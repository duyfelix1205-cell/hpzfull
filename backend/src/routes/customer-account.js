import { Router } from 'express';
import { one, query } from '../db.js';
import { AppError } from '../lib/errors.js';
import { normalizePhone, verifyPassword } from '../lib/customer-auth.js';
import { requireCustomerSession } from '../middleware/customer-session.js';
import { safeAccount, setAccountPassword } from '../services/customer-account.js';
import { customerOrdersAdapter } from '../adapters/customer-orders-adapter.js';

const r=Router();
r.use(requireCustomerSession);

async function loadAccount(accountId){return one(`SELECT * FROM customer_accounts WHERE account_id=$1 AND active=true`,[accountId])}

r.get('/me',async(req,res,next)=>{try{
  const account=await loadAccount(req.customerAccount.account_id);
  let customerProfile=null,integrationWarning=null;
  if(account?.orders_customer_id){try{customerProfile=await customerOrdersAdapter.getProfile(account.orders_customer_id)}catch(error){integrationWarning={code:error.code||'ORDERS_UNAVAILABLE',message:'Thông tin thành viên tạm thời chưa tải được.'}}}
  res.json({account:safeAccount(account),customer_profile:customerProfile,integration_warning:integrationWarning});
}catch(e){next(e)}});

r.post('/link-phone',async(req,res,next)=>{try{
  const account=await loadAccount(req.customerAccount.account_id);
  if(!account)throw new AppError('Tài khoản không tồn tại.',{status:404,code:'ACCOUNT_NOT_FOUND'});
  const phone=normalizePhone(req.body?.phone);
  if(!/^0\d{9,10}$/.test(phone))throw new AppError('Số điện thoại không hợp lệ.',{status:400,code:'INVALID_PHONE'});
  if(account.orders_customer_id){
    if(account.phone_normalized===phone){return res.json({account:safeAccount(account),customer_profile:await customerOrdersAdapter.getProfile(account.orders_customer_id)})}
    throw new AppError('Tài khoản đã liên kết với hồ sơ thành viên. Không thể tự đổi sang số khác.',{status:409,code:'CUSTOMER_ALREADY_LINKED'});
  }
  const result=await customerOrdersAdapter.resolveCustomer({phone,email:account.email,display_name:account.display_name,create_if_missing:true});
  const canLink=(result.match_status==='MATCHED'||result.match_status==='CREATED')&&Boolean(result.customer_id);
  if(canLink){
    try{
      const updated=(await query(`UPDATE customer_accounts SET phone=$2,phone_normalized=$2,orders_customer_id=$3,orders_link_status='LINKED',updated_at=now() WHERE account_id=$1 RETURNING *`,[account.account_id,phone,result.customer_id])).rows[0];
      return res.json({account:safeAccount(updated),customer_profile:await customerOrdersAdapter.getProfile(result.customer_id)});
    }catch(error){
      if(error?.code==='23505')throw new AppError('Hồ sơ thành viên này đã được liên kết với tài khoản khác.',{status:409,code:'CUSTOMER_LINK_CONFLICT'});
      throw error;
    }
  }
  const status=result.claim_status||'REVIEW_REQUIRED_DUPLICATE_PHONE';
  const updated=(await query(`UPDATE customer_accounts SET phone=$2,phone_normalized=$2,orders_link_status=$3,updated_at=now() WHERE account_id=$1 RETURNING *`,[account.account_id,phone,status])).rows[0];
  res.status(result.match_status==='AMBIGUOUS'?409:202).json({account:safeAccount(updated),link_review_required:true,reason:status});
}catch(e){next(e)}});

r.post('/change-password',async(req,res,next)=>{try{
  const account=await loadAccount(req.customerAccount.account_id);
  const current=String(req.body?.current_password||''),nextPassword=String(req.body?.new_password||'');
  if(account.password_hash&&!(await verifyPassword(current,account.password_hash)))throw new AppError('Mật khẩu hiện tại không đúng.',{status:401,code:'CURRENT_PASSWORD_INVALID'});
  if(!account.password_hash&&!account.email_verified_at)throw new AppError('Hãy xác minh email trước khi thiết lập mật khẩu.',{status:403,code:'EMAIL_VERIFICATION_REQUIRED'});
  await setAccountPassword(account.account_id,nextPassword);
  res.json({ok:true});
}catch(e){next(e)}});

export default r;
