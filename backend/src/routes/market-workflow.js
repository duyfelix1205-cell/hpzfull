import express from 'express';
import { many, one } from '../db.js';
import { AppError } from '../lib/errors.js';
import { DEFAULT_SOLD_VISIBILITY_HOURS, hiddenActionAllowsEdit, soldVisibilitySql } from '../lib/market-visibility.js';
import { requireCustomerSession } from '../middleware/customer-session.js';

const router=express.Router();
const clean=v=>String(v??'').trim();
const slugify=v=>clean(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100);
const jsonArray=v=>Array.isArray(v)?v.map(clean).filter(Boolean):String(v??'').split(/\r?\n|,/).map(clean).filter(Boolean);
const numberOrNull=v=>{if(v===''||v===null||v===undefined)return null;const n=Number(v);return Number.isFinite(n)?n:null};

const publicPostSelect=`
  SELECT p.post_id,p.slug,p.title,p.category,p.description,p.price_amount,p.price_text,p.currency,
         p.location_text,p.seller_display_name,
         CASE WHEN p.contact_public THEN p.seller_contact ELSE NULL END AS seller_contact,
         p.contact_public,p.seller_avatar_url,p.seller_verified,p.author_user_id,p.featured,p.is_sold,p.sold_at,p.sold_visibility_until,
         p.allow_shipping,p.warranty_text,p.image_urls,p.tags,p.created_at,p.published_at
    FROM catalog_market_post p`;

async function ownedPost(postId,accountId){
  const item=await one('SELECT * FROM catalog_market_post WHERE post_id=$1 AND author_user_id=$2',[postId,accountId]);
  if(!item)throw new AppError('Không tìm thấy bài ZWMarket thuộc tài khoản này.',{status:404,code:'MARKET_POST_NOT_FOUND'});
  return item;
}

router.get('/sessions',async(req,res,next)=>{
  try{
    const includeEnded=String(req.query.include_ended||'').toLowerCase()==='true';
    const statuses=includeEnded?['OPEN','UPCOMING','ENDED']:['OPEN','UPCOMING'];
    const rows=await many(`
      SELECT s.*,
             CASE WHEN s.status='UPCOMING' THEN 0 ELSE
               (SELECT count(*)::int
                  FROM catalog_market_session_post sp
                  JOIN catalog_market_post p ON p.post_id=sp.post_id
                 WHERE sp.session_id=s.session_id AND sp.removed_at IS NULL
                   AND p.moderation_status='APPROVED' AND p.publish_status='PUBLISHED'
                   AND ${soldVisibilitySql('p')})
             END AS active_post_count
        FROM catalog_market_session s
       WHERE s.status=ANY($1::text[])
       ORDER BY CASE s.status WHEN 'OPEN' THEN 0 WHEN 'UPCOMING' THEN 1 ELSE 2 END,
                s.starts_at NULLS LAST,s.created_at DESC`,[statuses]);
    res.json({items:rows});
  }catch(error){next(error)}
});

router.get('/sessions/:ref/posts',async(req,res,next)=>{
  try{
    const session=await one(`SELECT * FROM catalog_market_session
      WHERE (session_id::text=$1 OR slug=$1) AND status IN ('OPEN','UPCOMING','ENDED') LIMIT 1`,[req.params.ref]);
    if(!session)throw new AppError('Phiên ZWMarket không tồn tại.',{status:404,code:'MARKET_SESSION_NOT_FOUND'});
    const items=session.status==='UPCOMING'?[]:await many(`${publicPostSelect}
      JOIN catalog_market_session_post sp ON sp.post_id=p.post_id
      WHERE sp.session_id=$1 AND sp.removed_at IS NULL
        AND p.moderation_status='APPROVED' AND p.publish_status='PUBLISHED'
        AND ${soldVisibilitySql('p')}
      ORDER BY p.featured DESC,p.is_sold ASC,sp.joined_at DESC,p.published_at DESC NULLS LAST`,[session.session_id]);
    res.json({session,items});
  }catch(error){next(error)}
});

router.get('/mine/posts',requireCustomerSession,async(req,res,next)=>{
  try{
    const rows=await many(`
      SELECT p.*,
             COALESCE((
               SELECT jsonb_agg(jsonb_build_object(
                 'session_id',s.session_id,'slug',s.slug,'name',s.name,'status',s.status,
                 'starts_at',s.starts_at,'ends_at',s.ends_at,'joined_at',sp.joined_at
               ) ORDER BY sp.joined_at DESC)
                 FROM catalog_market_session_post sp
                 JOIN catalog_market_session s ON s.session_id=sp.session_id
                WHERE sp.post_id=p.post_id AND sp.removed_at IS NULL
             ),'[]'::jsonb) AS sessions
        FROM catalog_market_post p
       WHERE p.author_user_id=$1
       ORDER BY p.updated_at DESC,p.created_at DESC`,[req.customerAccount.account_id]);
    res.json({items:rows});
  }catch(error){next(error)}
});

