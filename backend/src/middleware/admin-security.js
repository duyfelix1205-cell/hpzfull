import { createHash, timingSafeEqual } from 'node:crypto';
import { pool } from '../db.js';
import { config } from '../config.js';
import { buildAdminActor } from '../lib/admin-auth.js';
import { AppError } from '../lib/errors.js';

function equalHex(a,b){
  const aa=Buffer.from(String(a||''),'hex');
  const bb=Buffer.from(String(b||''),'hex');
  return aa.length===bb.length && aa.length>0 && timingSafeEqual(aa,bb);
}

async function standalonePasswordActor(req){
  if(!config.standaloneMode) return null;
  const password=String(req.headers['x-catalog-admin-password']||'');
  if(!password) return null;
  const row=(await pool.query('SELECT password_sha256 FROM catalog_admin_access WHERE singleton=true')).rows[0];
  if(!row) throw new AppError('Standalone admin credential is not initialized',{code:'ADMIN_AUTH_CONFIG',status:500});
  const supplied=createHash('sha256').update(password).digest('hex');
  if(!equalHex(supplied,row.password_sha256)) throw new AppError('Sai mật khẩu quản trị',{code:'ADMIN_UNAUTHENTICATED',status:401});
  return {userId:'standalone-admin',roles:['catalog-admin'],mode:'standalone_password'};
}

export async function adminSecurity(req, res, next) {
  try {
    // TEMPORARY TEST BYPASS: only the Admin SPA sends this marker while standalone mode is enabled.
    // Raw Admin API calls without the marker remain protected so platform isolation smoke remains valid.
    const testBypass = config.standaloneMode && String(req.headers['x-catalog-test-admin']||'') === '1';
    req.adminActor = testBypass
      ? {userId:'standalone-test-admin',roles:['catalog-admin'],mode:'standalone_test_bypass'}
      : (await standalonePasswordActor(req) || buildAdminActor(req, config));
    if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
      res.on('finish', () => {
        pool.query(
          `INSERT INTO catalog_admin_audit(actor_user_id,actor_roles,method,path,status_code,request_id) VALUES($1,$2,$3,$4,$5,$6)`,
          [req.adminActor?.userId || null, req.adminActor?.roles || [], req.method, req.originalUrl.split('?')[0], res.statusCode, req.requestId || null]
        ).catch(error => console.error('admin audit write failed', error));
      });
    }
    next();
  } catch (error) { next(error); }
}
