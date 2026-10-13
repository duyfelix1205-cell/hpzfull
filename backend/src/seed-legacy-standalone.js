import vm from 'node:vm';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { pool, tx } from './db.js';
import { config } from './config.js';

const LEGACY_COMMIT='865168e0933c72bc0e390a9c1fe694f00a24b7ff';
const BASE=`https://raw.githubusercontent.com/LightZex/hpz-aquaroom/${LEGACY_COMMIT}`;
const scripts=['fish-data.js','fish-fix.js','chuotmy-fix.js','paraiba-fix.js','red-devil-fix.js','cobalt-fix.js','royal-fix.js','mana-altum-fix.js','ica-bar-fix.js','red-allen-fix.js'];
const slugify=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120)||'item';
const idFor=(vn,en)=>`PRD-LEGACY-${createHash('sha1').update(`${vn}|${en}`).digest('hex').slice(0,12).toUpperCase()}`;
const priceNumber=v=>{if(typeof v==='number'&&Number.isFinite(v))return v;const first=String(v||'').split(/\s+-\s+/)[0];const m=first.match(/[0-9][0-9.,]*/);if(!m)return null;const digits=m[0].replace(/\D/g,'');return digits?Number(digits):null};
const priceText=v=>v===null||v===undefined||v===''?null:(typeof v==='number'?`${new Intl.NumberFormat('vi-VN').format(v)}đ`:String(v));
const short=s=>{const x=String(s||'').trim();return x.length<=260?x:`${x.slice(0,257).trim()}...`};
const mimeFor=p=>{const e=path.extname(p).toLowerCase();return e==='.png'?'image/png':e==='.webp'?'image/webp':e==='.gif'?'image/gif':'image/jpeg'};
const safeName=(p,i)=>`${String(i).padStart(3,'0')}-${path.basename(p).replace(/[^A-Za-z0-9._-]+/g,'-')}`;
const legacyCategory=f=>String(f.categoryLabel||f.category||f.cat||f.group||f.type||'').trim();

