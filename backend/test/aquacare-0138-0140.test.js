import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hasWaterMeasurement,evaluateCareDecision,assertIncidentAction} from '../src/lib/aquacare-v1.js';

const get=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const inactive={status:'INACTIVE_UNRESOLVED',human_state:'CONTRIBUTED',wait_reason:'human_review'};
const active={status:'ACTIVE',human_state:'ACKNOWLEDGED'};
test('ISS-0138 customer and Human cannot resolve INACTIVE_UNRESOLVED directly',()=>{
 for(const [action,actor] of [['CONFIRM_RESOLUTION','CUSTOMER'],['HUMAN_RESOLVED','HPZ_HUMAN']]){
  assert.throws(()=>assertIncidentAction(inactive,action,actor,{confirmed:true,content:'Đã có đủ căn cứ giải quyết thực tế'}),{
   code:'INCIDENT_RESUME_REQUIRED'
  });
 }
});
test('ISS-0138 inactive is only resumed with reason, then legitimate resolution requires confirmation',()=>{
 assert.throws(()=>assertIncidentAction(inactive,'RESUME','CUSTOMER'),{code:'CARE_TRANSITION_DENIED'});
 const next=assertIncidentAction(inactive,'RESUME','CUSTOMER',{content:'Tiếp tục theo dõi cá sau khi trao đổi'});
 assert.equal(next.status,'ACTIVE');
 assert.equal(next.event_type,'RESUMED');
 assert.equal(next.wait_reason,null);
 assert.equal(assertIncidentAction({...inactive,...next},'CONFIRM_RESOLUTION','CUSTOMER',{confirmed:true,content:'Cá phục hồi và kết quả đo ổn định'}).status,'RESOLVED');
 assert.throws(()=>assertIncidentAction({...inactive,...next},'HUMAN_RESOLVED','HPZ_HUMAN',{confirmed:false,content:'Đã giải quyết'}));
 assert.equal(assertIncidentAction({...active},'HUMAN_RESOLVED','HPZ_HUMAN',{confirmed:true,content:'Đã kiểm chứng cùng khách hàng'}).status,'RESOLVED');
});
test('ISS-0139 a note/observational log is NOT a measured water reading',()=>{
 assert.equal(hasWaterMeasurement(null),false);
 assert.equal(hasWaterMeasurement({note:'Cá bơi bình thường'}),false);
 assert.equal(hasWaterMeasurement({water_state:'CLOUDY',filter_state:'NORMAL',note:'Nước hơi đục'}),false);
 assert.equal(hasWaterMeasurement({temperature_c:null,ph:null,nh3_nh4_mg_l:null,no2_mg_l:null}),false);
 assert.equal(hasWaterMeasurement({temperature_c:'',ph:undefined,nh3_nh4_mg_l:null,no2_mg_l:null}),false);
 assert.equal(hasWaterMeasurement({ph:'unknown'}),false);
 assert.equal(hasWaterMeasurement({no2_mg_l:0}),true);
 assert.equal(hasWaterMeasurement({ph:'7.2'}),true);
});
test('ISS-0139 Care Decision stays bounded B without readings and A only with real data',()=>{
 const log={water_state:'CLOUDY',filter_state:'NORMAL',note:'Nước đục'};
 const base={issue_type:'water',description:'Nước đục lâu ngày cần đánh giá hệ thống lọc'};
 assert.equal(evaluateCareDecision({...base,has_measurement:hasWaterMeasurement(log)}).code,'B');
 assert.equal(evaluateCareDecision({...base,has_measurement:hasWaterMeasurement({...log,ph:7.2})}).code,'A');
 const a=get('backend/src/routes/aquacare-v1.js');
 const b=get('backend/src/routes/aquacare.js');
 assert.match(a,/has_measurement:hasWaterMeasurement\(latest\)/);
 assert.match(b,/has_measurement:hasWaterMeasurement\(latestLog\)/);
});
test('ISS-0140 Human UI exists inside existing /admin/aquacare route and real auth is required',()=>{
 const router=get('frontend/src/AdminRouter.jsx'),workspace=get('frontend/src/WorkspaceAdmin.jsx');
 const ui=get('frontend/src/AquaCareHumanAdmin.jsx'),client=get('frontend/src/api.js');
 const backend=get('backend/src/routes/admin-aquacare.js');
 assert.match(router,/path==='\/admin\/aquacare'/);
 assert.match(workspace,/AquacareAdmin=AquaCareHumanAdmin/);
 for(const action of ['HUMAN_ACKNOWLEDGED','HUMAN_CONTRIBUTED','REQUEST_INFO','HUMAN_INACTIVE','RESUME','HUMAN_RESOLVED'])assert.ok(ui.includes(action),action);
 assert.match(client,/!path\.startsWith\('\/api\/v1\/admin\/catalog\/aquacare'\)/);
 assert.match(client,/listHumanCareIncidents/);
 assert.match(client,/updateHumanCareIncident/);
 assert.match(backend,/CARE_HUMAN_AUTH_REQUIRED/);
 assert.match(backend,/assertIncidentAction\(issue,action,'HPZ_HUMAN'/);
 assert.doesNotMatch(backend,/standalone_test_bypass/);
});
test('No DB resets, new business states, or Cross-CRM data mutation',()=>{
 const domain=get('backend/src/lib/aquacare-v1.js');
 assert.match(domain,/current==='INACTIVE_UNRESOLVED'/);
 assert.match(get('frontend/src/AquaCareV1Experience.jsx'),/\['ACTIVE','WAITING'\]\.includes\(incident\.status\)/);
 assert.doesNotMatch(domain,/DELETE FROM|TRUNCATE|DROP TABLE/);
});
