const finiteTime=value=>{const t=value?new Date(value).getTime():NaN;return Number.isFinite(t)?t:null};

export function sessionClock(session,now=Date.now()){
  if(!session)return{phase:'NONE',hasTimeline:false,progress:null,targetAt:null,remainingMs:null};
  const start=finiteTime(session.starts_at),end=finiteTime(session.ends_at),current=Number(now);
  const hasTimeline=start!==null&&end!==null&&end>start;
  let phase='UNKNOWN',targetAt=null;
  if(start!==null&&current<start){phase='UPCOMING';targetAt=start}
  else if(end!==null&&current>=end){phase='ENDED'}
  else if(start!==null&&end!==null&&current>=start&&current<end){phase='OPEN';targetAt=end}
  else if(start!==null&&current>=start&&end===null){phase='STARTED'}
  else if(end!==null&&current<end&&start===null){phase='ENDING';targetAt=end}
  const progress=hasTimeline?Math.max(0,Math.min(100,((current-start)/(end-start))*100)):null;
  const remainingMs=targetAt===null?null:Math.max(0,targetAt-current);
  return{phase,hasTimeline,progress,targetAt,remainingMs,startAt:start,endAt:end};
}

export function countdownText(ms){
  if(ms===null||ms===undefined)return'';
  const total=Math.max(0,Math.floor(Number(ms)/1000));
  const days=Math.floor(total/86400),hours=Math.floor((total%86400)/3600),minutes=Math.floor((total%3600)/60),seconds=total%60;
  const hh=String(hours).padStart(2,'0'),mm=String(minutes).padStart(2,'0'),ss=String(seconds).padStart(2,'0');
  return days>0?days+' ngày '+hh+':'+mm+':'+ss:hh+':'+mm+':'+ss;
}

export function sessionStageView(session,now=Date.now()){
  const clock=sessionClock(session,now);
  const fallback=session?.status||'NONE';
  const phase=['UPCOMING','OPEN','ENDED'].includes(clock.phase)?clock.phase:fallback;
  const label=phase==='OPEN'?'CHỢ CÁ ĐANG MỞ':phase==='UPCOMING'?'PHIÊN SẮP MỞ':phase==='ENDED'?'PHIÊN ĐÃ KẾT THÚC':'ZWMARKET';
  const prefix=phase==='OPEN'?'Còn ':phase==='UPCOMING'?'Mở sau ':'';
  const countdown=clock.remainingMs===null?'':countdownText(clock.remainingMs);
  return{...clock,phase,label,prefix,countdown};
}