async function loadRuntime(){const context={console,document:{addEventListener(){},getElementById(){return null}},location:{search:''},URLSearchParams};vm.createContext(context);for(const file of scripts){const r=await fetch(`${BASE}/assets/js/${file}`);if(!r.ok)throw new Error(`legacy script ${file}: HTTP ${r.status}`);vm.runInContext(await r.text(),context,{filename:file})}return JSON.parse(vm.runInContext('JSON.stringify(FISH)',context));}
async function ensureImage(productId,src,index,alt,client){if(!/^assets\/img\//.test(src)||src.includes('..'))return false;const found=(await client.query('SELECT media_id FROM catalog_media WHERE product_id=$1 AND legacy_source_path=$2',[productId,src])).rows[0];if(found)return false;const dir=path.join(config.mediaRoot,'legacy',productId);const key=path.posix.join('legacy',productId,safeName(src,index));const target=path.join(config.mediaRoot,key);await mkdir(dir,{recursive:true});try{await access(target)}catch{const r=await fetch(`${BASE}/${src.split('/').map(encodeURIComponent).join('/')}`);if(!r.ok)throw new Error(`legacy image ${src}: HTTP ${r.status}`);await writeFile(target,Buffer.from(await r.arrayBuffer()),{flag:'wx'}).catch(e=>{if(e.code!=='EEXIST')throw e})}const n=Number((await client.query('SELECT COUNT(*)::int n FROM catalog_media WHERE product_id=$1',[productId])).rows[0].n);await client.query(`INSERT INTO catalog_media(product_id,media_type,storage_key,alt_text,sort_order,is_primary,original_name,mime_type,file_size,legacy_source_path) VALUES($1,'IMAGE',$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,[productId,key,alt,index,n===0,path.basename(src),mimeFor(src),null,src]);return true;}

async function run(){
  if(!config.standaloneMode||!config.seedLegacyStandalone){console.log('legacy standalone seed skipped');return}
  await pool.query(`UPDATE catalog_content SET publish_status='HIDDEN',updated_at=now() WHERE product_id IN (SELECT product_id FROM catalog_product_source WHERE source_kind='ORDERS') AND publish_status='PUBLISHED'`);
  const fish=await loadRuntime();let created=0,updated=0,images=0,categories=0;
  for(let i=0;i<fish.length;i++){
    const f=fish[i]||{};const name=String(f.vn||f.en||`Cá ${i+1}`).trim();const en=String(f.en||'').trim()||null;const productId=idFor(name,en||'');const slugBase=slugify(en||name);
    const comboNumeric=f.combo&&typeof f.combo==='object'?Object.fromEntries(Object.entries(f.combo).map(([k,v])=>[k,priceNumber(v)]).filter(([,v])=>v!==null)):{};
    const comboText=f.combo&&typeof f.combo==='object'?Object.fromEntries(Object.entries(f.combo).map(([k,v])=>[k,priceText(v)]).filter(([,v])=>v)):{};
    const categoryName=legacyCategory(f);
    const wasCreated=await tx(async client=>{
      const existed=Boolean((await client.query('SELECT 1 FROM catalog_product_source WHERE product_id=$1',[productId])).rows[0]);
      await client.query(`INSERT INTO catalog_product_source(product_id,product_name,sale_status,available_qty,list_price,combo_prices_json,combo_prices_text_json,source_updated_at,inventory_updated_at,synced_at,sync_state,source_kind,price_text,product_type) VALUES($1,$2,'ACTIVE',NULL,$3,$4::jsonb,$5::jsonb,now(),now(),now(),'OK','LOCAL',$6,'FISH') ON CONFLICT(product_id) DO UPDATE SET product_name=EXCLUDED.product_name,list_price=EXCLUDED.list_price,combo_prices_json=EXCLUDED.combo_prices_json,combo_prices_text_json=EXCLUDED.combo_prices_text_json,source_kind='LOCAL',price_text=EXCLUDED.price_text,synced_at=now()`,[productId,name,priceNumber(f.price),JSON.stringify(comboNumeric),JSON.stringify(comboText),priceText(f.price)]);
      let slug=slugBase;const slugOwner=(await client.query('SELECT product_id FROM catalog_content WHERE slug=$1 AND product_id<>$2',[slug,productId])).rows[0];if(slugOwner)slug=`${slugBase}-${productId.slice(-6).toLowerCase()}`;
      await client.query(`INSERT INTO catalog_content(product_id,slug,secondary_name,short_description,description,origin,size_text,care_info,selling_points_json,video_url,publish_status,featured,sort_order,stock_display_mode,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,'PUBLISHED',$11,$12,'HIDDEN',now(),now()) ON CONFLICT(product_id) DO UPDATE SET slug=COALESCE(NULLIF(catalog_content.slug,''),EXCLUDED.slug),secondary_name=COALESCE(NULLIF(catalog_content.secondary_name,''),EXCLUDED.secondary_name),short_description=COALESCE(NULLIF(catalog_content.short_description,''),EXCLUDED.short_description),description=COALESCE(NULLIF(catalog_content.description,''),EXCLUDED.description),origin=COALESCE(NULLIF(catalog_content.origin,''),EXCLUDED.origin),size_text=COALESCE(NULLIF(catalog_content.size_text,''),EXCLUDED.size_text),care_info=COALESCE(NULLIF(catalog_content.care_info,''),EXCLUDED.care_info),video_url=COALESCE(NULLIF(catalog_content.video_url,''),EXCLUDED.video_url),publish_status=CASE WHEN catalog_content.publish_status IN ('DRAFT','HIDDEN') AND catalog_content.updated_at=catalog_content.created_at THEN 'PUBLISHED' ELSE catalog_content.publish_status END,sort_order=LEAST(catalog_content.sort_order,EXCLUDED.sort_order),updated_at=now()`,[productId,slug,en,short(f.desc),String(f.desc||'').trim()||null,String(f.origin||'').trim()||null,String(f.size||'').trim()||null,[f.temp&&`Nhiệt độ: ${f.temp}`,f.food&&`Thức ăn: ${f.food}`].filter(Boolean).join(' · ')||null,JSON.stringify([f.promo&&f.promo!=='Không có'?String(f.promo):null].filter(Boolean)),String(f.video||'').trim()||null,i<4,i]);
      if(categoryName){const categorySlug=slugify(categoryName);const cat=(await client.query(`INSERT INTO catalog_category(name,slug,status,sort_order) VALUES($1,$2,'ACTIVE',$3) ON CONFLICT(slug) DO UPDATE SET status='ACTIVE',updated_at=now() RETURNING category_id`,[categoryName,categorySlug,i])).rows[0];await client.query(`INSERT INTO catalog_product_category(product_id,category_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,[productId,cat.category_id]);categories++}
      for(const [j,src] of (Array.isArray(f.gallery)?f.gallery:[]).entries())if(await ensureImage(productId,String(src),j,name,client))images++;
      return !existed;
    });
    wasCreated?created++:updated++;
  }
  console.log(JSON.stringify({legacy_commit:LEGACY_COMMIT,effective_fish:fish.length,created,updated,images,category_assignments:categories},null,2));
}

run().then(()=>pool.end()).catch(async e=>{console.error(e);await pool.end().catch(()=>{});process.exit(1)});
