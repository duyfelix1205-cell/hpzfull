import React,{useEffect,useMemo,useState}from'react';
import{HPZAppShell,HPZButton,HPZContainer}from'./ui/HPZUI.jsx';
import{GAME_CATEGORIES,GAME_REGISTRY,gameById}from'./game-registry.js';

const RECENT_KEY='hpz.gamehub.recent.v1';

const loadRecent=()=>{
  try{
    const value=JSON.parse(localStorage.getItem(RECENT_KEY)||'[]');
    return Array.isArray(value)?value.filter(x=>x&&x.id).slice(0,6):[];
  }catch{return []}
};

const rememberGame=game=>{
  try{
    const current=loadRecent().filter(x=>x.id!==game.id);
    current.unshift({id:game.id,last_played_at:new Date().toISOString()});
    localStorage.setItem(RECENT_KEY,JSON.stringify(current.slice(0,6)));
  }catch{}
};

function Cover({game,large=false}){
 return <div className={'gamehub-cover gamehub-cover--'+game.cover+(large?' is-large':'')} aria-hidden="true">
   <span className="gamehub-cover__sun"/>
   <span className="gamehub-cover__cloud c1">☁</span>
   <span className="gamehub-cover__cloud c2">☁</span>
   <span className="gamehub-cover__land"/>
   <span className="gamehub-cover__water"/>
   <span className="gamehub-cover__accent">{game.coverAccent}</span>
   <span className="gamehub-cover__hero">{game.coverIcon}</span>
   <span className="gamehub-cover__fish f1">{game.cover==='wildwood'?'✦':game.cover==='aquarium3d'?'🐠':'🐟'}</span>
   <span className="gamehub-cover__fish f2">{game.cover==='wildwood'?'🦋':game.cover==='aquarium3d'?'🐡':'🐠'}</span>
   <span className="gamehub-cover__spark s1">✦</span>
   <span className="gamehub-cover__spark s2">✦</span>
 </div>;
}

function StatusBadge({game}){
 const tone=game.status==='LIVE'?'live':game.status==='BETA'?'beta':'soon';
 return <span className={'gamehub-status '+tone}><i/>{game.statusLabel}</span>;
}

function GameCard({game,recent=false}){
 return <article className="gamehub-card">
   <a className="gamehub-card__cover" href={game.href} onClick={()=>rememberGame(game)} aria-label={'Chơi '+game.name}>
     <Cover game={game}/>
     <StatusBadge game={game}/>
     {recent&&<span className="gamehub-recent-mark">Chơi gần đây</span>}
   </a>
   <div className="gamehub-card__body">
     <div className="gamehub-card__heading"><div><small>{game.kicker}</small><h3>{game.name}</h3></div><span>{game.external?'↗':'›'}</span></div>
     <p>{game.description}</p>
     <div className="gamehub-tags">{game.tags.map(tag=><span key={tag}>{tag}</span>)}</div>
     <a className="gamehub-play-link" href={game.href} onClick={()=>rememberGame(game)}>▶ {recent?'Chơi tiếp':game.playersLabel}<span>{game.external?'Mở game ↗':'Mở trong HPZ'}</span></a>
   </div>
 </article>;
}

function Featured({game}){
 if(!game)return null;
 return <section className="gamehub-featured">
   <div className="gamehub-featured__copy">
     <span className="gamehub-eyebrow">GAME NỔI BẬT</span>
     <div className="gamehub-featured__title"><h2>{game.name}</h2><StatusBadge game={game}/></div>
     <p>{game.description}</p>
     <div className="gamehub-tags">{game.tags.map(tag=><span key={tag}>{tag}</span>)}</div>
     <div className="gamehub-featured__actions">
       <HPZButton href={game.href} onClick={()=>rememberGame(game)}>▶ Chơi ngay</HPZButton>
       <span>Không cài đặt · Mở trực tiếp trên web</span>
     </div>
   </div>
   <a className="gamehub-featured__visual" href={game.href} onClick={()=>rememberGame(game)} aria-label={'Mở '+game.name}><Cover game={game} large/><div className="gamehub-featured__caption"><b>{game.kicker}</b><span>Khám phá thế giới game →</span></div></a>
 </section>;
}

