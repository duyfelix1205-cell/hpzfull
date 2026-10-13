async function request(path,{method='GET',body,headers}={}){
  const response=await fetch(path,{method,credentials:'same-origin',headers:{...(body!==undefined?{'content-type':'application/json'}:{}),...(headers||{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const payload=await response.json().catch(()=>null);
  if(!response.ok){const error=new Error(payload?.error?.message||payload?.message||`Request failed (${response.status})`);error.code=payload?.error?.code||payload?.code||'REQUEST_FAILED';error.status=response.status;error.payload=payload;throw error}
  return payload;
}
export const customerAuthApi={
  config:()=>request('/api/v1/customer-auth/config'),
  register:payload=>request('/api/v1/customer-auth/register',{method:'POST',body:payload}),
  login:payload=>request('/api/v1/customer-auth/login',{method:'POST',body:payload}),
  google:credential=>request('/api/v1/customer-auth/google',{method:'POST',body:{credential}}),
  logout:()=>request('/api/v1/customer-auth/logout',{method:'POST',body:{}}),
  forgot:email=>request('/api/v1/customer-auth/forgot-password',{method:'POST',body:{email}}),
  reset:(token,password)=>request('/api/v1/customer-auth/reset-password',{method:'POST',body:{token,password}}),
  verifyEmail:token=>request('/api/v1/customer-auth/verify-email',{method:'POST',body:{token}}),
  resendVerification:()=>request('/api/v1/customer-auth/resend-verification',{method:'POST',body:{}}),
  me:()=>request('/api/v1/customer-account/me'),
  linkPhone:phone=>request('/api/v1/customer-account/link-phone',{method:'POST',body:{phone}}),
  changePassword:(current_password,new_password)=>request('/api/v1/customer-account/change-password',{method:'POST',body:{current_password,new_password}})
};
