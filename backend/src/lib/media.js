import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { AppError } from './errors.js';

export const IMAGE_MIME_EXT = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
});

export function assertImageMime(mimeType) {
  const ext = IMAGE_MIME_EXT[mimeType];
  if (!ext) throw new AppError('Unsupported image type. Use JPEG, PNG, WEBP or GIF.', { code: 'CATALOG_MEDIA_TYPE_INVALID', status: 415 });
  return ext;
}

export function createStorageKey(entityId, mimeType, uuid = randomUUID()) {
  if (!/^(PRD|TNK)-[A-Za-z0-9._-]+$/.test(entityId || '')) throw new AppError('Invalid catalog entity id for media storage', { code: 'CATALOG_ENTITY_ID_INVALID' });
  const ext = assertImageMime(mimeType);
  if (!/^[A-Za-z0-9-]+$/.test(uuid)) throw new AppError('Invalid media identifier', { code: 'CATALOG_MEDIA_KEY_INVALID' });
  return `${entityId}/${uuid}.${ext}`;
}

export function safeMediaPath(root, storageKey) {
  if (!storageKey || path.isAbsolute(storageKey)) throw new AppError('Invalid media storage key', { code: 'CATALOG_MEDIA_KEY_INVALID' });
  const base = path.resolve(root);
  const target = path.resolve(base, storageKey);
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) throw new AppError('Unsafe media storage key', { code: 'CATALOG_MEDIA_KEY_INVALID' });
  return target;
}

export function mediaPublicUrl(storageKey) {
  return `/media/${String(storageKey).split('/').map(encodeURIComponent).join('/')}`;
}
