async function request(path,{method='GET',body,headers}={}){
  const response=await fetch(path,{
    method,
    credentials:'same-origin',
    headers:{...(body!==undefined?{'content-type':'application/json'}:{}),...(headers||{})},
    ...(body!==undefined?{body:JSON.stringify(body)}:{})
  });
  const payload=await response.json().catch(()=>null);
  if(!response.ok){
    const error=new Error(payload?.error?.message||payload?.message||('Request failed ('+response.status+')'));
    error.status=response.status;
    error.code=payload?.error?.code||payload?.code||'REQUEST_FAILED';
    error.payload=payload;
    throw error;
  }
  return payload;
}

export const aquaCareApi={
  listTanks:()=>request('/api/v1/aquacare/tanks'),
  getTank:id=>request('/api/v1/aquacare/tanks/'+encodeURIComponent(id)),
  createTank:body=>request('/api/v1/aquacare/tanks',{method:'POST',body}),
  updateTank:(id,body)=>request('/api/v1/aquacare/tanks/'+encodeURIComponent(id),{method:'PUT',body}),
  archiveTank:id=>request('/api/v1/aquacare/tanks/'+encodeURIComponent(id),{method:'DELETE',body:{}}),
  addLog:(id,body)=>request('/api/v1/aquacare/tanks/'+encodeURIComponent(id)+'/logs',{method:'POST',body}),
  addIssue:(id,body)=>request('/api/v1/aquacare/tanks/'+encodeURIComponent(id)+'/issues',{method:'POST',body}),
  updateIssue:(id,body)=>request('/api/v1/aquacare/issues/'+encodeURIComponent(id),{method:'PATCH',body}),
  addReminder:(id,body)=>request('/api/v1/aquacare/tanks/'+encodeURIComponent(id)+'/reminders',{method:'POST',body}),
  updateReminder:(id,body)=>request('/api/v1/aquacare/reminders/'+encodeURIComponent(id),{method:'PATCH',body}),
  purchasedItems:()=>request('/api/v1/aquacare/purchased-items'),
  attachPurchased:(tankId,body)=>request('/api/v1/aquacare/tanks/'+encodeURIComponent(tankId)+'/purchased-items',{method:'POST',body}),
  relationship:()=>request('/api/v1/aquacare/relationship'),
  startCare:()=>request('/api/v1/aquacare/relationship',{method:'POST',body:{}}),
  normalCare:()=>request('/api/v1/aquacare/normal-care'),
  incidents:(params={})=>request('/api/v1/aquacare/incidents'+(params.tank_id?'?tank_id='+encodeURIComponent(params.tank_id):'')),
  createIncident:body=>request('/api/v1/aquacare/incidents',{method:'POST',body}),
  getIncident:id=>request('/api/v1/aquacare/incidents/'+encodeURIComponent(id)),
  incidentEvent:(id,body)=>request('/api/v1/aquacare/incidents/'+encodeURIComponent(id)+'/events',{method:'POST',body}),
  recurrence:(id,body)=>request('/api/v1/aquacare/incidents/'+encodeURIComponent(id)+'/recurrence',{method:'POST',body}),
  observation:body=>request('/api/v1/aquacare/observations',{method:'POST',body}),
  askGuidance:body=>request('/api/v1/aquacare/guidance-questions',{method:'POST',body}),
  history:(tankId='',page=1)=>request('/api/v1/aquacare/history?'+new URLSearchParams({page:String(page),page_size:'50',...(tankId?{tank_id:tankId}:{})}))
};

export const gameApi={
  state:()=>request('/api/v1/game/state'),
  world:()=>request('/api/v1/game/world'),
  action:(action,payload={})=>request('/api/v1/game/action',{method:'POST',body:{action,payload}})
};

export const communityApi={
  listPosts:()=>request('/api/v1/community/posts'),
  listComments:id=>request('/api/v1/community/posts/'+encodeURIComponent(id)+'/comments'),
  createPost:body=>request('/api/v1/community/posts',{method:'POST',body}),
  comment:(id,body)=>request('/api/v1/community/posts/'+encodeURIComponent(id)+'/comments',{method:'POST',body}),
  react:id=>request('/api/v1/community/posts/'+encodeURIComponent(id)+'/reactions',{method:'POST',body:{reaction_type:'LIKE'}})
};
