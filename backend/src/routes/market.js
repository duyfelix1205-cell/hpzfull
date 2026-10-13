import express from 'express';
import { many, one } from '../db.js';
import { marketPhaseSql, publicMarketVisibilitySql } from '../lib/market-visibility.js';

const router=express.Router();
const clean=v=>String(v??'').trim();
const publicSelect=`
  SELECT p.post_id,p.slug,p.title,p.category,p.description,p.price_amount,p.price_text,p.currency,
         p.location_text,p.seller_display_name,
         CASE WHEN p.contact_public THEN p.seller_contact ELSE NULL END AS seller_contact,
         p.contact_public,p.seller_avatar_url,p.seller_verified,p.author_user_id,p.featured,p.is_sold,p.sold_at,p.sold_visibility_until,
         ${marketPhaseSql('p')} AS market_phase,p.allow_shipping,p.warranty_text,p.image_urls,p.tags,
         p.created_at,p.published_at
    FROM catalog_market_post p`;

router.get('/posts',async(req,res,next)=>{
  try{
    const where=[publicMarketVisibilitySql('p')];
    const values=[];
    if(clean(req.query.q)){
      values.push(`%${clean(req.query.q)}%`);
      where.push(`unaccent(lower(concat_ws(' ',p.title,p.description,p.category,p.location_text,p.seller_display_name))) LIKE unaccent(lower($${values.length}))`);
    }
    if(clean(req.query.category)){
      values.push(clean(req.query.category));
      where.push(`p.category=$${values.length}`);
    }
    if(String(req.query.featured||'').toLowerCase()==='true') where.push('p.featured=true');
    const rows=await many(`${publicSelect} WHERE ${where.join(' AND ')} ORDER BY p.featured DESC,p.is_sold ASC,p.published_at DESC NULLS LAST,p.created_at DESC LIMIT 200`,values);
    res.json({items:rows});
  }catch(error){next(error)}
});

router.get('/categories',async(_req,res,next)=>{
  try{
    const rows=await many(`SELECT p.category,count(*)::int count FROM catalog_market_post p WHERE ${publicMarketVisibilitySql('p')} GROUP BY p.category ORDER BY count(*) DESC,p.category`);
    res.json({items:rows});
  }catch(error){next(error)}
});

router.get('/posts/:ref',async(req,res,next)=>{
  try{
    const item=await one(`${publicSelect} WHERE ${publicMarketVisibilitySql('p')} AND (p.post_id::text=$1 OR p.slug=$1) LIMIT 1`,[req.params.ref]);
    if(!item)return res.status(404).json({error:{code:'MARKET_POST_NOT_FOUND',message:'Tin ZWMarket không tồn tại'}});
    res.json(item);
  }catch(error){next(error)}
});

export default router;
