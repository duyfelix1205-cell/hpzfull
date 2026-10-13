import { Router } from 'express';
import { pool } from '../db.js';
import { config } from '../config.js';

const router = Router();
const metadata = () => ({
  ok: true,
  app_id: config.appId,
  service: 'backend',
  environment: config.environment,
  namespace: config.namespace,
  release: config.release,
  deploy_sha: config.deploySha
});
router.get('/live', (_req, res) => res.json(metadata()));
router.get('/ready', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ...metadata(), database: 'ready' });
  } catch (error) {
    res.status(503).json({ ...metadata(), ok: false, database: 'unavailable', error: error.message });
  }
});
export default router;
