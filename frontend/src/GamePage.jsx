import React,{useEffect,useMemo,useRef,useState}from'react';
import{gameApi}from'./ecosystem-api.js';
import{HPZAppShell,HPZContainer,HPZButton,HPZNotice,HPZLoading}from'./ui/HPZUI.jsx';
import{fish2dBackgroundStyle}from'./fish-2d-library.js';

const inv=(state,code)=>Number(state?.inventory?.find(x=>x.item_code===code)?.quantity||0);
const rarityLabel={COMMON:'Thường',UNCOMMON:'Khá hiếm',RARE:'Hiếm',EPIC:'Cực hiếm'};
const rarityIcon={COMMON:'🐟',UNCOMMON:'🐠',RARE:'🐡',EPIC:'✨🐠'};
const fmt=n=>Number(n||0).toLocaleString('vi-VN');

function Fish2DSprite({name,fallback='🐟'}){
 const style=fish2dBackgroundStyle(name);
 return style?<i className="aq-fish2d-sprite" style={style} aria-hidden="true"/>:<>{fallback}</>;
}

function GameTop({state}){
 const p=state.player,w=state.world;
 return <div className="aq-topbar">
   <div className="aq-farm-name"><span className="aq-avatar">🌾</span><div><b>Nông trại ven sông</b><small>Streak {p.streak_days} ngày</small></div></div>
   <div className="aq-resource"><span>🪙</span><div><small>AquaCoin</small><b>{fmt(p.aqua_coin)}</b></div></div>
   <div className="aq-resource"><span>⭐</span><div><small>Lv.{p.level}</small><b>{fmt(p.xp)} XP</b></div></div>
   <div className="aq-weather"><span>{w.mood.emoji}</span><div><small>{w.location}</small><b>{Math.round(w.temperature_c)}°C · {w.time_of_day.label}</b></div></div>
 </div>;
}

function WorldBanner({world}){
 return <div className="aq-world-banner">
   <div className="aq-world-main"><span>{world.mood.emoji}</span><div><b>{world.mood.headline}</b><small>{world.mood.joke}</small>{world.source_label&&<small className="aq-weather-source">{world.attribution_url?<a href={world.attribution_url} target="_blank" rel="noreferrer">Dữ liệu: {world.source_label}</a>:'Dữ liệu: '+world.source_label}</small>}</div></div>
   <div className="aq-festival"><span>{world.festival.emoji}</span><div><small>Diễn biến hôm nay</small><b>{world.festival.name}</b></div></div>
 </div>;
}

function SceneViewport({children,className='',initialX=0,initialY=0,label='Khu vực trò chơi'}){
 const scrollRef=useRef(null),dragRef=useRef({active:false,x:0,y:0,left:0,top:0}),[dragging,setDragging]=useState(false);
 useEffect(()=>{const el=scrollRef.current;if(!el)return;const id=requestAnimationFrame(()=>{el.scrollLeft=Math.max(0,initialX);el.scrollTop=Math.max(0,initialY)});return()=>cancelAnimationFrame(id)},[initialX,initialY]);
 const pointerDown=e=>{if(e.pointerType==='touch'||e.button!==0)return;const el=scrollRef.current;if(!el)return;dragRef.current={active:true,x:e.clientX,y:e.clientY,left:el.scrollLeft,top:el.scrollTop};setDragging(true);el.setPointerCapture?.(e.pointerId)};
 const pointerMove=e=>{const d=dragRef.current,el=scrollRef.current;if(!d.active||!el)return;e.preventDefault();el.scrollLeft=d.left-(e.clientX-d.x);el.scrollTop=d.top-(e.clientY-d.y)};
 const pointerUp=e=>{dragRef.current.active=false;setDragging(false);scrollRef.current?.releasePointerCapture?.(e.pointerId)};
 const keyDown=e=>{const el=scrollRef.current;if(!el)return;const step=70;if(e.key==='ArrowLeft'){el.scrollLeft-=step;e.preventDefault()}else if(e.key==='ArrowRight'){el.scrollLeft+=step;e.preventDefault()}else if(e.key==='ArrowUp'){el.scrollTop-=step;e.preventDefault()}else if(e.key==='ArrowDown'){el.scrollTop+=step;e.preventDefault()}};
 return <div className={'aq-scene-frame '+className}>
   <div ref={scrollRef} className={'aq-scene-pan '+(dragging?'is-dragging':'')} role="region" aria-label={label} tabIndex="0" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onKeyDown={keyDown}>
     {children}
   </div>
   <div className="aq-pan-hint" aria-hidden="true">↔ Kéo để khám phá</div>
 </div>;
}

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