router.post('/mine/posts',requireCustomerSession,async(req,res,next)=>{
  try{
    const account=req.customerAccount;
    const title=clean(req.body.title);
    if(!title)throw new AppError('Tiêu đề bài đăng là bắt buộc.',{code:'MARKET_TITLE_REQUIRED'});
    const contact=clean(req.body.seller_contact)||null;
    const slugBase=slugify(title)||'tin';
    const item=await one(`INSERT INTO catalog_market_post(
      slug,title,category,description,price_amount,price_text,location_text,seller_display_name,seller_contact,contact_public,
      seller_avatar_url,seller_verified,author_user_id,submission_source,moderation_status,publish_status,featured,is_sold,
      allow_shipping,warranty_text,image_urls,tags,moderation_note
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,false,$12,'USER','PENDING','DRAFT',false,false,$13,$14,$15::jsonb,$16::jsonb,NULL)
    RETURNING *`,[
      `${slugBase}-${Date.now().toString(36)}`,title,clean(req.body.category)||'Khác',clean(req.body.description),
      numberOrNull(req.body.price_amount),clean(req.body.price_text)||null,clean(req.body.location_text)||null,
      clean(req.body.seller_display_name)||clean(account.display_name)||'Thành viên HPZ',contact,
      Boolean(req.body.contact_public)&&Boolean(contact),clean(req.body.seller_avatar_url)||null,account.account_id,
      Boolean(req.body.allow_shipping),clean(req.body.warranty_text)||null,JSON.stringify(jsonArray(req.body.image_urls)),
      JSON.stringify(jsonArray(req.body.tags))
    ]);
    res.status(201).json(item);
  }catch(error){next(error)}
});

router.put('/mine/posts/:id',requireCustomerSession,async(req,res,next)=>{
  try{
    const current=await ownedPost(req.params.id,req.customerAccount.account_id);
    if(current.is_sold)throw new AppError('Bài đã bán không thể sửa nội dung.',{status:409,code:'MARKET_POST_SOLD'});
    if(current.publish_status==='HIDDEN'&&!hiddenActionAllowsEdit(current.hidden_action))throw new AppError('Bài đang bị ẩn và không thuộc trường hợp được chỉnh sửa/gửi lại.',{status:409,code:'MARKET_POST_HIDDEN_READ_ONLY'});
    const title=clean(req.body.title)||current.title;
    const contact=req.body.seller_contact===undefined?current.seller_contact:(clean(req.body.seller_contact)||null);
    const contactPublic=req.body.contact_public===undefined?current.contact_public:(Boolean(req.body.contact_public)&&Boolean(contact));
    const item=await one(`UPDATE catalog_market_post SET
      title=$3,category=$4,description=$5,price_amount=$6,price_text=$7,location_text=$8,
      seller_display_name=$9,seller_contact=$10,contact_public=$11,seller_avatar_url=$12,
      allow_shipping=$13,warranty_text=$14,image_urls=$15::jsonb,tags=$16::jsonb,
      moderation_status='PENDING',publish_status='DRAFT',moderation_note=NULL,hidden_action=NULL,updated_at=now()
      WHERE post_id=$1 AND author_user_id=$2 RETURNING *`,[
      current.post_id,req.customerAccount.account_id,title,clean(req.body.category)||current.category,
      req.body.description===undefined?current.description:clean(req.body.description),
      req.body.price_amount===undefined?current.price_amount:numberOrNull(req.body.price_amount),
      req.body.price_text===undefined?current.price_text:(clean(req.body.price_text)||null),
      req.body.location_text===undefined?current.location_text:(clean(req.body.location_text)||null),
      clean(req.body.seller_display_name)||current.seller_display_name||clean(req.customerAccount.display_name)||'Thành viên HPZ',
      contact,contactPublic,req.body.seller_avatar_url===undefined?current.seller_avatar_url:(clean(req.body.seller_avatar_url)||null),
      req.body.allow_shipping===undefined?current.allow_shipping:Boolean(req.body.allow_shipping),
      req.body.warranty_text===undefined?current.warranty_text:(clean(req.body.warranty_text)||null),
      JSON.stringify(req.body.image_urls===undefined?(current.image_urls||[]):jsonArray(req.body.image_urls)),
      JSON.stringify(req.body.tags===undefined?(current.tags||[]):jsonArray(req.body.tags))
    ]);
    res.json(item);
  }catch(error){next(error)}
});

