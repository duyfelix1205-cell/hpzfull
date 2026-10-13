import test from'node:test';
import assert from'node:assert/strict';
import{taxonomyDefinition,taxonomyOptionValue}from'../src/lib/content-taxonomy.js';

test('content taxonomy exposes the two managed classification scopes',()=>{
 assert.equal(taxonomyDefinition('journal-type')?.scope,'JOURNAL_TYPE');
 assert.equal(taxonomyDefinition('wiki-category')?.scope,'WIKI_CATEGORY');
 assert.equal(taxonomyDefinition('unknown'),null);
});

test('journal option values are stable machine keys while wiki keeps readable category value',()=>{
 assert.equal(taxonomyOptionValue('journal-type','Sự kiện đặc biệt'),'SU_KIEN_DAC_BIET');
 assert.equal(taxonomyOptionValue('wiki-category','  Chăm sóc nâng cao  '),'Chăm sóc nâng cao');
});