const FARM_COOLDOWNS={HARVEST:12,FEED_CHICKENS:18,CHAT_NPC:45};

function farmRemaining(state,type,now){
 const row=(state?.recent_activity||[]).find(item=>item.action_type===type);
 if(!row?.created_at)return 0;
 const at=new Date(row.created_at).getTime();
 if(!Number.isFinite(at))return 0;
 const elapsed=Math.max(0,(now-at)/1000);
 return Math.max(0,Math.ceil((FARM_COOLDOWNS[type]||0)-elapsed));
}

function FarmScene({state,onAction,busy}){
 const vegetables=inv(state,'vegetables'),eggs=inv(state,'eggs'),home={x:44,y:62};
 const targets={HARVEST:{x:70,y:43,motion:'harvesting'},FEED_CHICKENS:{x:78,y:70,motion:'feeding-chickens'},CHAT_NPC:{x:29,y:43,motion:'chatting'}};
 const[pos,setPos]=useState(home),[motion,setMotion]=useState('idle'),[localBusy,setLocalBusy]=useState(false),[now,setNow]=useState(()=>Date.now());
 const alive=useRef(true);
 useEffect(()=>{alive.current=true;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>{alive.current=false;clearInterval(timer)}},[]);
 const remaining={
   HARVEST:farmRemaining(state,'HARVEST',now),
   FEED_CHICKENS:farmRemaining(state,'FEED_CHICKENS',now),
   CHAT_NPC:farmRemaining(state,'CHAT_NPC',now)
 };
 const ready=type=>remaining[type]===0;
 const cropStage=remaining.HARVEST===0?'ready':remaining.HARVEST>8?'sprout':remaining.HARVEST>4?'growing':'almost';
 const label=(type,readyLabel)=>remaining[type]?readyLabel+' sau '+remaining[type]+'s':'Sẵn sàng';
 const run=async type=>{
   if(busy||localBusy||!ready(type))return;
   const target=targets[type]||home;setLocalBusy(true);setMotion('walking');setPos(target);await wait(620);
   if(!alive.current)return;setMotion(target.motion);await wait(430);
   const result=await onAction(type);await wait(520);
   if(!alive.current)return result;setMotion('walking');setPos(home);await wait(620);
   if(alive.current){setMotion('idle');setLocalBusy(false);setNow(Date.now())}return result;
 };
 const tool=motion==='harvesting'?'🧺':motion==='feeding-chickens'?'🥣':motion==='chatting'?'💬':'';
 return <div className="aq-farm-wrap">
   <div className="aq-farm-status" aria-label="Trạng thái nông trại">
     <span className={ready('HARVEST')?'is-ready':'is-waiting'}><i>🌱</i><span><b>Ruộng rau</b><small>{label('HARVEST','Thu hoạch')}</small></span></span>
     <span className={ready('FEED_CHICKENS')?'is-ready':'is-waiting'}><i>🐔</i><span><b>Chuồng gà</b><small>{label('FEED_CHICKENS','Cho ăn')}</small></span></span>
     <span className={ready('CHAT_NPC')?'is-ready':'is-waiting'}><i>💬</i><span><b>Hàng xóm</b><small>{label('CHAT_NPC','Trò chuyện')}</small></span></span>
   </div>
   <SceneViewport className="aq-farm-frame" initialX={120} initialY={25} label="Nông trại có thể kéo để khám phá">
     <section className={'aq-scene aq-farm-scene aq-world-canvas crop-'+cropStage+' '+(motion==='harvesting'?'is-harvesting ':'')+(motion==='feeding-chickens'?'is-feeding-chickens ':'')+(motion==='chatting'?'is-chatting ':'')}>
       <div className="aq-pixel-cloud c1">☁</div><div className="aq-pixel-cloud c2">☁</div>
       <div className="aq-house"><span>🏡</span><small>Phòng cá ở trong nhà →</small></div>
       <div className="aq-neighbor"><span>👩‍🌾</span><small>Cô hàng xóm</small><button type="button" className="aq-map-action aq-map-action--neighbor" disabled={busy||localBusy||!ready('CHAT_NPC')} onClick={()=>run('CHAT_NPC')}><b>{ready('CHAT_NPC')?'Nói chuyện':'Đang bận'}</b><em>{remaining.CHAT_NPC?remaining.CHAT_NPC+'s':'+'+2+' XP'}</em></button></div>
       <div className="aq-field">
         {Array.from({length:16}).map((_,i)=><span key={i} className={'aq-crop crop-'+(i%3)}><i className="aq-crop-stem"/><i className="aq-crop-leaf l1"/><i className="aq-crop-leaf l2"/><i className="aq-crop-head"/></span>)}
         <div className="aq-harvest-fx" aria-hidden="true"><i>🥬</i><i>🥕</i><i>🥬</i><i>🥕</i></div>
         <button type="button" className="aq-map-action aq-map-action--field" disabled={busy||localBusy||!ready('HARVEST')} onClick={()=>run('HARVEST')}><b>{ready('HARVEST')?'Thu hoạch':'Đang lớn'}</b><em>{remaining.HARVEST?remaining.HARVEST+'s':'Kho '+vegetables}</em></button>
       </div>
       <div className="aq-chicken-yard"><span className="hen h1">🐔</span><span className="hen h2">🐔</span><span className="hen h3">🐣</span><div className="aq-feed-specks" aria-hidden="true">{Array.from({length:9}).map((_,i)=><i key={i}/>)}</div><small>Chuồng gà</small><button type="button" className="aq-map-action aq-map-action--chicken" disabled={busy||localBusy||!ready('FEED_CHICKENS')} onClick={()=>run('FEED_CHICKENS')}><b>{ready('FEED_CHICKENS')?'Cho ăn':'Đang no'}</b><em>{remaining.FEED_CHICKENS?remaining.FEED_CHICKENS+'s':'Kho '+eggs}</em></button></div>
       <div className="aq-river"><div className="aq-water-lines"/><span className="aq-river-fish f1">🐟</span><span className="aq-river-fish f2">🐟</span><span className="aq-heron">🪿</span></div>
       <div className={'aq-player-path '+motion} style={{left:pos.x+'%',top:pos.y+'%'}}><span className="aq-player-shadow"/><span className="aq-player-body">🧑‍🌾</span>{tool&&<span className="aq-player-tool">{tool}</span>}</div>
     </section>
   </SceneViewport>
   <div className="aq-farm-actions">
     <button disabled={busy||localBusy||!ready('HARVEST')} onClick={()=>run('HARVEST')}><span>🌱</span><b>Thu hoạch</b><small>{remaining.HARVEST?'Đang mọc · '+remaining.HARVEST+'s':'Kho: '+vegetables+' rau'}</small></button>
     <button disabled={busy||localBusy||!ready('FEED_CHICKENS')} onClick={()=>run('FEED_CHICKENS')}><span>🐔</span><b>Cho gà ăn</b><small>{remaining.FEED_CHICKENS?'Chờ '+remaining.FEED_CHICKENS+'s':'Kho: '+eggs+' trứng'}</small></button>
     <button disabled={busy||localBusy||!ready('CHAT_NPC')} onClick={()=>run('CHAT_NPC')}><span>💬</span><b>Tám với hàng xóm</b><small>{remaining.CHAT_NPC?'Gặp lại sau '+remaining.CHAT_NPC+'s':'Nghe chuyện xóm'}</small></button>
   </div>
 </div>;
}

