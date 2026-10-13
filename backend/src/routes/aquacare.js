import { Router } from 'express';
import { many, one, query, tx } from '../db.js';
import { AppError } from '../lib/errors.js';
import { requireCustomerSession } from '../middleware/customer-session.js';
import { customerOrdersAdapter } from '../adapters/customer-orders-adapter.js';
import { mediaPublicUrl } from '../lib/media.js';
import { assertIncidentAction, evaluateCareDecision, hasWaterMeasurement } from '../lib/aquacare-v1.js';

const r=Router();
r.use(requireCustomerSession);

const clip=(value,max=500)=>String(value??'').trim().slice(0,max);
const numberOrNull=value=>{
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
};
const positiveInt=(value,fallback=1)=>{
  const n=Math.trunc(Number(value));
  return Number.isFinite(n)&&n>0?n:fallback;
};
const issueLabels={
  gasp:'Cá thở gấp / nổi đầu',
  spots:'Đốm lạ / nghi bệnh ngoài da',
  fin:'Rách vây / vết thương',
  eating:'Cá bỏ ăn / lờ đờ',
  water:'Nước đục / có mùi',
  filter:'Lọc / sủi gặp sự cố',
  death:'Cá chết / xấu nhanh',
  other:'Vấn đề khác'
};

async function customerContext(req,client){
  const account=await one('SELECT account_id,display_name,orders_customer_id FROM customer_accounts WHERE account_id=$1 AND active=true',[req.customerAccount.account_id],client);
  if(!account)throw new AppError('Tài khoản không tồn tại.',{status:404,code:'ACCOUNT_NOT_FOUND'});
  if(!account.orders_customer_id)throw new AppError('Hãy liên kết số điện thoại với hồ sơ HPZ trước khi dùng AquaCare.',{status:409,code:'CUSTOMER_LINK_REQUIRED'});
  return {account,customerId:account.orders_customer_id};
}

async function ownedTank(customerId,tankId,client){
  const tank=await one('SELECT * FROM aquacare.tank WHERE tank_id=$1 AND customer_id=$2 AND status<>\'ARCHIVED\'',[tankId,customerId],client);
  if(!tank)throw new AppError('Không tìm thấy bể cá.',{status:404,code:'TANK_NOT_FOUND'});
  return tank;
}

export function guidanceFor(issue,latestLog){
  const steps=[];
  const type=String(issue?.issue_type||issue?.type||'other');
  if(type==='gasp'||type==='death')steps.push({level:'critical',title:'Ưu tiên liên hệ chuyên môn',body:'Nếu nhiều cá thở gấp, chết hoặc xấu nhanh, hãy liên hệ kỹ thuật HPZ / chuyên môn thủy sinh ngay. Không chờ hệ thống tự chẩn đoán.'});
  if(type==='gasp')steps.push({level:'warning',title:'Kiểm tra trao đổi khí và nước',body:'Kiểm tra sủi, chuyển động mặt nước và lọc nếu thiết bị an toàn; đo nhiệt độ, NH3/NH4 và NO2 nếu có bộ thử.'});
  if(type==='filter')steps.push({level:'critical',title:'Kiểm tra hệ thống an toàn',body:'Kiểm tra nguồn điện, máy bơm và đường nước. Nếu nghi rò điện, tránh chạm nước, ngắt nguồn an toàn và gọi kỹ thuật.'});
  if(type==='water')steps.push({level:'warning',title:'Kiểm tra nước và thức ăn',body:'Đối chiếu lịch thay nước, thức ăn dư và tình trạng lọc. Tránh thay toàn bộ nước hoặc rửa sạch mọi vật liệu lọc cùng lúc.'});
  if(['spots','fin','eating','other','death'].includes(type))steps.push({level:'info',title:'Theo dõi cá bị ảnh hưởng',body:'Ghi lại loài, số cá, thời điểm và thay đổi gần đây. Kiểm tra nước trước khi cân nhắc thuốc; không áp dụng một liều, muối hay tăng nhiệt giống nhau cho mọi loài.'});
  if(latestLog&&(Number(latestLog.nh3_nh4_mg_l||0)>0||Number(latestLog.no2_mg_l||0)>0))steps.push({level:'warning',title:'Đối chiếu chỉ số nước',body:'Nhật ký gần nhất ghi nhận NH3/NH4 hoặc NO2 lớn hơn 0. Hãy giữ lại giá trị, pH và thời điểm đo để nhân viên đánh giá.'});
  if(!steps.length)steps.push({level:'info',title:'Bước đầu',body:'Theo dõi thay đổi của cá và nước, kiểm tra lọc và ghi nhật ký. Liên hệ kỹ thuật nếu tình trạng tiếp tục hoặc nặng hơn.'});
  return steps;
}

