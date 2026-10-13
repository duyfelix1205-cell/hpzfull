import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { config } from '../config.js';
import { AppError } from './errors.js';

const scryptAsync = promisify(crypto.scrypt);

export const normalizeEmail = value => String(value || '').trim().toLowerCase();
export function normalizePhone(value) {
  let text=String(value || '').replace(/\D/g,'');
  if(text.startsWith('84')&&text.length>=11) text='0'+text.slice(2);
  if(/^[3-9]\d{8}$/.test(text)) text='0'+text;
  return text;
}
export const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));

export async function hashPassword(password) {
  const plain=String(password || '');
  if(plain.length<8) throw new AppError('Mật khẩu phải có ít nhất 8 ký tự.',{status:400,code:'PASSWORD_TOO_SHORT'});
  if(plain.length>200) throw new AppError('Mật khẩu quá dài.',{status:400,code:'PASSWORD_TOO_LONG'});
  const salt=crypto.randomBytes(16);
  const derived=await scryptAsync(plain,salt,64);
  return `scrypt$${salt.toString('hex')}$${Buffer.from(derived).toString('hex')}`;
}

export async function verifyPassword(password,encoded) {
  const [kind,saltHex,hashHex]=String(encoded || '').split('$');
  if(kind!=='scrypt'||!saltHex||!hashHex) return false;
  try {
    const expected=Buffer.from(hashHex,'hex');
    const actual=Buffer.from(await scryptAsync(String(password || ''),Buffer.from(saltHex,'hex'),expected.length));
    return actual.length===expected.length && crypto.timingSafeEqual(actual,expected);
  } catch { return false; }
}

export function rawToken(bytes=32){return crypto.randomBytes(bytes).toString('base64url')}
export function tokenHash(token){return crypto.createHash('sha256').update(String(token || '')).digest('hex')}
export function newId(prefix){return `${prefix}-${crypto.randomUUID()}`}

export function parseCookies(header='') {
  const out={};
  for(const item of String(header || '').split(';')){
    const i=item.indexOf('='); if(i<0)continue;
    const key=item.slice(0,i).trim(), value=item.slice(i+1).trim();
    if(key) out[key]=decodeURIComponent(value);
  }
  return out;
}

export function sessionCookie(token,maxAgeSeconds) {
  const secure=config.environment==='production'?'; Secure':'';
  return `${config.customerSessionCookie}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.max(0,Math.floor(maxAgeSeconds))}${secure}`;
}
export function clearSessionCookie(){return sessionCookie('',0)}