function Fishing({state,onAction,busy,setToast}){
 const[phase,setPhase]=useState('idle'),[seconds,setSeconds]=useState(0);
 const timers=useRef([]);
 const clear=()=>{timers.current.forEach(clearTimeout);timers.current=[]};
 useEffect(()=>clear,[]);
 const reset=()=>{clear();setPhase('idle');setSeconds(0)};
 const cast=()=>{
   if(inv(state,'bait')<=0){setToast('Hết mồi rồi. Ghé Chợ mua thêm nhé.');return}
   clear();setPhase('casting');setToast('Vung cần…');
   timers.current.push(setTimeout(()=>{setPhase('waiting');setToast('Phao đang trôi… đừng nóng vội.');
     timers.current.push(setTimeout(()=>{setPhase('bite');setSeconds(3);setToast('CÁ CẮN! GIẬT CẦN!')},1300+Math.random()*1800));
   },850));
 };
 useEffect(()=>{if(phase!=='bite')return;const id=setInterval(()=>setSeconds(v=>{if(v<=1){clearInterval(id);setToast('Chậm một nhịp, cá cười rồi bơi mất.');setPhase('idle');return 0}return v-1}),850);return()=>clearInterval(id)},[phase,setToast]);
 const reel=async()=>{
   if(phase==='waiting'||phase==='casting'){setToast('Giật sớm quá! Bà đứng bờ nhìn mà không nói gì.');reset();return}
   if(phase!=='bite')return;
   setPhase('reeling');await wait(340);
   const result=await onAction('FISH_CAST');
   if(result){setPhase('caught');setToast(result.result?.message||'Kéo cá lên bờ rồi!');await wait(900)}
   setPhase('idle');setSeconds(0);
 };
 return <div className="aq-fishing-wrap">
   <SceneViewport className="aq-fishing-frame" initialX={150} initialY={20} label="Bờ sông câu cá có thể kéo để khám phá">
     <section className={'aq-scene aq-fishing-scene aq-world-canvas '+phase}>
       <div className="aq-fish-river"><div className="aq-water-lines"/><i className="shadow s1"/><i className="shadow s2"/><i className="shadow s3"/><span className="aq-bird">🪿</span><span className="aq-bobber">🔴</span><span className="aq-splash">💦</span><span className="aq-fishing-alert">!</span><span className="aq-caught-fish">🐟</span></div>
       <div className="aq-riverbank"><span className="aq-reeds">🌾🌿</span><span className="aq-flowers">🌸🌼</span><span className="aq-fisher">🧑‍🌾</span><div className="aq-rod"/></div>
       <div className="aq-fishing-status">{phase==='idle'?'Chọn chỗ đẹp rồi thả câu.':phase==='casting'?'Đang vung cần…':phase==='bite'?'CÁ CẮN! '+seconds:phase==='reeling'?'Đang kéo cá lên…':phase==='caught'?'Cá lên bờ rồi!':'Cá chú ý — đợi phao chìm!'}</div>
     </section>
   </SceneViewport>
   <div className="aq-fishing-controls">
     <div><b>🎣 Cần tre</b><small>Mồi còn {inv(state,'bait')}</small></div>
     <HPZButton disabled={busy||phase==='reeling'||phase==='caught'} onClick={phase==='idle'?cast:reel}>{phase==='idle'?'Thả câu':phase==='bite'?'GIẬT CẦN!':'Giật thử'}</HPZButton>
     <HPZButton variant="secondary" disabled={busy||phase!=='idle'} onClick={()=>onAction('BUY_BAIT',{qty:5})}>Mua 5 mồi · 10 xu</HPZButton>
   </div>
 </div>;
}

