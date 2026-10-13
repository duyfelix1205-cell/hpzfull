import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { one, pool, tx } from '../db.js';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';
import { assertImageMime, createStorageKey, mediaPublicUrl, safeMediaPath } from '../lib/media.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxMediaBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    try { assertImageMime(file.mimetype); cb(null, true); }
    catch (error) { cb(error); }
  }
});

const decorate = row => row ? { ...row, url: mediaPublicUrl(row.storage_key) } : row;
const parseBoolean = value => ['1','true','yes','on'].includes(String(value || '').toLowerCase());

router.get('/:productId/media', async (req, res, next) => {
  try {
    const rows = (await pool.query(
      `SELECT * FROM catalog_media WHERE product_id=$1 ORDER BY sort_order,created_at,media_id`, [req.params.productId]
    )).rows;
    res.json({ items: rows.map(decorate) });
  } catch (error) { next(error); }
});

router.post('/:productId/media', upload.single('file'), async (req, res, next) => {
  let storageKey = null;
  let filePath = null;
  try {
    const productId = req.params.productId;
    if (!req.file) throw new AppError('Image file is required', { code: 'CATALOG_MEDIA_FILE_REQUIRED' });
    const source = await one(`SELECT product_id FROM catalog_product_source WHERE product_id=$1`, [productId]);
    if (!source) throw new AppError('Product not found', { code: 'NOT_FOUND', status: 404 });

    storageKey = createStorageKey(productId, req.file.mimetype);
    filePath = safeMediaPath(config.mediaRoot, storageKey);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, req.file.buffer, { flag: 'wx' });

    const row = await tx(async client => {
      const count = Number((await client.query(`SELECT COUNT(*)::int n FROM catalog_media WHERE product_id=$1`, [productId])).rows[0].n);
      const makePrimary = count === 0 || parseBoolean(req.body?.is_primary);
      if (makePrimary) await client.query(`UPDATE catalog_media SET is_primary=false,updated_at=now() WHERE product_id=$1`, [productId]);
      const sortOrder = Number((await client.query(`SELECT COALESCE(MAX(sort_order),-1)+1 n FROM catalog_media WHERE product_id=$1`, [productId])).rows[0].n);
      return (await client.query(
        `INSERT INTO catalog_media(product_id,media_type,storage_key,alt_text,sort_order,is_primary,original_name,mime_type,file_size)
         VALUES($1,'IMAGE',$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [productId,storageKey,String(req.body?.alt_text||'').trim()||null,sortOrder,makePrimary,req.file.originalname,req.file.mimetype,req.file.size]
      )).rows[0];
    });
    res.status(201).json(decorate(row));
  } catch (error) {
    if (filePath) await unlink(filePath).catch(() => {});
    next(error);
  }
});

router.put('/:productId/media/reorder', async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.media_ids) ? req.body.media_ids.map(String) : null;
    if (!ids || new Set(ids).size !== ids.length) throw new AppError('media_ids must be a unique array', { code: 'CATALOG_MEDIA_REORDER_INVALID' });
    const rows = (await pool.query(`SELECT media_id::text FROM catalog_media WHERE product_id=$1 ORDER BY sort_order,created_at`, [req.params.productId])).rows;
    const current = rows.map(row => row.media_id);
    if (ids.length !== current.length || ids.some(id => !current.includes(id))) throw new AppError('media_ids must contain every product media item exactly once', { code: 'CATALOG_MEDIA_REORDER_INVALID', status: 409 });
    await tx(async client => {
      for (let index=0; index<ids.length; index += 1) {
        await client.query(`UPDATE catalog_media SET sort_order=$3,updated_at=now() WHERE product_id=$1 AND media_id=$2`, [req.params.productId, ids[index], index]);
      }
    });
    const refreshed = (await pool.query(`SELECT * FROM catalog_media WHERE product_id=$1 ORDER BY sort_order,created_at`, [req.params.productId])).rows;
    res.json({ items: refreshed.map(decorate) });
  } catch (error) { next(error); }
});

router.patch('/:productId/media/:mediaId', async (req, res, next) => {
  try {
    const productId = req.params.productId;
    const mediaId = req.params.mediaId;
    const wantsPrimary = req.body?.is_primary === true;
    const hasAlt = Object.prototype.hasOwnProperty.call(req.body || {}, 'alt_text');
    if (!wantsPrimary && !hasAlt) throw new AppError('No media fields supplied', { code: 'CATALOG_MEDIA_PATCH_EMPTY' });
    const row = await tx(async client => {
      const current = (await client.query(`SELECT * FROM catalog_media WHERE product_id=$1 AND media_id=$2`, [productId,mediaId])).rows[0];
      if (!current) throw new AppError('Media not found', { code: 'NOT_FOUND', status: 404 });
      if (wantsPrimary) await client.query(`UPDATE catalog_media SET is_primary=false,updated_at=now() WHERE product_id=$1`, [productId]);
      return (await client.query(
        `UPDATE catalog_media SET alt_text=$3,is_primary=$4,updated_at=now() WHERE product_id=$1 AND media_id=$2 RETURNING *`,
        [productId,mediaId,hasAlt ? (String(req.body.alt_text||'').trim()||null) : current.alt_text,wantsPrimary ? true : current.is_primary]
      )).rows[0];
    });
    res.json(decorate(row));
  } catch (error) { next(error); }
});

router.delete('/:productId/media/:mediaId', async (req, res, next) => {
  try {
    const deleted = await tx(async client => {
      const current = (await client.query(`SELECT * FROM catalog_media WHERE product_id=$1 AND media_id=$2`, [req.params.productId,req.params.mediaId])).rows[0];
      if (!current) throw new AppError('Media not found', { code: 'NOT_FOUND', status: 404 });
      await client.query(`DELETE FROM catalog_media WHERE media_id=$1`, [current.media_id]);
      if (current.is_primary) {
        await client.query(
          `UPDATE catalog_media SET is_primary=true,updated_at=now() WHERE media_id=(SELECT media_id FROM catalog_media WHERE product_id=$1 ORDER BY sort_order,created_at LIMIT 1)`,
          [req.params.productId]
        );
      }
      return current;
    });
    await unlink(safeMediaPath(config.mediaRoot, deleted.storage_key)).catch(error => {
      if (error.code !== 'ENOENT') console.error('media unlink failed', error);
    });
    res.json({ ok: true, media_id: deleted.media_id });
  } catch (error) { next(error); }
});

export default router;
