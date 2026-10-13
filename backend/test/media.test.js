import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { assertImageMime, createStorageKey, mediaPublicUrl, safeMediaPath } from '../src/lib/media.js';

test('media accepts supported image types and builds canonical storage key', () => {
  assert.equal(assertImageMime('image/webp'), 'webp');
  assert.equal(createStorageKey('PRD-DEMO-001','image/png','abc-123'), 'PRD-DEMO-001/abc-123.png');
  assert.equal(mediaPublicUrl('PRD-DEMO-001/abc-123.png'), '/media/PRD-DEMO-001/abc-123.png');
});

test('media rejects unsupported content type', () => {
  assert.throws(() => assertImageMime('application/pdf'), /Unsupported image type/);
});

test('media storage path blocks traversal', () => {
  const root = path.resolve('/tmp/catalog-media');
  assert.equal(safeMediaPath(root,'PRD-DEMO-001/a.jpg'), path.join(root,'PRD-DEMO-001','a.jpg'));
  assert.throws(() => safeMediaPath(root,'../escape.jpg'), /Unsafe media storage key/);
});
