import { Router } from 'express';
import { many, one, query, tx } from '../db.js';
import { AppError } from '../lib/errors.js';
import { requireCustomerSession } from '../middleware/customer-session.js';
import { evaluateCareDecision, assertIncidentAction, hasWaterMeasurement } from '../lib/aquacare-v1.js';
import { guidanceFor } from './aquacare.js';

const r=Router();
r.use(requireCustomerSession);
const clip=(x,max=1000)=>String(x??'').trim().slice(0,max);
const types=new Set(['gasp','spots','fin','eating','water','filter','death','other']);
const names={gasp:'Cá thở gấp / nổi đầu',spots:'Đốm lạ / nghi bệnh ngoài da',fin:'Rách vây / vết thương',
 eating:'Cá bỏ ăn / lờ đờ',water:'Nước đục / có mùi',filter:'Lọc / sủi gặp sự cố',
 death:'Cá chết / xấu nhanh',other:'Vấn đề khác'};

async function customer(req,client){
 const account=await one('SELECT account_id,display_name,orders_customer_id FROM customer_accounts WHERE account_id=$1 AND active=true',
   [req.customerAccount.account_id],client);
 if(!account)throw new AppError('Tài khoản không tồn tại.',{status:404,code:'ACCOUNT_NOT_FOUND'});
 if(!account.orders_customer_id)throw new AppError('Hãy liên kết hồ sơ khách HPZ trước khi dùng AquaCare.',{status:409,code:'CUSTOMER_LINK_REQUIRED'});
 return{customerId:account.orders_customer_id,actorId:account.account_id,account};
}
async function validatedTank(customerId,id,client){
 if(!id)return null;
 const tank=await one("SELECT tank_id,name FROM aquacare.tank WHERE tank_id=$1 AND customer_id=$2 AND status='ACTIVE'",[id,customerId],client);
 if(!tank)throw new AppError('Bể không thuộc hồ sơ của bạn.',{status:404,code:'TANK_NOT_FOUND'});
 return tank;
}
async function ownedIncident(customerId,id,client,lock=false){
 const item=await one(`SELECT * FROM aquacare.issue WHERE issue_id=$1 AND customer_id=$2 ${lock?'FOR UPDATE':''}`,[id,customerId],client);
 if(!item)throw new AppError('Không tìm thấy Incident trong hồ sơ này.',{status:404,code:'ISSUE_NOT_FOUND'});
 return item;
}
async function startCare(customerId,client){
 const ins=await query(`INSERT INTO aquacare.care_relationship(customer_id) VALUES($1)
 ON CONFLICT(customer_id) DO NOTHING RETURNING customer_id`,[customerId],client);
 if(ins.rowCount){
  await appendEvent(client,{customerId,type:'CARE_STARTED',actor:'CUSTOMER',
   text:'Customer bắt đầu quan hệ chăm sóc AquaCare.'});
 }
 return Boolean(ins.rowCount);
}
async function appendEvent(client,{customerId,tankId=null,issueId=null,type,actor='CUSTOMER',actorId='',text}){
 const row=await one(`INSERT INTO aquacare.care_event
 (customer_id,tank_id,issue_id,event_type,actor_type,actor_id,content)
 VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
 [customerId,tankId,issueId,type,actor,actorId,clip(text,4000)],client);
 return row;
}
async function incidentDetail(customerId,id,client){
 const issue=await ownedIncident(customerId,id,client);
 const [events,latestLog]=await Promise.all([
  many('SELECT * FROM aquacare.care_event WHERE customer_id=$1 AND issue_id=$2 ORDER BY created_at,event_id',
    [customerId,id],client),
  issue.tank_id?one('SELECT * FROM aquacare.care_log WHERE tank_id=$1 AND customer_id=$2 ORDER BY created_at DESC LIMIT 1',
    [issue.tank_id,customerId],client):null
 ]);
 return{...issue,label:names[issue.issue_type],guidance:guidanceFor(issue,latestLog),
    decision:{code:issue.care_decision,note:'Care Decision đã ghi nhận; các nhật ký mới không tự đổi quyết định hoặc Incident State.'},
    events};
}

r.get('/relationship',async(req,res,next)=>{try{
 const {customerId}=await customer(req);
 const relation=await one('SELECT customer_id,started_at,last_active_at FROM aquacare.care_relationship WHERE customer_id=$1',[customerId]);
 res.json({started:Boolean(relation),relationship:relation});
}catch(e){next(e)}});

r.post('/relationship',async(req,res,next)=>{try{
 const {customerId,actorId}=await customer(req);
 const result=await tx(async c=>{
  const created=await startCare(customerId,c);
  await query('UPDATE aquacare.care_relationship SET last_active_at=now() WHERE customer_id=$1',[customerId],c);
  return{started:true,created,customer_id:customerId};
 });
 res.status(result.created?201:200).json(result);
}catch(e){next(e)}});

r.get('/incidents',async(req,res,next)=>{try{
 const {customerId}=await customer(req);
 const tankId=clip(req.query.tank_id,80);
 if(tankId)await validatedTank(customerId,tankId);
 const rows=await many(`SELECT i.*,t.name AS tank_name FROM aquacare.issue i
 LEFT JOIN aquacare.tank t ON t.tank_id=i.tank_id
 WHERE i.customer_id=$1 AND ($2::uuid IS NULL OR i.tank_id=$2::uuid)
 ORDER BY (i.status='RESOLVED') ASC,i.created_at DESC LIMIT 150`,
 [customerId,tankId||null]);
 res.json({items:rows.map(x=>({...x,label:names[x.issue_type]||'Vấn đề'}))});
}catch(e){next(e)}});

r.post('/incidents',async(req,res,next)=>{try{
 const type=clip(req.body?.issue_type,32);
 if(!types.has(type))throw new AppError('Chọn loại vấn đề phù hợp.',{status:400,code:'ISSUE_TYPE_INVALID'});
 const description=clip(req.body?.description,800);
 const tankId=clip(req.body?.tank_id,80)||null;
 if(req.body?.media||req.body?.file)throw new AppError('Tải media chưa được hỗ trợ ở AquaCare V1.',{status:422,code:'CARE_MEDIA_UNAVAILABLE'});
 const result=await tx(async c=>{
  const {customerId,actorId}=await customer(req,c);
  await validatedTank(customerId,tankId,c);
  await startCare(customerId,c);
  const latest=tankId?await one('SELECT * FROM aquacare.care_log WHERE tank_id=$1 AND customer_id=$2 ORDER BY created_at DESC LIMIT 1',[tankId,customerId],c):null;
  const decision=evaluateCareDecision({issue_type:type,description,has_measurement:hasWaterMeasurement(latest)});
  const issue=await one(`INSERT INTO aquacare.issue
  (tank_id,customer_id,issue_type,onset,description,status,care_decision)
  VALUES($1,$2,$3,$4,$5,'ACTIVE',$6) RETURNING *`,
  [tankId,customerId,type,clip(req.body?.onset,60)||'Không rõ',description||null,decision.code],c);
  await appendEvent(c,{customerId,tankId,issueId:issue.issue_id,type:'CONCERN_RECEIVED',actorId,
   text:description||'Customer báo Concern, chưa cung cấp mô tả chi tiết.'});
  await appendEvent(c,{customerId,tankId,issueId:issue.issue_id,type:'CARE_DECISION_'+decision.code,
   actor:'SYSTEM',text:decision.reason+' '+decision.action});
  return incidentDetail(customerId,issue.issue_id,c);
 });
 res.status(201).json(result);
}catch(e){next(e)}});

r.get('/incidents/:id',async(req,res,next)=>{try{
 const {customerId}=await customer(req);
 res.json(await incidentDetail(customerId,req.params.id));
}catch(e){next(e)}});

r.post('/incidents/:id/events',async(req,res,next)=>{try{
 const action=clip(req.body?.action,48).toUpperCase();
 const content=clip(req.body?.content,4000);
 if(req.body?.media||req.body?.file)throw new AppError('Media chưa được upload thật; chỉ lưu mô tả, không giả đã đính kèm.',{status:422,code:'CARE_MEDIA_UNAVAILABLE'});
 const result=await tx(async c=>{
  const {customerId,actorId}=await customer(req,c);
  const issue=await ownedIncident(customerId,req.params.id,c,true);
  const step=assertIncidentAction(issue,action,'CUSTOMER',{content,confirmed:req.body?.confirmed===true});
  const updated=await one(`UPDATE aquacare.issue
   SET status=$3,human_state=$4,wait_reason=$5,resolution_by=$6,resolution_basis=$7,
       resolved_at=CASE WHEN $3='RESOLVED' THEN now() ELSE resolved_at END,updated_at=now()
   WHERE issue_id=$1 AND customer_id=$2 RETURNING *`,
   [issue.issue_id,customerId,step.status,step.human_state||issue.human_state,step.wait_reason===undefined?issue.wait_reason:step.wait_reason,
    step.resolution_by||issue.resolution_by,step.resolution_basis||issue.resolution_basis],c);
  await appendEvent(c,{customerId,tankId:issue.tank_id,issueId:issue.issue_id,type:step.event_type,actorId,
   text:content||(action==='NO_OUTCOME'?'Chưa có kết quả xác nhận.':'Customer yêu cầu hỗ trợ HPZ Human.')});
  return updated;
 });
 res.json(result);
}catch(e){next(e)}});

r.post('/incidents/:id/recurrence',async(req,res,next)=>{try{
 const result=await tx(async c=>{
  const {customerId,actorId}=await customer(req,c);
  const old=await ownedIncident(customerId,req.params.id,c,true);
  if(old.status!=='RESOLVED')throw new AppError('Chỉ tạo tái phát khi Incident cũ đã RESOLVED.',{status:409,code:'RECURRENCE_NOT_RESOLVED'});
  const description=clip(req.body?.description,800);
  if(description.length<3)throw new AppError('Vui lòng mô tả dấu hiệu tái phát.',{status:400,code:'RECURRENCE_DESCRIPTION_REQUIRED'});
  await startCare(customerId,c);
  const decision=evaluateCareDecision({issue_type:old.issue_type,description});
  const row=await one(`INSERT INTO aquacare.issue
     (tank_id,customer_id,issue_type,onset,description,status,care_decision,previous_issue_id)
     VALUES($1,$2,$3,$4,$5,'ACTIVE',$6,$7) RETURNING *`,
   [old.tank_id,customerId,old.issue_type,clip(req.body?.onset,60)||'Không rõ',description,decision.code,old.issue_id],c);
  await appendEvent(c,{customerId,tankId:row.tank_id,issueId:row.issue_id,
    type:'RECURRENCE_CREATED',actorId,text:'Incident tái phát từ '+old.issue_id+': '+description});
  return incidentDetail(customerId,row.issue_id,c);
 });
 res.status(201).json(result);
}catch(e){next(e)}});

r.post('/observations',async(req,res,next)=>{try{
 const kind=clip(req.body?.kind,20).toUpperCase();
 if(!['OBSERVATION','EVENT'].includes(kind))throw new AppError('Loại ghi nhận không hợp lệ.',{status:400,code:'CARE_NOTE_KIND_INVALID'});
 const content=clip(req.body?.content,4000);
 if(!content)throw new AppError('Cần nội dung quan sát thực tế.',{status:400,code:'CARE_NOTE_REQUIRED'});
 const result=await tx(async c=>{
  const {customerId,actorId}=await customer(req,c);
  const tankId=clip(req.body?.tank_id,80)||null;
  await validatedTank(customerId,tankId,c);
  await startCare(customerId,c);
  return appendEvent(c,{customerId,tankId,type:kind,actorId,text:content});
 });
 res.status(201).json(result);
}catch(e){next(e)}});

r.post('/guidance-questions',async(req,res,next)=>{try{
 const content=clip(req.body?.question,3000);
 if(!content)throw new AppError('Vui lòng nhập câu hỏi.',{status:400,code:'CARE_QUESTION_REQUIRED'});
 const result=await tx(async c=>{
  const {customerId,actorId}=await customer(req,c);
  const tankId=clip(req.body?.tank_id,80)||null;
  await validatedTank(customerId,tankId,c);
  await startCare(customerId,c);
  return appendEvent(c,{customerId,tankId,type:'GUIDANCE_QUESTION',actorId,text:content});
 });
 res.status(201).json({...result,note:'Câu hỏi được lưu trong Care History; chưa có xác nhận nhân viên HPZ tiếp nhận.'});
}catch(e){next(e)}});

r.get('/history',async(req,res,next)=>{try{
 const {customerId}=await customer(req);
 const tankId=clip(req.query.tank_id,80)||null;
 if(tankId)await validatedTank(customerId,tankId);
 const pageSize=Math.min(100,Math.max(1,Math.trunc(Number(req.query.page_size)||50)));
 const page=Math.max(1,Math.trunc(Number(req.query.page)||1));
 const filter=[customerId,tankId];
 const counts=await one(`SELECT
  (SELECT count(*) FROM aquacare.care_event WHERE customer_id=$1 AND ($2::uuid IS NULL OR tank_id=$2::uuid))::int AS events,
  (SELECT count(*) FROM aquacare.care_log WHERE customer_id=$1 AND ($2::uuid IS NULL OR tank_id=$2::uuid))::int AS logs`,filter);
 const total=Number(counts.events)+Number(counts.logs);
 const rows=await many(`SELECT * FROM (
  SELECT event_id::text,customer_id,tank_id,issue_id,event_type,actor_type,actor_id,content,
         created_at,NULL::jsonb AS measured
    FROM aquacare.care_event
   WHERE customer_id=$1 AND ($2::uuid IS NULL OR tank_id=$2::uuid)
  UNION ALL
  SELECT 'log:'||log_id::text,customer_id,tank_id,NULL::uuid,'CARE_LOG','CUSTOMER','',
         concat_ws(' · ',NULLIF(note,''),'Nước '||water_state,'Lọc '||filter_state),
         created_at,jsonb_build_object('temperature_c',temperature_c,'ph',ph,'nh3_nh4_mg_l',nh3_nh4_mg_l,'no2_mg_l',no2_mg_l)
    FROM aquacare.care_log
   WHERE customer_id=$1 AND ($2::uuid IS NULL OR tank_id=$2::uuid)
 ) timeline ORDER BY created_at DESC,event_id DESC LIMIT $3 OFFSET $4`,
  [customerId,tankId,pageSize,(page-1)*pageSize]);
 res.json({items:rows,total,page,page_size:pageSize});
}catch(e){next(e)}});

r.get('/normal-care',async(req,res,next)=>{try{
 const {customerId}=await customer(req);
 const tanks=await many(`SELECT tank_id,name FROM aquacare.tank WHERE customer_id=$1 AND status='ACTIVE' ORDER BY updated_at DESC LIMIT 40`,[customerId]);
 const log=await one(`SELECT l.tank_id,l.water_state,l.filter_state,l.created_at
 FROM aquacare.care_log l JOIN aquacare.tank t ON t.tank_id=l.tank_id
 WHERE l.customer_id=$1 AND t.customer_id=$1 ORDER BY l.created_at DESC LIMIT 1`,[customerId]);
 res.json({tank_count:tanks.length,latest_recorded_log:log||null,
   guidance:['Quan sát hành vi cá và hệ thống lọc định kỳ.','Ghi lại những thông số bạn thực sự đo được; không suy đoán.',
    'Không tự kết luận cá đang khỏe hay mắc bệnh chỉ từ lịch sử mua hàng.','Khi có dấu hiệu bất thường, hãy báo Concern hoặc liên hệ HPZ.']});
}catch(e){next(e)}});

export default r;
