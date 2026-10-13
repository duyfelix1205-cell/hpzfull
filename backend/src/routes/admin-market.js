import express from 'express';
import { many, one } from '../db.js';
import { AppError } from '../lib/errors.js';
import { DEFAULT_SOLD_VISIBILITY_HOURS, HIDDEN_ACTIONS, normalizeHiddenAction } from '../lib/market-visibility.js';

const router=express.Router();
const clean=v=>String(v??'').trim();
const slugify=v=>clean(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100);
const jsonArray=v=>Array.isArray(v)?v.map(clean).filter(Boolean):[];
const numberOrNull=v=>v===''||v===null||v===undefined?null:Number(v);

router.get('/',async(req,res,next)=>{
  try{
    const values=[];
    const where=[];
    if(clean(req.query.q)){
      values.push(`%${clean(req.query.q)}%`);
      where.push(`unaccent(lower(concat_ws(' ',title,description,category,location_text,seller_display_name,seller_contact))) LIKE unaccent(lower($${values.length}))`);
    }
    if(clean(req.query.status)){
      values.push(clean(req.query.status).toUpperCase());
      where.push(`publish_status=$${values.length}`);
    }
    if(clean(req.query.moderation)){
      values.push(clean(req.query.moderation).toUpperCase());
      where.push(`moderation_status=$${values.length}`);
    }
    const rows=await many(`SELECT * FROM catalog_market_post ${where.length?`WHERE ${where.join(' AND ')}`:''} ORDER BY updated_at DESC,created_at DESC LIMIT 300`,values);
    res.json({items:rows});
  }catch(error){next(error)}
});

router.get('/:id',async(req,res,next)=>{
  try{
    const item=await one('SELECT * FROM catalog_market_post WHERE post_id=$1',[req.params.id]);
    if(!item)return res.status(404).json({error:{code:'MARKET_POST_NOT_FOUND',message:'Tin ZWMarket không tồn tại'}});
    res.json(item);
  }catch(error){next(error)}
});

router.post('/',async(req,res,next)=>{
  try{
    const title=clean(req.body.title)||'Tin ZWMarket mới';
    const slugBase=slugify(req.body.slug||title)||`tin-${Date.now()}`;
    const item=await one(`INSERT INTO catalog_market_post(
      slug,title,category,description,price_amount,price_text,location_text,seller_display_name,seller_contact,contact_public,seller_avatar_url,
      seller_verified,author_user_id,submission_source,moderation_status,publish_status,featured,is_sold,sold_at,sold_visibility_until,allow_shipping,warranty_text,image_urls,tags
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'ADMIN','APPROVED','DRAFT',$14,$15,
      CASE WHEN $15 THEN now() ELSE NULL END,
      CASE WHEN $15 THEN now()+($20::int * interval '1 hour') ELSE NULL END,
      $16,$17,$18::jsonb,$19::jsonb) RETURNING *`,[
      `${slugBase}-${Date.now().toString(36)}`,title,clean(req.body.category)||'Khác',clean(req.body.description),numberOrNull(req.body.price_amount),clean(req.body.price_text)||null,
      clean(req.body.location_text)||null,clean(req.body.seller_display_name),clean(req.body.seller_contact)||null,Boolean(req.body.contact_public),clean(req.body.seller_avatar_url)||null,
      Boolean(req.body.seller_verified),clean(req.body.author_user_id)||null,Boolean(req.body.featured),Boolean(req.body.is_sold),Boolean(req.body.allow_shipping),clean(req.body.warranty_text)||null,
      JSON.stringify(jsonArray(req.body.image_urls)),JSON.stringify(jsonArray(req.body.tags)),DEFAULT_SOLD_VISIBILITY_HOURS
    ]);
    res.status(201).json(item);
  }catch(error){next(error)}
});

