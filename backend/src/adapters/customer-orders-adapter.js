import { config } from '../config.js';
import { AppError } from '../lib/errors.js';

async function request(path,options={}) {
  if(!config.ordersBaseUrl||!config.customerOrdersInternalToken) throw new AppError('Orders customer integration chưa sẵn sàng.',{status:503,code:'ORDERS_CUSTOMER_INTEGRATION_UNAVAILABLE'});
  const response=await fetch(`${config.ordersBaseUrl}${path}`,{
    ...options,
    headers:{'content-type':'application/json','authorization':`Bearer ${config.customerOrdersInternalToken}`,...(options.headers||{})},
    signal:AbortSignal.timeout(8000)
  });
  const body=await response.json().catch(()=>null);
  if(response.status===409&&body?.match_status==='AMBIGUOUS') return body;
  if(!response.ok){
    throw new AppError(body?.error || body?.message || 'Orders integration request failed.',{status:response.status,code:body?.code || 'ORDERS_CUSTOMER_INTEGRATION_FAILED'});
  }
  return body;
}

export const customerOrdersAdapter={
  ping:()=>request('/api/v1/integration/catalog/ping'),
  resolveCustomer:payload=>request('/api/v1/integration/catalog/customers/resolve',{method:'POST',body:JSON.stringify(payload)}),
  getProfile:customerId=>request(`/api/v1/integration/catalog/customers/${encodeURIComponent(customerId)}/profile`)
};
