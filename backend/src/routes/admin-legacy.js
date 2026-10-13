import { Router } from 'express';
import { confirmLegacyMapping, listLegacyMappings, stageLegacyDataset } from '../services/legacy-migration.js';
const router = Router();
router.get('/mappings',async(req,res,next)=>{try{res.json({items:await listLegacyMappings(req.query.status)})}catch(error){next(error)}});
router.post('/stage',async(req,res,next)=>{try{res.json(await stageLegacyDataset(req.body))}catch(error){next(error)}});
router.put('/mappings/:legacyKey',async(req,res,next)=>{try{res.json(await confirmLegacyMapping(req.params.legacyKey,req.body?.product_id))}catch(error){next(error)}});
export default router;
