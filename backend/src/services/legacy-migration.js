import path from 'node:path';
import { copyFile, mkdir, stat } from 'node:fs/promises';
import { many, one, pool, tx } from '../db.js';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';
import { legacyMediaMime, legacyStorageKey, normalizeLegacyText, safeLegacyAssetPath, validateLegacyDataset } from '../lib/legacy.js';
import { safeMediaPath } from '../lib/media.js';

export async function stageLegacyDataset(input) {
  const items = validateLegacyDataset(input);
  const products = await many(`SELECT product_id,product_name FROM catalog_product_source ORDER BY product_id`);
  const result = { total: items.length, review_required: 0, unmatched: 0, already_confirmed: 0 };
  await tx(async client => {
    for (const item of items) {
      const existing = (await client.query(`SELECT * FROM catalog_legacy_mapping WHERE legacy_key=$1`, [item.legacy_key])).rows[0];
      if (existing?.manually_confirmed) {
        await client.query(`UPDATE catalog_legacy_mapping SET legacy_vn_name=$2,legacy_en_name=$3,legacy_payload=$4::jsonb,last_seen_at=now() WHERE legacy_key=$1`, [item.legacy_key,item.vn||null,item.en||null,JSON.stringify(item)]);
        result.already_confirmed += 1;
        continue;
      }
      const names = new Set([normalizeLegacyText(item.vn), normalizeLegacyText(item.en)].filter(Boolean));
      const candidates = products.filter(p => names.has(normalizeLegacyText(p.product_name)));
      const proposed = candidates.length === 1 ? candidates[0].product_id : null;
      const status = candidates.length ? 'REVIEW_REQUIRED' : 'UNMATCHED';
      const matchType = candidates.length === 1 ? 'EXACT_NORMALIZED_NAME' : (candidates.length > 1 ? 'AMBIGUOUS_EXACT_NAME' : null);
      await client.query(
        `INSERT INTO catalog_legacy_mapping(legacy_key,legacy_vn_name,legacy_en_name,proposed_product_id,match_type,match_status,confidence,manually_confirmed,legacy_payload,last_seen_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,false,$8::jsonb,now())
         ON CONFLICT(legacy_key) DO UPDATE SET legacy_vn_name=EXCLUDED.legacy_vn_name,legacy_en_name=EXCLUDED.legacy_en_name,
           proposed_product_id=EXCLUDED.proposed_product_id,match_type=EXCLUDED.match_type,match_status=EXCLUDED.match_status,
           confidence=EXCLUDED.confidence,manually_confirmed=false,legacy_payload=EXCLUDED.legacy_payload,last_seen_at=now()`,
        [item.legacy_key,item.vn||null,item.en||null,proposed,matchType,status,candidates.length===1?1:null,JSON.stringify(item)]
      );
      if (status === 'REVIEW_REQUIRED') result.review_required += 1; else result.unmatched += 1;
    }
  });
  return result;
}

export async function listLegacyMappings(status) {
  const params=[]; let where='TRUE';
  if (status) { params.push(String(status).toUpperCase()); where=`match_status=$1`; }
  return many(`SELECT legacy_key,legacy_vn_name,legacy_en_name,proposed_product_id,match_type,match_status,confidence,manually_confirmed,confirmed_at,imported_at,last_seen_at FROM catalog_legacy_mapping WHERE ${where} ORDER BY legacy_vn_name,legacy_key`, params);
}

export async function confirmLegacyMapping(legacyKey, productId) {
  if (!/^PRD-[A-Za-z0-9._-]+$/.test(String(productId||''))) throw new AppError('Invalid canonical product_id', { code:'LEGACY_PRODUCT_ID_INVALID' });
  const source = await one(`SELECT product_id,product_name FROM catalog_product_source WHERE product_id=$1`, [productId]);
  if (!source) throw new AppError('Canonical product not found in Orders read model', { code:'NOT_FOUND', status:404 });
  const conflict = await one(`SELECT legacy_key FROM catalog_legacy_mapping WHERE proposed_product_id=$1 AND manually_confirmed=true AND legacy_key<>$2`, [productId,legacyKey]);
  if (conflict) throw new AppError('Canonical product_id is already confirmed for another legacy record', { code:'LEGACY_MAPPING_CONFLICT', status:409 });
  const row = (await pool.query(
    `UPDATE catalog_legacy_mapping SET proposed_product_id=$2,match_type='MANUAL',match_status='MATCHED',confidence=1,manually_confirmed=true,confirmed_at=now() WHERE legacy_key=$1 RETURNING *`,
    [legacyKey,productId]
  )).rows[0];
  if (!row) throw new AppError('Legacy mapping not found', { code:'NOT_FOUND', status:404 });
  return row;
}

