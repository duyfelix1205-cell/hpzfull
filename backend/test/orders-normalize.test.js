import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOrdersItem } from '../src/adapters/orders-normalize.js';

test('normalizes valid Orders item', () => {
  const row = normalizeOrdersItem({ product_id:'PRD-001', name:'Fish', available_qty:'12', list_price:'100000' });
  assert.equal(row.product_id, 'PRD-001');
  assert.equal(row.available_qty, 12);
  assert.equal(row.list_price, 100000);
});

test('rejects non-canonical id', () => {
  assert.throws(() => normalizeOrdersItem({ product_id:'001', name:'Fish' }), /Invalid canonical product_id/);
});

test('rejects missing name', () => {
  assert.throws(() => normalizeOrdersItem({ product_id:'PRD-001', name:'' }), /Missing product name/);
});
