import { Router } from 'express';
import { many, one, tx } from '../db.js';
import { AppError } from '../lib/errors.js';
import { assertIncidentAction } from '../lib/aquacare-v1.js';

const r=Router();
// The Catalog-wide standalone test header is not a genuine HPZ Human identity.
r.use((req,_res,next)=>{
 if(!['trusted_headers','standalone_password'].includes(req.adminActor?.mode))
  return next(new AppError('AquaCare Human cần xác thực thật.',{status:403,code:'CARE_HUMAN_AUTH_REQUIRED'}));
 next();
});
const clip=(x,max=4000)=>String(x??'').trim().slice(0,max);

r.get('/incidents',async(req,res,next)=>{try{
 const status=clip(req.query.status,30);
 const rows=await many(`SELECT i.issue_id,i.customer_id,i.tank_id,t.name AS tank_name,i.issue_type,i.status,
 i.care_decision,i.human_state,i.description,i.created_at,i.updated_at
 FROM aquacare.issue i LEFT JOIN aquacare.tank t ON t.tank_id=i.tank_id
 WHERE ($1::text='' OR i.status=$1 OR ($1='REQUESTED' AND i.human_state='REQUESTED'))
 ORDER BY (i.human_state='REQUESTED') DESC,i.updated_at DESC LIMIT 200`,[status]);
 res.json({items:rows});
}catch(e){next(e)}});

r.get('/incidents/:id',async(req,res,next)=>{try{
 const issue=await one('SELECT * FROM aquacare.issue WHERE issue_id=$1',[req.params.id]);
 if(!issue)throw new AppError('Incident không tồn tại.',{status:404,code:'ISSUE_NOT_FOUND'});
 const events=await many('SELECT event_id,event_type,actor_type,actor_id,content,created_at FROM aquacare.care_event WHERE issue_id=$1 ORDER BY created_at,event_id',[req.params.id]);
 res.json({...issue,events});
}catch(e){next(e)}});

r.post('/incidents/:id/actions',async(req,res,next)=>{try{
 const action=clip(req.body?.action,48).toUpperCase();
 const content=clip(req.body?.content);
 const actorId=clip(req.adminActor?.userId,120);
 if(!actorId||!['trusted_headers','standalone_password'].includes(req.adminActor?.mode))
   throw new AppError('Cần xác thực HPZ Human thực, không chấp nhận quyền test hoặc anonymous.',{status:403,code:'CARE_HUMAN_IDENTITY_REQUIRED'});
 const updated=await tx(async client=>{
  const issue=await one('SELECT * FROM aquacare.issue WHERE issue_id=$1 FOR UPDATE',[req.params.id],client);
  if(!issue)throw new AppError('Incident không tồn tại.',{status:404,code:'ISSUE_NOT_FOUND'});
  const result=assertIncidentAction(issue,action,'HPZ_HUMAN',{content,confirmed:req.body?.confirmed===true});
  const row=await one(`UPDATE aquacare.issue SET status=$2,human_state=$3,wait_reason=$4,
       resolution_by=$5,resolution_basis=$6,resolved_at=CASE WHEN $2='RESOLVED' THEN now() ELSE resolved_at END,
       updated_at=now() WHERE issue_id=$1 RETURNING *`,
   [issue.issue_id,result.status,result.human_state||issue.human_state,
    result.wait_reason===undefined?issue.wait_reason:result.wait_reason,
    result.resolution_by||issue.resolution_by,result.resolution_basis||issue.resolution_basis],client);
  await client.query(`INSERT INTO aquacare.care_event
   (customer_id,tank_id,issue_id,event_type,actor_type,actor_id,content)
   VALUES($1,$2,$3,$4,'HPZ_HUMAN',$5,$6)`,
   [issue.customer_id,issue.tank_id,issue.issue_id,result.event_type,actorId,content]);
  return row;
 });
 res.json(updated);
}catch(e){next(e)}});
export default r;
