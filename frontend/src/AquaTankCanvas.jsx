import React,{useEffect,useMemo,useRef,useState}from'react';
import{buildFishInstances,renderPolicy}from'./aquacare-visual-model.js';
import{FISH_2D_ATLAS,fish2dSprite}from'./fish-2d-library.js';

const colorPalette=['#ef8c57','#f2c14e','#4cb3a7','#5e8fd8','#c76ca9','#f06f70','#6aa85a','#8a74d6'];

function fallbackColor(name,index){
  let h=0;for(const ch of String(name||''))h=((h<<5)-h+ch.charCodeAt(0))|0;
  return colorPalette[Math.abs(h+index)%colorPalette.length];
}
function drawFallbackFish(ctx,w,h,color){
  ctx.save();
  ctx.fillStyle=color;
  ctx.beginPath();ctx.moveTo(-w*.46,0);ctx.lineTo(-w*.7,-h*.34);ctx.lineTo(-w*.7,h*.34);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.ellipse(0,0,w*.5,h*.42,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.44)';
  ctx.beginPath();ctx.ellipse(w*.12,-h*.06,w*.18,h*.12,-.25,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#062b45';ctx.beginPath();ctx.arc(w*.31,-h*.08,Math.max(1.4,h*.055),0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.65)';ctx.beginPath();ctx.arc(w*.33,-h*.1,Math.max(.6,h*.023),0,Math.PI*2);ctx.fill();
  ctx.restore();
}
function drawSpriteFish(ctx,img,sprite,w,h){
  ctx.drawImage(img,sprite.sx,sprite.sy,sprite.sw,sprite.sh,-w/2,-h/2,w,h);
}
function drawRealFish(ctx,img,w,h){
  ctx.save();
  ctx.beginPath();ctx.ellipse(0,0,w*.52,h*.48,0,0,Math.PI*2);ctx.clip();
  const ratio=img.naturalWidth&&img.naturalHeight?img.naturalWidth/img.naturalHeight:1.5;
  let dw=w,dh=h;if(ratio>w/h){dh=w/ratio}else{dw=h*ratio}
  ctx.drawImage(img,-dw/2,-dh/2,dw,dh);
  ctx.restore();
  ctx.strokeStyle='rgba(255,255,255,.48)';ctx.lineWidth=1;
  ctx.beginPath();ctx.ellipse(0,0,w*.52,h*.48,0,0,Math.PI*2);ctx.stroke();
}
function issueSurfaceSet(instances,issues){
  const gasp=(issues||[]).filter(x=>x.status==='OPEN'&&x.issue_type==='gasp');
  if(!gasp.length)return new Set();
  const set=new Set();
  for(const issue of gasp){
    const matches=issue.affected_tank_item_id?instances.filter(x=>x.item_id===issue.affected_tank_item_id):instances;
    const count=Math.max(1,Number(issue.affected_count||Math.min(3,matches.length)));
    matches.slice(0,count).forEach(x=>set.add(x.id));
  }
  return set;
}

export function AquaTankCanvas({tank}){
  const canvasRef=useRef(null),hostRef=useRef(null),[size,setSize]=useState({w:720,h:320});
  const fishItems=useMemo(()=>buildFishInstances(tank?.items||[]),[tank?.items]);
  const openIssues=useMemo(()=>(tank?.issues||[]).filter(x=>x.status==='OPEN'),[tank?.issues]);
  const surfaceIds=useMemo(()=>issueSurfaceSet(fishItems,openIssues),[fishItems,openIssues]);
  const water=tank?.logs?.[0]?.water_state||'clear';
  const groups=useMemo(()=>{const map=new Map();for(const x of tank?.items||[]){if(x.item_type!=='FISH'||x.removed_at)continue;const name=x.species_name||x.product_name||'Cá';map.set(name,(map.get(name)||0)+Number(x.quantity||0))}return[...map.entries()]},[tank?.items]);

  useEffect(()=>{
    const host=hostRef.current;if(!host)return;
    const apply=()=>setSize({w:Math.max(280,Math.floor(host.clientWidth)),h:Math.max(220,Math.floor(host.clientHeight))});
    apply();
    const ro=new ResizeObserver(apply);ro.observe(host);return()=>ro.disconnect();
  },[]);

  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const ratio=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.floor(size.w*ratio);canvas.height=Math.floor(size.h*ratio);
    canvas.style.width=size.w+'px';canvas.style.height=size.h+'px';
    const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);
    const policy=renderPolicy(fishItems.length);
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const states=fishItems.map((fish,index)=>({...fish,sprite:fish.image_url?null:fish2dSprite(fish.name),px:fish.x*size.w,py:fish.y*size.h,t:fish.phase,index}));
    const imageCache=new Map();
    const spriteAtlas={img:null,ready:false,failed:false};
    if(states.some(f=>f.sprite)){
      const img=new Image();img.decoding='async';img.src=FISH_2D_ATLAS;spriteAtlas.img=img;
      img.onload=()=>{spriteAtlas.ready=true};img.onerror=()=>{spriteAtlas.failed=true};
    }
    for(const f of states){
      if(!f.image_url||imageCache.has(f.image_url))continue;
      const img=new Image();img.decoding='async';img.src=f.image_url;imageCache.set(f.image_url,{img,ready:false});
      img.onload=()=>{const row=imageCache.get(f.image_url);if(row)row.ready=true};
      img.onerror=()=>{const row=imageCache.get(f.image_url);if(row)row.failed=true};
    }
    let raf=0,last=0;
    const baseSize=Math.max(12,Math.min(42,30*policy.size*(size.w/720)));
    const render=now=>{
      if(now-last<1000/policy.fps){raf=requestAnimationFrame(render);return}
      const dt=Math.min(.06,(now-last||16)/1000);last=now;
      ctx.clearRect(0,0,size.w,size.h);
      for(const s of states){
        if(!reduced){
          s.t+=dt;
          const targetTop=surfaceIds.has(s.id);
          const vertical=Math.sin(s.t*1.8+s.phase)*7;
          s.px+=s.direction*s.speed*size.w*dt;
          s.py+=Math.sin(s.t*.9+s.phase)*2*dt;
          if(targetTop)s.py+=(size.h*.12-s.py)*Math.min(1,dt*1.1);
          if(s.px>size.w+baseSize){s.px=-baseSize;s.direction=1}
          if(s.px<-baseSize){s.px=size.w+baseSize;s.direction=-1}
          const minY=targetTop?size.h*.06:size.h*.08,maxY=targetTop?size.h*.25:size.h*.86;
          s.py=Math.max(minY,Math.min(maxY,s.py));
          s.drawY=s.py+vertical;
        }else s.drawY=s.py;
        const local=baseSize*s.scale;
        const imgRow=s.image_url?imageCache.get(s.image_url):null;
        ctx.save();ctx.translate(s.px,s.drawY);if(s.direction<0)ctx.scale(-1,1);
        ctx.shadowColor='rgba(2,37,61,.18)';ctx.shadowBlur=5;ctx.shadowOffsetY=2;
        if(imgRow?.ready&&!imgRow.failed)drawRealFish(ctx,imgRow.img,local*1.75,local);
        else if(s.sprite&&spriteAtlas.ready&&!spriteAtlas.failed)drawSpriteFish(ctx,spriteAtlas.img,s.sprite,local*2.25,local*1.08);
        else drawFallbackFish(ctx,local*1.55,local*.78,fallbackColor(s.name,s.index));
        ctx.restore();
      }
      if(!reduced)raf=requestAnimationFrame(render);
    };
    render(performance.now());
    return()=>cancelAnimationFrame(raf);
  },[fishItems,size,surfaceIds]);

  return <div ref={hostRef} className={'aquacare-visual-v2 aquacare-visual-v2--'+water}>
    <canvas ref={canvasRef} aria-label={'Mô phỏng 2D '+fishItems.length+' cá trong bể '+(tank?.name||'')}/>
    <div className="aquacare-visual-v2__light"/>
    <div className="aquacare-visual-v2__plants"><i/><i/><i/></div>
    <div className="aquacare-visual-v2__ground"/>
    {tank?.has_air&&<div className="aquacare-visual-v2__air"><i/><i/><i/><i/><i/></div>}
    {openIssues.length>0&&<span className="aquacare-visual-v2__issue">⚠ {openIssues.length} vấn đề</span>}
    <div className="aquacare-visual-v2__count"><b>{fishItems.length}</b><span>cá · {groups.length} nhóm</span></div>
    <div className="aquacare-visual-v2__legend">{groups.slice(0,4).map(([name,qty])=><span key={name}>{name} × {qty}</span>)}{groups.length>4&&<span>+{groups.length-4} nhóm</span>}</div>
  </div>;
}
