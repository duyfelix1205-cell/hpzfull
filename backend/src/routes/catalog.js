import { Router } from 'express';
import { many, one } from '../db.js';
import { config } from '../config.js';
import { mediaPublicUrl } from '../lib/media.js';
import { stockFreshness } from '../lib/freshness.js';
import { normalizeSearch,SEARCH_TRANSLATE_FROM,SEARCH_TRANSLATE_TO } from '../lib/search.js';

const router = Router();
const decorateFreshness = row => row.source_kind==='LOCAL'
  ? { ...row, stock_stale:false, stock_age_seconds:null }
  : ({ ...row, ...stockFreshness({ inventoryUpdatedAt:row.inventory_updated_at, syncedAt:row.synced_at, thresholdSeconds:config.stockStaleSeconds }) });

router.get('/products', async (req,res,next) => {
  try {
    const params=[]; const where=[`COALESCE(c.publish_status,'DRAFT')='PUBLISHED'`];
    const q=normalizeSearch(req.query.q,120);
    if(q){
      params.push(q,SEARCH_TRANSLATE_FROM,SEARCH_TRANSLATE_TO);
      const qParam=params.length-2,fromParam=params.length-1,toParam=params.length;
      where.push(`(translate(lower(COALESCE(s.product_name,'')),$${fromParam},$${toParam}) LIKE '%'||$${qParam}||'%' OR translate(lower(COALESCE(c.secondary_name,'')),$${fromParam},$${toParam}) LIKE '%'||$${qParam}||'%' OR translate(lower(COALESCE(c.short_description,'')),$${fromParam},$${toParam}) LIKE '%'||$${qParam}||'%' OR translate(lower(COALESCE(s.product_code,'')),$${fromParam},$${toParam}) LIKE '%'||$${qParam}||'%')`);
    }
    if(req.query.category){params.push(String(req.query.category).trim().toLowerCase());where.push(`EXISTS(SELECT 1 FROM catalog_product_category pc JOIN catalog_category cat USING(category_id) WHERE pc.product_id=s.product_id AND cat.slug=$${params.length} AND cat.status='ACTIVE')`);}
    if(req.query.sale_status){const status=String(req.query.sale_status).trim().toUpperCase();if(!/^[A-Z0-9 _/-]{1,40}$/.test(status))return res.status(400).json({error:{code:'INVALID_SALE_STATUS',message:'Invalid sale_status'}});if(status==='STOCK')where.push(`UPPER(BTRIM(COALESCE(s.sale_status,''))) ~ '^STOCK($|[[:space:]_/-])'`);else{params.push(status);where.push(`UPPER(BTRIM(COALESCE(s.sale_status,'')))=$${params.length}`);}}
    const rows=await many(`SELECT s.product_id,c.slug,s.product_name AS name,c.secondary_name,c.short_description,c.size_text,s.sale_status,s.available_qty,s.list_price,s.price_text,s.combo_prices_json,s.combo_prices_text_json,s.source_kind,c.featured,c.stock_display_mode,s.inventory_updated_at,s.synced_at,COALESCE((SELECT jsonb_agg(jsonb_build_object('variant_id',v.variant_id,'size_label',v.size_label,'list_price',v.list_price,'price_text',v.price_text,'combo_prices_json',v.combo_prices_json,'combo_prices_text_json',v.combo_prices_text_json,'available_qty',v.available_qty,'sort_order',v.sort_order,'is_active',v.is_active) ORDER BY v.sort_order,v.created_at) FROM catalog_product_size_variant v WHERE v.product_id=s.product_id AND v.is_active),'[]'::jsonb) AS size_variants,m.storage_key AS primary_storage_key,ARRAY(SELECT jsonb_build_object('name',cat.name,'slug',cat.slug) FROM catalog_product_category pc JOIN catalog_category cat USING(category_id) WHERE pc.product_id=s.product_id AND cat.status='ACTIVE' ORDER BY cat.sort_order,cat.name) AS categories FROM catalog_product_source s JOIN catalog_content c USING(product_id) LEFT JOIN LATERAL (SELECT storage_key FROM catalog_media WHERE product_id=s.product_id ORDER BY is_primary DESC,sort_order,created_at LIMIT 1) m ON true WHERE ${where.join(' AND ')} ORDER BY c.sort_order,s.product_name`,params);
    res.set('Cache-Control',q||req.query.sale_status?'no-store':'public, max-age=15, stale-while-revalidate=60');
    res.json({ stale_after_seconds:config.stockStaleSeconds, items:rows.map(({primary_storage_key,...row})=>decorateFreshness({...row,primary_image_url:primary_storage_key?mediaPublicUrl(primary_storage_key):null})) });
  } catch(error){next(error)}
});
router.get('/categories',async(_req,res,next)=>{try{res.set('Cache-Control','public, max-age=60, stale-while-revalidate=300');res.json({items:await many(`SELECT name,slug,sort_order FROM catalog_category WHERE status='ACTIVE' ORDER BY sort_order,name`)})}catch(error){next(error)}});
router.get('/products/:slug', async (req,res,next) => {
  try {
    const row=await one(`SELECT s.*,c.* FROM catalog_product_source s JOIN catalog_content c USING(product_id) WHERE c.slug=$1 AND c.publish_status='PUBLISHED'`,[req.params.slug]);
    if(!row)return res.status(404).json({error:{code:'NOT_FOUND',message:'Product not found'}});
    const media=await many(`SELECT media_id,media_type,storage_key,alt_text,sort_order,is_primary,mime_type,file_size FROM catalog_media WHERE product_id=$1 ORDER BY sort_order,created_at`,[row.product_id]);
    const categories=await many(`SELECT c.name,c.slug FROM catalog_category c JOIN catalog_product_category pc USING(category_id) WHERE pc.product_id=$1 AND c.status='ACTIVE' ORDER BY c.sort_order,c.name`,[row.product_id]);
    const size_variants=await many(`SELECT variant_id,size_label,list_price,price_text,combo_prices_json,combo_prices_text_json,available_qty,sort_order,is_active FROM catalog_product_size_variant WHERE product_id=$1 AND is_active=true ORDER BY sort_order,created_at`,[row.product_id]);
    res.set('Cache-Control','no-store');
    res.json(decorateFreshness({...row,categories,size_variants,media:media.map(({storage_key,...item})=>({...item,url:mediaPublicUrl(storage_key)}))}));
  } catch(error){next(error)}
});

