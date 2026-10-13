import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { many, one, pool, tx } from '../db.js';
import { AppError } from '../lib/errors.js';
import { catalogContentPatch, isIncompleteContent } from '../lib/catalog-content.js';
import { safeMediaPath } from '../lib/media.js';
import { config } from '../config.js';

const router = Router();
const baseSelect = `
  SELECT s.product_id,s.product_name,s.sale_status,s.available_qty,s.list_price,s.price_text,
         s.combo_prices_json,s.combo_prices_text_json,s.product_code,s.branch_availability_json,
         s.source_updated_at,s.inventory_updated_at,s.synced_at,s.source_kind,s.product_type,
         c.slug,c.secondary_name,c.short_description,c.description,c.origin,c.size_text,c.temperament,c.care_info,
         c.selling_points_json,c.display_sections_json,c.video_url,c.publish_status,c.featured,c.sort_order,c.stock_display_mode,
         c.seo_title,c.seo_description,c.created_at AS content_created_at,c.updated_at AS content_updated_at
  FROM catalog_product_source s JOIN catalog_content c USING(product_id)`;
const listSelect = `
  SELECT s.product_id,s.product_name,s.sale_status,s.available_qty,s.list_price,s.price_text,s.source_kind,s.product_type,
         c.slug,c.secondary_name,c.publish_status,c.featured,c.sort_order,
         (c.slug IS NULL OR btrim(COALESCE(c.short_description,''))='' OR btrim(COALESCE(c.description,''))='') AS incomplete
  FROM catalog_product_source s JOIN catalog_content c USING(product_id)`;

const slugify=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120)||'fish';
const generatedId=()=>`PRD-LOCAL-${randomUUID().replace(/-/g,'').slice(0,12).toUpperCase()}`;
const nullableNumber=value=>value===null||value===undefined||value===''?null:Number(value);

function filterClause(filter) {
  switch (String(filter || 'all').toLowerCase()) {
    case 'draft': return `c.publish_status='DRAFT'`;
    case 'published': return `c.publish_status='PUBLISHED'`;
    case 'hidden': return `c.publish_status='HIDDEN'`;
    case 'out_of_stock': return `COALESCE(s.available_qty,0)<=0`;
    case 'incomplete': return `(c.slug IS NULL OR btrim(COALESCE(c.short_description,''))='' OR btrim(COALESCE(c.description,''))='')`;
    case 'all': return 'TRUE';
    default: throw new AppError('Invalid admin product filter', { code: 'CATALOG_FILTER_INVALID' });
  }
}

router.get('/', async (req, res, next) => {
  try {
    const params = [];
    const where = [filterClause(req.query.filter)];
    const q = String(req.query.q || '').trim().toLowerCase();
    if (q) {
      params.push(`%${q}%`);
      where.push(`(lower(s.product_id) LIKE $${params.length} OR lower(s.product_name) LIKE $${params.length} OR lower(COALESCE(s.product_code,'')) LIKE $${params.length} OR lower(COALESCE(c.secondary_name,'')) LIKE $${params.length})`);
    }
    const rows = await many(`${listSelect} WHERE ${where.join(' AND ')} ORDER BY c.sort_order,s.product_name`, params);
    res.set('Cache-Control','no-store');
    res.json({ items: rows });
  } catch (error) { next(error); }
});

