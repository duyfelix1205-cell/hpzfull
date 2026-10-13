import React,{useEffect,useState}from'react';
import{createPortal}from'react-dom';
import{publicApi}from'./api.js';
import{contentPublicApi}from'./contentApi.js';

export function ViewerEnhancements(){
 const[target,setTarget]=useState(null),[sections,setSections]=useState([]);
 useEffect(()=>{
   const nav=document.querySelector('.legacy-public header.site .nav ul');
   if(nav){
     const policy=[...nav.querySelectorAll('a')].find(a=>String(a.getAttribute('href')||'').includes('chinhsach'))?.closest('li');
     if(!nav.querySelector('.viewer-market-nav')){const li=document.createElement('li');li.className='viewer-market-nav';li.innerHTML='<a href="/zwmarket">ZWMarket</a>';policy?nav.insertBefore(li,policy):nav.appendChild(li)}
     if(!nav.querySelector('.viewer-journal-nav')){const li=document.createElement('li');li.className='viewer-journal-nav';li.innerHTML='<a href="/nhat-bao">Nhật Báo</a>';policy?nav.insertBefore(li,policy):nav.appendChild(li)}
     if(!nav.querySelector('.viewer-wiki-nav')){const li=document.createElement('li');li.className='viewer-wiki-nav';li.innerHTML='<a href="/hpzwiki">HPzwiki</a>';policy?nav.insertBefore(li,policy):nav.appendChild(li)}
   }
   const track=e=>{const a=e.target?.closest?.('a[href]');if(!a||a.dataset.noTrack==='1')return;const raw=a.getAttribute('href');if(!raw||raw.startsWith('javascript:'))return;contentPublicApi.recordClick({source_path:location.pathname+location.search,target_path:raw,link_label:String(a.textContent||'').trim().slice(0,160)})};
   document.addEventListener('click',track,true);
   const tuneImages=()=>document.querySelectorAll('.legacy-public .grid img,.legacy-public .tank-grid img,.legacy-public .teaser-grid img,.legacy-public .detail-thumbs img,.content-hub img,.zw-public img').forEach(img=>{img.loading='lazy';img.decoding='async'});
   tuneImages();
   const mo=new MutationObserver(tuneImages);mo.observe(document.body,{childList:true,subtree:true});
   const findTarget=()=>{const t=document.querySelector('.legacy-public .detail-copy');if(t)setTarget(t)};
   findTarget();
   const tm=setInterval(findTarget,120);
   const path=location.pathname.replace(/\/$/,'');
   const fish=path.match(/^\/fish\/(.+)$/),tank=path.match(/^\/tank\/(.+)$/);
   if(fish)publicApi.getProduct(decodeURIComponent(fish[1])).then(d=>setSections(Array.isArray(d.display_sections_json)?d.display_sections_json:[])).catch(()=>{});
   else if(tank)publicApi.getTank(decodeURIComponent(tank[1])).then(d=>setSections(Array.isArray(d.display_sections_json)?d.display_sections_json:[])).catch(()=>{});
   return()=>{clearInterval(tm);mo.disconnect();document.removeEventListener('click',track,true)}
 },[]);
 const visible=sections.filter(x=>String(x?.title||x?.text||'').trim());
 return <>{target&&visible.length>0&&createPortal(<section className="viewer-custom-sections">{visible.map((s,i)=><div className="viewer-custom-section" key={s.id||i}>{s.title&&<b>{s.title}</b>}{s.text&&<span>{s.text}</span>}</div>)}</section>,target)}</>;
}
