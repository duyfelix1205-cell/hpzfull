import { Router } from 'express';
import { many, one, query, tx } from '../db.js';
import { normalizeSearch,SEARCH_TRANSLATE_FROM,SEARCH_TRANSLATE_TO } from '../lib/search.js';
import { requireTaxonomyDefinition,taxonomyOptionValue } from '../lib/content-taxonomy.js';

const router=Router();
const publishStates=new Set(['DRAFT','PUBLISHED','HIDDEN','ARCHIVED']);
const clip=(value,max)=>String(value??'').trim().slice(0,max);
const nullable=(value,max)=>{const v=clip(value,max);return v||null};
const slugify=value=>clip(value,180).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120);
const checkedStatus=value=>{const v=clip(value,30)||'DRAFT';if(!publishStates.has(v)){const e=new Error('Unsupported publish status');e.status=400;throw e}return v};
const conflict=e=>{if(e.code==='23505'){e.status=409;e.message='Value already exists'}throw e};

async function checkedTaxonomy(scope,value){
  const spec=requireTaxonomyDefinition(scope);
  const v=clip(value,160)||spec.defaultValue;
  const found=await one('SELECT option_value FROM catalog_content_taxonomy_option WHERE scope=$1 AND option_value=$2 AND active=true',[spec.scope,v]);
  if(!found){const e=new Error(`Unsupported ${spec.label}`);e.status=400;throw e}
  return found.option_value;
}

router.get('/taxonomy/:scope',async(req,res,next)=>{try{
  const spec=requireTaxonomyDefinition(req.params.scope);
  const items=await many(`SELECT o.option_id,o.option_value,o.label,o.sort_order,o.locked,o.active,
      COALESCE(u.usage_count,0)::int AS usage_count
    FROM catalog_content_taxonomy_option o
    LEFT JOIN (
      SELECT ${spec.column} AS option_value,count(*)::int AS usage_count
      FROM ${spec.table}
      GROUP BY ${spec.column}
    ) u ON u.option_value=o.option_value
    WHERE o.scope=$1
    ORDER BY o.active DESC,o.sort_order,o.label,o.option_value`,[spec.scope]);
  res.json({scope:req.params.scope,default_value:spec.defaultValue,items});
}catch(e){next(e)}});

router.post('/taxonomy/:scope',async(req,res,next)=>{try{
  const spec=requireTaxonomyDefinition(req.params.scope);
  const label=clip(req.body?.label,160);if(!label){const e=new Error('label is required');e.status=400;throw e}
  const optionValue=taxonomyOptionValue(req.params.scope,label);if(!optionValue){const e=new Error('option value is required');e.status=400;throw e}
  const row=await one(`INSERT INTO catalog_content_taxonomy_option(scope,option_value,label,sort_order,locked,active)
    VALUES($1,$2,$3,$4,false,true) RETURNING *`,[spec.scope,optionValue,label,Number(req.body?.sort_order||100)]);
  res.status(201).json({...row,usage_count:0});
}catch(e){try{conflict(e)}catch(x){next(x)}}});

router.put('/taxonomy/:scope/:id',async(req,res,next)=>{try{
  const spec=requireTaxonomyDefinition(req.params.scope);
  const current=await one('SELECT * FROM catalog_content_taxonomy_option WHERE option_id=$1 AND scope=$2',[req.params.id,spec.scope]);
  if(!current){const e=new Error('Taxonomy option not found');e.status=404;throw e}
  const label=clip(req.body?.label??current.label,160);if(!label){const e=new Error('label is required');e.status=400;throw e}
  const row=await one(`UPDATE catalog_content_taxonomy_option SET label=$1,sort_order=$2,updated_at=now()
    WHERE option_id=$3 AND scope=$4 RETURNING *`,[label,Number(req.body?.sort_order??current.sort_order??0),req.params.id,spec.scope]);
  const usage=await one(`SELECT count(*)::int AS usage_count FROM ${spec.table} WHERE ${spec.column}=$1`,[row.option_value]);
  res.json({...row,usage_count:Number(usage?.usage_count||0)});
}catch(e){next(e)}});

router.delete('/taxonomy/:scope/:id',async(req,res,next)=>{try{
  const spec=requireTaxonomyDefinition(req.params.scope);
  const result=await tx(async client=>{
    const current=await one('SELECT * FROM catalog_content_taxonomy_option WHERE option_id=$1 AND scope=$2',[req.params.id,spec.scope],client);
    if(!current){const e=new Error('Taxonomy option not found');e.status=404;throw e}
    if(current.locked||current.option_value===spec.defaultValue){const e=new Error('Default option cannot be deleted');e.status=409;throw e}
    const moved=await query(`UPDATE ${spec.table} SET ${spec.column}=$1,updated_at=now() WHERE ${spec.column}=$2`,[spec.defaultValue,current.option_value],client);
    await query('DELETE FROM catalog_content_taxonomy_option WHERE option_id=$1 AND scope=$2',[req.params.id,spec.scope],client);
    return{deleted:true,option_id:current.option_id,label:current.label,reassigned_count:moved.rowCount,default_value:spec.defaultValue};
  });
  res.json(result);
}catch(e){next(e)}});

