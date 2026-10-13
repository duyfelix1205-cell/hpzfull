import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root = new URL('../../', import.meta.url);
const source = path => readFileSync(new URL(path, root), 'utf8');
const review = source('frontend/src/zwmarket-astra6.css');
const base = source('frontend/src/zwmarket.css');
const app = source('frontend/src/main.jsx');
const page = source('frontend/src/ZwMarketPage.jsx');

test('ISS-2026-0145 matches explicitly Owner approved Astra6 review without demo UI', () => {
  assert.match(review, /ebb4221299d5199c160960d155eec357cc3a7b39184666cdc33f096cb406bf74/);
  assert.match(review, /font-family:system-ui,-apple-system/);
  assert.match(review, /\.zwm-app \.zwm-shell--rail/);
  assert.match(review, /\.zwm-app \.zwm-stage__content/);
  assert.match(review, /\.zwm-app \.zwm-products/);
  assert.match(review, /\.zwm-app \.zwm-modal/);
  assert.match(review, /\.zwm-app \.zwm-form-panel/);
  assert.match(review, /\.zwm-app \.zwm-empty--market/);
  assert.match(review, /\.zwm-app \.zwm-mobile-nav/);
  assert.match(review, /env\(safe-area-inset-bottom\)/);
  assert.doesNotMatch(review, /#review-tools|#review-notice|demoRole|mockPosts/);
});

test('Astra6 stylesheet applies after pre-existing ZWMarket CSS and does not alter other apps', () => {
  assert.ok(app.indexOf("import './zwmarket-astra6.css';") > app.indexOf("import './zwmarket.css';"));
  assert.match(app, /market\?ZwMarketPage/);
  assert.match(app, /content\?ContentHub/);
  assert.match(base, /\/zwmarket\/stage\.png/);
  assert.match(page, /publicApi\.listMarketPosts/);
  assert.match(page, /marketApi\.mine/);
  assert.match(page, /marketApi\.sessions/);
  assert.match(page, /marketApi\.create/);
  assert.match(page, /marketApi\.update/);
});

test('all reviewed screens remain connected to genuine application navigation', () => {
  assert.match(page, /\{navItems\.map\(/);
  assert.match(page, /onClick=\{\(\)=>onRoute\('notifications'\)\}/);
  assert.match(page, /onClick=\{\(\)=>onRoute\('help'\)\}/);
  assert.match(page, /route==='explore'\?explore/);
  assert.match(page, /route==='create'\?create/);
  assert.match(page, /route==='mine'\?mineView/);
  assert.match(page, /route==='notifications'\?notifications/);
  assert.match(page, /route==='help'\?help/);
  assert.match(page, /\{selectedPost&&<MarketModal/);
});
