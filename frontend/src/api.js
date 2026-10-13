const ADMIN_PASSWORD_KEY='nexora.catalog.admin.password';
const responseCache=new Map();

export const adminSession={
  get:()=>sessionStorage.getItem(ADMIN_PASSWORD_KEY)||'',
  set:value=>sessionStorage.setItem(ADMIN_PASSWORD_KEY,String(value||'')),
  clear:()=>sessionStorage.removeItem(ADMIN_PASSWORD_KEY)
};

async function request(path, options = {}) {
  const method=String(options.method||'GET').toUpperCase();
  const cacheable=method==='GET'&&path.startsWith('/api/v1/catalog/')&&!path.includes('?q=')&&!path.includes('/products/')&&!path.includes('/tanks/');
  const cached=responseCache.get(path);
  if(cacheable&&cached&&Date.now()-cached.at<15000)return cached.body;
  const headers = { ...(options.headers || {}) };
  if(path.startsWith('/api/v1/admin/')){
    // Human Care requires a real Admin identity; never send the Catalog test bypass marker.
    if(!path.startsWith('/api/v1/admin/catalog/aquacare')) headers['x-catalog-test-admin']='1';
    const password=adminSession.get();
    if(password) headers['x-catalog-admin-password']=password;
  }
  if (!(options.body instanceof FormData) && options.body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(path, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error=new Error(body?.error?.message || `HTTP ${response.status}`);
    error.status=response.status;
    throw error;
  }
  if(cacheable)responseCache.set(path,{at:Date.now(),body});
  if(method!=='GET')responseCache.clear();
  return body;
}

let latestProductList=null;
let latestTankList=null;
let latestMarketList=null;
function latestOnly(kind,promise){
  if(kind==='products')latestProductList=promise;else if(kind==='tanks')latestTankList=promise;else latestMarketList=promise;
  const current=()=>kind==='products'?latestProductList:(kind==='tanks'?latestTankList:latestMarketList);
  return promise.then(value=>promise===current()?value:current(),error=>promise===current()?Promise.reject(error):current());
}

export const publicApi = {
  listProducts: ({ q='', category='', sale_status='' } = {}) => {const p=request(`/api/v1/catalog/products?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}&sale_status=${encodeURIComponent(sale_status)}`);return latestOnly('products',p)},
  listCategories: () => request('/api/v1/catalog/categories'),
  getProduct: slug => request(`/api/v1/catalog/products/${encodeURIComponent(slug)}`),
  listTanks: ({q=''}={}) => {const p=request(`/api/v1/catalog/tanks?q=${encodeURIComponent(q)}`);return latestOnly('tanks',p)},
  getTank: slug => request(`/api/v1/catalog/tanks/${encodeURIComponent(slug)}`),
  getHomepage: () => request('/api/v1/catalog/site/homepage'),
  getPolicy: () => request('/api/v1/catalog/site/policy'),
  listMarketPosts: ({q='',category=''}={}) => {const p=request(`/api/v1/catalog/market/posts?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`);return latestOnly('market',p)},
  listMarketCategories: () => request('/api/v1/catalog/market/categories'),
  getMarketPost: ref => request(`/api/v1/catalog/market/posts/${encodeURIComponent(ref)}`)
};

export const adminApi = {
  verify: () => request('/api/v1/admin/catalog/products?filter=all&q=__admin_verify__'),
  listProducts: ({ filter='all', q='' } = {}) => request(`/api/v1/admin/catalog/products?filter=${encodeURIComponent(filter)}&q=${encodeURIComponent(q)}`),
  getProduct: productId => request(`/api/v1/admin/catalog/products/${encodeURIComponent(productId)}`),
  createProduct: body => request('/api/v1/admin/catalog/products',{method:'POST',body:JSON.stringify(body)}),
  updateSource: (productId,body) => request(`/api/v1/admin/catalog/products/${encodeURIComponent(productId)}/source`,{method:'PUT',body:JSON.stringify(body)}),
  deleteProduct: productId => request(`/api/v1/admin/catalog/products/${encodeURIComponent(productId)}`,{method:'DELETE'}),
  updateContent: (productId, content) => request(`/api/v1/admin/catalog/products/${encodeURIComponent(productId)}/content`, { method:'PUT', body:JSON.stringify(content) }),
  publish: productId => request(`/api/v1/admin/catalog/products/${encodeURIComponent(productId)}/publish`, { method:'POST' }),
  unpublish: productId => request(`/api/v1/admin/catalog/products/${encodeURIComponent(productId)}/unpublish`, { method:'POST' }),
  sync: () => request('/api/v1/admin/catalog/sync', { method:'POST' }),
  syncStatus: () => request('/api/v1/admin/catalog/sync/status'),
  listMedia: productId => request(`/api/v1/admin/catalog/products/${encodeURIComponent(productId)}/media`),
  uploadMedia: (productId, file, altText='') => { const fd=new FormData();fd.append('file',file);fd.append('alt_text',altText);return request(`/api/v1/admin/catalog/products/${encodeURIComponent(productId)}/media`,{method:'POST',body:fd}); },
  updateMedia: (productId, mediaId, body) => request(`/api/v1/admin/catalog/products/${encodeURIComponent(productId)}/media/${encodeURIComponent(mediaId)}`,{method:'PATCH',body:JSON.stringify(body)}),
  patchMedia: (productId, mediaId, body) => request(`/api/v1/admin/catalog/products/${encodeURIComponent(productId)}/media/${encodeURIComponent(mediaId)}`,{method:'PATCH',body:JSON.stringify(body)}),
  reorderMedia: (productId, mediaIds) => request(`/api/v1/admin/catalog/products/${encodeURIComponent(productId)}/media/reorder`,{method:'PUT',body:JSON.stringify({media_ids:mediaIds})}),
  deleteMedia: (productId, mediaId) => request(`/api/v1/admin/catalog/products/${encodeURIComponent(productId)}/media/${encodeURIComponent(mediaId)}`,{method:'DELETE'}),
  listProductVariants: productId => request(`/api/v1/admin/catalog/products/${encodeURIComponent(productId)}/variants`),
  saveProductVariants: (productId,items) => request(`/api/v1/admin/catalog/products/${encodeURIComponent(productId)}/variants`,{method:'PUT',body:JSON.stringify({items})}),
  listTanks: ({q=''}={}) => request(`/api/v1/admin/catalog/tanks?q=${encodeURIComponent(q)}`),
  getTank: tankId => request(`/api/v1/admin/catalog/tanks/${encodeURIComponent(tankId)}`),
  createTank: body => request('/api/v1/admin/catalog/tanks',{method:'POST',body:JSON.stringify(body)}),
  updateTank: (tankId,body) => request(`/api/v1/admin/catalog/tanks/${encodeURIComponent(tankId)}`,{method:'PUT',body:JSON.stringify(body)}),
  deleteTank: tankId => request(`/api/v1/admin/catalog/tanks/${encodeURIComponent(tankId)}`,{method:'DELETE'}),
  listTankMedia: tankId => request(`/api/v1/admin/catalog/tanks/${encodeURIComponent(tankId)}/media`),
  uploadTankMedia: (tankId,file,altText='')=>{const fd=new FormData();fd.append('file',file);fd.append('alt_text',altText);return request(`/api/v1/admin/catalog/tanks/${encodeURIComponent(tankId)}/media`,{method:'POST',body:fd})},
  patchTankMedia: (tankId,mediaId,body)=>request(`/api/v1/admin/catalog/tanks/${encodeURIComponent(tankId)}/media/${encodeURIComponent(mediaId)}`,{method:'PATCH',body:JSON.stringify(body)}),
  deleteTankMedia: (tankId,mediaId)=>request(`/api/v1/admin/catalog/tanks/${encodeURIComponent(tankId)}/media/${encodeURIComponent(mediaId)}`,{method:'DELETE'}),
  listTankCategories: () => request('/api/v1/admin/catalog/tank-categories'),
  createTankCategory: body => request('/api/v1/admin/catalog/tank-categories',{method:'POST',body:JSON.stringify(body)}),
  updateTankCategory: (id,body) => request(`/api/v1/admin/catalog/tank-categories/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(body)}),
  deleteTankCategory: id => request(`/api/v1/admin/catalog/tank-categories/${encodeURIComponent(id)}`,{method:'DELETE'}),
  getTankCategories: tankId => request(`/api/v1/admin/catalog/tank-categories/tank/${encodeURIComponent(tankId)}`),
  setTankCategories: (tankId,categoryIds) => request(`/api/v1/admin/catalog/tank-categories/tank/${encodeURIComponent(tankId)}`,{method:'PUT',body:JSON.stringify({category_ids:categoryIds})}),
  listLegacyMappings: status => request(`/api/v1/admin/catalog/legacy/mappings${status?`?status=${encodeURIComponent(status)}`:''}`),
  confirmLegacyMapping: (legacyKey, productId) => request(`/api/v1/admin/catalog/legacy/mappings/${encodeURIComponent(legacyKey)}`,{method:'PUT',body:JSON.stringify({product_id:productId})}),
  listCategories: () => request('/api/v1/admin/catalog/categories'),
  createCategory: body => request('/api/v1/admin/catalog/categories',{method:'POST',body:JSON.stringify(body)}),
  updateCategory: (id,body) => request(`/api/v1/admin/catalog/categories/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(body)}),
  deleteCategory: id => request(`/api/v1/admin/catalog/categories/${encodeURIComponent(id)}`,{method:'DELETE'}),
  getProductCategories: productId => request(`/api/v1/admin/catalog/categories/product/${encodeURIComponent(productId)}`),
  setProductCategories: (productId,categoryIds) => request(`/api/v1/admin/catalog/categories/product/${encodeURIComponent(productId)}`,{method:'PUT',body:JSON.stringify({category_ids:categoryIds})}),
  listAudit: limit => request(`/api/v1/admin/catalog/audit?limit=${encodeURIComponent(limit||100)}`),
  getHomepage: () => request('/api/v1/admin/catalog/site/homepage'),
  updateHomepage: content => request('/api/v1/admin/catalog/site/homepage',{method:'PUT',body:JSON.stringify(content)}),
  getPolicy: () => request('/api/v1/admin/catalog/site/policy'),
  updatePolicy: content => request('/api/v1/admin/catalog/site/policy',{method:'PUT',body:JSON.stringify(content)}),
  listLookupOptions: fieldKey => request(`/api/v1/admin/catalog/lookups/${encodeURIComponent(fieldKey)}`),
  createLookupOption: (fieldKey,body) => request(`/api/v1/admin/catalog/lookups/${encodeURIComponent(fieldKey)}`,{method:'POST',body:JSON.stringify(body)}),
  updateLookupOption: (fieldKey,id,body) => request(`/api/v1/admin/catalog/lookups/${encodeURIComponent(fieldKey)}/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(body)}),
  deleteLookupOption: (fieldKey,id) => request(`/api/v1/admin/catalog/lookups/${encodeURIComponent(fieldKey)}/${encodeURIComponent(id)}`,{method:'DELETE'}),
  listMarketPosts: ({q='',status='',moderation=''}={}) => request(`/api/v1/admin/catalog/market?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}&moderation=${encodeURIComponent(moderation)}`),
  getMarketPost: id => request(`/api/v1/admin/catalog/market/${encodeURIComponent(id)}`),
  createMarketPost: body => request('/api/v1/admin/catalog/market',{method:'POST',body:JSON.stringify(body)}),
  updateMarketPost: (id,body) => request(`/api/v1/admin/catalog/market/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(body)}),
  publishMarketPost: id => request(`/api/v1/admin/catalog/market/${encodeURIComponent(id)}/publish`,{method:'POST'}),
  unpublishMarketPost: (id,body={}) => request(`/api/v1/admin/catalog/market/${encodeURIComponent(id)}/unpublish`,{method:'POST',body:JSON.stringify(body)}),
  rejectMarketPost: (id,note='') => request(`/api/v1/admin/catalog/market/posts/${encodeURIComponent(id)}/reject`,{method:'POST',body:JSON.stringify({note})}),
  listMarketSessions: () => request('/api/v1/admin/catalog/market/sessions'),
  createMarketSession: body => request('/api/v1/admin/catalog/market/sessions',{method:'POST',body:JSON.stringify(body)}),
  updateMarketSession: (id,body) => request(`/api/v1/admin/catalog/market/sessions/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(body)}),
  setMarketSessionStatus: (id,status) => request(`/api/v1/admin/catalog/market/sessions/${encodeURIComponent(id)}/status`,{method:'POST',body:JSON.stringify({status})}),
  listHumanCareIncidents: (status='')=>request('/api/v1/admin/catalog/aquacare/incidents'+(status?'?status='+encodeURIComponent(status):'')),
  getHumanCareIncident: id=>request('/api/v1/admin/catalog/aquacare/incidents/'+encodeURIComponent(id)),
  updateHumanCareIncident: (id,body)=>request('/api/v1/admin/catalog/aquacare/incidents/'+encodeURIComponent(id)+'/actions',{method:'POST',body:JSON.stringify(body)}),
    deleteMarketPost: id => request(`/api/v1/admin/catalog/market/${encodeURIComponent(id)}`,{method:'DELETE'})
};
