async function request(path,{method='GET',body}={}){
  const response=await fetch(path,{
    method,
    credentials:'same-origin',
    headers:body===undefined?{}:{'content-type':'application/json'},
    ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  const payload=await response.json().catch(()=>null);
  if(!response.ok){
    const error=new Error(payload?.error?.message||payload?.message||('Request failed ('+response.status+')'));
    error.status=response.status;
    error.code=payload?.error?.code||payload?.code||'REQUEST_FAILED';
    throw error;
  }
  return payload;
}

export const marketApi={
  sessions:(includeEnded=false)=>request('/api/v1/catalog/market/sessions?include_ended='+(includeEnded?'true':'false')),
  sessionPosts:ref=>request('/api/v1/catalog/market/sessions/'+encodeURIComponent(ref)+'/posts'),
  mine:()=>request('/api/v1/catalog/market/mine/posts'),
  create:body=>request('/api/v1/catalog/market/mine/posts',{method:'POST',body}),
  update:(id,body)=>request('/api/v1/catalog/market/mine/posts/'+encodeURIComponent(id),{method:'PUT',body}),
  resubmit:id=>request('/api/v1/catalog/market/mine/posts/'+encodeURIComponent(id)+'/resubmit',{method:'POST',body:{}}),
  sold:id=>request('/api/v1/catalog/market/mine/posts/'+encodeURIComponent(id)+'/sold',{method:'POST',body:{}}),
  joinSession:(id,sessionRef)=>request('/api/v1/catalog/market/mine/posts/'+encodeURIComponent(id)+'/sessions/'+encodeURIComponent(sessionRef),{method:'POST',body:{}}),
  leaveSession:(id,sessionRef)=>request('/api/v1/catalog/market/mine/posts/'+encodeURIComponent(id)+'/sessions/'+encodeURIComponent(sessionRef),{method:'DELETE'})
};
