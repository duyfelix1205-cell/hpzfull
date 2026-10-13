import { AppError } from './errors.js';

export const INCIDENT_STATES=Object.freeze(['ACTIVE','WAITING','INACTIVE_UNRESOLVED','RESOLVED']);
export const HUMAN_STATES=Object.freeze(['NONE','REQUESTED','ACKNOWLEDGED','CONTRIBUTED']);

export const activeIncident=incident=>incident?.status!=='RESOLVED';

// Only actual numeric tests count as water measurements. Observational labels,
// notes, and 0-valued readings must not be mistaken for missing/present values.
export function hasWaterMeasurement(log){
 if(!log||typeof log!=='object')return false;
 return ['temperature_c','ph','nh3_nh4_mg_l','no2_mg_l'].some(key=>{
  const value=log[key];
  return value!==null&&value!==undefined&&value!==''&&
    (typeof value==='number'||typeof value==='string')&&Number.isFinite(Number(value));
 });
}

export function evaluateCareDecision({issue_type,description,has_measurement=false}={}){
  const type=String(issue_type||'other');
  const detail=String(description||'').trim();
  if(['gasp','death'].includes(type))return {code:'C',reason:'Có dấu hiệu cần HPZ Human xem xét sớm.',action:'Liên hệ HPZ và lưu quan sát thực tế; không tự chẩn đoán.'};
  if(type==='other'&&detail.length<12)return {code:'D',reason:'Chưa đủ căn cứ kết luận an toàn.',action:'Mô tả thêm tình trạng, thời điểm và bể liên quan nếu biết.'};
  if(!has_measurement||detail.length<15)return {code:'B',reason:'Cần thêm thông tin thực tế để hướng dẫn theo ngữ cảnh.',action:'Bổ sung dấu hiệu, thời điểm và kết quả đo nếu có; không suy đoán thông số.'};
  if(['water','filter'].includes(type))return {code:'A',reason:'Chỉ cung cấp checklist an toàn trong giới hạn.',action:'Kiểm tra thiết bị và dữ liệu đã đo; liên hệ HPZ nếu tình trạng xấu đi.'};
  return {code:'B',reason:'Cần thêm đánh giá phù hợp từng loài và bể.',action:'Ghi nhận diễn biến và trao đổi với HPZ khi cần.'};
}

