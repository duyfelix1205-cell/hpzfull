import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const page=read('frontend/src/ZwMarketPage.jsx');
const style=read('frontend/src/zwmarket.css');
const app=read('frontend/src/main.jsx');

test('ISS-2026-0145 ZWMarket mobile navigation uses real authorized route handlers',()=>{
  assert.match(page,/className="zwm-mobile-nav" aria-label="Điều hướng ZWMarket trên điện thoại"/);
  assert.match(page,/\{navItems\.map\(/);
  assert.match(page,/onClick=\{\(\)=>onRoute\('notifications'\)\}/);
  assert.match(page,/onClick=\{\(\)=>onRoute\('help'\)\}/);
  assert.match(page,/onClick=\{\(\)=>onRoute\(id\)\}/);
  assert.match(page,/aria-current=\{route===id\?'page':undefined\}/);
  assert.match(page,/value==='create'\?openCreate\(\):navigate\(value\)/);
  assert.match(page,/const openCreate=\(\)=>\{if\(!account\)/);
});

test('mobile search, HPZ account and bottom bar stay reachable with safe-area spacing',()=>{
  assert.match(style,/\.zwm-app \.zwm-topbar\{[\s\S]*?display:grid!important/);
  assert.match(style,/\.zwm-app \.zwm-mobile-nav\{[\s\S]*?display:flex!important/);
  assert.match(style,/\.zwm-main\{padding:14px 14px calc\(104px \+ env\(safe-area-inset-bottom\)\)!important\}/);
  assert.match(style,/overflow-x:auto!important/);
  assert.match(style,/scroll-snap-type:x proximity/);
  assert.match(style,/\.zwm-app \.zwm-account-link/);
  assert.match(style,/\.zwm-sidebar nav\{display:none!important\}/);
});

test('existing ZWMarket and unrelated application routing remain unchanged',()=>{
  assert.match(app,/market\?ZwMarketPage/);
  assert.match(app,/content\?ContentHub/);
  assert.match(page,/publicApi\.listMarketPosts/);
  assert.match(page,/marketApi\.mine/);
  assert.match(page,/marketApi\.sessions/);
  assert.match(page,/MarketModal/);
  assert.doesNotMatch(page,/demoRole|setDemoRole|mockPosts|sampleOrder/);
});

test('rejected React candidate is revised: four mobile tabs and actual HPZ account entry',()=>{
  const parity=read('frontend/src/zwmarket-astra6.css');
  assert.match(page,/className="zwm-mobile-account"/);
  assert.match(page,/href=\{accountHref\}/);
  assert.match(page,/account\?account\.display_name/);
  assert.match(parity,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)!important/);
  assert.match(parity,/overflow-x:hidden!important/);
  assert.match(parity,/\.zwm-app \.zwm-mobile-account/);
  assert.match(parity,/\.zwm-app \.zwm-search/);
  assert.match(parity,/\.zwm-app \.zwm-stage-cta/);
  assert.doesNotMatch(parity,/demoRole|sampleOrder|mockPosts/);
});
