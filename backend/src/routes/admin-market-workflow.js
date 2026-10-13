import express from 'express';
import { many, one } from '../db.js';
import { AppError } from '../lib/errors.js';

const router=express.Router();
const clean=v=>String(v??'').trim();
const slugify=v=>clean(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100);
const dateOrNull=v=>clean(v)||null;

router.get('/sessions',async(_req,res,next)=>{
  try{
    const items=await many(`
      SELECT s.*,
             (SELECT count(*)::int FROM catalog_market_session_post sp WHERE sp.session_id=s.session_id AND sp.removed_at IS NULL) AS post_count
        FROM catalog_market_session s
       ORDER BY CASE s.status WHEN 'OPEN' THEN 0 WHEN 'UPCOMING' THEN 1 WHEN 'DRAFT' THEN 2 ELSE 3 END,
                s.starts_at NULLS LAST,s.created_at DESC`);
    res.json({items});
  }catch(error){next(error)}
});

router.post('/sessions',async(req,res,next)=>{
  try{
    const name=clean(req.body.name)||'Phiên ZWMarket mới';
    const slugBase=slugify(req.body.slug||name)||'phien-zwmarket';
    const item=await one(`INSERT INTO catalog_market_session(slug,name,description,category,starts_at,ends_at,status)
      VALUES($1,$2,$3,$4,$5,$6,'DRAFT') RETURNING *`,[
      `${slugBase}-${Date.now().toString(36)}`,name,clean(req.body.description),clean(req.body.category)||null,
      dateOrNull(req.body.starts_at),dateOrNull(req.body.ends_at)
    ]);
    res.status(201).json(item);
  }catch(error){next(error)}
});

router.put('/sessions/:id',async(req,res,next)=>{
  try{
    const current=await one('SELECT * FROM catalog_market_session WHERE session_id=$1',[req.params.id]);
    if(!current)throw new AppError('Phiên ZWMarket không tồn tại.',{status:404,code:'MARKET_SESSION_NOT_FOUND'});
    if(current.status==='ENDED')throw new AppError('Phiên đã kết thúc chỉ được xem lịch sử.',{status:409,code:'MARKET_SESSION_ENDED'});
    const item=await one(`UPDATE catalog_market_session SET
      name=$2,description=$3,category=$4,starts_at=$5,ends_at=$6,updated_at=now()
      WHERE session_id=$1 RETURNING *`,[
      current.session_id,clean(req.body.name)||current.name,
      req.body.description===undefined?current.description:clean(req.body.description),
      req.body.category===undefined?current.category:(clean(req.body.category)||null),
      req.body.starts_at===undefined?current.starts_at:dateOrNull(req.body.starts_at),
      req.body.ends_at===undefined?current.ends_at:dateOrNull(req.body.ends_at)
    ]);
    res.json(item);
  }catch(error){next(error)}
});

router.post('/sessions/:id/status',async(req,res,next)=>{
  try{
    const status=clean(req.body.status).toUpperCase();
    if(!['DRAFT','UPCOMING','OPEN','ENDED'].includes(status))throw new AppError('Trạng thái phiên không hợp lệ.',{code:'MARKET_SESSION_STATUS_INVALID'});
    const current=await one('SELECT * FROM catalog_market_session WHERE session_id=$1',[req.params.id]);
    if(!current)throw new AppError('Phiên ZWMarket không tồn tại.',{status:404,code:'MARKET_SESSION_NOT_FOUND'});
    if(current.status==='ENDED'&&status!=='ENDED')throw new AppError('Không mở lại phiên đã kết thúc để bảo toàn lịch sử.',{status:409,code:'MARKET_SESSION_ENDED'});
    const item=await one(`UPDATE catalog_market_session SET status=$2,updated_at=now() WHERE session_id=$1 RETURNING *`,[current.session_id,status]);
    res.json(item);
  }catch(error){next(error)}
});

router.post('/posts/:id/reject',async(req,res,next)=>{
  try{
    const note=clean(req.body.note);
    const item=await one(`UPDATE catalog_market_post SET
      moderation_status='REJECTED',publish_status='DRAFT',moderation_note=$2,hidden_action=NULL,updated_at=now()
      WHERE post_id=$1 RETURNING *`,[req.params.id,note||'Bài chưa đạt yêu cầu kiểm duyệt.']);
    if(!item)throw new AppError('Tin ZWMarket không tồn tại.',{status:404,code:'MARKET_POST_NOT_FOUND'});
    res.json(item);
  }catch(error){next(error)}
});

export default router;
