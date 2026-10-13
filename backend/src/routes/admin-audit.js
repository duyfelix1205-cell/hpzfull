import { Router } from 'express';
import { many } from '../db.js';
const router=Router();
router.get('/',async(req,res,next)=>{try{const limit=Math.min(200,Math.max(1,Number(req.query.limit||100)));res.json({items:await many(`SELECT * FROM catalog_admin_audit ORDER BY created_at DESC LIMIT $1`,[limit])});}catch(error){next(error)}});
export default router;
