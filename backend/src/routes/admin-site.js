import { Router } from 'express';
import { one, query } from '../db.js';
import { DEFAULT_HOMEPAGE, DEFAULT_POLICY_TABLE, normalizeHomepage, normalizePolicyTable } from '../lib/site-content.js';
const router=Router();
router.get('/homepage',async(_req,res,next)=>{try{const row=await one("SELECT value_json,updated_at FROM catalog_site_setting WHERE setting_key='homepage'");res.json({content:normalizeHomepage(row?.value_json||DEFAULT_HOMEPAGE),updated_at:row?.updated_at||null})}catch(e){next(e)}});
router.put('/homepage',async(req,res,next)=>{try{const content=normalizeHomepage(req.body||{});await query("INSERT INTO catalog_site_setting(setting_key,value_json,updated_at) VALUES('homepage',$1::jsonb,now()) ON CONFLICT(setting_key) DO UPDATE SET value_json=EXCLUDED.value_json,updated_at=now()",[JSON.stringify(content)]);res.json({content})}catch(e){next(e)}});
router.get('/policy',async(_req,res,next)=>{try{const row=await one("SELECT value_json,updated_at FROM catalog_site_setting WHERE setting_key='policy'");res.json({content:normalizePolicyTable(row?.value_json||DEFAULT_POLICY_TABLE),updated_at:row?.updated_at||null})}catch(e){next(e)}});
router.put('/policy',async(req,res,next)=>{try{const content=normalizePolicyTable(req.body||{});await query("INSERT INTO catalog_site_setting(setting_key,value_json,updated_at) VALUES('policy',$1::jsonb,now()) ON CONFLICT(setting_key) DO UPDATE SET value_json=EXCLUDED.value_json,updated_at=now()",[JSON.stringify(content)]);res.json({content})}catch(e){next(e)}});
export default router;
