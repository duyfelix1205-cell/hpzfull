import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluateCareDecision,assertIncidentAction,INCIDENT_STATES,LEGACY_STATUS_MAP} from '../src/lib/aquacare-v1.js';

const source=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const base={status:'ACTIVE',human_state:'NONE',wait_reason:null};

test('S01/F03/A01: no aquarium required for customer Care Relationship or Concern',()=>{
 const sql=source('backend/db/migrations/025_aquacare_care_relationship_v1.sql');
 const route=source('backend/src/routes/aquacare-v1.js');
 assert.match(sql,/ALTER TABLE aquacare\.issue ALTER COLUMN tank_id DROP NOT NULL/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS aquacare\.care_relationship/);
 assert.match(route,/r\.post\('\/relationship'/);
 assert.match(route,/r\.post\('\/incidents'/);
 assert.match(route,/const tankId=clip\(req\.body\?\.tank_id,80\)\|\|null/);
});

test('S02/S03: legacy aquarium management and explicit HPZ purchase inclusion are retained',()=>{
 const old=source('backend/src/routes/aquacare.js');
 assert.match(old,/r\.post\('\/tanks'/);
 assert.match(old,/r\.put\('\/tanks\/:tankId'/);
 assert.match(old,/r\.post\('\/tanks\/:tankId\/purchased-items'/);
 assert.match(old,/source IN \('MANUAL','OTHER_STORE'\)/);
});

test('S04/S06: observation and guidance never auto-create an incident',()=>{
 const api=source('backend/src/routes/aquacare-v1.js');
 const notes=api.slice(api.indexOf("r.post('/observations'"),api.indexOf("r.get('/history'"));
 assert.match(notes,/appendEvent/);
 assert.doesNotMatch(notes,/INSERT INTO aquacare\.issue/);
 assert.match(notes,/GUIDANCE_QUESTION/);
});

test('S05: Normal Care uses bounded generic guidance and only real measured context',()=>{
 const api=source('backend/src/routes/aquacare-v1.js');
 assert.match(api,/r\.get\('\/normal-care'/);
 assert.match(api,/latest_recorded_log:log\|\|null/);
 assert.match(api,/không suy đoán/);
});

test('S07/S08/A02: Care Decision A/B/C/D is bounded and never incident state',()=>{
 assert.deepEqual(INCIDENT_STATES,['ACTIVE','WAITING','INACTIVE_UNRESOLVED','RESOLVED']);
 assert.equal(evaluateCareDecision({issue_type:'filter',description:'Lọc chạy yếu so với ngày trước',has_measurement:true}).code,'A');
 assert.equal(evaluateCareDecision({issue_type:'filter',description:'Lọc yếu',has_measurement:false}).code,'B');
 assert.equal(evaluateCareDecision({issue_type:'death',description:'Một cá chết'}).code,'C');
 assert.equal(evaluateCareDecision({issue_type:'other',description:'Không rõ'}).code,'D');
});

test('S09/S11: customer evidence stays on incident, WAITING resumes only for valid new info',()=>{
 const wait={...base,status:'WAITING',wait_reason:'customer_info'};
 assert.equal(assertIncidentAction(wait,'EVIDENCE','CUSTOMER',{content:'Đã đo nước thực tế'}).status,'ACTIVE');
 assert.equal(assertIncidentAction(wait,'NO_OUTCOME','CUSTOMER').status,'WAITING');
 assert.equal(assertIncidentAction({...wait,wait_reason:'human_review'},'OUTCOME','CUSTOMER',{content:'Vẫn theo dõi'}).status,'WAITING');
 assert.equal(assertIncidentAction({...base,status:'INACTIVE_UNRESOLVED'},'EVIDENCE','CUSTOMER',{content:'Ảnh chụp mô tả'}).status,'INACTIVE_UNRESOLVED');
});

test('S10/A04: Human milestone is not Incident State; only actual Human can acknowledge',()=>{
 assert.equal(assertIncidentAction(base,'REQUEST_HUMAN','CUSTOMER').human_state,'REQUESTED');
 assert.throws(()=>assertIncidentAction({...base,human_state:'REQUESTED'},'HUMAN_ACKNOWLEDGED','CUSTOMER'),{code:'CARE_HUMAN_AUTHORITY_REQUIRED'});
 assert.equal(assertIncidentAction({...base,human_state:'REQUESTED'},'HUMAN_ACKNOWLEDGED','HPZ_HUMAN').human_state,'ACKNOWLEDGED');
 assert.equal(assertIncidentAction({...base,human_state:'ACKNOWLEDGED'},'HUMAN_CONTRIBUTED','HPZ_HUMAN',{content:'Đã đọc dữ liệu khách cung cấp'}).human_state,'CONTRIBUTED');
 assert.throws(()=>assertIncidentAction({...base,human_state:'REQUESTED'},'HUMAN_CONTRIBUTED','HPZ_HUMAN',{content:'Lưu'}));
});

test('S12/A07: Customer or HPZ Human resolution requires an explicit confirmation and basis',()=>{
 assert.throws(()=>assertIncidentAction(base,'CONFIRM_RESOLUTION','CUSTOMER',{content:'Đã ổn',confirmed:true}),{code:'RESOLUTION_EVIDENCE_REQUIRED'});
 assert.throws(()=>assertIncidentAction(base,'CONFIRM_RESOLUTION','CUSTOMER',{content:'Đã ổn hoàn toàn'}),{code:'RESOLUTION_EVIDENCE_REQUIRED'});
 assert.equal(assertIncidentAction(base,'CONFIRM_RESOLUTION','CUSTOMER',{content:'Theo dõi đã ổn định thực tế',confirmed:true}).status,'RESOLVED');
 assert.throws(()=>assertIncidentAction(base,'HUMAN_RESOLVED','CUSTOMER',{content:'Đã ổn hoàn toàn',confirmed:true}));
 assert.equal(assertIncidentAction(base,'HUMAN_RESOLVED','HPZ_HUMAN',{content:'Khách xác nhận có kết quả',confirmed:true}).status,'RESOLVED');
});

test('S13/A05: invalid transitions and quiet/no-outcome can never silently resolve',()=>{
 assert.throws(()=>assertIncidentAction({...base,status:'RESOLVED'},'RESUME','CUSTOMER',{content:'Tiếp tục'}),{code:'INCIDENT_RESOLVED_IMMUTABLE'});
 assert.equal(assertIncidentAction(base,'NO_OUTCOME','CUSTOMER').status,'ACTIVE');
 assert.equal(assertIncidentAction(base,'REQUEST_HUMAN','CUSTOMER').status,'ACTIVE');
 assert.equal(assertIncidentAction(base,'REQUEST_INFO','HPZ_HUMAN',{content:'Cần kết quả đo'}).status,'WAITING');
 assert.throws(()=>assertIncidentAction(base,'HUMAN_INACTIVE','CUSTOMER',{content:'Chưa rõ lý do nghỉ'}));
 assert.throws(()=>assertIncidentAction({...base,human_state:'CONTRIBUTED'},'HUMAN_INACTIVE','HPZ_HUMAN',{content:'Chưa đủ liên lạc và cần theo dõi thêm'}));
 assert.equal(assertIncidentAction({...base,status:'WAITING',human_state:'CONTRIBUTED'},'HUMAN_INACTIVE','HPZ_HUMAN',{content:'Chưa đủ liên lạc và cần theo dõi thêm'}).status,'INACTIVE_UNRESOLVED');
});

test('S14: recurrence is a new Incident linked to immutable resolved parent',()=>{
 const api=source('backend/src/routes/aquacare-v1.js');
 assert.match(api,/if\(old\.status!=='RESOLVED'\)/);
 assert.match(api,/previous_issue_id\)/);
 assert.match(api,/RECURRENCE_CREATED/);
});

test('S15/A09: history is scoped by stable customer_id, with tank-specific filtering',()=>{
 const api=source('backend/src/routes/aquacare-v1.js');
 assert.match(api,/r\.get\('\/history'/);
 assert.match(api,/WHERE customer_id=\$1 AND \(\$2::uuid IS NULL OR tank_id=\$2::uuid\)/);
 assert.match(api,/validatedTank\(customerId,tankId\)/);
 assert.match(api,/CARE_LOG/);
});

test('legacy data preservation: audit old state before migrating and no destructive data reset',()=>{
 const sql=source('backend/db/migrations/025_aquacare_care_relationship_v1.sql');
 assert.deepEqual(LEGACY_STATUS_MAP,{OPEN:'ACTIVE',RESOLVED:'RESOLVED'});
 assert.ok(sql.indexOf('LEGACY_IMPORTED')<sql.indexOf("UPDATE aquacare.issue SET status='ACTIVE'"));
 assert.ok(sql.indexOf('DROP CONSTRAINT IF EXISTS issue_status_check')<sql.indexOf("UPDATE aquacare.issue SET status='ACTIVE'"));
 assert.doesNotMatch(sql,/\bTRUNCATE\b|\bDELETE FROM\b|\bDROP TABLE\b/);
 assert.match(sql,/ON CONFLICT DO NOTHING/);
});

test('Human API requires existing admin-security middleware, no fake acknowledgement',()=>{
 const app=source('backend/src/app.js'),admin=source('backend/src/routes/admin-aquacare.js');
 assert.ok(app.indexOf("app.use('/api/v1/admin', adminSecurity)")<app.indexOf("app.use('/api/v1/admin/catalog/aquacare', adminAquaCare)"));
 assert.match(admin,/req\.adminActor\?\.userId/);
 assert.match(admin,/assertIncidentAction\(issue,action,'HPZ_HUMAN'/);
 assert.match(admin,/standalone_password/);
 assert.match(admin,/trusted_headers/);
 assert.match(admin,/CARE_HUMAN_AUTH_REQUIRED/);
});
