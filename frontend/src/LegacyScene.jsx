import React,{useEffect,useRef}from'react';

const LEGACY='/assets/hpz/scene/';
const FISH=['fish_blue','fish_brown','fish_green','fish_grey','fish_grey_long_a','fish_grey_long_b','fish_orange','fish_pink','fish_red'];
const SMALL_FISH=['fish_grey','fish_green','fish_blue'];
const FLOCK_GROUPS=3;
const BUBBLES=['bubble_a','bubble_b','bubble_c'];
const rand=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];

export function LegacyScene(){
  const ref=useRef(null);
  useEffect(()=>{
    const host=ref.current;if(!host)return;
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mobile=innerWidth<760||/Mobi|Android/i.test(navigator.userAgent);
    const cv=document.createElement('canvas');host.appendChild(cv);const ctx=cv.getContext('2d');
    let W=0,H=0,dpr=1,raf=0,last=performance.now(),start=last,scrollY=window.scrollY;
    const imgs={};
    [...FISH,...BUBBLES,'turtle2'].forEach(name=>{const i=new Image();i.src=LEGACY+name+'.png';imgs[name]=i});
    const fish=Array.from({length:mobile?9:16},()=>({name:pick(FISH),x:rand(-200,innerWidth+200),y:rand(.08,.86),dir:Math.random()<.5?1:-1,depth:rand(.25,1),phase:rand(0,Math.PI*2),speed:rand(24,78),bob:rand(5,13)}));
    const flock=[];
    if(!mobile){
      for(let g=0;g<FLOCK_GROUPS;g++){
        const count=Math.floor(rand(9,14));
        const name=SMALL_FISH[g%SMALL_FISH.length];
        const scale=rand(.5,.62);
        for(let j=0;j<count;j++)flock.push({g,name,scale:scale+rand(-.05,.05),x:rand(0,innerWidth),y:rand(innerHeight*.2,innerHeight*.6),vx:rand(10,40),vy:rand(-6,6),phase:rand(0,Math.PI*2)});
      }
    }
    const bubbles=Array.from({length:mobile?22:44},()=>({name:pick(BUBBLES),x:Math.random(),y:Math.random(),speed:rand(14,52),size:rand(9,25),phase:rand(0,6.28)}));
    const dust=Array.from({length:mobile?45:105},()=>({x:Math.random(),y:Math.random(),r:rand(.5,1.8),a:rand(.06,.28),s:rand(2,8),p:rand(0,6.28)}));
    const rays=Array.from({length:mobile?5:9},()=>({x:Math.random(),w:rand(65,180),a:rand(.025,.075),p:rand(0,6.28)}));
    const ripples=[];const burst=[];
    let turtle=null,turtleAt=rand(10,18),elapsed=0;
    function resize(){dpr=Math.min(devicePixelRatio||1,mobile?1.4:2);W=innerWidth;H=innerHeight;cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);cv.style.width=W+'px';cv.style.height=H+'px';ctx.setTransform(dpr,0,0,dpr,0,0)}
    function onScroll(){scrollY=window.scrollY}
    function pointer(e){if(reduce)return;ripples.push({x:e.clientX,y:e.clientY,r:4,a:.45});for(let i=0;i<7;i++)burst.push({x:e.clientX+rand(-8,8),y:e.clientY+rand(-5,5),vx:rand(-14,14),vy:rand(25,65),r:rand(1,3),a:rand(.35,.75)})}
    addEventListener('resize',resize);addEventListener('scroll',onScroll,{passive:true});addEventListener('pointerdown',pointer,{passive:true});resize();
    function sprite(name,cx,cy,w,h,flip,a=1,rot=0){const im=imgs[name];if(!im?.complete||!im.naturalWidth)return;ctx.save();ctx.globalAlpha=a;ctx.translate(cx,cy);ctx.rotate(rot);ctx.scale(flip?-1:1,1);ctx.drawImage(im,-w/2,-h/2,w,h);ctx.restore()}
    function frame(now){const dt=Math.min(.05,(now-last)/1000)||.016;last=now;elapsed=(now-start)/1000;const depth=Math.min(1,scrollY/Math.max(900,document.documentElement.scrollHeight-innerHeight));
      const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,`rgb(${Math.round(16-9*depth)},${Math.round(80-50*depth)},${Math.round(126-76*depth)})`);g.addColorStop(.46,`rgb(${Math.round(11-5*depth)},${Math.round(63-31*depth)},${Math.round(102-50*depth)})`);g.addColorStop(1,`rgb(${Math.round(5-2*depth)},${Math.round(37-20*depth)},${Math.round(61-28*depth)})`);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
      ctx.save();ctx.globalCompositeOperation='lighter';rays.forEach(r=>{const x=r.x*W+Math.sin(elapsed*.11+r.p)*45;const gg=ctx.createLinearGradient(x,0,x+r.w*.35,H*.72);gg.addColorStop(0,`rgba(180,235,255,${r.a*(1-depth*.65)})`);gg.addColorStop(1,'rgba(100,190,230,0)');ctx.fillStyle=gg;ctx.beginPath();ctx.moveTo(x-r.w/2,0);ctx.lineTo(x+r.w/2,0);ctx.lineTo(x+r.w*.78,H*.72);ctx.lineTo(x-r.w*.22,H*.72);ctx.closePath();ctx.fill()});ctx.restore();
      dust.forEach(d=>{d.y-=d.s*dt/H;if(d.y<0)d.y=1;const x=d.x*W+Math.sin(elapsed*.18+d.p)*7;ctx.fillStyle=`rgba(210,240,250,${d.a})`;ctx.beginPath();ctx.arc(x,d.y*H-scrollY*.015,d.r,0,Math.PI*2);ctx.fill()});
      bubbles.forEach(b=>{b.y-=b.speed*dt/H;if(b.y<-.08){b.y=1.05;b.x=Math.random()}sprite(b.name,b.x*W+Math.sin(elapsed*.7+b.phase)*10,b.y*H,b.size,b.size,false,.48)});
      if(flock.length){
        flock.forEach(b=>{
          const ax=((elapsed*14+b.g*(W/3)+Math.sin(elapsed*.3+b.g*2.1)*W*.25)%(W+240))-120;
          const ay=H*.3+Math.sin(elapsed*.47+b.g)*H*.16-scrollY*.05;
          let sx=ax-b.x,sy=ay-b.y;
          const d=Math.hypot(sx,sy)||1;
          sx=sx/d*32;sy=sy/d*32;
          for(const o of flock){
            if(o===b)continue;
            const dx=b.x-o.x,dy=b.y-o.y,d2=dx*dx+dy*dy;
            if(d2<420&&d2>0){
              const dd=Math.sqrt(d2);
              sx+=(dx/dd)*(26-dd/16);
              sy+=(dy/dd)*(26-dd/16);
            }
          }
          b.vx+=(sx-b.vx)*Math.min(1,dt*2.4);
          b.vy+=(sy-b.vy)*Math.min(1,dt*2.4);
          const speed=Math.hypot(b.vx,b.vy)||1;
          if(speed>58){b.vx=b.vx/speed*58;b.vy=b.vy/speed*58}
          b.x+=b.vx*dt;
          b.y+=b.vy*dt+Math.sin(elapsed*5+b.phase)*6*dt;
          if(b.y<H*.08){b.y=H*.08;b.vy=Math.abs(b.vy)}
          if(b.y>H*.7){b.y=H*.7;b.vy=-Math.abs(b.vy)}
        });
        flock.forEach(b=>{
          const w=64*b.scale,h=w*.72;
          sprite(b.name,b.x,b.y,w,h,b.vx<0,.62,Math.sin(elapsed*7+b.phase)*.025);
        });
      }
      fish.forEach((f,i)=>{f.x+=f.speed*f.dir*dt;if(f.dir>0&&f.x>W+170)f.x=-170;if(f.dir<0&&f.x<-170)f.x=W+170;const y=f.y*H+Math.sin(elapsed*(.7+f.depth)+f.phase)*f.bob-scrollY*(.01+.035*f.depth);const w=(55+105*f.depth)*(mobile?.76:1);sprite(f.name,f.x,y,w,w*.56,f.dir<0,.36+.55*f.depth,Math.sin(elapsed*5+f.phase)*.025)});
      if(!mobile&&!reduce){turtleAt-=dt;if(!turtle&&turtleAt<=0){const dir=Math.random()<.5?1:-1;turtle={dir,x:dir>0?-230:W+230,y:rand(H*.18,H*.45),speed:rand(15,23),p:rand(0,6.28)};turtleAt=rand(16,28)}if(turtle){turtle.x+=turtle.speed*turtle.dir*dt;const yy=turtle.y+Math.sin(elapsed*.5+turtle.p)*12;sprite('turtle2',turtle.x,yy,185,125,turtle.dir<0,.48);if(turtle.x<-280||turtle.x>W+280)turtle=null}}
      ripples.forEach(r=>{r.r+=85*dt;r.a-=.42*dt;ctx.strokeStyle=`rgba(170,235,255,${Math.max(0,r.a)})`;ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,Math.PI*2);ctx.stroke()});for(let i=ripples.length-1;i>=0;i--)if(ripples[i].a<=0)ripples.splice(i,1);
      burst.forEach(b=>{b.x+=b.vx*dt;b.y-=b.vy*dt;b.a-=.45*dt;ctx.strokeStyle=`rgba(210,245,255,${Math.max(0,b.a)})`;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.stroke()});for(let i=burst.length-1;i>=0;i--)if(burst[i].a<=0)burst.splice(i,1);
      raf=requestAnimationFrame(frame)}
    raf=requestAnimationFrame(frame);return()=>{cancelAnimationFrame(raf);removeEventListener('resize',resize);removeEventListener('scroll',onScroll);removeEventListener('pointerdown',pointer);cv.remove()}
  },[]);
  return <div id="aquarium-bg" ref={ref} aria-hidden="true"/>;
}

export const legacyAsset=path=>`/assets/hpz/${path}`;
