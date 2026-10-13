import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { legacyMediaMime, legacyStorageKey, makeLegacyKey, normalizeLegacyText, safeLegacyAssetPath, toLegacyRecord, validateLegacyDataset } from '../src/lib/legacy.js';

test('legacy normalization is deterministic without fuzzy matching',()=>{
  assert.equal(normalizeLegacyText(' Cá  Đĩa\u00a0Royal '),'cá đĩa royal');
  assert.notEqual(normalizeLegacyText('Cá Đĩa Royal'),normalizeLegacyText('Ca Dia Royal'));
});
test('legacy record preserves catalog-owned content and legacy reference values',()=>{
  const r=toLegacyRecord({vn:'Cá X',en:'Fish X',desc:'Mô tả',price:123,gallery:['assets/img/x.jpg']},2);
  assert.match(r.legacy_key,/^hpz-fish-/); assert.equal(r.description,'Mô tả'); assert.equal(r.legacy_price,123); assert.deepEqual(r.gallery,['assets/img/x.jpg']);
});
test('dataset rejects duplicate keys',()=>{
  assert.throws(()=>validateLegacyDataset({items:[{legacy_key:'a'},{legacy_key:'a'}]}),/duplicate/);
});
test('legacy media path rejects traversal and unsupported types',()=>{
  assert.throws(()=>safeLegacyAssetPath('/tmp/legacy','assets/img/../../secret.jpg'),/escapes/);
  assert.equal(legacyMediaMime('assets/img/a.webp'),'image/webp'); assert.equal(legacyMediaMime('assets/img/a.svg'),null);
  assert.match(legacyStorageKey('PRD-ABC','assets/img/a.webp'),/^PRD-ABC\/legacy-[a-f0-9]{16}\.webp$/);
  assert.equal(safeLegacyAssetPath('/tmp/legacy','assets/img/a.jpg'),path.resolve('/tmp/legacy/assets/img/a.jpg'));
});
test('legacy keys include index so duplicate legacy names do not collide',()=>{
  const f={vn:'Same',en:'Same'}; assert.notEqual(makeLegacyKey(f,1),makeLegacyKey(f,2));
});
