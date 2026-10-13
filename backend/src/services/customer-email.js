import { config } from '../config.js';
import { AppError } from '../lib/errors.js';

export function emailDeliveryConfigured(){return Boolean(config.authEmailApiKey && config.authEmailFrom)}

export async function sendCustomerEmail({to,subject,html}) {
  if(!emailDeliveryConfigured()) return {sent:false,reason:'not_configured'};
  const response=await fetch(config.authEmailApiUrl,{
    method:'POST',
    headers:{'content-type':'application/json','authorization':`Bearer ${config.authEmailApiKey}`},
    body:JSON.stringify({from:config.authEmailFrom,to:[to],subject,html})
  });
  if(!response.ok){
    const body=await response.text().catch(()=> '');
    throw new AppError('Không thể gửi email xác thực lúc này.',{status:502,code:'AUTH_EMAIL_DELIVERY_FAILED',details:{provider_status:response.status,provider_message:body.slice(0,160)}});
  }
  return {sent:true};
}
