import React,{useCallback,useEffect,useMemo,useRef,useState}from'react';

const SAVE_KEY='hpz.wildwood.save.v1';
const WORLD={w:3600,h:2300};
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

function seeded(seed){
 let s=seed>>>0;
 return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296};
}
const rand=seeded(2042026);
const FOREST=Array.from({length:210},(_,i)=>({
 id:i,x:120+rand()*(WORLD.w-240),y:100+rand()*(WORLD.h-200),
 size:28+rand()*54,tone:i%4,lean:(rand()-.5)*.2
}));
const ROCKS=Array.from({length:52},(_,i)=>({id:i,x:100+rand()*(WORLD.w-200),y:100+rand()*(WORLD.h-200),s:12+rand()*20}));
const FIREFLIES=Array.from({length:70},(_,i)=>({id:i,x:rand()*WORLD.w,y:rand()*WORLD.h,p:rand()*Math.PI*2}));
const SEED_NODES=[
 {id:'s1',x:520,y:410},{id:'s2',x:980,y:720},{id:'s3',x:1490,y:360},{id:'s4',x:1960,y:940},
 {id:'s5',x:2440,y:540},{id:'s6',x:2940,y:920},{id:'s7',x:3120,y:1580},{id:'s8',x:2220,y:1740},
 {id:'s9',x:1550,y:1660},{id:'s10',x:820,y:1760}
];
const SPAWN={x:300,y:1180};
const HEART_TREE={x:3260,y:1160};
const ENEMY_START=[
 [760,1040],[1120,1360],[1430,900],[1760,1260],[2100,760],[2390,1320],[2760,980],[2970,1450],[1800,1720]
].map((p,i)=>({id:'e'+i,x:p[0],y:p[1],hp:3,alive:true,hit:0,attackCd:0,phase:i*.8}));

const freshGame=()=>({
 player:{x:SPAWN.x,y:SPAWN.y,hp:5,maxHp:5,seeds:1,facingX:1,facingY:0},
 collected:[],enemies:ENEMY_START.map(x=>({...x})),plants:[],chapter:1,finished:false,playtime:0
});

function safeLoad(){
 try{
   const raw=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');
   if(!raw?.player)return null;
   const fresh=freshGame();
   return {...fresh,...raw,finished:false,player:{...fresh.player,...raw.player},enemies:Array.isArray(raw.enemies)?raw.enemies:fresh.enemies,plants:[]};
 }catch{return null}
}
function saveGame(state){try{localStorage.setItem(SAVE_KEY,JSON.stringify(state))}catch{}}
function resetSave(){try{localStorage.removeItem(SAVE_KEY)}catch{}}

