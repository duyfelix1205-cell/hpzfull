import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const root=new URL('../../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const page=read('frontend/src/AquaCarePage.jsx');
const experience=read('frontend/src/AquaCareV1Experience.jsx');
const main=read('frontend/src/main.jsx');
const violet=read('frontend/src/aquacare-violet-0141.css');
const scene=JSON.parse(read('frontend/src/aquacare-stage03-map.json'));

test('ISS-2026-0141 AquaCare uses dedicated scene and interactive Violet shell only at /care',()=>{
  assert.match(main,/const care=path==='\/care'/);
  assert.match(main,/care\?AquaCarePage/);
  assert.match(main,/import '\.\/aquacare-violet-0141\.css'/);
  assert.match(main,/import '\.\/aquacare-stage03\.css'/);
  assert.match(main,/AquaCareStage03Scene/);
  assert.match(page,/aquacare-violet-app aquacare-v1-replacement/);
  assert.equal((page.match(/aquacare-violet-gate/g)||[]).length,3,'loading/login/customer linking preserve scoped shell');
});

test('Violet replacement covers Today / Tanks / Care functional sections, not just the hero',()=>{
  for(const area of ['today','tanks','care']) assert.match(experience,new RegExp("area==='"+area+"'"));
  for(const name of ['aquacare-violet-context','aquacare-violet-area-intro','aquacare-violet-quick-actions','aquacare-violet-tank-rail','aquacare-violet-overview-number'])
    assert.ok(experience.includes(name),'missing functional section '+name);
  assert.match(experience,/aria-pressed=\{selected===t\.tank_id\}/);
  assert.match(violet,/\.aquacare-violet-area-intro/);
  assert.match(violet,/\.aquacare-violet-tank-rail/);
  assert.match(violet,/@media\(max-width:760px\)/);
  assert.match(violet,/@media\(prefers-reduced-motion:reduce\)/);
});

test('all Stage03 referenced scene images are committed and isolated to AquaCare',()=>{
  assert.ok(Array.isArray(scene.layers)&&scene.layers.length>=5);
  for(const layer of scene.layers){
    assert.ok(layer.asset&&!layer.asset.includes('..'),'unsafe Stage03 asset path');
    assert.ok(existsSync(new URL('frontend/public/aquacare-stage03/'+layer.asset,root)),layer.asset);
  }
  assert.match(main,/care&&<AquaCareStage03Scene\/>/);
  assert.match(violet,/\.aquacare-violet-app/);
  assert.doesNotMatch(violet,/\n\.zwm-|\n\.wiki-|\n\.hpz-app\s*\{/);
});

test('all canonical customer-owned AquaCare operations remain wired to real APIs',()=>{
  for(const f of ['listTanks','getTank','createTank','updateTank','addLog','addIssue','updateIssue','updateReminder','purchasedItems','attachPurchased'])
    assert.ok(page.includes('aquaCareApi.'+f),'lost existing tank capability '+f);
  for(const f of ['startCare','relationship','normalCare','incidents','history','getIncident','createIncident','observation','askGuidance','recurrence','incidentEvent'])
    assert.ok(experience.includes('aquaCareApi.'+f),'lost V1 care capability '+f);
  assert.match(page,/publicApi\.listProducts/);
  assert.match(experience,/AquaCareWorkspace/);
  assert.match(experience,/onCreateTank/);
  assert.match(page,/CUSTOMER_LINK_REQUIRED/);
  assert.match(page,/error\?\.status===401/);
});

test('approved Stage04 source drives actual React layout without prototype fake state',()=>{
  const stage04=read('frontend/src/aquacare-stage04-0141.css');
  assert.match(stage04,/ce419e58753494294fce1f51b634d36c1d710bb961008b5fd8d3102143da582e/);
  assert.match(main,/import '\.\/aquacare-stage04-0141\.css'/);
  assert.match(page,/Chăm sóc cùng HPZ/);
  assert.match(page,/Hôm nay · Bể của tôi · Chăm sóc/);
  assert.match(stage04,/--stage04-purple:#9650f8/);
  assert.match(stage04,/\.aquacare-v1-replacement \.aquacare-v1-nav/);
  assert.match(stage04,/@media\(max-width:849px\)/);
  assert.match(stage04,/prefers-reduced-motion:reduce/);
  assert.doesNotMatch(stage04,/localStorage|setDemoRole|resetData|mockTanks/);
  assert.doesNotMatch(stage04,/\.zwm-app|\.wiki-app/);
});

test('Stage04 Care actionable tiles and ongoing/all filter preserve real incident lifecycle',()=>{
  const style=read('frontend/src/aquacare-stage04-0141.css');
  assert.match(experience,/aquacare-stage04-actions/);
  assert.match(experience,/aquacare-stage04-filter/);
  assert.match(experience,/incidentFilter==='ONGOING'/);
  assert.match(experience,/visibleIncidents=incidentFilter==='ONGOING'\?ongoing:incidents/);
  assert.match(experience,/setIncidentFilter\('ALL'\)/);
  assert.match(experience,/open\('concern'\)/);
  assert.match(experience,/open\('guidance'\)/);
  assert.match(experience,/aquacare-v1-history-filter/);
  assert.match(style,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(style,/\.aquacare-stage04-filter button.active/);
});