export function decorateVisualAsset(item){
  const imageUrl=item?.primary_storage_key?mediaPublicUrl(item.primary_storage_key):null;
  const {primary_storage_key,...clean}=item||{};
  return {...clean,visual_asset:{
    mode:imageUrl?'CATALOG_PRIMARY':'ANIMATED_FALLBACK',
    image_url:imageUrl,
    source:imageUrl?'catalog_media':'generated_2d'
  }};
}

async function tankDetail(customerId,tankId,client){
  const tank=await ownedTank(customerId,tankId,client);
  const [rawItems,logs,issues,reminders]=await Promise.all([
    many(`SELECT i.*,m.storage_key AS primary_storage_key
      FROM aquacare.tank_item i
      LEFT JOIN LATERAL (
        SELECT storage_key FROM catalog_media
        WHERE product_id=i.product_id AND media_type='IMAGE'
        ORDER BY is_primary DESC,sort_order,created_at
        LIMIT 1
      ) m ON true
      WHERE i.tank_id=$1 AND i.removed_at IS NULL
      ORDER BY i.added_at,i.tank_item_id`,[tankId],client),
    many('SELECT * FROM aquacare.care_log WHERE tank_id=$1 AND customer_id=$2 ORDER BY created_at DESC LIMIT 100',[tankId,customerId],client),
    many('SELECT * FROM aquacare.issue WHERE tank_id=$1 AND customer_id=$2 ORDER BY (status<>\'RESOLVED\') DESC,created_at DESC LIMIT 100',[tankId,customerId],client),
    many('SELECT * FROM aquacare.reminder WHERE tank_id=$1 AND customer_id=$2 ORDER BY (status=\'OPEN\') DESC,due_at NULLS LAST,created_at DESC LIMIT 100',[tankId,customerId],client)
  ]);
  const latestLog=logs[0]||null;
  const items=rawItems.map(decorateVisualAsset);
  return {...tank,items,logs,issues:issues.map(x=>({...x,label:issueLabels[x.issue_type]||'Vấn đề',guidance:guidanceFor(x,latestLog)})),reminders};
}

export function canonicalizeTankSpecies(species=[],catalogRows=[]){
  const catalogById=new Map((catalogRows||[]).map(row=>[String(row.product_id),row]));
  const merged=new Map();
  for(const raw of species||[]){
    const productId=clip(raw?.product_id,100)||null;
    const quantity=positiveInt(raw?.quantity,1);
    let speciesName=clip(raw?.species_name||raw?.name,160);
    if(productId){
      const catalog=catalogById.get(productId);
      if(!catalog)throw new AppError('Cá được chọn không tồn tại trong Catalog.',{status:400,code:'AQUACARE_CATALOG_FISH_INVALID'});
      speciesName=clip(catalog.product_name,160);
    }
    if(!speciesName)continue;
    const key=productId?'product:'+productId:'manual:'+speciesName.toLocaleLowerCase('vi-VN');
    const current=merged.get(key);
    if(current)current.quantity+=quantity;
    else merged.set(key,{species_name:speciesName,quantity,product_id:productId,source:['MANUAL','OTHER_STORE'].includes(String(raw?.source||'MANUAL'))?String(raw.source):'MANUAL'});
  }
  return [...merged.values()];
}

export async function resolveTankSpecies(species=[],client){
  const ids=[...new Set((species||[]).map(x=>clip(x?.product_id,100)).filter(Boolean))];
  const catalogRows=ids.length?await many(`SELECT s.product_id,s.product_name
    FROM catalog_product_source s
    WHERE s.product_id=ANY($1::text[]) AND s.product_type='FISH'`,[ids],client):[];
  return canonicalizeTankSpecies(species,catalogRows);
}

