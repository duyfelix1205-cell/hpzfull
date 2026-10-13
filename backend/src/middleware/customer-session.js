import { one, query } from '../db.js';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';
import { parseCookies, tokenHash } from '../lib/customer-auth.js';

async function resolveSession(req) {
  const token=parseCookies(req.headers.cookie || '')[config.customerSessionCookie];
  if(!token) return null;
  const row=await one(
    `SELECT a.*,s.session_id,s.expires_at
       FROM customer_sessions s
       JOIN customer_accounts a ON a.account_id=s.account_id
      WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND a.active=true`,
    [tokenHash(token)]
  );
  if(row) query(`UPDATE customer_sessions SET last_seen_at=now() WHERE session_id=$1`,[row.session_id]).catch(()=>{});
  return row;
}

export async function optionalCustomerSession(req,_res,next){try{req.customerAccount=await resolveSession(req);next()}catch(e){next(e)}}
export async function requireCustomerSession(req,_res,next){try{req.customerAccount=await resolveSession(req);if(!req.customerAccount)throw new AppError('Vui lòng đăng nhập.',{status:401,code:'CUSTOMER_AUTH_REQUIRED'});next()}catch(e){next(e)}}