function AquariumRoom({state,onAction,busy}){
 const a=state.aquarium,stored=state.fish_storage||[];
 const[roomAction,setRoomAction]=useState('idle'),[localBusy,setLocalBusy]=useState(false);
 const runRoom=async type=>{
   if(busy||localBusy)return;setLocalBusy(true);setRoomAction('walking');await wait(480);
   setRoomAction(type==='AQUARIUM_FEED'?'feeding':'cleaning');await wait(420);
   const result=await onAction(type);await wait(620);setRoomAction('returning');await wait(420);setRoomAction('idle');setLocalBusy(false);return result;
 };
 const tool=roomAction==='feeding'?'🍚':roomAction==='cleaning'?'🧽':'';
 return <div className="aq-room-wrap">
   <SceneViewport className="aq-room-frame" initialX={160} initialY={10} label="Phòng cá có thể kéo để khám phá">
     <section className={'aq-scene aq-room aq-world-canvas '+roomAction}>
       <div className="aq-room-title">PHÒNG CÁ CỦA BÀ</div>
       <div className="aq-window">🌤️</div>
       <div className="aq-shelf">🪴　📚　🪴</div>
       <div className={'aq-tank '+(roomAction==='feeding'?'feeding ':roomAction==='cleaning'?'cleaning ':'')}>
         <div className="aq-tank-light"/><div className="aq-tank-water"/>
         <div className="aq-tank-plant p1">🌿</div><div className="aq-tank-plant p2">🌱</div><div className="aq-tank-rock">🪨</div>
         {(a.fish||[]).map((f,i)=><span key={f.fish_id} className={'aq-swim fish-'+(i%5)+(fish2dBackgroundStyle(f.fish_name)?' has-fish2d':'')} title={f.fish_name}><Fish2DSprite name={f.fish_name} fallback={rarityIcon[f.rarity]||'🐟'}/></span>)}
         {roomAction==='feeding'&&<div className="aq-aquarium-feed-fx" aria-hidden="true">{Array.from({length:12}).map((_,i)=><i key={i}/>)}</div>}
         {!a.fish?.length&&<div className="aq-empty-tank">Bể đang chờ cá mới 🫧</div>}
       </div>
       <div className="aq-aquarium-stats">
         <span>💧 Sạch <b>{a.cleanliness}%</b></span><span>🫧 Oxy <b>{a.oxygen}%</b></span><span>🌡️ <b>{Number(a.effective_temperature_c).toFixed(1)}°C</b></span><span>✨ Đẹp <b>{a.beauty}%</b></span>
       </div>
       <div className="aq-grandma">👵<small>“Đừng cho ăn lần ba nhé.”</small></div>
       <div className={'aq-room-player '+roomAction}><span className="aq-player-shadow"/><span className="aq-player-body">🧑‍🌾</span>{tool&&<span className="aq-player-tool">{tool}</span>}</div>
     </section>
   </SceneViewport>
   <div className="aq-room-actions">
     <HPZButton disabled={busy||localBusy||!a.fish_count} onClick={()=>runRoom('AQUARIUM_FEED')}>🍚 Cho cá ăn ({inv(state,'fish_feed')})</HPZButton>
     <HPZButton variant="secondary" disabled={busy||localBusy} onClick={()=>runRoom('AQUARIUM_CLEAN')}>🧽 Lau kính / thay nước</HPZButton>
     <HPZButton variant="secondary" disabled={busy||localBusy} onClick={()=>onAction('BUY_FEED',{qty:3})}>🛍️ Mua thức ăn</HPZButton>
   </div>
   <div className="aq-two-cols">
     <section className="aq-panel">
       <h3>🐠 Cá đang trong bể <small>{a.fish_count}/{a.capacity}</small></h3>
       <div className="aq-fish-list">{a.fish?.length?a.fish.map(f=><article key={f.fish_id}><div className="aq-fish-thumb">{f.image_url?<img src={f.image_url} alt=""/>:<Fish2DSprite name={f.fish_name} fallback={rarityIcon[f.rarity]||'🐟'}/>}</div><div><b>{f.fish_name}</b><small>{rarityLabel[f.rarity]} · No bụng {f.hunger}% · Vui {f.happiness}%</small></div><button disabled={busy||localBusy} onClick={()=>onAction('AQUARIUM_REMOVE',{fish_id:f.fish_id})}>Đưa ra</button></article>):<p className="aq-muted">Hãy câu hoặc mua cá rồi thả vào bể.</p>}</div>
     </section>
     <section className="aq-panel">
       <h3>🧺 Cá đang chờ thả <small>{stored.length} con</small></h3>
       <div className="aq-fish-list">{stored.length?stored.map(f=><article key={f.fish_id}><div className="aq-fish-thumb">{f.image_url?<img src={f.image_url} alt=""/>:<Fish2DSprite name={f.fish_name} fallback={rarityIcon[f.rarity]||'🐟'}/>}</div><div><b>{f.fish_name}</b><small>{f.source==='CAUGHT'?'Câu được':'Mua ở chợ'} · {rarityLabel[f.rarity]}</small></div><button disabled={busy||localBusy||a.fish_count>=a.capacity} onClick={()=>onAction('AQUARIUM_ADD',{fish_id:f.fish_id})}>Thả vào bể</button></article>):<p className="aq-muted">Chưa có cá chờ. Ra sông thử vận may nhé.</p>}</div>
     </section>
   </div>
 </div>;
}