router.post('/', async (req,res,next)=>{
  try{
    if(!config.standaloneMode) throw new AppError('Standalone product creation is disabled',{code:'CATALOG_STANDALONE_DISABLED',status:409});
    const body=req.body||{}; const name=String(body.product_name||'').trim();
    if(!name) throw new AppError('Tên cá là bắt buộc',{code:'CATALOG_PRODUCT_NAME_REQUIRED'});
    const productId=String(body.product_id||generatedId()).trim();
    if(!/^PRD-[A-Za-z0-9._-]+$/.test(productId)) throw new AppError('product_id không hợp lệ',{code:'CATALOG_PRODUCT_ID_INVALID'});
    let slug=String(body.slug||slugify(name)).trim();
    const row=await tx(async client=>{
      await client.query(`INSERT INTO catalog_product_source(product_id,product_name,sale_status,available_qty,list_price,price_text,combo_prices_json,combo_prices_text_json,source_updated_at,inventory_updated_at,synced_at,sync_state,source_kind,product_type)
        VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,now(),now(),now(),'OK','LOCAL','FISH')`,[
        productId,name,String(body.sale_status||'ACTIVE').trim()||'ACTIVE',nullableNumber(body.available_qty),nullableNumber(body.list_price),String(body.price_text||'').trim()||null,
        JSON.stringify(body.combo_prices_json||{}),JSON.stringify(body.combo_prices_text_json||{})]);
      const taken=(await client.query('SELECT 1 FROM catalog_content WHERE slug=$1',[slug])).rows[0]; if(taken) slug=`${slug}-${productId.slice(-6).toLowerCase()}`;
      await client.query(`INSERT INTO catalog_content(product_id,slug,secondary_name,short_description,description,origin,size_text,temperament,care_info,display_sections_json,video_url,publish_status,featured,sort_order,stock_display_mode)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,'DRAFT',$12,$13,$14)
        ON CONFLICT(product_id) DO UPDATE SET
          slug=EXCLUDED.slug,
          secondary_name=EXCLUDED.secondary_name,
          short_description=EXCLUDED.short_description,
          description=EXCLUDED.description,
          origin=EXCLUDED.origin,
          size_text=EXCLUDED.size_text,
          temperament=EXCLUDED.temperament,
          care_info=EXCLUDED.care_info,
          display_sections_json=EXCLUDED.display_sections_json,
          video_url=EXCLUDED.video_url,
          publish_status='DRAFT',
          featured=EXCLUDED.featured,
          sort_order=EXCLUDED.sort_order,
          stock_display_mode=EXCLUDED.stock_display_mode,
          updated_at=now()`,[
        productId,slug,String(body.secondary_name||'').trim()||null,String(body.short_description||'').trim()||null,String(body.description||'').trim()||null,
        String(body.origin||'').trim()||null,String(body.size_text||'').trim()||null,String(body.temperament||'').trim()||null,String(body.care_info||'').trim()||null,
        JSON.stringify(body.display_sections_json||[]),String(body.video_url||'').trim()||null,Boolean(body.featured),Number(body.sort_order||0),String(body.stock_display_mode||'HIDDEN')]);
      return (await client.query(`${baseSelect} WHERE s.product_id=$1`,[productId])).rows[0];
    });
    res.status(201).json({...row,incomplete:isIncompleteContent(row)});
  }catch(error){if(error.code==='23505'){const constraint=String(error.constraint||'');const isSlug=constraint.includes('slug');return next(new AppError(isSlug?'Slug đã tồn tại':'product_id đã tồn tại',{code:isSlug?'CATALOG_SLUG_CONFLICT':'CATALOG_PRODUCT_CONFLICT',status:409}))}next(error)}
});

router.get('/:productId', async (req, res, next) => {
  try {
    const row = await one(`${baseSelect} WHERE s.product_id=$1`, [req.params.productId]);
    if (!row) throw new AppError('Product not found', { code: 'NOT_FOUND', status: 404 });
    res.json({ ...row, incomplete: isIncompleteContent(row) });
  } catch (error) { next(error); }
});

router.put('/:productId/source',async(req,res,next)=>{
  try{
    const current=await one('SELECT * FROM catalog_product_source WHERE product_id=$1',[req.params.productId]);
    if(!current)throw new AppError('Product not found',{code:'NOT_FOUND',status:404});
    if(!config.standaloneMode && current.source_kind!=='LOCAL')throw new AppError('Chỉ được sửa dữ liệu nguồn của sản phẩm LOCAL',{code:'CATALOG_SOURCE_READONLY',status:409});
    const b=req.body||{}; const name=String(b.product_name??current.product_name).trim(); if(!name)throw new AppError('Tên cá là bắt buộc',{code:'CATALOG_PRODUCT_NAME_REQUIRED'});
    const row=(await pool.query(`UPDATE catalog_product_source SET product_name=$2,sale_status=$3,available_qty=$4,list_price=$5,price_text=$6,combo_prices_json=$7::jsonb,combo_prices_text_json=$8::jsonb,source_updated_at=now(),inventory_updated_at=now(),synced_at=now() WHERE product_id=$1 RETURNING *`,[
      req.params.productId,name,String(b.sale_status??current.sale_status),nullableNumber(b.available_qty??current.available_qty),nullableNumber(b.list_price??current.list_price),String(b.price_text??current.price_text??'').trim()||null,
      JSON.stringify(b.combo_prices_json??current.combo_prices_json??{}),JSON.stringify(b.combo_prices_text_json??current.combo_prices_text_json??{})])).rows[0];
    res.json(row);
  }catch(error){next(error)}
});

