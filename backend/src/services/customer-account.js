import { one, query, tx } from '../db.js';
import { config } from '../config.js';
import { clearSessionCookie, hashPassword, newId, rawToken, sessionCookie, tokenHash } from '../lib/customer-auth.js';

export function safeAccount(row){
  if(!row)return null;
  return {
    account_id:row.account_id,
    email:row.email,
    display_name:row.display_name || '',
    email_verified:Boolean(row.email_verified_at),
    phone:row.phone || '',
    phone_normalized:row.phone_normalized || '',
    customer_id:row.orders_customer_id || null,
    link_status:row.orders_link_status || 'NOT_LINKED',
    has_password:Boolean(row.password_hash),
    google_linked:Boolean(row.google_subject),
    created_at:row.created_at,
    last_login_at:row.last_login_at
  };
}

export async function createSession(accountId,res,client=null){
  const token=rawToken();
  const sessionId=newId('SES');
  const maxAge=config.customerSessionDays*86400;
  const executor=client || {query};
  await executor.query(
    `INSERT INTO customer_sessions(session_id,account_id,token_hash,expires_at)
     VALUES($1,$2,$3,now()+($4||' seconds')::interval)`,
    [sessionId,accountId,tokenHash(token),String(maxAge)]
  );
  res.setHeader('Set-Cookie',sessionCookie(token,maxAge));
  return sessionId;
}

export async function revokeCurrentSession(req,res){
  if(req.customerAccount?.session_id) await query(`UPDATE customer_sessions SET revoked_at=now() WHERE session_id=$1`,[req.customerAccount.session_id]);
  res.setHeader('Set-Cookie',clearSessionCookie());
}

export async function issueAuthToken(accountId,purpose,ttlSeconds,client=null){
  const raw=rawToken(); const hash=tokenHash(raw); const authTokenId=newId('AUT');
  const runner=client || {query};
  await runner.query(`UPDATE customer_auth_tokens SET consumed_at=COALESCE(consumed_at,now()) WHERE account_id=$1 AND purpose=$2 AND consumed_at IS NULL`,[accountId,purpose]);
  await runner.query(
    `INSERT INTO customer_auth_tokens(auth_token_id,account_id,token_hash,purpose,expires_at)
     VALUES($1,$2,$3,$4,now()+($5||' seconds')::interval)`,
    [authTokenId,accountId,hash,purpose,String(ttlSeconds)]
  );
  return raw;
}

export async function consumeAuthToken(raw,purpose,handler){
  return tx(async client=>{
    const token=await one(
      `SELECT t.*,a.email,a.account_id FROM customer_auth_tokens t JOIN customer_accounts a ON a.account_id=t.account_id
       WHERE t.token_hash=$1 AND t.purpose=$2 AND t.consumed_at IS NULL AND t.expires_at>now() FOR UPDATE`,
      [tokenHash(raw),purpose],client
    );
    if(!token)return null;
    await handler(client,token);
    await client.query(`UPDATE customer_auth_tokens SET consumed_at=now() WHERE auth_token_id=$1`,[token.auth_token_id]);
    return token;
  });
}

export async function setAccountPassword(accountId,password,client=null){
  const passwordHash=await hashPassword(password);
  const runner=client || {query};
  await runner.query(`UPDATE customer_accounts SET password_hash=$2,updated_at=now() WHERE account_id=$1`,[accountId,passwordHash]);
}
