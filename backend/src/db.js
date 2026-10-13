import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;
export const pool = new Pool({ connectionString: config.databaseUrl });

export async function query(text, params = [], client = pool) {
  return client.query(text, params);
}

export async function one(text, params = [], client = pool) {
  const result = await client.query(text, params);
  return result.rows[0] || null;
}

export async function many(text, params = [], client = pool) {
  return (await client.query(text, params)).rows;
}

export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