function catalogContentValues(item) {
  return {
    secondary_name: item.en || null,
    description: item.description || null,
    origin: item.origin || null,
    size_text: item.size_text || null,
    temperament: item.temperament || null,
    video_url: item.video_url || null
  };
}

export async function importConfirmedLegacy({ legacyRoot, dryRun = true } = {}) {
  const mappings = await many(`SELECT * FROM catalog_legacy_mapping WHERE match_status='MATCHED' AND manually_confirmed=true ORDER BY legacy_key`);
  const run = (await pool.query(`INSERT INTO catalog_legacy_import_run(dry_run,matched_count) VALUES($1,$2) RETURNING import_run_id`, [dryRun,mappings.length])).rows[0];
  const summary = { import_run_id:run.import_run_id, matched:mappings.length, content:0, media:0, skipped:0, errors:0, dry_run:dryRun };
  try {
    for (const mapping of mappings) {
      const item = mapping.legacy_payload || {};
      const productId = mapping.proposed_product_id;
      try {
        const source = await one(`SELECT product_id FROM catalog_product_source WHERE product_id=$1`, [productId]);
        if (!source) { summary.skipped += 1; continue; }
        const values = catalogContentValues(item);
        if (!dryRun) {
          await pool.query(
            `UPDATE catalog_content SET
              secondary_name=COALESCE(NULLIF(secondary_name,''),$2),
              description=COALESCE(NULLIF(description,''),$3),
              origin=COALESCE(NULLIF(origin,''),$4),
              size_text=COALESCE(NULLIF(size_text,''),$5),
              temperament=COALESCE(NULLIF(temperament,''),$6),
              video_url=COALESCE(NULLIF(video_url,''),$7),updated_at=now()
             WHERE product_id=$1`,
            [productId,values.secondary_name,values.description,values.origin,values.size_text,values.temperament,values.video_url]
          );
        }
        summary.content += 1;
        if (!legacyRoot) continue;
        for (let index=0; index<(item.gallery||[]).length; index += 1) {
          const legacyPath = item.gallery[index];
          const mime = legacyMediaMime(legacyPath);
          if (!mime) { summary.skipped += 1; continue; }
          const existing = await one(`SELECT media_id FROM catalog_media WHERE product_id=$1 AND legacy_source_path=$2`, [productId,legacyPath]);
          if (existing) { summary.skipped += 1; continue; }
          const sourcePath = safeLegacyAssetPath(legacyRoot,legacyPath);
          const fileStat = await stat(sourcePath);
          const storageKey = legacyStorageKey(productId,legacyPath);
          const targetPath = safeMediaPath(config.mediaRoot,storageKey);
          if (!dryRun) {
            await mkdir(path.dirname(targetPath),{recursive:true});
            await copyFile(sourcePath,targetPath);
            const count = Number((await pool.query(`SELECT COUNT(*)::int n FROM catalog_media WHERE product_id=$1`,[productId])).rows[0].n);
            const sort = Number((await pool.query(`SELECT COALESCE(MAX(sort_order),-1)+1 n FROM catalog_media WHERE product_id=$1`,[productId])).rows[0].n);
            await pool.query(
              `INSERT INTO catalog_media(product_id,media_type,storage_key,alt_text,sort_order,is_primary,original_name,mime_type,file_size,legacy_source_path)
               VALUES($1,'IMAGE',$2,$3,$4,$5,$6,$7,$8,$9)`,
              [productId,storageKey,item.vn||item.en||null,sort,count===0,path.basename(legacyPath),mime,fileStat.size,legacyPath]
            );
          }
          summary.media += 1;
        }
        if (!dryRun) await pool.query(`UPDATE catalog_legacy_mapping SET imported_at=now() WHERE legacy_key=$1`, [mapping.legacy_key]);
      } catch (error) {
        summary.errors += 1;
        console.error('legacy import item failed', mapping.legacy_key, error);
      }
    }
    const status = summary.errors ? 'PARTIAL' : 'SUCCESS';
    await pool.query(`UPDATE catalog_legacy_import_run SET finished_at=now(),imported_content_count=$2,imported_media_count=$3,skipped_count=$4,error_count=$5,status=$6 WHERE import_run_id=$1`, [run.import_run_id,summary.content,summary.media,summary.skipped,summary.errors,status]);
    return { ...summary, status };
  } catch (error) {
    await pool.query(`UPDATE catalog_legacy_import_run SET finished_at=now(),status='FAILED',error_summary=$2 WHERE import_run_id=$1`, [run.import_run_id,String(error.message||error)]).catch(()=>{});
    throw error;
  }
}