function tankPayload(body){
  const name=clip(body?.name,70);
  const volume=numberOrNull(body?.estimated_volume_l);
  if(!name)throw new AppError('Tên bể là bắt buộc.',{status:400,code:'TANK_NAME_REQUIRED'});
  if(!volume||volume<=0||volume>50000)throw new AppError('Thể tích bể không hợp lệ.',{status:400,code:'TANK_VOLUME_INVALID'});
  const species=Array.isArray(body?.species)?body.species.slice(0,32).map(x=>({
    species_name:clip(x?.species_name||x?.name,80),
    quantity:positiveInt(x?.quantity||x?.count,1),
    product_id:clip(x?.product_id,100)||null,
    source:['MANUAL','OTHER_STORE'].includes(String(x?.source||'MANUAL'))?String(x.source):'MANUAL'
  })).filter(x=>x.species_name):[];
  return {
    name,
    tank_type:clip(body?.tank_type,50)||'AQUARIUM',
    length_cm:numberOrNull(body?.length_cm),
    width_cm:numberOrNull(body?.width_cm),
    height_cm:numberOrNull(body?.height_cm),
    estimated_volume_l:volume,
    filter_type:clip(body?.filter_type,80)||null,
    has_air:body?.has_air!==false,
    species
  };
}

r.get('/tanks',async(req,res,next)=>{try{
  const {customerId}=await customerContext(req);
  const items=await many(`SELECT t.*,
    COALESCE((SELECT sum(i.quantity) FROM aquacare.tank_item i WHERE i.tank_id=t.tank_id AND i.removed_at IS NULL AND i.item_type='FISH'),0)::int AS fish_count,
    COALESCE((SELECT count(*) FROM aquacare.issue x WHERE x.tank_id=t.tank_id AND x.status<>'RESOLVED'),0)::int AS open_issues,
    (SELECT l.water_state FROM aquacare.care_log l WHERE l.tank_id=t.tank_id ORDER BY l.created_at DESC LIMIT 1) AS latest_water_state,
    (SELECT l.created_at FROM aquacare.care_log l WHERE l.tank_id=t.tank_id ORDER BY l.created_at DESC LIMIT 1) AS latest_log_at
    FROM aquacare.tank t WHERE t.customer_id=$1 AND t.status='ACTIVE' ORDER BY t.updated_at DESC,t.created_at DESC`,[customerId]);
  res.json({items});
}catch(e){next(e)}});

