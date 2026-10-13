import { Router } from 'express';
import { one, query, tx } from '../db.js';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';
import { hashPassword, newId, normalizeEmail, normalizePhone, validEmail, verifyPassword } from '../lib/customer-auth.js';
import { optionalCustomerSession, requireCustomerSession } from '../middleware/customer-session.js';
import { createSession, issueAuthToken, revokeCurrentSession, safeAccount, consumeAuthToken } from '../services/customer-account.js';
import { emailDeliveryConfigured, sendCustomerEmail } from '../services/customer-email.js';

const r=Router();
const attempts=new Map();
function limit(bucket,max,windowMs){return(req,res,next)=>{const key=`${bucket}:${req.ip||'unknown'}`;const now=Date.now(),v=attempts.get(key);if(!v||now-v.start>windowMs){attempts.set(key,{start:now,count:1});return next()}v.count++;if(v.count>max)return res.status(429).json({error:{code:'RATE_LIMITED',message:'Bạn thao tác quá nhanh. Vui lòng thử lại sau.',request_id:req.requestId}});next()}}
const authLimit=limit('auth',20,10*60*1000), recoveryLimit=limit('recovery',8,30*60*1000);

async function sendVerification(account){
  const token=await issueAuthToken(account.account_id,'VERIFY_EMAIL',24*3600);
  const url=`${config.publicBaseUrl}/verify-email?token=${encodeURIComponent(token)}`;
  return sendCustomerEmail({to:account.email,subject:'Xác minh tài khoản HPZ Aquaroom',html:`<p>Chào bạn,</p><p>Nhấn vào liên kết dưới đây để xác minh email tài khoản HPZ Aquaroom:</p><p><a href="${url}">Xác minh email</a></p><p>Liên kết có hiệu lực trong 24 giờ.</p>`});
}

r.get('/config',(_req,res)=>res.json({google_enabled:false,google_client_id:null,email_delivery_enabled:emailDeliveryConfigured(),phone_link_policy:'phone-match'}));

r.post('/register',authLimit,async(req,res,next)=>{try{
  const email=normalizeEmail(req.body?.email),displayName=String(req.body?.display_name||req.body?.name||'').trim(),phone=normalizePhone(req.body?.phone),password=String(req.body?.password||'');
  if(!validEmail(email))throw new AppError('Email không hợp lệ.',{status:400,code:'INVALID_EMAIL'});
  if(phone&&!/^0\d{9,10}$/.test(phone))throw new AppError('Số điện thoại không hợp lệ.',{status:400,code:'INVALID_PHONE'});
  const passwordHash=await hashPassword(password);
  const existing=await one(`SELECT account_id FROM customer_accounts WHERE email_normalized=$1`,[email]);
  if(existing)throw new AppError('Email này đã có tài khoản. Hãy đăng nhập hoặc dùng Quên mật khẩu.',{status:409,code:'EMAIL_ALREADY_REGISTERED'});
  const accountId=newId('ACC');
  const account=await tx(async client=>{
    const row=(await client.query(`INSERT INTO customer_accounts(account_id,email,email_normalized,display_name,password_hash,phone,phone_normalized) VALUES($1,$2,$2,$3,$4,$5,$6) RETURNING *`,[accountId,email,displayName,passwordHash,phone||null,phone||null])).rows[0];
    await createSession(accountId,res,client);
    return row;
  });
  res.status(201).json({account:safeAccount(account),verification_email_sent:false});
}catch(e){next(e)}});

r.post('/login',authLimit,async(req,res,next)=>{try{
  const email=normalizeEmail(req.body?.email),password=String(req.body?.password||'');
  const account=await one(`SELECT * FROM customer_accounts WHERE email_normalized=$1 AND active=true`,[email]);
  if(!account||!account.password_hash||!(await verifyPassword(password,account.password_hash)))throw new AppError('Email hoặc mật khẩu không đúng.',{status:401,code:'INVALID_LOGIN'});
  await query(`UPDATE customer_accounts SET last_login_at=now(),updated_at=now() WHERE account_id=$1`,[account.account_id]);
  await createSession(account.account_id,res);
  res.json({account:safeAccount({...account,last_login_at:new Date()})});
}catch(e){next(e)}});

r.post('/google',authLimit,(_req,res)=>res.status(410).json({error:{code:'GOOGLE_LOGIN_DISABLED',message:'Đăng nhập Google được tạm đóng trong phiên bản hiện tại.'}}));

r.post('/logout',optionalCustomerSession,async(req,res,next)=>{try{await revokeCurrentSession(req,res);res.json({ok:true})}catch(e){next(e)}});

r.post('/forgot-password',recoveryLimit,async(req,res,next)=>{try{
  const email=normalizeEmail(req.body?.email),generic='Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.';
  if(validEmail(email)){
    const account=await one(`SELECT * FROM customer_accounts WHERE email_normalized=$1 AND active=true`,[email]);
    if(account){
      const token=await issueAuthToken(account.account_id,'RESET_PASSWORD',30*60);
      const url=`${config.publicBaseUrl}/reset-password?token=${encodeURIComponent(token)}`;
      try{await sendCustomerEmail({to:account.email,subject:'Đặt lại mật khẩu HPZ Aquaroom',html:`<p>Bạn vừa yêu cầu đặt lại mật khẩu.</p><p><a href="${url}">Đặt lại mật khẩu</a></p><p>Liên kết có hiệu lực trong 30 phút. Nếu không phải bạn yêu cầu, hãy bỏ qua email này.</p>`})}catch(error){console.error('customer password reset email failed',error.message)}
    }
  }
  res.json({ok:true,message:generic});
}catch(e){next(e)}});

r.post('/reset-password',recoveryLimit,async(req,res,next)=>{try{
  const raw=String(req.body?.token||''),password=String(req.body?.password||'');
  const passwordHash=await hashPassword(password);
  const consumed=await consumeAuthToken(raw,'RESET_PASSWORD',async(client,token)=>{
    await client.query(`UPDATE customer_accounts SET password_hash=$2,updated_at=now() WHERE account_id=$1`,[token.account_id,passwordHash]);
    await client.query(`UPDATE customer_sessions SET revoked_at=now() WHERE account_id=$1 AND revoked_at IS NULL`,[token.account_id]);
  });
  if(!consumed)throw new AppError('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.',{status:400,code:'RESET_TOKEN_INVALID'});
  res.json({ok:true});
}catch(e){next(e)}});

r.post('/verify-email',recoveryLimit,async(req,res,next)=>{try{
  const consumed=await consumeAuthToken(String(req.body?.token||''),'VERIFY_EMAIL',async(client,token)=>{await client.query(`UPDATE customer_accounts SET email_verified_at=COALESCE(email_verified_at,now()),updated_at=now() WHERE account_id=$1`,[token.account_id])});
  if(!consumed)throw new AppError('Liên kết xác minh email không hợp lệ hoặc đã hết hạn.',{status:400,code:'VERIFY_TOKEN_INVALID'});
  res.json({ok:true});
}catch(e){next(e)}});

r.post('/resend-verification',requireCustomerSession,recoveryLimit,async(req,res,next)=>{try{
  if(req.customerAccount.email_verified_at)return res.json({ok:true,already_verified:true});
  const result=await sendVerification(req.customerAccount);
  if(!result.sent)throw new AppError('Dịch vụ gửi email chưa được cấu hình.',{status:503,code:'AUTH_EMAIL_NOT_CONFIGURED'});
  res.json({ok:true});
}catch(e){next(e)}});

export default r;
