import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from './db.js';

const dir = fileURLToPath(new URL('../db/migrations', import.meta.url));
await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations(filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
for (const filename of (await readdir(dir)).filter(x => x.endsWith('.sql')).sort()) {
  const done = await pool.query('SELECT 1 FROM schema_migrations WHERE filename=$1', [filename]);
  if (done.rowCount) continue;
  const sql = await readFile(path.join(dir, filename), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations(filename) VALUES($1)', [filename]);
    await client.query('COMMIT');
    console.log(`applied ${filename}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
await pool.end();
