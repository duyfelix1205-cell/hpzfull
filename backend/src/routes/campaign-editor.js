import { Router } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { one, query } from '../db.js';
import { AppError } from '../lib/errors.js';

const r=Router();
const allowedCampaigns=new Set(['mi-an-longfin']);

function campaignKey(value){
  const key=String(value||'').trim().toLowerCase();
  if(!allowedCampaigns.has(key)) throw new AppError('Campaign not found',{status:404,code:'CAMPAIGN_NOT_FOUND'});
  return key;
}
function equalHex(a,b){
  const aa=Buffer.from(String(a||''),'hex'),bb=Buffer.from(String(b||''),'hex');
  return aa.length===bb.length&&aa.length>0&&timingSafeEqual(aa,bb);
}
async function verifyEditor(username,password){
  const user=String(username||'').trim();
  if(!user||!password) return null;
  const row=await one('SELECT username,password_sha256 FROM catalog_campaign_editor_access WHERE username=$1 AND active=true',[user]);
  if(!row) return null;
  const supplied=createHash('sha256').update(String(password)).digest('hex');
  return equalHex(supplied,row.password_sha256)?row:null;
}
function cleanCopy(input){
  if(!input||typeof input!=='object'||Array.isArray(input)) throw new AppError('Campaign copy must be an object',{status:400,code:'INVALID_CAMPAIGN_COPY'});
  const entries=Object.entries(input);
  if(entries.length>400) throw new AppError('Campaign copy has too many fields',{status:400,code:'CAMPAIGN_COPY_TOO_LARGE'});
  const out={};
  for(const[key,value]of entries){
    const k=String(key||'').trim();
    if(!/^[a-z0-9_.:\/-]{1,220}$/i.test(k)) throw new AppError('Campaign copy contains an invalid key',{status:400,code:'INVALID_CAMPAIGN_COPY_KEY'});
    const text=String(value??'');
    if(text.length>10000) throw new AppError('Campaign copy field is too long',{status:400,code:'CAMPAIGN_COPY_FIELD_TOO_LARGE'});
    out[k]=text;
  }
  return out;
}
async function requireEditor(req,_res,next){
  try{
    const actor=await verifyEditor(req.headers['x-campaign-admin-username'],req.headers['x-campaign-admin-password']);
    if(!actor) throw new AppError('Sai tài khoản hoặc mật khẩu quản trị',{status:401,code:'CAMPAIGN_ADMIN_UNAUTHENTICATED'});
    req.campaignAdmin=actor.username;
    next();
  }catch(error){next(error)}
}

r.get('/:campaignKey/content',async(req,res,next)=>{try{
  const key=campaignKey(req.params.campaignKey);
  const row=await one('SELECT campaign_key,copy_json,updated_at FROM catalog_campaign_content WHERE campaign_key=$1',[key]);
  res.setHeader('cache-control','no-store');
  res.json({campaign_key:key,copy:row?.copy_json||{},updated_at:row?.updated_at||null});
}catch(error){next(error)}});

r.post('/:campaignKey/editor/login',async(req,res,next)=>{try{
  campaignKey(req.params.campaignKey);
  const actor=await verifyEditor(req.body?.username,req.body?.password);
  if(!actor) throw new AppError('Sai tài khoản hoặc mật khẩu quản trị',{status:401,code:'CAMPAIGN_ADMIN_UNAUTHENTICATED'});
  res.json({ok:true,username:actor.username,role:'campaign-admin'});
}catch(error){next(error)}});

r.put('/:campaignKey/editor/content',requireEditor,async(req,res,next)=>{try{
  const key=campaignKey(req.params.campaignKey);
  const copy=cleanCopy(req.body?.copy);
  const result=await query(`
    INSERT INTO catalog_campaign_content(campaign_key,copy_json,updated_by,updated_at)
    VALUES($1,$2::jsonb,$3,now())
    ON CONFLICT(campaign_key) DO UPDATE
      SET copy_json=EXCLUDED.copy_json,updated_by=EXCLUDED.updated_by,updated_at=now()
    RETURNING campaign_key,copy_json,updated_by,updated_at
  `,[key,JSON.stringify(copy),req.campaignAdmin]);
  res.json({campaign_key:key,copy:result.rows[0].copy_json,updated_by:result.rows[0].updated_by,updated_at:result.rows[0].updated_at});
}catch(error){next(error)}});

export const campaignEditorHelpers={campaignKey,cleanCopy,verifyEditor};
export default r;
