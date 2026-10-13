import React,{useEffect,useMemo,useState}from'react';
import{contentPublicApi}from'./contentApi.js';
import{LongfinCampaign}from'./LongfinCampaign.jsx';
import{HPZAppShell,HPZContainer,HPZPageHeader,HPZCard,HPZCardHeader,HPZTabs,HPZField,HPZButton,HPZEmptyState,HPZLoading,HPZStatus}from'./ui/HPZUI.jsx';

const fallbackTypeLabel={POSTER:'Poster',EVENT:'Sự kiện',OFFER:'Ưu đãi',ANNOUNCEMENT:'Thông báo',CAMPAIGN:'Chiến dịch'};
const safeHref=value=>{const v=String(value||'').trim();return /^(https?:\/\/|\/|#)/i.test(v)?v:'#'};
const safeImage=value=>{const v=String(value||'').trim();return /^(https?:\/\/|\/)/i.test(v)?v:''};
const date=value=>value?new Intl.DateTimeFormat('vi-VN',{dateStyle:'medium'}).format(new Date(value)):'';
const lines=text=>String(text||'').split(/\n+/).filter(Boolean);

function ArticleShell({active='wiki',children}){return <HPZAppShell active={active}><HPZContainer>{children}</HPZContainer></HPZAppShell>}

function JournalList(){
 const[items,setItems]=useState([]),[types,setTypes]=useState([]),[q,setQ]=useState(''),[kind,setKind]=useState('ALL'),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{document.title='Nhật Báo — HPZ Aquaroom';contentPublicApi.listTaxonomy('journal-type').then(r=>setTypes(r.items||[])).catch(()=>{})},[]);
 useEffect(()=>{let active=true;const tm=setTimeout(()=>{setLoading(true);contentPublicApi.listJournal({q}).then(r=>{if(active){setItems(r.items||[]);setError('')}}).catch(e=>active&&setError(e.message)).finally(()=>active&&setLoading(false))},160);return()=>{active=false;clearTimeout(tm)}},[q]);
 const visible=useMemo(()=>kind==='ALL'?items:items.filter(x=>x.entry_type===kind),[items,kind]);
 const tabs=[['ALL','Tất cả'],...types.map(t=>[t.option_value,t.label])];
 return <ArticleShell active="journal"><HPZPageHeader eyebrow="HPZ DISCOVER" title="Nhật Báo" subtitle="Poster, sự kiện, thông báo và ưu đãi mới nhất từ HPZ."/><HPZCard className="hpz-section"><HPZField label="Tìm nội dung" value={q} onChange={e=>setQ(e.target.value)} placeholder="Tìm poster, sự kiện, ưu đãi…"/><HPZTabs items={tabs} value={kind} onChange={setKind}/></HPZCard>{loading?<HPZLoading label="Đang tìm Nhật Báo…"/>:error?<HPZCard><HPZEmptyState title="Không tải được nội dung">{error}</HPZEmptyState></HPZCard>:visible.length?<div className="hpz-wiki-grid">{visible.map(x=><HPZCard key={x.journal_id} className="hpz-media-card">{safeImage(x.image_url)&&<a href={'/nhat-bao/'+encodeURIComponent(x.slug)}><img src={safeImage(x.image_url)} alt={x.title}/></a>}<div className="hpz-media-card__body"><HPZStatus>{x.entry_type_label||fallbackTypeLabel[x.entry_type]||x.entry_type}</HPZStatus><h2><a href={'/nhat-bao/'+encodeURIComponent(x.slug)}>{x.title}</a></h2>{x.summary&&<p>{x.summary}</p>}<small className="hpz-muted">{x.starts_at?'Từ '+date(x.starts_at):''}{x.ends_at?' · đến '+date(x.ends_at):''}</small><div className="hpz-actions"><HPZButton variant="secondary" href={'/nhat-bao/'+encodeURIComponent(x.slug)}>Xem chi tiết</HPZButton>{x.cta_url&&<HPZButton href={safeHref(x.cta_url)}>{x.cta_label||'Xem ngay'}</HPZButton>}</div></div></HPZCard>)}</div>:<HPZCard><HPZEmptyState title="Chưa có nội dung phù hợp"/></HPZCard>}</ArticleShell>
}

function JournalDetail({slug}){
 const[item,setItem]=useState(null),[error,setError]=useState('');
 useEffect(()=>{contentPublicApi.getJournal(slug).then(x=>{setItem(x);document.title=x.title+' — Nhật Báo HPZ'}).catch(e=>setError(e.message))},[slug]);
 return <ArticleShell active="journal"><HPZPageHeader eyebrow="NHẬT BÁO" title={item?.title||'Đang tải nội dung'} subtitle={item?.summary}/>{error?<HPZCard><HPZEmptyState title="Không tìm thấy nội dung">{error}</HPZEmptyState></HPZCard>:!item?<HPZLoading/>:<HPZCard className="hpz-content-article"><div className="hpz-actions"><HPZButton variant="ghost" href="/nhat-bao">← Nhật Báo</HPZButton><HPZStatus>{item.entry_type_label||fallbackTypeLabel[item.entry_type]||item.entry_type}</HPZStatus></div>{safeImage(item.image_url)&&<img className="hpz-content-cover" src={safeImage(item.image_url)} alt={item.title}/>}<div className="hpz-content-body">{lines(item.content).map((p,i)=><p key={i}>{p}</p>)}</div>{item.cta_url&&<HPZButton href={safeHref(item.cta_url)}>{item.cta_label||'Xem ngay'}</HPZButton>}</HPZCard>}</ArticleShell>
}

function WikiList(){
 const[items,setItems]=useState([]),[categories,setCategories]=useState([]),[q,setQ]=useState(''),[category,setCategory]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{document.title='HPZWiki — HPZ Aquaroom';contentPublicApi.listTaxonomy('wiki-category').then(r=>setCategories(r.items||[])).catch(()=>{})},[]);
 useEffect(()=>{let active=true;const tm=setTimeout(()=>{setLoading(true);contentPublicApi.listWiki({q,category}).then(r=>{if(active){setItems(r.items||[]);setError('')}}).catch(e=>active&&setError(e.message)).finally(()=>active&&setLoading(false))},160);return()=>{active=false;clearTimeout(tm)}},[q,category]);
 return <ArticleShell active="wiki"><HPZPageHeader eyebrow="HPZ WIKI" title="Kiến thức thực hành" subtitle="Cá, bể, thiết bị, chăm sóc, bệnh và sự cố — nền tri thức có cấu trúc cho toàn Customer Ecosystem."/><HPZCard className="hpz-section"><div className="hpz-grid hpz-grid--2"><HPZField label="Tìm kiếm" value={q} onChange={e=>setQ(e.target.value)} placeholder="Tìm bài viết, loài cá, bệnh…"/><HPZField label="Chủ đề" as="select" value={category} onChange={e=>setCategory(e.target.value)} options={[{value:'',label:'Tất cả chủ đề'},...categories.map(c=>({value:c.option_value,label:c.label}))]}/></div></HPZCard>{loading?<HPZLoading label="Đang tìm HPZWiki…"/>:error?<HPZCard><HPZEmptyState title="Không tải được Wiki">{error}</HPZEmptyState></HPZCard>:items.length?<div className="hpz-wiki-grid">{items.map(x=><HPZCard key={x.article_id} className="hpz-media-card"><a href={'/wiki/'+encodeURIComponent(x.slug)}>{safeImage(x.image_url)&&<img src={safeImage(x.image_url)} alt={x.title}/>}<div className="hpz-media-card__body"><HPZStatus>{x.category_label||x.category}</HPZStatus><h2>{x.title}</h2>{x.summary&&<p>{x.summary}</p>}<small className="hpz-muted">Cập nhật {date(x.updated_at)}</small></div></a></HPZCard>)}</div>:<HPZCard><HPZEmptyState title="Chưa có bài viết phù hợp"/></HPZCard>}</ArticleShell>
}

