import { Router } from 'express';
import { many, one, query } from '../db.js';
import { normalizeSearch,SEARCH_TRANSLATE_FROM,SEARCH_TRANSLATE_TO } from '../lib/search.js';
import { requireTaxonomyDefinition } from '../lib/content-taxonomy.js';

const router=Router();
const clip=(value,max)=>String(value??'').trim().slice(0,max);

router.get('/taxonomy/:scope',async(req,res,next)=>{try{
  const spec=requireTaxonomyDefinition(req.params.scope);
  const items=await many(`SELECT option_value,label,sort_order
    FROM catalog_content_taxonomy_option
    WHERE scope=$1 AND active=true
    ORDER BY sort_order,label,option_value`,[spec.scope]);
  res.json({scope:req.params.scope,default_value:spec.defaultValue,items});
}catch(e){next(e)}});

router.get('/journal',async(req,res,next)=>{try{
  const q=normalizeSearch(req.query.q,120);
  const items=await many(`SELECT j.journal_id,j.entry_type,COALESCE(t.label,j.entry_type) AS entry_type_label,j.title,j.slug,j.summary,j.image_url,j.cta_label,j.cta_url,j.starts_at,j.ends_at,j.featured,j.sort_order,j.updated_at
    FROM catalog_journal_entry j
    LEFT JOIN catalog_content_taxonomy_option t ON t.scope='JOURNAL_TYPE' AND t.option_value=j.entry_type AND t.active=true
    WHERE j.publish_status='PUBLISHED'
      AND ($1='' OR translate(lower(COALESCE(j.title,'')),$2,$3) LIKE '%'||$1||'%'
        OR translate(lower(COALESCE(j.slug,'')),$2,$3) LIKE '%'||$1||'%'
        OR translate(lower(COALESCE(j.summary,'')),$2,$3) LIKE '%'||$1||'%'
        OR translate(lower(COALESCE(j.content,'')),$2,$3) LIKE '%'||$1||'%'
        OR translate(lower(COALESCE(j.cta_label,'')),$2,$3) LIKE '%'||$1||'%'
        OR translate(lower(COALESCE(j.entry_type,'')),$2,$3) LIKE '%'||$1||'%'
        OR translate(lower(COALESCE(t.label,'')),$2,$3) LIKE '%'||$1||'%')
    ORDER BY j.featured DESC,j.sort_order ASC,COALESCE(j.starts_at,j.created_at) DESC,j.created_at DESC`,[q,SEARCH_TRANSLATE_FROM,SEARCH_TRANSLATE_TO]);
  res.json({items});
}catch(e){next(e)}});

router.get('/journal/:slug',async(req,res,next)=>{try{
  const item=await one(`SELECT j.journal_id,j.entry_type,COALESCE(t.label,j.entry_type) AS entry_type_label,j.title,j.slug,j.summary,j.content,j.image_url,j.cta_label,j.cta_url,j.starts_at,j.ends_at,j.featured,j.sort_order,j.updated_at
    FROM catalog_journal_entry j
    LEFT JOIN catalog_content_taxonomy_option t ON t.scope='JOURNAL_TYPE' AND t.option_value=j.entry_type AND t.active=true
    WHERE j.slug=$1 AND j.publish_status='PUBLISHED'`,[req.params.slug]);
  if(!item){const e=new Error('Journal entry not found');e.status=404;throw e}
  res.json(item);
}catch(e){next(e)}});

router.get('/wiki',async(req,res,next)=>{try{
  const q=normalizeSearch(req.query.q,120),category=clip(req.query.category,160);
  const items=await many(`SELECT w.article_id,w.title,w.slug,w.category,COALESCE(t.label,w.category) AS category_label,w.summary,w.image_url,w.featured,w.sort_order,w.updated_at
    FROM catalog_wiki_article w
    LEFT JOIN catalog_content_taxonomy_option t ON t.scope='WIKI_CATEGORY' AND t.option_value=w.category AND t.active=true
    WHERE w.publish_status='PUBLISHED'
      AND ($1='' OR translate(lower(COALESCE(w.title,'')),$2,$3) LIKE '%'||$1||'%'
        OR translate(lower(COALESCE(w.slug,'')),$2,$3) LIKE '%'||$1||'%'
        OR translate(lower(COALESCE(w.summary,'')),$2,$3) LIKE '%'||$1||'%'
        OR translate(lower(COALESCE(w.content,'')),$2,$3) LIKE '%'||$1||'%'
        OR translate(lower(COALESCE(w.category,'')),$2,$3) LIKE '%'||$1||'%'
        OR translate(lower(COALESCE(t.label,'')),$2,$3) LIKE '%'||$1||'%')
      AND ($4='' OR w.category=$4)
    ORDER BY w.featured DESC,w.sort_order ASC,w.updated_at DESC`,[q,SEARCH_TRANSLATE_FROM,SEARCH_TRANSLATE_TO,category]);
  res.json({items});
}catch(e){next(e)}});

router.get('/wiki/:slug',async(req,res,next)=>{try{
  const item=await one(`SELECT w.article_id,w.title,w.slug,w.category,COALESCE(t.label,w.category) AS category_label,w.summary,w.content,w.image_url,w.featured,w.sort_order,w.updated_at
    FROM catalog_wiki_article w
    LEFT JOIN catalog_content_taxonomy_option t ON t.scope='WIKI_CATEGORY' AND t.option_value=w.category AND t.active=true
    WHERE w.slug=$1 AND w.publish_status='PUBLISHED'`,[req.params.slug]);
  if(!item){const e=new Error('Wiki article not found');e.status=404;throw e}
  res.json(item);
}catch(e){next(e)}});

router.post('/traffic/click',async(req,res,next)=>{try{
  const source=clip(req.body?.source_path,500)||'/';
  const target=clip(req.body?.target_path,1000);
  const label=clip(req.body?.link_label,160);
  if(!target){const e=new Error('target_path is required');e.status=400;throw e}
  await query(`INSERT INTO catalog_link_click_daily(event_date,source_path,target_path,link_label,click_count)
    VALUES((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,$1,$2,$3,1)
    ON CONFLICT(event_date,source_path,target_path,link_label)
    DO UPDATE SET click_count=catalog_link_click_daily.click_count+1,updated_at=now()`,[source,target,label]);
  res.status(202).json({accepted:true});
}catch(e){next(e)}});

export default router;
