import { Router } from 'express';
import { one } from '../db.js';
import { DEFAULT_HOMEPAGE, DEFAULT_POLICY_TABLE, normalizeHomepage, normalizePolicyTable } from '../lib/site-content.js';
const router=Router();
router.get('/homepage',async(_req,res,next)=>{try{const row=await one("SELECT value_json,updated_at FROM catalog_site_setting WHERE setting_key='homepage'");res.set('Cache-Control','public, max-age=15, stale-while-revalidate=60');res.json({content:normalizeHomepage(row?.value_json||DEFAULT_HOMEPAGE),updated_at:row?.updated_at||null})}catch(e){next(e)}});
router.get('/policy',async(_req,res,next)=>{try{const row=await one("SELECT value_json,updated_at FROM catalog_site_setting WHERE setting_key='policy'");res.set('Cache-Control','public, max-age=15, stale-while-revalidate=60');res.json({content:normalizePolicyTable(row?.value_json||DEFAULT_POLICY_TABLE),updated_at:row?.updated_at||null})}catch(e){next(e)}});
export default router;
