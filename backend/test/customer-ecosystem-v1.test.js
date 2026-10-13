import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { guidanceFor, decorateVisualAsset, canonicalizeTankSpecies } from '../src/routes/aquacare.js';
import { buildFishInstances, preferredZone, renderPolicy } from '../../frontend/src/aquacare-visual-model.js';
import { normalizeCatalogFish, filterCatalogFish, addCatalogFishSelection } from '../../frontend/src/aquacare-fish-picker-model.js';
import { FISH_2D_ATLAS, fish2dSpeciesForName, fish2dSprite } from '../../frontend/src/fish-2d-library.js';

test('AquaCare gasp guidance keeps emergency and water checks',()=>{
  const steps=guidanceFor({issue_type:'gasp'},{nh3_nh4_mg_l:'0.20',no2_mg_l:'0'});
  assert.ok(steps.some(x=>x.level==='critical'&&/liên hệ/i.test(x.body)));
  assert.ok(steps.some(x=>/trao đổi khí/i.test(x.title)));
  assert.ok(steps.some(x=>/chỉ số nước/i.test(x.title)));
});

test('AquaCare normal issue guidance never invents medicine instructions',()=>{
  const steps=guidanceFor({issue_type:'spots'},null);
  assert.ok(steps.length>0);
  assert.equal(steps.some(x=>/liều cụ thể|mg\/kg|ml\/l/i.test(x.body)),false);
});