r.post('/tanks',async(req,res,next)=>{try{
  const payload=tankPayload(req.body);
  const result=await tx(async client=>{
    const {customerId}=await customerContext(req,client);
    const tank=(await client.query(`INSERT INTO aquacare.tank(customer_id,name,tank_type,length_cm,width_cm,height_cm,estimated_volume_l,filter_type,has_air)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[customerId,payload.name,payload.tank_type,payload.length_cm,payload.width_cm,payload.height_cm,payload.estimated_volume_l,payload.filter_type,payload.has_air])).rows[0];
    const species=await resolveTankSpecies(payload.species,client);
    for(const item of species)await client.query(`INSERT INTO aquacare.tank_item(tank_id,item_type,product_id,species_name,source,quantity)
      VALUES($1,'FISH',$2,$3,$4,$5)`,[tank.tank_id,item.product_id,item.species_name,item.source,item.quantity]);
    return tankDetail(customerId,tank.tank_id,client);
  });
  res.status(201).json(result);
}catch(e){next(e)}});

r.get('/tanks/:tankId',async(req,res,next)=>{try{
  const {customerId}=await customerContext(req);
  res.json(await tankDetail(customerId,req.params.tankId));
}catch(e){next(e)}});

r.put('/tanks/:tankId',async(req,res,next)=>{try{
  const payload=tankPayload(req.body);
  const result=await tx(async client=>{
    const {customerId}=await customerContext(req,client);
    await ownedTank(customerId,req.params.tankId,client);
    await client.query(`UPDATE aquacare.tank SET name=$3,tank_type=$4,length_cm=$5,width_cm=$6,height_cm=$7,estimated_volume_l=$8,filter_type=$9,has_air=$10,updated_at=now()
      WHERE tank_id=$1 AND customer_id=$2`,[req.params.tankId,customerId,payload.name,payload.tank_type,payload.length_cm,payload.width_cm,payload.height_cm,payload.estimated_volume_l,payload.filter_type,payload.has_air]);
    const species=await resolveTankSpecies(payload.species,client);
    // Never delete/reseed manual fish: Incident links reference stable tank_item_id.
    const previous=await many(`SELECT tank_item_id,product_id,species_name,source FROM aquacare.tank_item
      WHERE tank_id=$1 AND item_type='FISH' AND source IN ('MANUAL','OTHER_STORE') AND removed_at IS NULL
      FOR UPDATE`,[req.params.tankId],client);
    const used=new Set();
    const key=x=>x.product_id?'product:'+x.product_id:'manual:'+String(x.species_name||'').toLocaleLowerCase('vi-VN');
    for(const item of species){
      const found=previous.find(x=>!used.has(x.tank_item_id)&&key(x)===key(item));
      if(found){
        used.add(found.tank_item_id);
        await client.query(`UPDATE aquacare.tank_item
          SET product_id=$2,species_name=$3,source=$4,quantity=$5
          WHERE tank_item_id=$1`,[found.tank_item_id,item.product_id,item.species_name,item.source,item.quantity]);
      }else{
        await client.query(`INSERT INTO aquacare.tank_item(tank_id,item_type,product_id,species_name,source,quantity)
          VALUES($1,'FISH',$2,$3,$4,$5)`,[req.params.tankId,item.product_id,item.species_name,item.source,item.quantity]);
      }
    }
    for(const existing of previous){
      if(!used.has(existing.tank_item_id)){
        await client.query('UPDATE aquacare.tank_item SET removed_at=now() WHERE tank_item_id=$1',
          [existing.tank_item_id]);
      }
    }
    return tankDetail(customerId,req.params.tankId,client);
  });
  res.json(result);
}catch(e){next(e)}});

r.delete('/tanks/:tankId',async(req,res,next)=>{try{
  const {customerId}=await customerContext(req);
  await ownedTank(customerId,req.params.tankId);
  await query(`UPDATE aquacare.tank SET status='ARCHIVED',updated_at=now() WHERE tank_id=$1 AND customer_id=$2`,[req.params.tankId,customerId]);
  res.json({ok:true});
}catch(e){next(e)}});

r.post('/tanks/:tankId/logs',async(req,res,next)=>{try{
  const {customerId}=await customerContext(req);
  await ownedTank(customerId,req.params.tankId);
  const water=['clear','cloudy','green','unknown'].includes(req.body?.water_state)?req.body.water_state:'unknown';
  const filter=['ok','weak','off','unknown'].includes(req.body?.filter_state)?req.body.filter_state:'unknown';
  const row=(await query(`INSERT INTO aquacare.care_log(tank_id,customer_id,water_state,filter_state,temperature_c,ph,nh3_nh4_mg_l,no2_mg_l,note)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[req.params.tankId,customerId,water,filter,numberOrNull(req.body?.temperature_c),numberOrNull(req.body?.ph),numberOrNull(req.body?.nh3_nh4_mg_l),numberOrNull(req.body?.no2_mg_l),clip(req.body?.note,500)||null])).rows[0];
  await query('UPDATE aquacare.tank SET updated_at=now() WHERE tank_id=$1',[req.params.tankId]);
  res.status(201).json(row);
}catch(e){next(e)}});

r.post('/tanks/:tankId/issues',async(req,res,next)=>{try{
 const type=String(req.body?.issue_type||'');
 if(!issueLabels[type])throw new AppError('Loại vấn đề không hợp lệ.',{status:400,code:'ISSUE_TYPE_INVALID'});
 const result=await tx(async client=>{
  const {customerId,account}=await customerContext(req,client);
  await ownedTank(customerId,req.params.tankId,client);
  const itemId=clip(req.body?.affected_tank_item_id,80)||null;
  const affectedCount=Math.max(0,Math.trunc(Number(req.body?.affected_count||0)));
  let speciesName=clip(req.body?.affected_species_name,80)||null;
  if(itemId){
   const item=await one('SELECT tank_item_id,species_name,quantity FROM aquacare.tank_item WHERE tank_item_id=$1 AND tank_id=$2 AND removed_at IS NULL',
    [itemId,req.params.tankId],client);
   if(!item)throw new AppError('Loài cá được chọn không thuộc bể này.',{status:400,code:'AFFECTED_ITEM_INVALID'});
   if(affectedCount>Number(item.quantity))throw new AppError('Số cá bị ảnh hưởng không thể lớn hơn số cá đang có.',{status:400,code:'AFFECTED_COUNT_INVALID'});
   speciesName=item.species_name||speciesName;
  }
  const latestLog=await one('SELECT * FROM aquacare.care_log WHERE tank_id=$1 ORDER BY created_at DESC LIMIT 1',[req.params.tankId],client);
  const description=clip(req.body?.description,800);
  const decision=evaluateCareDecision({issue_type:type,description,has_measurement:hasWaterMeasurement(latestLog)});
  const row=await one(`INSERT INTO aquacare.issue
     (tank_id,customer_id,issue_type,affected_tank_item_id,affected_species_name,affected_count,onset,description,status,care_decision)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,'ACTIVE',$9) RETURNING *`,
     [req.params.tankId,customerId,type,itemId,speciesName,affectedCount,clip(req.body?.onset,60)||'Không rõ',
      description||null,decision.code],client);
  await client.query(`INSERT INTO aquacare.care_relationship(customer_id) VALUES($1) ON CONFLICT DO NOTHING`,[customerId]);
  await client.query(`INSERT INTO aquacare.care_event(customer_id,tank_id,issue_id,event_type,actor_type,actor_id,content)
    VALUES($1,$2,$3,'CONCERN_RECEIVED','CUSTOMER',$4,$5)`,
    [customerId,req.params.tankId,row.issue_id,account.account_id,description||'Customer báo vấn đề trong bể.']);
  return {...row,label:issueLabels[type],guidance:guidanceFor(row,latestLog),decision};
 });
 res.status(201).json(result);
}catch(e){next(e)}});

r.patch('/issues/:issueId',async(req,res,next)=>{try{
 const requested=String(req.body?.status||'').toUpperCase();
 if(requested!=='RESOLVED')throw new AppError('Sử dụng Care Experience để cập nhật diễn biến; chỉ xác nhận RESOLVED khi có căn cứ.',{status:409,code:'CARE_LEGACY_STATUS_BLOCKED'});
 const content=clip(req.body?.resolution_basis||req.body?.content,4000);
 const row=await tx(async client=>{
  const {customerId,account}=await customerContext(req,client);
  const issue=await one('SELECT * FROM aquacare.issue WHERE issue_id=$1 AND customer_id=$2 FOR UPDATE',[req.params.issueId,customerId],client);
  if(!issue)throw new AppError('Không tìm thấy sự cố.',{status:404,code:'ISSUE_NOT_FOUND'});
  const step=assertIncidentAction(issue,'CONFIRM_RESOLUTION','CUSTOMER',{content,confirmed:req.body?.confirmed===true});
  const updated=await one(`UPDATE aquacare.issue
    SET status='RESOLVED',resolution_by='CUSTOMER',resolution_basis=$3,resolved_at=now(),updated_at=now()
    WHERE issue_id=$1 AND customer_id=$2 RETURNING *`,[issue.issue_id,customerId,step.resolution_basis],client);
  await client.query(`INSERT INTO aquacare.care_event
    (customer_id,tank_id,issue_id,event_type,actor_type,actor_id,content)
    VALUES($1,$2,$3,'RESOLVED','CUSTOMER',$4,$5)`,[customerId,issue.tank_id,issue.issue_id,account.account_id,content]);
  return updated;
 });
 res.json(row);
}catch(e){next(e)}});

r.post('/tanks/:tankId/reminders',async(req,res,next)=>{try{
  const {customerId}=await customerContext(req);
  await ownedTank(customerId,req.params.tankId);
  const title=clip(req.body?.title,160);
  if(!title)throw new AppError('Nội dung nhắc việc là bắt buộc.',{status:400,code:'REMINDER_TITLE_REQUIRED'});
  const row=(await query(`INSERT INTO aquacare.reminder(tank_id,customer_id,title,due_at,recurrence)
    VALUES($1,$2,$3,$4,$5) RETURNING *`,[req.params.tankId,customerId,title,req.body?.due_at||null,clip(req.body?.recurrence,80)||null])).rows[0];
  res.status(201).json(row);
}catch(e){next(e)}});

r.patch('/reminders/:reminderId',async(req,res,next)=>{try{
  const {customerId}=await customerContext(req);
  const status=String(req.body?.status||'').toUpperCase();
  if(!['OPEN','DONE','CANCELLED'].includes(status))throw new AppError('Trạng thái nhắc việc không hợp lệ.',{status:400,code:'REMINDER_STATUS_INVALID'});
  const row=(await query(`UPDATE aquacare.reminder SET status=$3,completed_at=CASE WHEN $3='DONE' THEN COALESCE(completed_at,now()) ELSE NULL END
    WHERE reminder_id=$1 AND customer_id=$2 RETURNING *`,[req.params.reminderId,customerId,status])).rows[0];
  if(!row)throw new AppError('Không tìm thấy nhắc việc.',{status:404,code:'REMINDER_NOT_FOUND'});
  res.json(row);
}catch(e){next(e)}});

r.get('/purchased-items',async(req,res,next)=>{try{
  const {customerId}=await customerContext(req);
  const profile=await customerOrdersAdapter.getProfile(customerId);
  const placed=await many(`SELECT source_order_id,product_id FROM aquacare.tank_item i JOIN aquacare.tank t ON t.tank_id=i.tank_id
    WHERE t.customer_id=$1 AND i.source='HPZ_ORDER' AND i.removed_at IS NULL`,[customerId]);
  const seen=new Set(placed.map(x=>String(x.source_order_id)+'|'+String(x.product_id)));
  const items=[];
  for(const order of profile?.orders||[]){
    for(const item of order.items||[]){
      if(!item.product_id)continue;
      const key=String(order.order_id)+'|'+String(item.product_id);
      if(seen.has(key))continue;
      items.push({order_id:order.order_id,order_code:order.code,order_date:order.date,product_id:item.product_id,product_name:item.product_name||item.product_code||'Sản phẩm',quantity:Number(item.qty||0)});
    }
  }
  res.json({items:items.filter(x=>x.quantity>0).slice(0,50)});
}catch(e){next(e)}});

r.post('/tanks/:tankId/purchased-items',async(req,res,next)=>{try{
  const {customerId}=await customerContext(req);
  await ownedTank(customerId,req.params.tankId);
  const orderId=clip(req.body?.order_id,120),productId=clip(req.body?.product_id,120);
  if(!orderId||!productId)throw new AppError('Thiếu order_id hoặc product_id.',{status:400,code:'PURCHASE_REF_REQUIRED'});
  const profile=await customerOrdersAdapter.getProfile(customerId);
  const order=(profile?.orders||[]).find(x=>String(x.order_id)===orderId);
  const item=order?.items?.find(x=>String(x.product_id)===productId);
  if(!order||!item)throw new AppError('Không tìm thấy sản phẩm trong lịch sử mua hàng của tài khoản này.',{status:404,code:'PURCHASE_ITEM_NOT_FOUND'});
  await query(`INSERT INTO aquacare.tank_item(tank_id,item_type,product_id,product_name,species_name,source,source_order_id,quantity)
    VALUES($1,'FISH',$2,$3,$3,'HPZ_ORDER',$4,$5) ON CONFLICT DO NOTHING`,[req.params.tankId,productId,clip(item.product_name||item.product_code,160)||'Sản phẩm',orderId,positiveInt(item.qty,1)]);
  res.json(await tankDetail(customerId,req.params.tankId));
}catch(e){next(e)}});

export default r;