router.put('/:productId/content', async (req, res, next) => {
  try {
    const productId = req.params.productId;
    const source = await one(`SELECT product_id FROM catalog_product_source WHERE product_id=$1`, [productId]);
    if (!source) throw new AppError('Product not found', { code: 'NOT_FOUND', status: 404 });
    const patch = catalogContentPatch(req.body || {});
    const fields = Object.keys(patch);
    if (!fields.length) throw new AppError('No editable Catalog fields supplied', { code: 'CATALOG_CONTENT_EMPTY' });
    const params = [productId];
    const sets = fields.map(field => {
      const jsonField = field === 'selling_points_json' || field === 'display_sections_json';
      params.push(jsonField ? JSON.stringify(patch[field]) : patch[field]);
      return `${field}=$${params.length}${jsonField ? '::jsonb' : ''}`;
    });
    try {
      const row = (await pool.query(`UPDATE catalog_content SET ${sets.join(',')},updated_at=now() WHERE product_id=$1 RETURNING *`, params)).rows[0];
      res.json(row);
    } catch (error) {
      if (error.code === '23505') throw new AppError('Slug already exists', { code: 'CATALOG_SLUG_CONFLICT', status: 409 });
      throw error;
    }
  } catch (error) { next(error); }
});

router.post('/:productId/publish', async (req, res, next) => {
  try {
    const current = await one(`SELECT * FROM catalog_content WHERE product_id=$1`, [req.params.productId]);
    if (!current) throw new AppError('Product not found', { code: 'NOT_FOUND', status: 404 });
    if (isIncompleteContent(current)) throw new AppError('Cần slug, mô tả ngắn và mô tả đầy đủ trước khi publish', { code: 'CATALOG_PUBLISH_INCOMPLETE', status: 409 });
    res.json((await pool.query(`UPDATE catalog_content SET publish_status='PUBLISHED',updated_at=now() WHERE product_id=$1 RETURNING *`, [req.params.productId])).rows[0]);
  } catch (error) { next(error); }
});

router.post('/:productId/unpublish', async (req, res, next) => {
  try {
    const row = (await pool.query(`UPDATE catalog_content SET publish_status='DRAFT',updated_at=now() WHERE product_id=$1 RETURNING *`, [req.params.productId])).rows[0];
    if (!row) throw new AppError('Product not found', { code: 'NOT_FOUND', status: 404 });
    res.json(row);
  } catch (error) { next(error); }
});

router.delete('/:productId',async(req,res,next)=>{
  try{
    const src=await one('SELECT source_kind FROM catalog_product_source WHERE product_id=$1',[req.params.productId]);
    if(!src)throw new AppError('Product not found',{code:'NOT_FOUND',status:404});
    if(!config.standaloneMode && src.source_kind!=='LOCAL')throw new AppError('Không được xóa sản phẩm nguồn Orders',{code:'CATALOG_SOURCE_READONLY',status:409});
    const media=await many('SELECT storage_key FROM catalog_media WHERE product_id=$1',[req.params.productId]);
    await pool.query('DELETE FROM catalog_product_source WHERE product_id=$1',[req.params.productId]);
    await Promise.all(media.map(m=>unlink(safeMediaPath(config.mediaRoot,m.storage_key)).catch(()=>{})));
    res.json({ok:true,product_id:req.params.productId});
  }catch(error){next(error)}
});

export default router;
