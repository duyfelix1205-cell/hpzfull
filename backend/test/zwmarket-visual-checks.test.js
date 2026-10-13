import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const css=read('frontend/src/zwmarket.css');
const html=read('frontend/index.html');
const page=read('frontend/src/ZwMarketPage.jsx');
test('Market navigation and seller actions remain present',()=>{
  for(const marker of ['function ZwmShell','href="/market"','marketApi.mine','myInMarket','myPending','myAttention']) assert.ok(page.includes(marker),marker);
});
test('Approved typography and controlled glow are scoped to Market',()=>{
  for(const marker of ['family=Fraunces','family=Onest']) assert.ok(html.includes(marker),marker);
  for(const marker of ["font-family:'Onest'","font-family:'Fraunces'",'.zwm-app .zwm-brand img','ISS-2026-0120..0124']) assert.ok(css.includes(marker),marker);
});
test('Market density preserves interactive listings and navigation',()=>{
  for(const marker of ['.zwm-app .zwm-personal-market','.zwm-app .zwm-mini-stat','.zwm-app .zwm-mine-row','.zwm-app .zwm-row-actions .zwm-btn','.zwm-app .zwm-railbox','.zwm-app .zwm-listing']) assert.ok(css.includes(marker),marker);
});