router.get('/journal',async(req,res,next)=>{try{
  const q=normalizeSearch(req.query.q,120);
  const items=await many(`SELECT j.*,COALESCE(t.label,j.entry_type) AS entry_type_label
    FROM catalog_journal_entry j
    LEFT JOIN catalog_content_taxonomy_option t ON t.scope='JOURNAL_TYPE' AND t.option_value=j.entry_type
    WHERE ($1='' OR translate(lower(COALESCE(j.title,'')),$2,$3) LIKE '%'||$1||'%'
      OR translate(lower(COALESCE(j.slug,'')),$2,$3) LIKE '%'||$1||'%'
      OR translate(lower(COALESCE(j.summary,'')),$2,$3) LIKE '%'||$1||'%'
      OR translate(lower(COALESCE(j.content,'')),$2,$3) LIKE '%'||$1||'%'
      OR translate(lower(COALESCE(j.cta_label,'')),$2,$3) LIKE '%'||$1||'%'
      OR translate(lower(COALESCE(j.entry_type,'')),$2,$3) LIKE '%'||$1||'%'
      OR translate(lower(COALESCE(t.label,'')),$2,$3) LIKE '%'||$1||'%')
    ORDER BY j.featured DESC,j.sort_order,j.updated_at DESC`,[q,SEARCH_TRANSLATE_FROM,SEARCH_TRANSLATE_TO]);
  res.json({items});
}catch(e){next(e)}});

router.post('/journal',async(req,res,next)=>{try{
  const title=clip(req.body?.title,240);if(!title){const e=new Error('title is required');e.status=400;throw e}
  const slug=slugify(req.body?.slug||title);if(!slug){const e=new Error('slug is required');e.status=400;throw e}
  const entryType=await checkedTaxonomy('journal-type',req.body?.entry_type);
  const row=await one(`INSERT INTO catalog_journal_entry(entry_type,title,slug,summary,content,image_url,cta_label,cta_url,starts_at,ends_at,publish_status,featured,sort_order)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,[
      entryType,title,slug,nullable(req.body?.summary,1000),nullable(req.body?.content,50000),nullable(req.body?.image_url,2000),nullable(req.body?.cta_label,160),nullable(req.body?.cta_url,2000),req.body?.starts_at||null,req.body?.ends_at||null,checkedStatus(req.body?.publish_status),Boolean(req.body?.featured),Number(req.body?.sort_order||0)
    ]);
  const option=await one("SELECT label FROM catalog_content_taxonomy_option WHERE scope='JOURNAL_TYPE' AND option_value=$1",[entryType]);
  res.status(201).json({...row,entry_type_label:option?.label||entryType});
}catch(e){try{conflict(e)}catch(x){next(x)}}});

router.put('/journal/:id',async(req,res,next)=>{try{
  const current=await one('SELECT * FROM catalog_journal_entry WHERE journal_id=$1',[req.params.id]);if(!current){const e=new Error('Journal entry not found');e.status=404;throw e}
  const title=clip(req.body?.title??current.title,240),slug=slugify(req.body?.slug??current.slug),entryType=await checkedTaxonomy('journal-type',req.body?.entry_type??current.entry_type);
  const row=await one(`UPDATE catalog_journal_entry SET entry_type=$1,title=$2,slug=$3,summary=$4,content=$5,image_url=$6,cta_label=$7,cta_url=$8,starts_at=$9,ends_at=$10,publish_status=$11,featured=$12,sort_order=$13,updated_at=now() WHERE journal_id=$14 RETURNING *`,[
    entryType,title,slug,nullable(req.body?.summary??current.summary,1000),nullable(req.body?.content??current.content,50000),nullable(req.body?.image_url??current.image_url,2000),nullable(req.body?.cta_label??current.cta_label,160),nullable(req.body?.cta_url??current.cta_url,2000),req.body?.starts_at??current.starts_at,req.body?.ends_at??current.ends_at,checkedStatus(req.body?.publish_status??current.publish_status),Boolean(req.body?.featured??current.featured),Number(req.body?.sort_order??current.sort_order),req.params.id
  ]);
  const option=await one("SELECT label FROM catalog_content_taxonomy_option WHERE scope='JOURNAL_TYPE' AND option_value=$1",[entryType]);
  res.json({...row,entry_type_label:option?.label||entryType});
}catch(e){try{conflict(e)}catch(x){next(x)}}});

router.delete('/journal/:id',async(req,res,next)=>{try{const r=await query('DELETE FROM catalog_journal_entry WHERE journal_id=$1',[req.params.id]);if(!r.rowCount){const e=new Error('Journal entry not found');e.status=404;throw e}res.json({deleted:true})}catch(e){next(e)}});

router.get('/wiki',async(req,res,next)=>{try{
  const q=normalizeSearch(req.query.q,120);
  const items=await many(`SELECT w.*,COALESCE(t.label,w.category) AS category_label
    FROM catalog_wiki_article w
    LEFT JOIN catalog_content_taxonomy_option t ON t.scope='WIKI_CATEGORY' AND t.option_value=w.category
    WHERE ($1='' OR translate(lower(COALESCE(w.title,'')),$2,$3) LIKE '%'||$1||'%'
      OR translate(lower(COALESCE(w.slug,'')),$2,$3) LIKE '%'||$1||'%'
      OR translate(lower(COALESCE(w.category,'')),$2,$3) LIKE '%'||$1||'%'
      OR translate(lower(COALESCE(t.label,'')),$2,$3) LIKE '%'||$1||'%'
      OR translate(lower(COALESCE(w.summary,'')),$2,$3) LIKE '%'||$1||'%'
      OR translate(lower(COALESCE(w.content,'')),$2,$3) LIKE '%'||$1||'%')
    ORDER BY w.featured DESC,w.sort_order,w.updated_at DESC`,[q,SEARCH_TRANSLATE_FROM,SEARCH_TRANSLATE_TO]);
  res.json({items});
}catch(e){next(e)}});

router.post('/wiki',async(req,res,next)=>{try{
  const title=clip(req.body?.title,240);if(!title){const e=new Error('title is required');e.status=400;throw e}
  const slug=slugify(req.body?.slug||title);if(!slug){const e=new Error('slug is required');e.status=400;throw e}
  const category=await checkedTaxonomy('wiki-category',req.body?.category);
  const row=await one(`INSERT INTO catalog_wiki_article(title,slug,category,summary,content,image_url,publish_status,featured,sort_order)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[
      title,slug,category,nullable(req.body?.summary,1000),nullable(req.body?.content,50000),nullable(req.body?.image_url,2000),checkedStatus(req.body?.publish_status),Boolean(req.body?.featured),Number(req.body?.sort_order||0)
    ]);
  const option=await one("SELECT label FROM catalog_content_taxonomy_option WHERE scope='WIKI_CATEGORY' AND option_value=$1",[category]);
  res.status(201).json({...row,category_label:option?.label||category});
}catch(e){try{conflict(e)}catch(x){next(x)}}});

