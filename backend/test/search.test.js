import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSearch,SEARCH_TRANSLATE_FROM,SEARCH_TRANSLATE_TO } from '../src/lib/search.js';

test('normalizeSearch strips Vietnamese accents and handles đ',()=>{
  assert.equal(normalizeSearch('  Cá Đĩa chữa bệnh  '),'ca dia chua benh');
  assert.equal(normalizeSearch('Ưu Đãi Tháng 9'),'uu dai thang 9');
});

test('normalizeSearch makes composed and decomposed Vietnamese input equivalent',()=>{
  const composed='bống';
  const decomposed=composed.normalize('NFD');
  assert.equal(normalizeSearch(composed),'bong');
  assert.equal(normalizeSearch(decomposed),'bong');
});

test('PostgreSQL translate maps have equal length',()=>{
  assert.equal([...SEARCH_TRANSLATE_FROM].length,[...SEARCH_TRANSLATE_TO].length);
});