export function assertIncidentAction(issue,action,actor,{content='',confirmed=false}={}){
 const current=issue?.status;
 const human=issue?.human_state||'NONE';
 const reason=String(content||'').trim();
 if(!INCIDENT_STATES.includes(current))
   throw new AppError('Trạng thái Incident không hợp lệ.',{status:409,code:'INCIDENT_STATE_INVALID'});
 if(!['CUSTOMER','HPZ_HUMAN','SYSTEM'].includes(actor))
   throw new AppError('Nguồn thao tác không hợp lệ.',{status:403,code:'CARE_ACTOR_INVALID'});
 const fail=(message,code='CARE_TRANSITION_DENIED')=>{throw new AppError(message,{status:409,code})};
 if(current==='RESOLVED')fail('Incident đã có xác nhận kết quả. Báo tái phát cần tạo Incident mới.','INCIDENT_RESOLVED_IMMUTABLE');
 if(current==='INACTIVE_UNRESOLVED'&&['CONFIRM_RESOLUTION','HUMAN_RESOLVED'].includes(action))
   fail('Incident đang tạm ngừng chưa rõ kết quả. Cần RESUME với lý do, theo dõi tiếp và có căn cứ mới trước khi xác nhận RESOLVED.','INCIDENT_RESUME_REQUIRED');
 if(['EVIDENCE','OUTCOME','NO_OUTCOME'].includes(action)){
   if(!reason&&action!=='NO_OUTCOME')fail('Cần nội dung cập nhật thực tế.','CARE_EVIDENCE_REQUIRED');
   const resumed=action!=='NO_OUTCOME'&&current==='WAITING'&&issue?.wait_reason==='customer_info';
   return{status:resumed?'ACTIVE':current,wait_reason:resumed?null:issue?.wait_reason||null,
     event_type:action,actor_type:actor};
 }
 if(action==='REQUEST_HUMAN'){
   if(actor!=='CUSTOMER')fail('Yêu cầu hỗ trợ này chỉ dành cho Customer.');
   if(human!=='NONE')fail('Yêu cầu Human đã tồn tại; vui lòng theo dõi tiến trình.');
   return{status:current,human_state:'REQUESTED',event_type:'HUMAN_REQUESTED',actor_type:actor};
 }
 if(action==='CONFIRM_RESOLUTION'){
   if(actor!=='CUSTOMER'||!confirmed||reason.length<8)fail('Customer phải xác nhận rõ kết quả và căn cứ (ít nhất 8 ký tự).','RESOLUTION_EVIDENCE_REQUIRED');
   return{status:'RESOLVED',resolution_by:'CUSTOMER',resolution_basis:reason,event_type:'RESOLVED',actor_type:actor};
 }
 if(action==='RESUME'){
   if(!['WAITING','INACTIVE_UNRESOLVED'].includes(current))fail('Incident hiện không ở trạng thái cần tiếp tục.');
   if(!reason)fail('Cần lý do tiếp tục chăm sóc.');
   return{status:'ACTIVE',wait_reason:null,event_type:'RESUMED',actor_type:actor};
 }
 if(actor!=='HPZ_HUMAN'&&actor!=='SYSTEM')
   fail('Chỉ HPZ Human hoặc quy tắc hệ thống được phép thực hiện bước này.','CARE_HUMAN_AUTHORITY_REQUIRED');
 if(action==='REQUEST_INFO'){
   if(current!=='ACTIVE'||!reason)fail('Chỉ có thể yêu cầu bổ sung thông tin khi đang ACTIVE.');
   return{status:'WAITING',wait_reason:'customer_info',event_type:'INFO_REQUESTED',actor_type:actor};
 }
 if(action==='HUMAN_ACKNOWLEDGED'){
   if(actor!=='HPZ_HUMAN'||human!=='REQUESTED')fail('Cần có yêu cầu Human trước khi tiếp nhận.');
   return{status:current,human_state:'ACKNOWLEDGED',event_type:'HUMAN_ACKNOWLEDGED',actor_type:actor};
 }
 if(action==='HUMAN_CONTRIBUTED'){
   if(actor!=='HPZ_HUMAN'||!['ACKNOWLEDGED','CONTRIBUTED'].includes(human)||!reason)
     fail('HPZ Human cần tiếp nhận và có nội dung đóng góp thực tế.');
   return{status:current,human_state:'CONTRIBUTED',event_type:'HUMAN_CONTRIBUTED',actor_type:actor};
 }
 if(action==='HUMAN_INACTIVE'){
   if(actor!=='HPZ_HUMAN'||human!=='CONTRIBUTED'||current!=='WAITING'||reason.length<8)
     fail('Chỉ HPZ Human đã đóng góp mới được ghi INACTIVE_UNRESOLVED với căn cứ.');
   return{status:'INACTIVE_UNRESOLVED',event_type:'INACTIVE_UNRESOLVED',actor_type:actor};
 }
 if(action==='HUMAN_RESOLVED'){
   if(actor!=='HPZ_HUMAN'||!confirmed||reason.length<8)
     fail('HPZ Human phải xác nhận rõ căn cứ giải quyết (ít nhất 8 ký tự).');
   return{status:'RESOLVED',resolution_by:'HPZ_HUMAN',resolution_basis:reason,event_type:'RESOLVED',actor_type:actor};
 }
 fail('Hành động chăm sóc không hợp lệ.','CARE_ACTION_INVALID');
}

export const LEGACY_STATUS_MAP=Object.freeze({OPEN:'ACTIVE',RESOLVED:'RESOLVED'});
