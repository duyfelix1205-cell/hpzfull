import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {ZWM_ICON_CATEGORY_MAP,resolveZwmCategoryIcon} from '../../frontend/src/zwmarket-category-icon-map.js';

const src=file=>readFileSync(new URL('../../'+file,import.meta.url),'utf8');
const root=new URL('../../frontend/public/zwmarket/category-icons/v1.5.2/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',root),'utf8'));

test('ISS-2026-0136 approved FV05 V1.5.2 Manifest has exact 24 deterministic label mappings',()=>{
 assert.equal(manifest.length,24);
 assert.equal(Object.keys(ZWM_ICON_CATEGORY_MAP).length,24);
 assert.deepEqual(Object.values(ZWM_ICON_CATEGORY_MAP).sort(),manifest.map(x=>x.name).sort());
 for(const entry of manifest){
  assert.equal(resolveZwmCategoryIcon(entry.display_name),entry.name);
  assert.equal(entry.status,'READY_FOR_WEB_UAT_NOT_VISUAL_APPROVED');
 }
 assert.equal(resolveZwmCategoryIcon('Khác'),null);
 assert.equal(resolveZwmCategoryIcon('Danh mục do người đăng tự tạo'),null);
 assert.equal(resolveZwmCategoryIcon('Cá Cảnh'), 'fish');
 assert.equal(resolveZwmCategoryIcon('Không xác định'),null);
});

test('each approved original WebP/PNG is present with ZIP manifest SHA-256, no recreated images',()=>{
 for(const entry of manifest){
  for(const format of ['webp','png']){
   const item=entry.files[format];
   const url=new URL(item.file,root);
   assert.ok(existsSync(url),'missing exact image: '+item.file);
   const bytes=readFileSync(url);
   assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256,item.file);
   assert.ok(format==='png'?bytes.subarray(0,4).equals(Buffer.from([137,80,78,71])):bytes.subarray(0,4).toString()==='RIFF',item.file);
   assert.deepEqual(item.size,format==='webp'?[256,256]:[512,512]);
  }
 }
});

test('existing category filter and listing category badge only receive optional presentation icons',()=>{
 const ui=src('frontend/src/ZwMarketPage.jsx');
 const icon=src('frontend/src/ZwmCategoryIcon.jsx');
 assert.match(ui,/categories\.map\(x=><button key=\{x\.category\}/);
 assert.match(ui,/onClick=\{\(\)=>setCategory\(x\.category\)\}/);
 assert.match(ui,/ZwmCategoryIcon category=\{x\.category\}/);
 assert.match(ui,/ZwmCategoryIcon category=\{tag\} small/);
 assert.match(ui,/p\.category===category/);
 assert.match(ui,/const emptyDraft=account=>\(\{title:'',category:'Khác'/);
 assert.match(icon,/if\(!id\)return null/);
 assert.match(icon,/<source type="image\/webp"/);
 assert.match(icon,/alt=""/);
 assert.doesNotMatch(ui,/setCategory\(resolveZwmCategoryIcon/);
});

test('original Navy, no image effects, responsive containment and accessible text labels',()=>{
 const css=src('frontend/src/zwmarket.css');
 assert.match(css,/\.zwm-category-icon img\{/);
 assert.match(css,/object-fit:contain/);
 assert.match(css,/filter:none/);
 assert.match(css,/mix-blend-mode:normal/);
 assert.match(css,/@media\(max-width:720px\)/);
 const report=readFileSync(new URL('EXTRACTION_REPORT.txt',root),'utf8');
 assert.match(report,/WEB UAT/);
 assert.match(report,/glow can be cut/i);
 assert.match(report,/Navy background/);
});
