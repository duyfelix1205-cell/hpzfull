import test from 'node:test';
import assert from 'node:assert/strict';
import { stockFreshness } from '../src/lib/freshness.js';
const now=new Date('2026-09-17T00:00:00Z').getTime();
test('fresh stock remains non-stale',()=>assert.deepEqual(stockFreshness({inventoryUpdatedAt:'2026-09-16T23:58:00Z',thresholdSeconds:300,now}),{stock_stale:false,stock_age_seconds:120}));
test('old or missing stock becomes stale',()=>{assert.equal(stockFreshness({syncedAt:'2026-09-16T23:50:00Z',thresholdSeconds:300,now}).stock_stale,true);assert.equal(stockFreshness({thresholdSeconds:300,now}).stock_stale,true)});
