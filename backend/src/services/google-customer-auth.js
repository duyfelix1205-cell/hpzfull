import { config } from '../config.js';
import { AppError } from '../lib/errors.js';
import { normalizeEmail } from '../lib/customer-auth.js';

export async function verifyGoogleCredential(credential) {
  if(!config.googleClientId) throw new AppError('Google login chưa được cấu hình.',{status:503,code:'GOOGLE_AUTH_NOT_CONFIGURED'});
  const token=String(credential || '').trim();
  if(!token) throw new AppError('Thiếu Google credential.',{status:400,code:'GOOGLE_CREDENTIAL_REQUIRED'});
  const response=await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`,{signal:AbortSignal.timeout(8000)});
  if(!response.ok) throw new AppError('Google credential không hợp lệ hoặc đã hết hạn.',{status:401,code:'GOOGLE_CREDENTIAL_INVALID'});
  const payload=await response.json();
  if(String(payload.aud || '')!==config.googleClientId) throw new AppError('Google credential không dành cho ứng dụng này.',{status:401,code:'GOOGLE_AUDIENCE_INVALID'});
  if(String(payload.email_verified)!=='true') throw new AppError('Google email chưa được xác minh.',{status:401,code:'GOOGLE_EMAIL_UNVERIFIED'});
  const email=normalizeEmail(payload.email);
  if(!email||!payload.sub) throw new AppError('Google profile thiếu thông tin bắt buộc.',{status:401,code:'GOOGLE_PROFILE_INVALID'});
  return {sub:String(payload.sub),email,name:String(payload.name || '').trim(),picture:String(payload.picture || '').trim()};
}
