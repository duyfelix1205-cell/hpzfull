import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const css=read('frontend/src/zwmarket.css');
const jsx=read('frontend/src/ZwMarketPage.jsx');

test('ISS-0125 palette contains all locked colors and preserves moderation semantics',()=>{
 const colors=['#06141C','#091B24','#102630','#18343D','#203F47','#29434B','#6B8A94','#79DCC5','#A1EBD8','#56BFA9','#153D38','#08251F','#BAF3E3','#EAF1ED','#B7C8C8','#90A9AE','#9ACB9B','#E5B96B','#ED9393','#9BBDE6','#A7B6BB','#F0D9B5','#D7A35D','#30291F'];
 for(const hex of colors)assert.ok(css.includes(hex),hex);
 assert.ok(jsx.includes("post.moderation_status==='PENDING'?'info'"));
 assert.ok(jsx.includes("post.moderation_status==='REJECTED'?'warning'"));
});
test('ISS-0127 warm halo does not repaint image pixels',()=>{
 assert.match(css,/0 0 36px rgba\(215,163,93,.12\)/);
 assert.match(css,/\.zwm-app \.zwm-warmth\{background:none!important\}/);
 const layer=css.split('ISS-2026-0125 / 0127')[1];
 assert.doesNotMatch(layer,/\.zwm-photo\s*\{[^}]*filter:/);
});
test('ISS-0128/0129 seller strip uses existing counters and action',()=>{
 for(const token of ['zwm-personal-market--strip','myActive.length','myInMarket','myPending','myAttention',"navigate('mine')","marketApi.mine()"])assert.ok(jsx.includes(token),token);
 assert.match(css,/\.zwm-app \.zwm-personal-market--strip/);
 assert.match(css,/@media\(max-width:720px\)/);
});
test('ISS-0130 Stage artwork byte identity and dynamic behavior preserved',()=>{
 const bytes=readFileSync(new URL('../../frontend/public/zwmarket/stage.png',import.meta.url));
 const gitBlob=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 assert.equal(gitBlob,'80237fa405c52f101fc578c24c91071caac82a8b');
 for(const token of ['sessionStageView(activeSession,now)','formatSessionTime(activeSession)',"openSession(activeSession)",'stageView.hasTimeline']) assert.ok(jsx.includes(token),token);
 assert.match(css,/url\('\/zwmarket\/stage.png'\)/);
});
