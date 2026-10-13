const ADMIN_PASSWORD_KEY='nexora.catalog.admin.password';

async function request(path,options={}){
  const headers={...(options.headers||{})};
  if(path.startsWith('/api/v1/admin/')){
    headers['x-catalog-test-admin']='1';
    const password=sessionStorage.getItem(ADMIN_PASSWORD_KEY)||'';
    if(password)headers['x-catalog-admin-password']=password;
  }
  if(options.body!==undefined)headers['content-type']='application/json';
  const response=await fetch(path,{...options,headers});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body?.error?.message||`HTTP ${response.status}`);
  return body;
}

export const contentPublicApi={
  listTaxonomy:scope=>request(`/api/v1/catalog/content/taxonomy/${encodeURIComponent(scope)}`),
  listJournal:({q=''}={})=>request(`/api/v1/catalog/content/journal?q=${encodeURIComponent(q)}`),
  getJournal:slug=>request(`/api/v1/catalog/content/journal/${encodeURIComponent(slug)}`),
  listWiki:({q='',category=''}={})=>request(`/api/v1/catalog/content/wiki?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`),
  getWiki:slug=>request(`/api/v1/catalog/content/wiki/${encodeURIComponent(slug)}`),
  recordClick:body=>fetch('/api/v1/catalog/content/traffic/click',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),keepalive:true}).catch(()=>{})
};

export const contentAdminApi={
  listTaxonomy:scope=>request(`/api/v1/admin/catalog/content/taxonomy/${encodeURIComponent(scope)}`),
  createTaxonomy:(scope,body)=>request(`/api/v1/admin/catalog/content/taxonomy/${encodeURIComponent(scope)}`,{method:'POST',body:JSON.stringify(body)}),
  updateTaxonomy:(scope,id,body)=>request(`/api/v1/admin/catalog/content/taxonomy/${encodeURIComponent(scope)}/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(body)}),
  deleteTaxonomy:(scope,id)=>request(`/api/v1/admin/catalog/content/taxonomy/${encodeURIComponent(scope)}/${encodeURIComponent(id)}`,{method:'DELETE'}),
  listJournal:({q=''}={})=>request(`/api/v1/admin/catalog/content/journal?q=${encodeURIComponent(q)}`),
  createJournal:body=>request('/api/v1/admin/catalog/content/journal',{method:'POST',body:JSON.stringify(body)}),
  updateJournal:(id,body)=>request(`/api/v1/admin/catalog/content/journal/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(body)}),
  deleteJournal:id=>request(`/api/v1/admin/catalog/content/journal/${encodeURIComponent(id)}`,{method:'DELETE'}),
  listWiki:({q=''}={})=>request(`/api/v1/admin/catalog/content/wiki?q=${encodeURIComponent(q)}`),
  createWiki:body=>request('/api/v1/admin/catalog/content/wiki',{method:'POST',body:JSON.stringify(body)}),
  updateWiki:(id,body)=>request(`/api/v1/admin/catalog/content/wiki/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(body)}),
  deleteWiki:id=>request(`/api/v1/admin/catalog/content/wiki/${encodeURIComponent(id)}`,{method:'DELETE'}),
  traffic:days=>request(`/api/v1/admin/catalog/content/traffic?days=${encodeURIComponent(days)}`)
};
