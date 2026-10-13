import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const source=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const page=source('frontend/src/ZwMarketPage.jsx');
const css=source('frontend/src/zwmarket.css');

test('ISS-0130 keeps Stage artwork unchanged and off the sidebar',()=>{
 const img=readFileSync(new URL('../../frontend/public/zwmarket/stage.png',import.meta.url));
 const sha=createHash('sha1').update('blob '+img.length+String.fromCharCode(0)).update(img).digest('hex');
 assert.equal(sha,'80237fa405c52f101fc578c24c91071caac82a8b');
 // ISS-2026-0143: exact byte-for-byte match to the LOCKed Visual Master V2's
 // embedded Stage PNG, independently recovered and hashed from that HTML.
 assert.equal(img.length,2769427,'Owner master has 2,769,427 bytes');
 assert.deepEqual([img.readUInt32BE(16),img.readUInt32BE(20)],[2048,768],'Owner master is 2048×768');
 assert.equal(createHash('sha256').update(img).digest('hex'),
  '826f972c903ae44dfac4d91ac493d921ad0e853e30adf6319b373a2dfe50005d',
  'Stage must be byte-identical to the LOCKed ZWM-A01 master');

 assert.ok(css.split("url('/zwmarket/stage.png')").length-1>=1, 'Hero must keep its original Stage bitmap');
 assert.ok(css.includes("background-image:url('/zwmarket/stage.png')"));
 const side=css.substring(css.lastIndexOf('.zwm-side-art{'),css.indexOf('}',css.lastIndexOf('.zwm-side-art{')));
 assert.ok(!side.includes('stage.png'));
 const allStageRefs=css.split("url('/zwmarket/stage.png')").length-1;
 const stageOnlyRefs=[...css.matchAll(/\.zwm-stage\s*\{[^}]*background-image:url\('\/zwmarket\/stage\.png'\)/g)].length;
 assert.ok(allStageRefs>0,'The verified artwork must appear on Session Stage');
 assert.equal(allStageRefs,stageOnlyRefs,
  'Every A01 image use must be scoped to the Session Stage; never Sidebar or elsewhere');
 assert.ok(!page.includes('zwmarket/stage.png'), 'Do not embed the master in sidebar JSX or other surfaces');

});
test('ISS-0130 retains dynamic session data and existing CTA behavior',()=>{
 assert.ok(page.includes('<h1>Chợ cá cuối tuần.</h1>'));
 for(const token of ['sessionStageView(activeSession,now)','formatSessionTime(activeSession)','stageView.hasTimeline','openSession(activeSession)','stageView.label','stageView.prefix','sessionPublicCount'])assert.ok(page.includes(token),token);
});
test('ISS-0131 rejects unverified icon replacement and preserves filters',()=>{
 assert.ok(source('docs/ZWMarket_ASSET_AUDIT_0130_0131.md').includes('ASSET EXPORT INCOMPLETE'));
 assert.ok(page.includes('categories.map(x=><button'));
 assert.ok(!page.includes('ZWM_2D_Icon_System_V1'));
});
