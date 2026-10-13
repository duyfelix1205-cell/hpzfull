import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('INT-CAT-OPS-001 is GET-only, scoped and keeps engagement separate from revenue', async () => {
  const source = await readFile(new URL('../src/routes/operations-read.js', import.meta.url), 'utf8');
  assert.match(source, /NEXORA_OPERATIONS_READ_SECRET|operationsReadSecret/);
  assert.match(source, /x-nexora-consumer/);
  assert.match(source, /source_app: 'product-catalog'/);
  assert.match(source, /crm_instance_id: 'product-catalog'/);
  assert.match(source, /ops-metrics\.v1/);
  for (const verb of [".post(", ".put(", ".patch(", ".delete("]) assert.equal(source.includes(verb), false);
  for (const metric of [
    'catalog.products_published',
    'catalog.products_stale_stock',
    'catalog.products_missing_description',
    'catalog.products_missing_primary_media',
    'catalog.market_visible_posts',
    'catalog.market_clicks'
  ]) assert.ok(source.includes(metric), metric);
  assert.match(source, /must not be combined with Orders\/Sales revenue/);
  assert.doesNotMatch(source, /seller_contact|customer_email|customer_phone/);
});
