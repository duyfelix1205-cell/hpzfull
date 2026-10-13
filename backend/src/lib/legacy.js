import path from 'node:path';
import { createHash } from 'node:crypto';
import { AppError } from './errors.js';

export function normalizeLegacyText(value) {
  return String(value ?? '').normalize('NFC').replace(/\u00a0/g, ' ').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function makeLegacyKey(record, index = 0) {
  const identity = `${normalizeLegacyText(record?.en)}|${normalizeLegacyText(record?.vn)}|${index}`;
  return `hpz-fish-${createHash('sha256').update(identity).digest('hex').slice(0,16)}`;
}

export function toLegacyRecord(fish, index = 0) {
  const gallery = Array.isArray(fish?.gallery) ? fish.gallery.filter(Boolean).map(String) : [];
  return {
    legacy_key: makeLegacyKey(fish, index),
    legacy_index: index,
    vn: String(fish?.vn || '').trim(),
    en: String(fish?.en || '').trim(),
    description: String(fish?.desc || '').trim() || null,
    origin: String(fish?.origin || '').trim() || null,
    size_text: String(fish?.size || '').trim() || null,
    temperament: String(fish?.temperament || '').trim() || null,
    temperature: String(fish?.temp || '').trim() || null,
    food: String(fish?.food || '').trim() || null,
    video_url: String(fish?.video || '').trim() || null,
    category: String(fish?.categoryLabel || fish?.category || fish?.cat || '').trim() || null,
    gallery,
    legacy_price: fish?.price ?? null,
    legacy_combo: fish?.combo ?? null,
    legacy_promo: fish?.promo ?? null
  };
}

export function validateLegacyDataset(input) {
  const items = Array.isArray(input) ? input : input?.items;
  if (!Array.isArray(items)) throw new AppError('Legacy dataset must contain an items array', { code: 'LEGACY_DATASET_INVALID' });
  const keys = new Set();
  for (const item of items) {
    if (!item?.legacy_key || keys.has(item.legacy_key)) throw new AppError('Legacy dataset contains missing or duplicate legacy_key', { code: 'LEGACY_DATASET_INVALID' });
    keys.add(item.legacy_key);
  }
  return items;
}

export function safeLegacyAssetPath(legacyRoot, relativePath) {
  const rel = String(relativePath || '').replace(/\\/g, '/');
  if (!rel.startsWith('assets/img/')) throw new AppError('Legacy media must be under assets/img', { code: 'LEGACY_MEDIA_PATH_INVALID' });
  const root = path.resolve(legacyRoot);
  const full = path.resolve(root, rel);
  const imageRoot = path.resolve(root, 'assets/img') + path.sep;
  if (!full.startsWith(imageRoot)) throw new AppError('Legacy media path escapes assets/img', { code: 'LEGACY_MEDIA_PATH_INVALID' });
  return full;
}

export function legacyMediaMime(relativePath) {
  const ext = path.extname(String(relativePath || '')).toLowerCase();
  return ({ '.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif' })[ext] || null;
}

export function legacyStorageKey(productId, relativePath) {
  if (!/^PRD-[A-Za-z0-9._-]+$/.test(productId)) throw new AppError('Invalid canonical product_id', { code: 'LEGACY_PRODUCT_ID_INVALID' });
  const mime = legacyMediaMime(relativePath);
  if (!mime) throw new AppError('Unsupported legacy media type', { code: 'LEGACY_MEDIA_TYPE_INVALID' });
  const ext = ({'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif'})[mime];
  const digest = createHash('sha256').update(String(relativePath)).digest('hex').slice(0,16);
  return `${productId}/legacy-${digest}${ext}`;
}