function Market({state,onAction,busy}){
 const[carting,setCarting]=useState(false);
 const sell=async()=>{if(busy||carting)return;setCarting(true);await wait(350);const r=await onAction('MARKET_SELL');await wait(650);setCarting(false);return r};
 return <div className="aq-market">
   <SceneViewport className="aq-market-frame" initialX={100} label="Phiên chợ có thể kéo để khám phá">
     <section className={'aq-market-scene aq-world-canvas '+(carting?'is-carting':'')}><div className="aq-stall vegetables">🥬🥕<b>Sạp rau</b></div><div className="aq-stall fish">🐠🐟<b>Hàng cá</b></div><div className="aq-stall npc">👵🧺<b>Bà Tám</b></div><div className="aq-market-crowd">🧑‍🌾　👩‍🦰　🧔　👧</div><div className="aq-market-cart">🧑‍🌾🛒</div></section>
   </SceneViewport>
   <section className="aq-panel aq-market-sell"><h3>🛻 Chuẩn bị hàng ra chợ</h3><p>Trong kho có <b>{inv(state,'vegetables')} rau</b> và <b>{inv(state,'eggs')} trứng</b>. Mỗi chuyến tự lấy tối đa 3 rau + 2 trứng.</p><HPZButton disabled={busy||carting||(!inv(state,'vegetables')&&!inv(state,'eggs'))} onClick={sell}>Đẩy xe ra chợ bán</HPZButton></section>
   <section className="aq-panel"><h3>🐟 Quầy cá hôm nay</h3><p className="aq-muted">Cá lấy từ Catalog đang Published. Giá dưới đây là AquaCoin trong game, không phải giá bán thật.</p><div className="aq-shop-grid">{(state.market||[]).map(f=><article key={f.product_id}>{f.image_url?<img src={f.image_url} alt={f.name}/>:<div className="aq-shop-fallback">🐠</div>}<b>{f.name}</b><small>{f.secondary_name||'Cá cảnh HPZ'}</small><button disabled={busy||state.player.aqua_coin<f.game_price} onClick={()=>onAction('BUY_FISH',{product_id:f.product_id})}>🪙 {f.game_price} · Mua</button></article>)}</div></section>
 </div>;
}