router.put('/wiki/:id',async(req,res,next)=>{try{
  const current=await one('SELECT * FROM catalog_wiki_article WHERE article_id=$1',[req.params.id]);if(!current){const e=new Error('Wiki article not found');e.status=404;throw e}
  const title=clip(req.body?.title??current.title,240),slug=slugify(req.body?.slug??current.slug),category=await checkedTaxonomy('wiki-category',req.body?.category??current.category);
  const row=await one(`UPDATE catalog_wiki_article SET title=$1,slug=$2,category=$3,summary=$4,content=$5,image_url=$6,publish_status=$7,featured=$8,sort_order=$9,updated_at=now() WHERE article_id=$10 RETURNING *`,[
    title,slug,category,nullable(req.body?.summary??current.summary,1000),nullable(req.body?.content??current.content,50000),nullable(req.body?.image_url??current.image_url,2000),checkedStatus(req.body?.publish_status??current.publish_status),Boolean(req.body?.featured??current.featured),Number(req.body?.sort_order??current.sort_order),req.params.id
  ]);
  const option=await one("SELECT label FROM catalog_content_taxonomy_option WHERE scope='WIKI_CATEGORY' AND option_value=$1",[category]);
  res.json({...row,category_label:option?.label||category});
}catch(e){try{conflict(e)}catch(x){next(x)}}});

router.delete('/wiki/:id',async(req,res,next)=>{try{const r=await query('DELETE FROM catalog_wiki_article WHERE article_id=$1',[req.params.id]);if(!r.rowCount){const e=new Error('Wiki article not found');e.status=404;throw e}res.json({deleted:true})}catch(e){next(e)}});

router.get('/traffic',async(req,res,next)=>{try{
  const days=Math.min(365,Math.max(1,Number(req.query.days)||30));
  const total=await one(`SELECT COALESCE(sum(click_count),0)::bigint AS clicks FROM catalog_link_click_daily WHERE event_date >= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - ($1::int - 1)`,[days]);
  const daily=await many(`SELECT event_date,COALESCE(sum(click_count),0)::bigint AS clicks FROM catalog_link_click_daily WHERE event_date >= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - ($1::int - 1) GROUP BY event_date ORDER BY event_date`,[days]);
  const links=await many(`SELECT target_path,link_label,COALESCE(sum(click_count),0)::bigint AS clicks FROM catalog_link_click_daily WHERE event_date >= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - ($1::int - 1) GROUP BY target_path,link_label ORDER BY clicks DESC,target_path LIMIT 50`,[days]);
  const sources=await many(`SELECT source_path,COALESCE(sum(click_count),0)::bigint AS clicks FROM catalog_link_click_daily WHERE event_date >= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - ($1::int - 1) GROUP BY source_path ORDER BY clicks DESC,source_path LIMIT 30`,[days]);
  res.json({days,total_clicks:Number(total?.clicks||0),daily:daily.map(x=>({...x,clicks:Number(x.clicks)})),links:links.map(x=>({...x,clicks:Number(x.clicks)})),sources:sources.map(x=>({...x,clicks:Number(x.clicks)}))});
}catch(e){next(e)}});

export default router;
