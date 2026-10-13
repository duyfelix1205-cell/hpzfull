import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogContentPatch, isIncompleteContent, normalizeDisplaySections, normalizeSlug } from '../src/lib/catalog-content.js';

test('normalizes slug and accepts catalog-owned fields', () => {
  assert.equal(normalizeSlug('bleheri-rainbow'), 'bleheri-rainbow');
  const patch = catalogContentPatch({ slug:'altum-peru', description:'x', product_name:'must-not-write', available_qty:999 });
  assert.equal(patch.slug, 'altum-peru');
  assert.equal(patch.description, 'x');
  assert.equal('product_name' in patch, false);
  assert.equal('available_qty' in patch, false);
});

test('rejects invalid slug', () => {
  assert.throws(() => normalizeSlug('Altum Peru'), /Slug must contain/);
});

test('incomplete requires slug, short and long descriptions', () => {
  assert.equal(isIncompleteContent({ slug:'x', short_description:'short', description:'long' }), false);
  assert.equal(isIncompleteContent({ slug:'x', short_description:'', description:'long' }), true);
});

test('normalizes customizable viewer sections', () => {
  assert.deepEqual(normalizeDisplaySections([{id:'food',title:' Thức ăn ',text:'  Artemia  '},{title:'',text:''}]),[{id:'food',title:'Thức ăn',text:'Artemia'}]);
  const patch=catalogContentPatch({display_sections_json:[{title:'Nhiệt độ',text:'24–28°C'}]});
  assert.equal(patch.display_sections_json[0].title,'Nhiệt độ');
  assert.throws(()=>normalizeDisplaySections('bad'),/must be an array/);
});
