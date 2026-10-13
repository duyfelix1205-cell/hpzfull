import { Router } from 'express';
import { many, one } from '../db.js';
import { syncCatalogSource } from '../services/catalog-sync.js';
import { config } from '../config.js';

const router = Router();
router.post('/', async (req, res, next) => {
  try {
    if (req.get('x-nexora-user-id') === 'release-smoke') {
      return res.json({ status:'SKIPPED', reason:'RELEASE_SMOKE_READ_ONLY', fetched:0, inserted:0, updated:0, failed:0 });
    }
    if (config.standaloneMode) return res.json({ status:'SKIPPED', reason:'CATALOG_STANDALONE_MODE', fetched:0, inserted:0, updated:0, failed:0 });
    res.json(await syncCatalogSource());
  } catch (error) { next(error); }
});
router.get('/status', async (_req, res, next) => {
  try {
    const latest = await one(`SELECT * FROM catalog_sync_run ORDER BY started_at DESC LIMIT 1`);
    const errors = latest ? await many(`SELECT * FROM catalog_sync_error WHERE sync_run_id=$1 ORDER BY created_at`, [latest.sync_run_id]) : [];
    res.json({ standalone_mode:config.standaloneMode, latest, errors });
  } catch (error) { next(error); }
});
export default router;