function drawTree(ctx,t,now){
 const sway=Math.sin(now*.00055+t.id)*2.2;
 ctx.save();ctx.translate(t.x,t.y);ctx.rotate(t.lean+sway*.002);
 ctx.fillStyle='rgba(0,0,0,.2)';ctx.beginPath();ctx.ellipse(0,18,t.size*.44,t.size*.16,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#3a2a23';ctx.fillRect(-t.size*.1,-t.size*.15,t.size*.2,t.size*.65);
 const palettes=[['#152d28','#21483a','#2d6046'],['#1a302a','#2d513d','#3c6b4c'],['#1c2c31','#2b4550','#3e5f67'],['#222a25','#35453a','#49604b']][t.tone];
 for(let i=0;i<5;i++){const a=(i/5)*Math.PI*2+.5,rr=t.size*(.18+(i%2)*.07),x=Math.cos(a)*rr,y=-t.size*.5+Math.sin(a)*rr*.55;ctx.fillStyle=palettes[i%palettes.length];ctx.beginPath();ctx.arc(x,y,t.size*(.34-(i%2)*.04),0,Math.PI*2);ctx.fill()}
 ctx.fillStyle=palettes[2];ctx.beginPath();ctx.arc(0,-t.size*.58,t.size*.4,0,Math.PI*2);ctx.fill();ctx.restore();
}
function drawRock(ctx,r){
 ctx.save();ctx.translate(r.x,r.y);ctx.fillStyle='rgba(0,0,0,.2)';ctx.beginPath();ctx.ellipse(0,7,r.s*1.2,r.s*.45,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#41504b';ctx.beginPath();ctx.ellipse(0,0,r.s,r.s*.72,-.2,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,255,255,.1)';ctx.beginPath();ctx.ellipse(-r.s*.2,-r.s*.2,r.s*.35,r.s*.17,-.4,0,Math.PI*2);ctx.fill();ctx.restore();
}
function drawSeedNode(ctx,n,taken,now){
 if(taken)return;const pulse=1+Math.sin(now*.004+n.x)*.1;
 ctx.save();ctx.translate(n.x,n.y);ctx.globalCompositeOperation='lighter';
 const g=ctx.createRadialGradient(0,0,0,0,0,42*pulse);g.addColorStop(0,'rgba(142,255,213,.8)');g.addColorStop(.3,'rgba(90,226,183,.32)');g.addColorStop(1,'rgba(90,226,183,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,42*pulse,0,Math.PI*2);ctx.fill();ctx.globalCompositeOperation='source-over';
 ctx.strokeStyle='#a9ffe0';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,14);ctx.quadraticCurveTo(-8,1,-2,-10);ctx.quadraticCurveTo(9,-4,4,6);ctx.stroke();
 ctx.fillStyle='#74e6b8';ctx.beginPath();ctx.ellipse(-7,-8,8,4,-.5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(7,-2,8,4,.45,0,Math.PI*2);ctx.fill();ctx.restore();
}
function drawPlant(ctx,p,now){
 const age=Math.max(0,(now-p.createdAt)/1000),grow=clamp(age/2.2,0,1),life=clamp(1-(age-8)/4,0,1);
 ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=life;
 const g=ctx.createRadialGradient(0,0,0,0,0,80);g.addColorStop(0,'rgba(93,255,191,.3)');g.addColorStop(1,'rgba(93,255,191,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,80,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='#8affc9';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,10);ctx.quadraticCurveTo(-7,-12*grow,0,-35*grow);ctx.stroke();
 ctx.fillStyle='#79e6ad';ctx.beginPath();ctx.ellipse(-9,-18*grow,13*grow,6*grow,-.5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(10,-27*grow,13*grow,6*grow,.5,0,Math.PI*2);ctx.fill();ctx.restore();
}
function drawEnemy(ctx,e,now){
 if(!e.alive)return;const bob=Math.sin(now*.005+e.phase)*5;ctx.save();ctx.translate(e.x,e.y+bob);if(e.hit>0){ctx.shadowBlur=18;ctx.shadowColor='#fff'}
 ctx.fillStyle=e.hit>0?'#fff':'#201a2a';ctx.beginPath();ctx.ellipse(0,4,25,34,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#0b0910';ctx.beginPath();ctx.ellipse(0,27,31,11,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#ff8c72';ctx.beginPath();ctx.arc(-8,-3,3.5,0,Math.PI*2);ctx.arc(8,-3,3.5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#51425d';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-15,-18);ctx.lineTo(-23,-32);ctx.moveTo(15,-18);ctx.lineTo(23,-32);ctx.stroke();ctx.restore();
}
function drawPlayer(ctx,p,now,anim){
 const speed=anim.moving?1:0,bob=Math.sin(now*.012)*3*speed;ctx.save();ctx.translate(p.x,p.y+bob);
 ctx.fillStyle='rgba(0,0,0,.28)';ctx.beginPath();ctx.ellipse(0,21,24-speed*3,8,0,0,Math.PI*2);ctx.fill();ctx.rotate(anim.dodging?-.22:0);
 ctx.fillStyle=anim.invuln?'rgba(129,238,255,.82)':'#d9c6aa';ctx.beginPath();ctx.arc(0,-18,9,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#263947';ctx.beginPath();ctx.moveTo(-13,-8);ctx.lineTo(13,-8);ctx.lineTo(18,21);ctx.lineTo(-18,21);ctx.closePath();ctx.fill();
 ctx.fillStyle='#4f806b';ctx.beginPath();ctx.moveTo(-12,-7);ctx.lineTo(0,-25);ctx.lineTo(12,-7);ctx.lineTo(7,8);ctx.lineTo(-7,8);ctx.closePath();ctx.fill();
 const fx=p.facingX||1,fy=p.facingY||0;ctx.strokeStyle='#c5d6d2';ctx.lineWidth=4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(fx*12,fy*12);ctx.lineTo(fx*31,fy*31);ctx.stroke();
 if(anim.attack>0){ctx.strokeStyle='rgba(206,255,234,.9)';ctx.lineWidth=5;ctx.beginPath();const a=Math.atan2(fy,fx);ctx.arc(0,0,48,a-.9,a+.9);ctx.stroke()}ctx.restore();
}

function WildwoodCanvas({running,paused,onStats,onComplete,resetToken,controlsRef}){
 const canvasRef=useRef(null),gameRef=useRef(null),rafRef=useRef(0),lastRef=useRef(0),saveRef=useRef(0),uiRef=useRef(0),keysRef=useRef(new Set());
 const[loaded,setLoaded]=useState(false);
 useEffect(()=>{gameRef.current=safeLoad()||freshGame();setLoaded(true)},[resetToken]);
 useEffect(()=>{if(!loaded)return;const down=e=>{if(['INPUT','TEXTAREA'].includes(document.activeElement?.tagName))return;keysRef.current.add(e.code);if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault()},up=e=>keysRef.current.delete(e.code);window.addEventListener('keydown',down,{passive:false});window.addEventListener('keyup',up);return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up)}},[loaded]);
 useEffect(()=>{
   if(!loaded)return;const canvas=canvasRef.current,ctx=canvas.getContext('2d');
   const resize=()=>{const dpr=Math.min(2,window.devicePixelRatio||1),rect=canvas.getBoundingClientRect();canvas.width=Math.max(1,Math.floor(rect.width*dpr));canvas.height=Math.max(1,Math.floor(rect.height*dpr));ctx.setTransform(dpr,0,0,dpr,0,0)};
   resize();window.addEventListener('resize',resize);
   const anim={attack:0,attackCd:0,dodge:0,dodgeCd:0,moving:false,invuln:false,damageCd:0};
   const loop=now=>{
     rafRef.current=requestAnimationFrame(loop);const game=gameRef.current;if(!game)return;const dt=Math.min(.033,Math.max(.001,(now-(lastRef.current||now))/1000));lastRef.current=now;const rect=canvas.getBoundingClientRect(),vw=rect.width,vh=rect.height,ctrl=controlsRef.current||{};
     if(running&&!paused&&!game.finished){
       game.playtime=(game.playtime||0)+dt;anim.attack=Math.max(0,anim.attack-dt);anim.attackCd=Math.max(0,anim.attackCd-dt);anim.dodge=Math.max(0,anim.dodge-dt);anim.dodgeCd=Math.max(0,anim.dodgeCd-dt);anim.damageCd=Math.max(0,anim.damageCd-dt);
       const keys=keysRef.current;let mx=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+(ctrl.x||0),my=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)+(ctrl.y||0),m=Math.hypot(mx,my);
       if(m>.05){mx/=m;my/=m;game.player.facingX=mx;game.player.facingY=my;anim.moving=true}else anim.moving=false;
       const dodgePressed=keys.has('ShiftLeft')||keys.has('ShiftRight')||ctrl.dodge;if(dodgePressed&&anim.dodgeCd<=0&&m>.05){anim.dodge=.24;anim.dodgeCd=1}
       const speed=anim.dodge>0?560:220;game.player.x=clamp(game.player.x+mx*speed*dt,60,WORLD.w-60);game.player.y=clamp(game.player.y+my*speed*dt,60,WORLD.h-60);anim.invuln=anim.dodge>0;
       const attackPressed=keys.has('Space')||keys.has('KeyF')||ctrl.attack;if(attackPressed&&anim.attackCd<=0){anim.attack=.22;anim.attackCd=.38;for(const e of game.enemies){if(!e.alive)continue;const d=dist(game.player,e);if(d<92){const dot=((e.x-game.player.x)*(game.player.facingX||1)+(e.y-game.player.y)*(game.player.facingY||0))/(d||1);if(dot>-.15){e.hp-=1;e.hit=.16;if(e.hp<=0)e.alive=false}}}}
       const plantPressed=keys.has('KeyE')||ctrl.plant;if(plantPressed&&!ctrl.plantLatch&&game.player.seeds>0){ctrl.plantLatch=true;game.player.seeds-=1;game.plants.push({id:'p'+Date.now()+Math.random(),x:game.player.x,y:game.player.y,createdAt:Date.now()})}if(!plantPressed)ctrl.plantLatch=false;
       for(const e of game.enemies){if(!e.alive)continue;e.hit=Math.max(0,(e.hit||0)-dt);e.attackCd=Math.max(0,(e.attackCd||0)-dt);const d=dist(e,game.player);if(d<540){const dx=(game.player.x-e.x)/(d||1),dy=(game.player.y-e.y)/(d||1);e.x+=dx*78*dt;e.y+=dy*78*dt}if(d<48&&e.attackCd<=0&&!anim.invuln&&anim.damageCd<=0){game.player.hp-=1;e.attackCd=.8;anim.damageCd=.7;if(game.player.hp<=0){game.player.hp=game.player.maxHp;game.player.x=SPAWN.x;game.player.y=SPAWN.y}}}
       for(const n of SEED_NODES)if(!game.collected.includes(n.id)&&dist(game.player,n)<42){game.collected.push(n.id);game.player.seeds+=1}
       const epoch=Date.now();game.plants=game.plants.filter(p=>epoch-p.createdAt<12000);for(const p of game.plants){if(epoch-p.createdAt<8500&&dist(game.player,p)<86)game.player.hp=Math.min(game.player.maxHp,game.player.hp+dt*.22);for(const e of game.enemies)if(e.alive&&dist(e,p)<75){e.hp-=dt*.35;if(e.hp<=0)e.alive=false}}
       if(game.collected.length>=3&&dist(game.player,HEART_TREE)<110){game.finished=true;saveGame(game);onComplete?.()}
       saveRef.current+=dt;if(saveRef.current>4){saveRef.current=0;saveGame(game)}
     }
     const camX=clamp(game.player.x-vw/2,0,Math.max(0,WORLD.w-vw)),camY=clamp(game.player.y-vh/2,0,Math.max(0,WORLD.h-vh));ctx.clearRect(0,0,vw,vh);const sky=ctx.createLinearGradient(0,0,0,vh);sky.addColorStop(0,'#0a1418');sky.addColorStop(1,'#102019');ctx.fillStyle=sky;ctx.fillRect(0,0,vw,vh);
     ctx.save();ctx.translate(-camX,-camY);ctx.fillStyle='#14271f';ctx.fillRect(0,0,WORLD.w,WORLD.h);ctx.strokeStyle='rgba(130,174,132,.08)';ctx.lineWidth=120;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(210,1180);ctx.bezierCurveTo(900,960,1280,1420,1870,1200);ctx.bezierCurveTo(2400,980,2740,1390,3340,1160);ctx.stroke();
     for(const r of ROCKS)drawRock(ctx,r);for(const f of FIREFLIES){const x=f.x+Math.sin(now*.0008+f.p)*18,y=f.y+Math.cos(now*.001+f.p)*10;ctx.fillStyle='rgba(173,255,204,'+(.25+.25*Math.sin(now*.003+f.p))+')';ctx.beginPath();ctx.arc(x,y,2,0,Math.PI*2);ctx.fill()}
     for(const n of SEED_NODES)drawSeedNode(ctx,n,game.collected.includes(n.id),now);for(const p of game.plants)drawPlant(ctx,p,Date.now());
     ctx.save();ctx.translate(HEART_TREE.x,HEART_TREE.y);const glow=ctx.createRadialGradient(0,-70,10,0,-70,150);glow.addColorStop(0,'rgba(112,255,190,.34)');glow.addColorStop(1,'rgba(112,255,190,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,-70,150,0,Math.PI*2);ctx.fill();ctx.fillStyle='#38291f';ctx.fillRect(-24,-90,48,130);ctx.fillStyle='#24553d';for(let i=0;i<9;i++){const a=i/9*Math.PI*2;ctx.beginPath();ctx.arc(Math.cos(a)*55,-105+Math.sin(a)*38,44,0,Math.PI*2);ctx.fill()}ctx.fillStyle='#8bffd0';ctx.beginPath();ctx.arc(0,-105,12,0,Math.PI*2);ctx.fill();ctx.restore();
     const entities=[...FOREST.map(t=>({y:t.y,type:'tree',v:t})),...game.enemies.filter(e=>e.alive).map(e=>({y:e.y,type:'enemy',v:e})),{y:game.player.y,type:'player',v:game.player}].sort((a,b)=>a.y-b.y);for(const item of entities){if(item.type==='tree')drawTree(ctx,item.v,now);else if(item.type==='enemy')drawEnemy(ctx,item.v,now);else drawPlayer(ctx,item.v,now,{...anim,dodging:anim.dodge>0})}ctx.restore();
     const fog=ctx.createRadialGradient(vw*.5,vh*.48,Math.min(vw,vh)*.15,vw*.5,vh*.48,Math.max(vw,vh)*.72);fog.addColorStop(0,'rgba(4,10,14,0)');fog.addColorStop(1,'rgba(4,8,12,.58)');ctx.fillStyle=fog;ctx.fillRect(0,0,vw,vh);
     uiRef.current+=dt;if(uiRef.current>.12){uiRef.current=0;onStats?.({hp:game.player.hp,maxHp:game.player.maxHp,seeds:game.player.seeds,collected:game.collected.length,enemies:game.enemies.filter(e=>e.alive).length,finished:game.finished,playtime:game.playtime})}
   };
   rafRef.current=requestAnimationFrame(loop);return()=>{cancelAnimationFrame(rafRef.current);window.removeEventListener('resize',resize);if(gameRef.current)saveGame(gameRef.current)}
 },[loaded,running,paused,onComplete,onStats,controlsRef]);
 return <canvas ref={canvasRef} className="wildwood-canvas" aria-label="Rừng Linh Mộc"/>;
}

export function WildwoodGamePage(){
 const saved=useMemo(()=>{try{return Boolean(localStorage.getItem(SAVE_KEY))}catch{return false}},[]);
 const[running,setRunning]=useState(false),[paused,setPaused]=useState(false),[finished,setFinished]=useState(false),[stats,setStats]=useState({hp:5,maxHp:5,seeds:1,collected:0,enemies:9}),[resetToken,setResetToken]=useState(0);
 const controlsRef=useRef({x:0,y:0,attack:false,dodge:false,plant:false,plantLatch:false}),joyRef=useRef(null);
 useEffect(()=>{document.title='HPZ Rừng Linh Mộc — Game phiêu lưu'},[]);useEffect(()=>{const fn=e=>{if(e.code==='Escape'&&running)setPaused(v=>!v)};window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn)},[running]);
 const updateStats=useCallback(v=>setStats(v),[]),complete=useCallback(()=>setFinished(true),[]);
 const startNew=()=>{resetSave();setResetToken(x=>x+1);setFinished(false);setPaused(false);setRunning(true)},continueGame=()=>{setFinished(false);setPaused(false);setRunning(true)},setAction=(key,on)=>{controlsRef.current[key]=on};
 const joyStart=e=>{e.currentTarget.setPointerCapture?.(e.pointerId);joyRef.current=e.currentTarget;joyMove(e)},joyMove=e=>{if(!joyRef.current)return;const r=joyRef.current.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,d=Math.hypot(dx,dy),max=r.width*.34,s=Math.min(1,d/max);controlsRef.current.x=d?dx/d*s:0;controlsRef.current.y=d?dy/d*s:0},joyEnd=e=>{controlsRef.current.x=0;controlsRef.current.y=0;joyRef.current?.releasePointerCapture?.(e.pointerId);joyRef.current=null};
 return <div className="wildwood-app">
   <WildwoodCanvas running={running} paused={paused||finished} onStats={updateStats} onComplete={complete} resetToken={resetToken} controlsRef={controlsRef}/>
   <a className="wildwood-back" href="/game">← Game Hub</a>
   {running&&<div className="wildwood-hud"><div className="wildwood-hearts">{Array.from({length:stats.maxHp||5}).map((_,i)=><span key={i} className={i<stats.hp?'full':''}>♥</span>)}</div><div className="wildwood-objective"><small>CHƯƠNG I · RỪNG THỨC GIẤC</small><b>{stats.collected<3?'Thu thập '+(3-stats.collected)+' Mầm Sáng':'Tìm Cây Trái Tim ở phía Đông'}</b></div><div className="wildwood-seeds"><span>✦</span><b>{stats.seeds}</b><small>Mầm</small></div></div>}
   {!running&&<div className="wildwood-title-screen"><div className="wildwood-title-glow"/><div className="wildwood-title-card"><span className="wildwood-kicker">HPZ ORIGINAL GAME</span><h1>RỪNG<br/><em>LINH MỘC</em></h1><p>Một khu rừng đã quên cách nở hoa. Hãy đi sâu vào bóng tối, tìm những Mầm Sáng và đánh thức Cây Trái Tim.</p><div className="wildwood-title-actions">{saved&&<button className="primary" onClick={continueGame}>Tiếp tục hành trình</button>}<button className={saved?'secondary':'primary'} onClick={startNew}>{saved?'Chơi lại từ đầu':'Bắt đầu hành trình'}</button></div><div className="wildwood-controls-help"><span><b>WASD</b> Di chuyển</span><span><b>Space</b> Tấn công</span><span><b>Shift</b> Lướt</span><span><b>E</b> Gieo mầm</span></div></div></div>}
   {paused&&running&&!finished&&<div className="wildwood-overlay"><div className="wildwood-pause-card"><span>RỪNG ĐANG CHỜ</span><h2>Tạm dừng</h2><button onClick={()=>setPaused(false)}>Tiếp tục</button><a href="/game">Về Game Hub</a></div></div>}
   {finished&&<div className="wildwood-overlay"><div className="wildwood-ending-card"><span>CHƯƠNG I HOÀN THÀNH</span><h2>Cây Trái Tim đã thức giấc</h2><p>Ánh sáng quay lại dưới tán rừng. Hành trình tiếp theo sẽ mở sâu hơn vào Linh Mộc.</p><button onClick={()=>{setFinished(false);setPaused(false)}}>Tiếp tục khám phá</button><a href="/game">Về Game Hub</a></div></div>}
   {running&&<div className="wildwood-mobile-controls"><div className="wildwood-joystick" onPointerDown={joyStart} onPointerMove={joyMove} onPointerUp={joyEnd} onPointerCancel={joyEnd}><i/></div><div className="wildwood-actions"><button className="seed" onPointerDown={()=>setAction('plant',true)} onPointerUp={()=>setAction('plant',false)} onPointerCancel={()=>setAction('plant',false)}>✦<small>Gieo</small></button><button className="dodge" onPointerDown={()=>setAction('dodge',true)} onPointerUp={()=>setAction('dodge',false)} onPointerCancel={()=>setAction('dodge',false)}>↝<small>Lướt</small></button><button className="attack" onPointerDown={()=>setAction('attack',true)} onPointerUp={()=>setAction('attack',false)} onPointerCancel={()=>setAction('attack',false)}>⚔<small>Đánh</small></button></div></div>}
   {running&&<button className="wildwood-pause" onClick={()=>setPaused(v=>!v)} aria-label="Tạm dừng">Ⅱ</button>}
 </div>;
}
