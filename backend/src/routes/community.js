import { Router } from 'express';
import { many, one, query } from '../db.js';
import { AppError } from '../lib/errors.js';
import { requireCustomerSession } from '../middleware/customer-session.js';

const r=Router();
const clip=(value,max=1200)=>String(value??'').trim().slice(0,max);

async function identity(req){
  const account=await one('SELECT account_id,display_name,orders_customer_id FROM customer_accounts WHERE account_id=$1 AND active=true',[req.customerAccount.account_id]);
  if(!account)throw new AppError('Tài khoản không tồn tại.',{status:404,code:'ACCOUNT_NOT_FOUND'});
  if(!account.orders_customer_id)throw new AppError('Hãy liên kết số điện thoại với hồ sơ HPZ trước khi tham gia Community.',{status:409,code:'CUSTOMER_LINK_REQUIRED'});
  return {account_id:account.account_id,customer_id:account.orders_customer_id,display_name:clip(account.display_name,120)||'HPZ Member'};
}

r.get('/posts',async(req,res,next)=>{try{
  const limit=Math.min(100,Math.max(1,Number(req.query.limit)||40));
  const items=await many(`SELECT p.post_id,p.customer_id,p.author_display_name,p.post_type,p.title,p.body,p.target_type,p.target_id,p.created_at,p.updated_at,
    (SELECT count(*)::int FROM community.comment c WHERE c.post_id=p.post_id AND c.status='PUBLISHED') AS comments_count,
    (SELECT count(*)::int FROM community.reaction x WHERE x.post_id=p.post_id AND x.reaction_type='LIKE') AS likes_count
    FROM community.post p WHERE p.status='PUBLISHED' ORDER BY p.created_at DESC LIMIT $1`,[limit]);
  res.json({items});
}catch(e){next(e)}});

r.get('/posts/:postId/comments',async(req,res,next)=>{try{
  const post=await one(`SELECT post_id FROM community.post WHERE post_id=$1 AND status='PUBLISHED'`,[req.params.postId]);
  if(!post)throw new AppError('Bài viết không tồn tại.',{status:404,code:'COMMUNITY_POST_NOT_FOUND'});
  const items=await many(`SELECT comment_id,post_id,customer_id,author_display_name,body,created_at
    FROM community.comment WHERE post_id=$1 AND status='PUBLISHED' ORDER BY created_at`,[req.params.postId]);
  res.json({items});
}catch(e){next(e)}});

r.post('/posts',requireCustomerSession,async(req,res,next)=>{try{
  const who=await identity(req);
  const body=clip(req.body?.body,2000),title=clip(req.body?.title,180)||null;
  const type=String(req.body?.post_type||'TEXT').toUpperCase();
  if(!body)throw new AppError('Nội dung bài viết là bắt buộc.',{status:400,code:'COMMUNITY_BODY_REQUIRED'});
  if(!['TEXT','TANK','WIKI','MARKET'].includes(type))throw new AppError('Loại bài viết không hợp lệ.',{status:400,code:'COMMUNITY_TYPE_INVALID'});
  const row=(await query(`INSERT INTO community.post(account_id,customer_id,author_display_name,post_type,title,body,target_type,target_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[who.account_id,who.customer_id,who.display_name,type,title,body,clip(req.body?.target_type,40)||null,clip(req.body?.target_id,160)||null])).rows[0];
  res.status(201).json(row);
}catch(e){next(e)}});

r.post('/posts/:postId/comments',requireCustomerSession,async(req,res,next)=>{try{
  const who=await identity(req);
  const post=await one(`SELECT post_id FROM community.post WHERE post_id=$1 AND status='PUBLISHED'`,[req.params.postId]);
  if(!post)throw new AppError('Bài viết không tồn tại.',{status:404,code:'COMMUNITY_POST_NOT_FOUND'});
  const body=clip(req.body?.body,1200);
  if(!body)throw new AppError('Nội dung bình luận là bắt buộc.',{status:400,code:'COMMUNITY_COMMENT_REQUIRED'});
  const row=(await query(`INSERT INTO community.comment(post_id,account_id,customer_id,author_display_name,body)
    VALUES($1,$2,$3,$4,$5) RETURNING *`,[req.params.postId,who.account_id,who.customer_id,who.display_name,body])).rows[0];
  res.status(201).json(row);
}catch(e){next(e)}});

r.post('/posts/:postId/reactions',requireCustomerSession,async(req,res,next)=>{try{
  const who=await identity(req);
  const post=await one(`SELECT post_id FROM community.post WHERE post_id=$1 AND status='PUBLISHED'`,[req.params.postId]);
  if(!post)throw new AppError('Bài viết không tồn tại.',{status:404,code:'COMMUNITY_POST_NOT_FOUND'});
  const existing=await one(`SELECT 1 ok FROM community.reaction WHERE post_id=$1 AND account_id=$2 AND reaction_type='LIKE'`,[req.params.postId,who.account_id]);
  if(existing)await query(`DELETE FROM community.reaction WHERE post_id=$1 AND account_id=$2 AND reaction_type='LIKE'`,[req.params.postId,who.account_id]);
  else await query(`INSERT INTO community.reaction(post_id,account_id,customer_id,reaction_type) VALUES($1,$2,$3,'LIKE')`,[req.params.postId,who.account_id,who.customer_id]);
  const count=await one(`SELECT count(*)::int likes_count FROM community.reaction WHERE post_id=$1 AND reaction_type='LIKE'`,[req.params.postId]);
  res.json({liked:!existing,likes_count:Number(count?.likes_count||0)});
}catch(e){next(e)}});

export default r;