router.get('/tanks',async(req,res,next)=>{try{const q=normalizeSearch(req.query.q,120);const rows=await many(`SELECT t.*,m.storage_key AS primary_storage_key,ARRAY(SELECT jsonb_build_object('name',c.name,'slug',c.slug) FROM catalog_tank_category_map cm JOIN catalog_tank_category c USING(category_id) WHERE cm.tank_id=t.tank_id AND c.status='ACTIVE' ORDER BY c.sort_order,c.name) AS categories FROM catalog_tank t LEFT JOIN LATERAL (SELECT storage_key FROM catalog_tank_media WHERE tank_id=t.tank_id ORDER BY is_primary DESC,sort_order,created_at LIMIT 1)m ON true WHERE t.publish_status='PUBLISHED' AND ($1='' OR translate(lower(COALESCE(t.name,'')),$2,$3) LIKE '%'||$1||'%' OR translate(lower(COALESCE(t.short_description,'')),$2,$3) LIKE '%'||$1||'%') ORDER BY t.sort_order,t.name`,[q,SEARCH_TRANSLATE_FROM,SEARCH_TRANSLATE_TO]);res.set('Cache-Control',q?'no-store':'public, max-age=15, stale-while-revalidate=60');res.json({items:rows.map(({primary_storage_key,...r})=>({...r,primary_image_url:primary_storage_key?mediaPublicUrl(primary_storage_key):null}))})}catch(e){next(e)}});
router.get('/tanks/:slug',async(req,res,next)=>{try{const row=await one(`SELECT * FROM catalog_tank WHERE slug=$1 AND publish_status='PUBLISHED'`,[req.params.slug]);if(!row)return res.status(404).json({error:{code:'NOT_FOUND',message:'Tank not found'}});const media=await many('SELECT media_id,storage_key,alt_text,sort_order,is_primary,mime_type,file_size FROM catalog_tank_media WHERE tank_id=$1 ORDER BY sort_order,created_at',[row.tank_id]);const categories=await many(`SELECT c.name,c.slug FROM catalog_tank_category c JOIN catalog_tank_category_map m USING(category_id) WHERE m.tank_id=$1 AND c.status='ACTIVE' ORDER BY c.sort_order,c.name`,[row.tank_id]);res.set('Cache-Control','no-store');res.json({...row,categories,media:media.map(({storage_key,...m})=>({...m,url:mediaPublicUrl(storage_key)}))})}catch(e){next(e)}});

export default router;