router.put('/:id',async(req,res,next)=>{
  try{
    const existing=await one('SELECT * FROM catalog_market_post WHERE post_id=$1',[req.params.id]);
    if(!existing)return res.status(404).json({error:{code:'MARKET_POST_NOT_FOUND',message:'Tin ZWMarket không tồn tại'}});
    const slug=slugify(req.body.slug||existing.slug||req.body.title)||existing.slug;
    const item=await one(`UPDATE catalog_market_post SET
      slug=$2,title=$3,category=$4,description=$5,price_amount=$6,price_text=$7,location_text=$8,seller_display_name=$9,seller_contact=$10,
      contact_public=$11,seller_avatar_url=$12,seller_verified=$13,author_user_id=$14,featured=$15,is_sold=$16,
      sold_at=CASE WHEN $16 THEN COALESCE(sold_at,now()) ELSE NULL END,
      sold_visibility_until=CASE WHEN $16 THEN COALESCE($21::timestamptz,sold_visibility_until,now()+($22::int * interval '1 hour')) ELSE NULL END,
      allow_shipping=$17,warranty_text=$18,image_urls=$19::jsonb,tags=$20::jsonb,updated_at=now()
      WHERE post_id=$1 RETURNING *`,[
      req.params.id,slug,clean(req.body.title)||existing.title,clean(req.body.category)||'Khác',clean(req.body.description),numberOrNull(req.body.price_amount),clean(req.body.price_text)||null,
      clean(req.body.location_text)||null,clean(req.body.seller_display_name),clean(req.body.seller_contact)||null,Boolean(req.body.contact_public),clean(req.body.seller_avatar_url)||null,
      Boolean(req.body.seller_verified),clean(req.body.author_user_id)||null,Boolean(req.body.featured),Boolean(req.body.is_sold),Boolean(req.body.allow_shipping),clean(req.body.warranty_text)||null,
      JSON.stringify(jsonArray(req.body.image_urls)),JSON.stringify(jsonArray(req.body.tags)),clean(req.body.sold_visibility_until)||null,DEFAULT_SOLD_VISIBILITY_HOURS
    ]);
    res.json(item);
  }catch(error){next(error)}
});

router.post('/:id/publish',async(req,res,next)=>{
  try{
    const item=await one(`UPDATE catalog_market_post SET moderation_status='APPROVED',publish_status='PUBLISHED',moderation_note=NULL,hidden_action=NULL,published_at=COALESCE(published_at,now()),updated_at=now() WHERE post_id=$1 RETURNING *`,[req.params.id]);
    if(!item)return res.status(404).json({error:{code:'MARKET_POST_NOT_FOUND',message:'Tin ZWMarket không tồn tại'}});
    res.json(item);
  }catch(error){next(error)}
});

router.post('/:id/unpublish',async(req,res,next)=>{
  try{
    const requested=clean(req.body?.action).toUpperCase();
    if(requested&&!HIDDEN_ACTIONS.includes(requested))throw new AppError('Hành động Hidden không hợp lệ.',{code:'MARKET_HIDDEN_ACTION_INVALID'});
    const action=normalizeHiddenAction(requested);
    const note=clean(req.body?.note)||'Bài đã được Admin ẩn khỏi ZWMarket.';
    const item=await one(`UPDATE catalog_market_post SET
      publish_status='HIDDEN',moderation_note=$2,hidden_action=$3,updated_at=now()
      WHERE post_id=$1 RETURNING *`,[req.params.id,note,action]);
    if(!item)return res.status(404).json({error:{code:'MARKET_POST_NOT_FOUND',message:'Tin ZWMarket không tồn tại'}});
    res.json(item);
  }catch(error){next(error)}
});

router.delete('/:id',async(req,res,next)=>{
  try{
    const item=await one('DELETE FROM catalog_market_post WHERE post_id=$1 RETURNING post_id',[req.params.id]);
    if(!item)return res.status(404).json({error:{code:'MARKET_POST_NOT_FOUND',message:'Tin ZWMarket không tồn tại'}});
    res.json({ok:true,post_id:item.post_id});
  }catch(error){next(error)}
});

export default router;