test('ecosystem migration is additive-only for existing production data',()=>{
  const sql=fs.readFileSync(new URL('../db/migrations/018_hpz_customer_ecosystem_v1.sql',import.meta.url),'utf8');
  assert.match(sql,/CREATE SCHEMA IF NOT EXISTS aquacare/i);
  assert.match(sql,/CREATE TABLE IF NOT EXISTS aquacare\.tank/i);
  assert.match(sql,/CREATE TABLE IF NOT EXISTS community\.post/i);
  assert.doesNotMatch(sql,/\bDROP\s+(TABLE|SCHEMA|COLUMN)\b/i);
  assert.doesNotMatch(sql,/\bTRUNCATE\b/i);
  assert.doesNotMatch(sql,/\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(sql,/\bUPDATE\s+(catalog_|customer_accounts|catalog\.)/i);
});


test('AquaCare 2D V2 renders the exact selected fish quantity',()=>{
  const items=[
    {tank_item_id:'a',item_type:'FISH',species_name:'Ranchu',quantity:5,visual_asset:{image_url:'/media/ranchu.png'}},
    {tank_item_id:'b',item_type:'FISH',species_name:'Neon',quantity:12,visual_asset:{image_url:null}},
    {tank_item_id:'c',item_type:'EQUIPMENT',product_name:'Filter',quantity:1}
  ];
  const fish=buildFishInstances(items);
  assert.equal(fish.length,17);
  assert.equal(fish.filter(x=>x.visual_source==='real').length,5);
  assert.equal(fish.filter(x=>x.visual_source==='fallback').length,12);
  assert.equal(new Set(fish.map(x=>x.id)).size,17);
});

test('AquaCare 2D V2 assigns stable swim zones and scales animation density without dropping fish',()=>{
  assert.equal(preferredZone('Cory chuột panda'),'bottom');
  assert.equal(preferredZone('Guppy bảy màu'),'top');
  assert.equal(preferredZone('Ranchu'),'middle');
  assert.ok(renderPolicy(500).fps<=20);
});

test('AquaCare visual asset reuses existing catalog primary media and otherwise falls back to generated 2D',()=>{
  const real=decorateVisualAsset({tank_item_id:'x',product_id:'PRD-1',primary_storage_key:'products/fish.png'});
  const fallback=decorateVisualAsset({tank_item_id:'y',species_name:'Cá nhập ngoài',primary_storage_key:null});
  assert.equal(real.visual_asset.mode,'CATALOG_PRIMARY');
  assert.match(real.visual_asset.image_url,/fish\.png/);
  assert.equal(fallback.visual_asset.mode,'ANIMATED_FALLBACK');
  assert.equal(fallback.visual_asset.image_url,null);
  assert.equal('primary_storage_key' in real,false);
});




test('shared 2D fish library maps the ten approved real-color species without changing unknown fallbacks',()=>{
  const cases=[
    ['Betta Halfmoon','betta'],
    ['Cá chép Koi Kohaku','koi'],
    ['Cá Hề Ocellaris','clownfish'],
    ['Cá Đĩa Blue Turquoise','discus'],
    ['Cá Thần Tiên Silver','angelfish'],
    ['Oranda Red White','oranda'],
    ['Cá Rồng Golden','arowana'],
    ['Cá Nóc Spotted','puffer'],
    ['Blue Tang Pacific','blue_tang'],
    ['Cá Mập Reef','shark']
  ];
  for(const[name,id]of cases)assert.equal(fish2dSpeciesForName(name)?.id,id,name);
  assert.equal(fish2dSpeciesForName('Neon vua'),null);
  assert.equal(FISH_2D_ATLAS,'/assets/fish2d/fish-2d-real-v1.webp');
  const sprite=fish2dSprite('Cá Hề Ocellaris');
  assert.deepEqual([sprite.sx,sprite.sy,sprite.sw,sprite.sh],[200,0,100,50]);
});

test('shared 2D fish atlas is shipped same-origin and stays compact',()=>{
  const url=new URL('../../frontend/public/assets/fish2d/fish-2d-real-v1.webp',import.meta.url);
  assert.equal(fs.existsSync(url),true);
  const size=fs.statSync(url).size;
  assert.ok(size>5000,'atlas should contain rendered fish sprites');
  assert.ok(size<100000,'atlas should remain lightweight for web aquariums');
  const canvas=fs.readFileSync(new URL('../../frontend/src/AquaTankCanvas.jsx',import.meta.url),'utf8');
  assert.match(canvas,/fish\.image_url\?null:fish2dSprite\(fish\.name\)/);
  assert.match(canvas,/if\(imgRow\?\.ready&&!imgRow\.failed\)drawRealFish/);
  assert.match(canvas,/else if\(s\.sprite&&spriteAtlas\.ready/);
});

test('AquaCare Catalog fish picker normalizes, searches and merges selected quantities',()=>{
  const items=normalizeCatalogFish([
    {product_id:'PRD-2',name:'Neon Vua',secondary_name:'Paracheirodon',sale_status:'STOCK'},
    {product_id:'PRD-1',name:'Ranchu',secondary_name:'Carassius auratus',sale_status:'SOLD'}
  ]);
  assert.deepEqual(items.map(x=>x.product_id),['PRD-2','PRD-1'].sort((a,b)=>{
    const names={'PRD-2':'Neon Vua','PRD-1':'Ranchu'}; return names[a].localeCompare(names[b],'vi');
  }));
  assert.equal(filterCatalogFish(items,'ranchu').length,1);
  assert.equal(filterCatalogFish(items,'Paracheirodon')[0].product_id,'PRD-2');
  const vietnamese=normalizeCatalogFish([
    {product_id:'PRD-3',name:'Ca\u0301 Đi\u0303a Da Beo',secondary_name:'Leopard Discus',sale_status:'ACTIVE'}
  ]);
  assert.equal(filterCatalogFish(vietnamese,'Cá Đĩa Beo')[0].product_id,'PRD-3');
  assert.equal(filterCatalogFish(vietnamese,'dia beo')[0].product_id,'PRD-3');
  const once=addCatalogFishSelection([],items.find(x=>x.product_id==='PRD-1'),3);
  const twice=addCatalogFishSelection(once,items.find(x=>x.product_id==='PRD-1'),2);
  assert.equal(twice.length,1);
  assert.equal(twice[0].quantity,5);
  assert.equal(twice[0].product_id,'PRD-1');
});

test('AquaCare backend canonicalizes Catalog fish name from product_id and preserves manual legacy fish',()=>{
  const out=canonicalizeTankSpecies([
    {product_id:'PRD-1',species_name:'Tên giả từ browser',quantity:2,source:'MANUAL'},
    {product_id:'PRD-1',species_name:'Khác',quantity:3,source:'MANUAL'},
    {species_name:'Cá ngoài catalog cũ',quantity:4,source:'OTHER_STORE'}
  ],[
    {product_id:'PRD-1',product_name:'Ranchu Red White'}
  ]);
  assert.equal(out.length,2);
  const catalog=out.find(x=>x.product_id==='PRD-1');
  assert.equal(catalog.species_name,'Ranchu Red White');
  assert.equal(catalog.quantity,5);
  const manual=out.find(x=>!x.product_id);
  assert.equal(manual.species_name,'Cá ngoài catalog cũ');
  assert.equal(manual.quantity,4);
});

test('AquaCare rejects unknown Catalog product_id instead of trusting browser input',()=>{
  assert.throws(
    ()=>canonicalizeTankSpecies([{product_id:'PRD-NOT-REAL',species_name:'Fake',quantity:1}],[]),
    error=>error?.code==='AQUACARE_CATALOG_FISH_INVALID'
  );
});


test('shared customer navigation preserves legacy and ecosystem route inventory',()=>{
  const ui=fs.readFileSync(new URL('../../frontend/src/ui/HPZUI.jsx',import.meta.url),'utf8');
  for(const route of ['/catalog','/tanks','/nhat-bao','/wiki','/care','/market','/community','/policy','/#contact','/me']){
    assert.ok(ui.includes(route),'missing shared navigation route '+route);
  }
  const publicApp=fs.readFileSync(new URL('../../frontend/src/PublicApp.jsx',import.meta.url),'utf8');
  assert.match(publicApp,/path==='\/beca\.html'\|\|path==='\/catalog'/);
  assert.match(publicApp,/path==='\/be\.html'\|\|path==='\/tanks'/);
  assert.match(publicApp,/path\.startsWith\('\/fish\/'\)/);
  assert.match(publicApp,/path\.startsWith\('\/tank\/'\)/);
  assert.match(publicApp,/path==='\/detail\.html'/);

  const main=fs.readFileSync(new URL('../../frontend/src/main.jsx',import.meta.url),'utf8');
  assert.ok(main.includes("path==='/nhat-bao'"));
  assert.ok(main.includes("path==='/hpzwiki'"));
  assert.ok(main.includes("path==='/wiki'"));
  assert.ok(main.includes("['/chinhsach.html','/policy']"));

  const hub=fs.readFileSync(new URL('../../frontend/src/ContentHub.jsx',import.meta.url),'utf8');
  assert.match(hub,/ArticleShell active="journal"/);
  assert.match(hub,/ArticleShell active="wiki"/);

  const policy=fs.readFileSync(new URL('../../frontend/src/LegacyPolicy.jsx',import.meta.url),'utf8');
  assert.match(policy,/HPZAppShell active="policy"/);
});

test('homepage Admin header and footer configuration remains wired to shared viewer shell',()=>{
  const admin=fs.readFileSync(new URL('../../frontend/src/HomeAdmin.jsx',import.meta.url),'utf8');
  const viewer=fs.readFileSync(new URL('../../frontend/src/PublicApp.jsx',import.meta.url),'utf8');
  for(const key of ['brand_name','brand_tagline','home_label','fish_label','tanks_label','policy_label','contact_label']){
    assert.ok(admin.includes(key),'Home Admin missing header field '+key);
  }
  for(const key of ['location','facebook_label','facebook_href','copyright']){
    assert.ok(admin.includes(key),'Home Admin missing footer field '+key);
  }
  assert.match(viewer,/siteHeader=\{h\}/);
  assert.match(viewer,/siteFooter=\{f\}/);
  assert.match(viewer,/site\.header\|\|HOME_FALLBACK\.header/);
  assert.match(viewer,/site\.footer\|\|HOME_FALLBACK\.footer/);
});


test('HPZ shared shell mounts the original animated underwater scene on customer-facing pages',()=>{
  const ui=fs.readFileSync(new URL('../../frontend/src/ui/HPZUI.jsx',import.meta.url),'utf8');
  assert.match(ui,/import \{ LegacyScene, legacyAsset \} from '\.\.\/LegacyScene\.jsx'/);
  assert.match(ui,/<LegacyScene\/>/);
  assert.match(ui,/legacyAsset\('logo\.png'\)/);

  const scene=fs.readFileSync(new URL('../../frontend/src/LegacyScene.jsx',import.meta.url),'utf8');
  for(const token of ['fish_blue','fish_orange','bubble_a','turtle2','requestAnimationFrame']){
    assert.ok(scene.includes(token),'underwater scene missing '+token);
  }
});

test('HPZ shared customer theme keeps original deep navy glass palette instead of light surfaces',()=>{
  const css=fs.readFileSync(new URL('../../frontend/src/ui/hpz-theme.css',import.meta.url),'utf8');
  for(const token of ['#06121f','#0a1f33','#eaf6ff','#8fb6cf','#3fd0ff','#ff8a3d','rgba(10,31,51,.72)','rgba(15,42,66,.85)']){
    assert.ok(css.includes(token),'missing undersea palette token '+token);
  }
  assert.match(css,/\.hpz-app>#aquarium-bg/);
  assert.match(css,/\.hpz-card\{[\s\S]*background:var\(--hpz-surface\)/);
  assert.match(css,/\.hpz-btn--primary[\s\S]*linear-gradient\(90deg,var\(--hpz-cyan\),var\(--hpz-accent\)\)/);
});

test('HPZ Design System V2 documents the shared underwater visual contract',()=>{
  const doc=fs.readFileSync(new URL('../../docs/HPZ_DESIGN_SYSTEM_V2_UNDERSEA.md',import.meta.url),'utf8');
  assert.match(doc,/Current visual source of truth/i);
  assert.match(doc,/LegacyScene/);
  assert.match(doc,/Dark translucent glass only/i);
  assert.match(doc,/Do not use white page cards/i);
});


test('Journal and Wiki keep high-contrast text on Undersea V2 navy cards',()=>{
  const css=fs.readFileSync(new URL('../../frontend/src/ui/hpz-theme.css',import.meta.url),'utf8');
  assert.match(css,/\.hpz-app \.hpz-media-card__body h2[\s\S]*color:#f4fbff!important/);
  assert.match(css,/\.hpz-app \.hpz-media-card__body p[\s\S]*color:#d7ecfa!important/);
  assert.match(css,/\.hpz-app \.hpz-media-card__body \.hpz-muted[\s\S]*color:#b6d7e8!important/);
  assert.match(css,/\.hpz-app \.hpz-content-body[\s\S]*color:#edf8ff!important/);
});


test('legacy public compatibility wrapper never creates an internal page scrollbar',()=>{
  const css=fs.readFileSync(new URL('../../frontend/src/ui/hpz-theme.css',import.meta.url),'utf8');
  assert.match(css,/\.hpz-app \.legacy-public\.hpz-public-compat\{[\s\S]*overflow:visible!important/);
  assert.match(css,/\.hpz-app \.legacy-public\.hpz-public-compat\{[\s\S]*width:100%/);
});


test('HPZ LegacyScene preserves the original desktop background fish schools',()=>{
  const scene=fs.readFileSync(new URL('../../frontend/src/LegacyScene.jsx',import.meta.url),'utf8');
  assert.match(scene,/const SMALL_FISH=\['fish_grey','fish_green','fish_blue'\]/);
  assert.match(scene,/const FLOCK_GROUPS=3/);
  assert.match(scene,/Math\.floor\(rand\(9,14\)\)/);
  assert.match(scene,/if\(!mobile\)/);
  assert.match(scene,/flock\.forEach\(b=>/);
  assert.match(scene,/d2<420&&d2>0/);
  assert.match(scene,/sprite\(b\.name,b\.x,b\.y,w,h,b\.vx<0,\.62/);
});


test('HPZ underwater sprites are shipped same-origin and do not depend on GitHub Raw',()=>{
  const scene=fs.readFileSync(new URL('../../frontend/src/LegacyScene.jsx',import.meta.url),'utf8');
  assert.match(scene,/const LEGACY='\/assets\/hpz\/scene\/'/);
  assert.match(scene,/legacyAsset=path=>`\/assets\/hpz\/\$\{path\}`/);
  assert.equal(scene.includes('raw.githubusercontent.com'),false);

  const required=[
    'logo.png',
    'scene/fish_blue.png','scene/fish_brown.png','scene/fish_green.png','scene/fish_grey.png',
    'scene/fish_grey_long_a.png','scene/fish_grey_long_b.png','scene/fish_orange.png','scene/fish_pink.png','scene/fish_red.png',
    'scene/bubble_a.png','scene/bubble_b.png','scene/bubble_c.png','scene/turtle2.png'
  ];
  for(const rel of required){
    const url=new URL('../../frontend/public/assets/hpz/'+rel,import.meta.url);
    assert.equal(fs.existsSync(url),true,'missing local underwater asset '+rel);
    assert.ok(fs.statSync(url).size>0,'empty local underwater asset '+rel);
  }
});