function Missions({state,onAction,busy}){
 const d=state.daily,done=(d.missions||[]).filter(x=>x.done).length,all=done===(d.missions||[]).length;
 return <div className="aq-missions">
   <section className="aq-panel aq-daily-card"><div><span className="aq-big-icon">📋</span><div><h2>Nhiệm vụ hôm nay</h2><p>Làm việc vừa đủ, còn thời gian ngồi ngắm cá.</p></div></div><strong>{done}/{d.missions.length}</strong></section>
   <div className="aq-mission-list">{d.missions.map(m=><article className={m.done?'done':''} key={m.id}><span>{m.emoji}</span><div><b>{m.label}</b><div className="aq-progress"><i style={{width:(m.progress/m.target*100)+'%'}}/></div><small>{m.progress}/{m.target} · thưởng nhiệm vụ {m.reward} xu trong tổng rương</small></div><em>{m.done?'✓':'…'}</em></article>)}</div>
   <section className="aq-panel aq-chest"><span>🎁</span><div><b>Rương Xóm Nhỏ</b><small>Hoàn thành đủ 5 nhiệm vụ: +120 AquaCoin · +60 XP</small></div><HPZButton disabled={busy||!all||d.reward_claimed} onClick={()=>onAction('CLAIM_DAILY')}>{d.reward_claimed?'Đã nhận hôm nay':'Mở rương'}</HPZButton></section>
   <section className="aq-panel"><h3>🏆 Đua top xóm ven sông</h3><div className="aq-kpi-row"><span>Level <b>{state.player.level}</b></span><span>XP <b>{fmt(state.player.xp)}</b></span><span>Danh tiếng <b>{fmt(state.player.reputation)}</b></span><span>Streak <b>{state.player.streak_days} ngày</b></span></div><div className="aq-leaderboard">{(state.leaderboard||[]).slice(0,10).map((p,i)=><div key={p.account_id} className={p.account_id===state.player.account_id?'me':''}><strong>{i<3?['🥇','🥈','🥉'][i]:'#'+(i+1)}</strong><span>{p.display_name}</span><b>Lv.{p.level} · {fmt(p.xp)} XP</b></div>)}</div></section>
 </div>;
}

