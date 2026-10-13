import { AppError } from './errors.js';

export const CONTENT_FIELDS = Object.freeze([
  'slug','secondary_name','short_description','description','origin','size_text','temperament','care_info',
  'selling_points_json','display_sections_json','video_url','featured','sort_order','stock_display_mode','seo_title','seo_description'
]);

export function normalizeSlug(value) {
  const slug = String(value ?? '').trim().toLowerCase();
  if (!slug) return null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new AppError('Slug must contain lowercase letters, numbers and single hyphens only', { code: 'CATALOG_SLUG_INVALID' });
  }
  return slug;
}

export function normalizeDisplaySections(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new AppError('display_sections_json must be an array', { code:'CATALOG_CONTENT_INVALID' });
  if (value.length > 30) throw new AppError('Tối đa 30 cột nội dung tùy chỉnh', { code:'CATALOG_CONTENT_INVALID' });
  return value.map((item, index) => {
    const title = String(item?.title ?? '').trim().slice(0,120);
    const text = String(item?.text ?? '').trim().slice(0,8000);
    if (!title && !text) return null;
    return { id:String(item?.id || `section-${index+1}`).slice(0,80), title, text };
  }).filter(Boolean);
}

export function catalogContentPatch(input = {}) {
  const patch = {};
  for (const field of CONTENT_FIELDS) {
    if (!(field in input)) continue;
    patch[field] = input[field];
  }
  if ('slug' in patch) patch.slug = normalizeSlug(patch.slug);
  if ('featured' in patch) patch.featured = Boolean(patch.featured);
  if ('display_sections_json' in patch) patch.display_sections_json = normalizeDisplaySections(patch.display_sections_json);
  if ('sort_order' in patch) {
    const n = Number(patch.sort_order);
    if (!Number.isInteger(n)) throw new AppError('sort_order must be an integer', { code: 'CATALOG_CONTENT_INVALID' });
    patch.sort_order = n;
  }
  if ('stock_display_mode' in patch) {
    const mode = String(patch.stock_display_mode || '').toUpperCase();
    if (!['EXACT','STATUS_ONLY','LOW_STOCK','HIDDEN'].includes(mode)) {
      throw new AppError('Invalid stock_display_mode', { code: 'CATALOG_CONTENT_INVALID' });
    }
    patch.stock_display_mode = mode;
  }
  return patch;
}

export function isIncompleteContent(row = {}) {
  return !row.slug || !String(row.short_description || '').trim() || !String(row.description || '').trim();
}