export function GameHubPage(){
 const[query,setQuery]=useState(''),[category,setCategory]=useState('all'),[recent,setRecent]=useState([]);
 useEffect(()=>{document.title='HPZ Game Hub — Chọn game để chơi';setRecent(loadRecent())},[]);
 const featured=GAME_REGISTRY.find(x=>x.featured&&x.status!=='COMING_SOON')||GAME_REGISTRY.find(x=>x.status!=='COMING_SOON');
 const recentGames=useMemo(()=>recent.map(x=>gameById(x.id)).filter(Boolean),[recent]);
 const visible=useMemo(()=>{
   const q=query.trim().toLocaleLowerCase('vi');
   return GAME_REGISTRY.filter(game=>{
     if(game.status==='COMING_SOON')return false;
     if(category!=='all'&&!game.categories.includes(category))return false;
     if(!q)return true;
     return [game.name,game.kicker,game.description,...game.tags].join(' ').toLocaleLowerCase('vi').includes(q);
   });
 },[query,category]);
 const coming=GAME_REGISTRY.filter(x=>x.status==='COMING_SOON');
 return <HPZAppShell active="game" className="gamehub-app">
   <HPZContainer className="gamehub">
     <section className="gamehub-hero">
       <div>
         <span className="gamehub-eyebrow">HPZ GAME HUB</span>
         <h1>Chọn một thế giới.<br/><em>Bắt đầu chơi.</em></h1>
         <p>Nơi tập hợp các game của HPZ. Mỗi game là một thế giới riêng, mở trực tiếp từ một thư viện duy nhất.</p>
       </div>
       <div className="gamehub-hero__stats"><span><b>{GAME_REGISTRY.filter(x=>x.status!=='COMING_SOON').length}</b><small>Game đang mở</small></span><span><b>{GAME_CATEGORIES.length-1}</b><small>Thể loại</small></span><span><b>∞</b><small>Thế giới sắp tới</small></span></div>
     </section>

     <section className="gamehub-toolbar" aria-label="Tìm và lọc game">
       <label className="gamehub-search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm game, thể loại hoặc hoạt động…" aria-label="Tìm game"/>{query&&<button onClick={()=>setQuery('')} aria-label="Xóa tìm kiếm">×</button>}</label>
       <div className="gamehub-filters">{GAME_CATEGORIES.map(item=><button key={item.id} className={category===item.id?'active':''} onClick={()=>setCategory(item.id)}><span>{item.icon}</span>{item.label}</button>)}</div>
     </section>

     {!query&&category==='all'&&<Featured game={featured}/>}

     {recentGames.length>0&&!query&&category==='all'&&<section className="gamehub-section">
       <div className="gamehub-section__head"><div><span className="gamehub-eyebrow">QUAY LẠI THẾ GIỚI CŨ</span><h2>Chơi gần đây</h2></div><span>{recentGames.length} game</span></div>
       <div className="gamehub-grid gamehub-grid--recent">{recentGames.map(game=><GameCard key={game.id} game={game} recent/>)}</div>
     </section>}

     <section className="gamehub-section">
       <div className="gamehub-section__head"><div><span className="gamehub-eyebrow">{query||category!=='all'?'KẾT QUẢ':'THƯ VIỆN GAME'}</span><h2>{query?'Game phù hợp':category!=='all'?(GAME_CATEGORIES.find(x=>x.id===category)?.label||'Game'):'Tất cả game'}</h2></div><span>{visible.length} game</span></div>
       {visible.length?<div className="gamehub-grid">{visible.map(game=><GameCard key={game.id} game={game}/>)}</div>:<div className="gamehub-empty"><span>🎮</span><b>Chưa tìm thấy game phù hợp</b><p>Thử từ khóa khác hoặc quay về “Tất cả”.</p><button onClick={()=>{setQuery('');setCategory('all')}}>Xem tất cả game</button></div>}
     </section>

     {coming.length>0&&<section className="gamehub-section">
       <div className="gamehub-section__head"><div><span className="gamehub-eyebrow">ĐANG PHÁT TRIỂN</span><h2>Sắp ra mắt</h2></div></div>
       <div className="gamehub-grid">{coming.map(game=><GameCard key={game.id} game={game}/>)}</div>
     </section>}

     <section className="gamehub-roadmap">
       <div><span>✦</span><div><b>Một Hub, nhiều thế giới</b><p>Game mới chỉ cần đăng ký vào Game Registry là tự xuất hiện tại đây, không phải thiết kế lại màn hình.</p></div></div>
       <div className="gamehub-roadmap__dots"><i/><i/><i/><i/></div>
     </section>
   </HPZContainer>
 </HPZAppShell>;
}