function WikiDetail({slug}){
 const[item,setItem]=useState(null),[error,setError]=useState('');
 useEffect(()=>{contentPublicApi.getWiki(slug).then(x=>{setItem(x);document.title=x.title+' — HPZWiki'}).catch(e=>setError(e.message))},[slug]);
 return <ArticleShell active="wiki"><HPZPageHeader eyebrow="HPZ WIKI" title={item?.title||'Đang tải bài viết'} subtitle={item?.summary}/>{error?<HPZCard><HPZEmptyState title="Không tìm thấy bài viết">{error}</HPZEmptyState></HPZCard>:!item?<HPZLoading/>:<HPZCard className="hpz-content-article"><div className="hpz-actions"><HPZButton variant="ghost" href="/wiki">← HPZWiki</HPZButton><HPZStatus>{item.category_label||item.category}</HPZStatus></div>{safeImage(item.image_url)&&<img className="hpz-content-cover" src={safeImage(item.image_url)} alt={item.title}/>}<div className="hpz-content-body">{lines(item.content).map((p,i)=><p key={i}>{p}</p>)}</div></HPZCard>}</ArticleShell>
}

export function ContentHub(){
 const path=location.pathname.replace(/\/$/,'')||'/';
 const journal=path.match(/^\/nhat-bao\/([^/]+)$/),wiki=path.match(/^\/(?:hpzwiki|wiki)\/([^/]+)$/);
 if(path==='/nhat-bao/mi-an-longfin/experience')return <LongfinCampaign/>;
 if(journal)return <JournalDetail slug={decodeURIComponent(journal[1])}/>;
 if(wiki)return <WikiDetail slug={decodeURIComponent(wiki[1])}/>;
 if(path==='/hpzwiki'||path==='/wiki')return <WikiList/>;
 return <JournalList/>;
}