export function GamePage(){
 const[state,setState]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(null),[tab,setTab]=useState('farm'),[busy,setBusy]=useState(false),[toast,setToast]=useState('');
 const load=async()=>{setLoading(true);try{setState(await gameApi.state());setError(null)}catch(e){setError(e)}finally{setLoading(false)}};
 useEffect(()=>{document.title='HPZ AquaQuest — Nông trại ven sông';load()},[]);
 const action=async(type,payload={})=>{setBusy(true);try{const r=await gameApi.action(type,payload);setState(r.state);setToast(r.result?.message||'Xong!');return r}catch(e){setToast(e.message);return null}finally{setBusy(false)}};
 const tabs=useMemo(()=>[
   ['farm','🏡','Nông trại'],['fishing','🎣','Câu cá'],['aquarium','🐠','Phòng cá'],['market','🧺','Chợ'],['missions','📋','Nhiệm vụ']
 ],[]);
 if(loading)return <HPZAppShell active="game" footer={false} bottomNav={false}><HPZContainer><HPZLoading label="Đang mở cổng vào xóm ven sông…"/></HPZContainer></HPZAppShell>;
 if(error?.status===401)return <HPZAppShell active="game" bottomNav={false}><HPZContainer><div className="aq-login-card"><span>🎮</span><h1>HPZ AquaQuest</h1><p>Đăng nhập My HPZ để lưu nông trại, cá, bể, XP và AquaCoin của riêng bạn.</p><HPZButton href="/login">Đăng nhập để chơi</HPZButton></div></HPZContainer></HPZAppShell>;
 if(error)return <HPZAppShell active="game" bottomNav={false}><HPZContainer><HPZNotice type="error">{error.message}</HPZNotice></HPZContainer></HPZAppShell>;
 return <HPZAppShell active="game" footer={false} bottomNav={false} className="aquaquest-app">
   <div className="aq-shell">
     <a className="aq-hub-back" href="/game">← Game Hub</a>
     <GameTop state={state}/>
     <WorldBanner world={state.world}/>
     {toast&&<button className="aq-toast" onClick={()=>setToast('')} aria-label="Đóng thông báo">{toast}<span>×</span></button>}
     <div className="aq-game-stage">
       {tab==='farm'&&<FarmScene state={state} onAction={action} busy={busy}/>}
       {tab==='fishing'&&<Fishing state={state} onAction={action} busy={busy} setToast={setToast}/>}
       {tab==='aquarium'&&<AquariumRoom state={state} onAction={action} busy={busy}/>}
       {tab==='market'&&<Market state={state} onAction={action} busy={busy}/>}
       {tab==='missions'&&<Missions state={state} onAction={action} busy={busy}/>}
     </div>
     <nav className="aq-dock" aria-label="AquaQuest">
       {tabs.map(([id,icon,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}><span>{icon}</span><b>{label}</b></button>)}
     </nav>
   </div>
 </HPZAppShell>;
}