router.post('/mine/posts/:id/resubmit',requireCustomerSession,async(req,res,next)=>{
  try{
    const current=await ownedPost(req.params.id,req.customerAccount.account_id);
    if(current.is_sold)throw new AppError('Bài đã bán không thể gửi duyệt lại.',{status:409,code:'MARKET_POST_SOLD'});
    if(current.publish_status==='HIDDEN')throw new AppError('Bài Hidden không có nút gửi duyệt lại chung. Nếu Admin cho phép, hãy chỉnh sửa bài rồi lưu để gửi duyệt.',{status:409,code:'MARKET_POST_HIDDEN_EDIT_REQUIRED'});
    const item=await one(`UPDATE catalog_market_post
      SET moderation_status='PENDING',publish_status='DRAFT',moderation_note=NULL,hidden_action=NULL,updated_at=now()
      WHERE post_id=$1 AND author_user_id=$2 RETURNING *`,[current.post_id,req.customerAccount.account_id]);
    res.json(item);
  }catch(error){next(error)}
});

router.post('/mine/posts/:id/sold',requireCustomerSession,async(req,res,next)=>{
  try{
    await ownedPost(req.params.id,req.customerAccount.account_id);
    const item=await one(`UPDATE catalog_market_post
      SET is_sold=true,
          sold_at=COALESCE(sold_at,now()),
          sold_visibility_until=COALESCE(sold_visibility_until,now()+($3::int * interval '1 hour')),
          updated_at=now()
      WHERE post_id=$1 AND author_user_id=$2 RETURNING *`,[req.params.id,req.customerAccount.account_id,DEFAULT_SOLD_VISIBILITY_HOURS]);
    res.json(item);
  }catch(error){next(error)}
});

router.post('/mine/posts/:id/sessions/:sessionRef',requireCustomerSession,async(req,res,next)=>{
  try{
    const post=await ownedPost(req.params.id,req.customerAccount.account_id);
    if(post.is_sold)throw new AppError('Bài đã bán không thể tham gia phiên mới.',{status:409,code:'MARKET_POST_SOLD'});
    if(post.moderation_status!=='APPROVED'||post.publish_status!=='PUBLISHED'){
      throw new AppError('Bài phải được duyệt và đang công khai trước khi tham gia phiên chợ.',{status:409,code:'MARKET_POST_NOT_PUBLIC'});
    }
    const session=await one(`SELECT * FROM catalog_market_session
      WHERE (session_id::text=$1 OR slug=$1) AND status IN ('UPCOMING','OPEN') LIMIT 1`,[req.params.sessionRef]);
    if(!session)throw new AppError('Phiên chợ không còn nhận bài.',{status:409,code:'MARKET_SESSION_NOT_JOINABLE'});
    if(clean(session.category)&&clean(session.category)!==clean(post.category)){
      throw new AppError('Bài không thuộc danh mục của phiên chợ này.',{status:409,code:'MARKET_SESSION_CATEGORY_MISMATCH'});
    }
    const item=await one(`INSERT INTO catalog_market_session_post(session_id,post_id,joined_by_account_id)
      VALUES($1,$2,$3)
      ON CONFLICT(session_id,post_id) DO UPDATE SET removed_at=NULL,joined_by_account_id=EXCLUDED.joined_by_account_id,joined_at=now()
      RETURNING *`,[session.session_id,post.post_id,req.customerAccount.account_id]);
    res.status(201).json({session,participation:item});
  }catch(error){next(error)}
});

router.delete('/mine/posts/:id/sessions/:sessionRef',requireCustomerSession,async(req,res,next)=>{
  try{
    const post=await ownedPost(req.params.id,req.customerAccount.account_id);
    const session=await one(`SELECT * FROM catalog_market_session WHERE (session_id::text=$1 OR slug=$1) LIMIT 1`,[req.params.sessionRef]);
    if(!session)throw new AppError('Phiên ZWMarket không tồn tại.',{status:404,code:'MARKET_SESSION_NOT_FOUND'});
    if(session.status==='ENDED')throw new AppError('Không thể thay đổi lịch sử của phiên đã kết thúc.',{status:409,code:'MARKET_SESSION_ENDED'});
    const item=await one(`UPDATE catalog_market_session_post SET removed_at=now()
      WHERE session_id=$1 AND post_id=$2 AND removed_at IS NULL RETURNING *`,[session.session_id,post.post_id]);
    res.json({ok:Boolean(item),participation:item||null});
  }catch(error){next(error)}
});

export default router;
