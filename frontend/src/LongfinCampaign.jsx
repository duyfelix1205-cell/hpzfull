import React,{useEffect,useMemo,useRef,useState}from'react';

const EXPERIENCE='/campaigns/mi-an-longfin/source/experience.html';
const CONTENT_API='/api/v1/catalog/campaigns/mi-an-longfin/content';
const LOGIN_API='/api/v1/catalog/campaigns/mi-an-longfin/editor/login';
const SAVE_API='/api/v1/catalog/campaigns/mi-an-longfin/editor/content';
const USER_KEY='nexora.catalog.longfin.admin.username';
const PASS_KEY='nexora.catalog.longfin.admin.password';
const DYNAMIC_IDS=new Set(['price','priceNote','total','pay','orderSummary','loadStatus','motion']);
const ATTRIBUTE_COPY=[
 ['[data-tip]','data-tip','Tooltip hotspot'],
 ['#price','data-unit-text','Đơn vị giá'],
 ['#priceNote','data-copy-text','Ghi chú giá'],
 ['#order','data-campaign-title','Tên campaign trong dialog'],
 ['#order','data-item-label','Tên đơn vị trong dialog'],
 ['#order','data-total-label','Nhãn tổng tham khảo'],
 ['#order','data-half-label','Nhãn đặt trước 50%'],
 ['#order','data-full-label','Nhãn thanh toán toàn bộ'],
 ['#order','data-sim-label','Nhãn mô phỏng'],
 ['#motion','data-pause-text','Nhãn tạm dừng chuyển động'],
 ['#motion','data-play-text','Nhãn bật chuyển động'],
 ['#loadStatus','data-ready-text','Trạng thái ảnh sẵn sàng'],
 ['#loadStatus','data-error-text','Trạng thái lỗi ảnh']
];

function apiError(body,status){const e=new Error(body?.error?.message||`HTTP ${status}`);e.status=status;return e}
async function json(path,options={}){
 const r=await fetch(path,{...options,headers:{...(options.headers||{}),...(options.body?{'content-type':'application/json'}:{})}});
 const body=await r.json().catch(()=>({}));
 if(!r.ok)throw apiError(body,r.status);
 return body;
}
function elementPath(el){
 const parts=[];
 while(el&&el.tagName&&el.tagName!=='BODY'){
  if(el.id){parts.unshift('#'+el.id);break}
  const tag=el.tagName.toLowerCase();
  let n=1,sib=el;
  while((sib=sib.previousElementSibling))if(sib.tagName===el.tagName)n++;
  parts.unshift(`${tag}:nth-of-type(${n})`);
  el=el.parentElement;
 }
 return parts.join('>');
}
function collectTextNodes(doc){
 if(!doc?.body)return[];
 const out=[],walker=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT);
 let node;
 while((node=walker.nextNode())){
  const parent=node.parentElement;
  if(!parent)continue;
  if(['SCRIPT','STYLE','NOSCRIPT','CANVAS'].includes(parent.tagName))continue;
  if(parent.closest('script,style,noscript,canvas'))continue;
  if(parent.id&&DYNAMIC_IDS.has(parent.id))continue;
  if(parent.closest('#price,#priceNote,#total,#pay,#orderSummary,#tip,#loadStatus,#motion'))continue;
  const raw=node.nodeValue||'',trimmed=raw.trim();
  if(!trimmed)continue;
  const textChildren=[...parent.childNodes].filter(x=>x.nodeType===Node.TEXT_NODE);
  const textIndex=Math.max(0,textChildren.indexOf(node));
  const path=elementPath(parent);
  const key=`copy-${String(out.length+1).padStart(3,'0')}`;
  const leading=raw.match(/^\s*/)?.[0]||'',trailing=raw.match(/\s*$/)?.[0]||'';
  out.push({kind:'text',key,node,original:trimmed,leading,trailing,tag:parent.tagName.toLowerCase(),context:(parent.getAttribute('aria-label')||parent.id||parent.className||path||parent.tagName).toString().trim().slice(0,90)});
 }
 let attrIndex=0;
 for(const[selector,attr,label]of ATTRIBUTE_COPY){
  for(const element of doc.querySelectorAll(selector)){
   if(!element.hasAttribute(attr))continue;
   attrIndex++;
   out.push({kind:'attr',key:`attr-${String(attrIndex).padStart(3,'0')}`,element,attr,original:element.getAttribute(attr)||'',leading:'',trailing:'',tag:element.tagName.toLowerCase(),context:label});
  }
 }
 return out;
}
function setNodeValue(item,value){
 const text=String(value??'');
 if(item.kind==='attr'){
  const before=item.element.getAttribute(item.attr)||'';
  item.element.setAttribute(item.attr,text);
  if(item.attr==='data-copy-text')item.element.textContent=text;
  if(item.attr==='data-ready-text'&&item.element.textContent===before)item.element.textContent=text;
  if(item.attr==='data-pause-text'&&item.element.textContent===before)item.element.textContent=text;
  if(item.attr==='data-play-text'&&item.element.textContent===before)item.element.textContent=text;
  return;
 }
 item.node.nodeValue=`${item.leading}${text}${item.trailing}`;
}
function labelFor(item,index){const base=item.original.replace(/\s+/g,' ').slice(0,72);return `${String(index+1).padStart(2,'0')} · ${base}`}

export function LongfinCampaign(){
 const iframeRef=useRef(null),nodesRef=useRef([]);
 const[copy,setCopy]=useState({}),[draft,setDraft]=useState({}),[fields,setFields]=useState([]),[loaded,setLoaded]=useState(false);
 const[admin,setAdmin]=useState(false),[panel,setPanel]=useState(false),[loginOpen,setLoginOpen]=useState(false),[credentials,setCredentials]=useState({username:'',password:''});
 const[message,setMessage]=useState(''),[saving,setSaving]=useState(false),[query,setQuery]=useState('');

 const apply=(source=copy)=>{
  const items=nodesRef.current;
  for(const item of items)setNodeValue(item,Object.prototype.hasOwnProperty.call(source,item.key)?source[item.key]:item.original);
  try{iframeRef.current?.contentWindow?.updateSimulation?.();iframeRef.current?.contentWindow?.motionLabel?.()}catch{}
 };
 const scan=()=>{
  const doc=iframeRef.current?.contentDocument;
  const items=collectTextNodes(doc);nodesRef.current=items;
  setFields(items.map(({key,original,context,tag})=>({key,original,context,tag})));
  setDraft(prev=>{
   const next={...copy,...prev};
   for(const item of items)if(!Object.prototype.hasOwnProperty.call(next,item.key))next[item.key]=item.original;
   queueMicrotask(()=>apply(next));
   return next;
  });
  setLoaded(true);
 };
 const loadContent=async()=>{
  try{const r=await json(CONTENT_API);setCopy(r.copy||{});setDraft(r.copy||{});setMessage('')}
  catch(e){setMessage('Không tải được nội dung đã lưu: '+e.message)}
 };
 useEffect(()=>{document.title='Mi Ấn Longfin — Campaign HPZ';loadContent();const u=sessionStorage.getItem(USER_KEY)||'',p=sessionStorage.getItem(PASS_KEY)||'';if(u&&p){json(LOGIN_API,{method:'POST',body:JSON.stringify({username:u,password:p})}).then(()=>{setCredentials({username:u,password:p});setAdmin(true)}).catch(()=>{sessionStorage.removeItem(USER_KEY);sessionStorage.removeItem(PASS_KEY)})}},[]);
 useEffect(()=>{if(loaded)apply(copy)},[copy,loaded]);

 const login=async e=>{e.preventDefault();setMessage('');try{await json(LOGIN_API,{method:'POST',body:JSON.stringify(credentials)});sessionStorage.setItem(USER_KEY,credentials.username);sessionStorage.setItem(PASS_KEY,credentials.password);setAdmin(true);setPanel(true);setLoginOpen(false);setMessage('Đã mở chế độ chỉnh sửa. Thay đổi nội dung ở bảng bên phải rồi bấm Lưu.')}catch(err){setMessage(err.message)}};
 const logout=()=>{sessionStorage.removeItem(USER_KEY);sessionStorage.removeItem(PASS_KEY);setAdmin(false);setPanel(false);setCredentials({username:'',password:''});setMessage('Đã thoát chế độ quản trị.')};
 const change=(key,value)=>{setDraft(x=>{const next={...x,[key]:value};const item=nodesRef.current.find(n=>n.key===key);if(item)setNodeValue(item,value);return next})};
 const save=async()=>{setSaving(true);setMessage('');try{
   const payload={...copy};
   for(const item of nodesRef.current)payload[item.key]=String(draft[item.key]??item.original);
   const r=await json(SAVE_API,{method:'PUT',headers:{'x-campaign-admin-username':credentials.username,'x-campaign-admin-password':credentials.password},body:JSON.stringify({copy:payload})});
   setCopy(r.copy||payload);setDraft(r.copy||payload);setMessage('Đã lưu nội dung lên Catalog. Khách hàng tải lại trang sẽ thấy bản mới.');
  }catch(e){setMessage(e.message)}finally{setSaving(false)}};
 const resetField=key=>{const item=nodesRef.current.find(n=>n.key===key);if(item)change(key,item.original)};
 const filtered=useMemo(()=>{const q=query.trim().toLowerCase();return fields.map((x,i)=>({...x,index:i})).filter(x=>!q||x.original.toLowerCase().includes(q)||String(draft[x.key]||'').toLowerCase().includes(q)||x.context.toLowerCase().includes(q))},[fields,query,draft]);

 return <div className="longfin-campaign-frame">
  <iframe ref={iframeRef} onLoad={scan} className="longfin-campaign-frame__view" src={EXPERIENCE} title="Mi Ấn Longfin — Campaign Experience" allow="fullscreen"/>
  <div className="longfin-editor-launch">
   {!admin?<button type="button" onClick={()=>setLoginOpen(true)}>Quản trị nội dung</button>:<>
    <button type="button" className="is-admin" onClick={()=>setPanel(v=>!v)}>{panel?'Đóng trình sửa':`Chỉnh nội dung (${fields.length})`}</button>
    <button type="button" onClick={save} disabled={saving||!loaded}>{saving?'Đang lưu…':'Lưu'}</button>
    <button type="button" onClick={logout}>Đăng xuất</button>
   </>}
  </div>
  {message&&<div className={`longfin-editor-toast ${admin?'is-admin':''}`}>{message}</div>}
  {loginOpen&&<div className="longfin-editor-modal" role="dialog" aria-modal="true" aria-label="Đăng nhập quản trị Campaign">
   <form onSubmit={login}>
    <button type="button" className="longfin-editor-modal__close" onClick={()=>setLoginOpen(false)} aria-label="Đóng">×</button>
    <span>HPZ CAMPAIGN ADMIN</span><h2>Đăng nhập quản trị</h2>
    <label>Tài khoản<input autoFocus autoComplete="username" value={credentials.username} onChange={e=>setCredentials(x=>({...x,username:e.target.value}))}/></label>
    <label>Mật khẩu<input type="password" autoComplete="current-password" value={credentials.password} onChange={e=>setCredentials(x=>({...x,password:e.target.value}))}/></label>
    <button className="longfin-editor-primary">Đăng nhập</button>
    {message&&<p>{message}</p>}
   </form>
  </div>}
  {admin&&panel&&<aside className="longfin-editor-panel" aria-label="Trình chỉnh sửa nội dung Mi Ấn Longfin">
   <header><div><span>HPZ CAMPAIGN CMS</span><h2>Mi Ấn Longfin</h2><p>{fields.length} đoạn text từ UX hiện tại · thay đổi hiển thị trực tiếp ở preview.</p></div><button type="button" onClick={()=>setPanel(false)}>×</button></header>
   <div className="longfin-editor-panel__tools"><input placeholder="Tìm nội dung…" value={query} onChange={e=>setQuery(e.target.value)}/><button type="button" onClick={save} disabled={saving}>{saving?'Đang lưu…':'Lưu tất cả'}</button></div>
   <div className="longfin-editor-panel__list">{filtered.map(item=><label key={item.key} className="longfin-editor-field">
    <span>{labelFor(item,item.index)}</span><small>{item.tag} · {item.context||'campaign copy'}</small>
    <textarea rows={Math.min(6,Math.max(2,Math.ceil(String(draft[item.key]??item.original).length/55)))} value={draft[item.key]??item.original} onChange={e=>change(item.key,e.target.value)}/>
    <button type="button" onClick={()=>resetField(item.key)}>Khôi phục text gốc</button>
   </label>)}</div>
   <footer><p>Giá trị tính toán/quantity/trạng thái runtime được khóa để không làm sai logic Catalog. Tất cả copy biên tập của trang được quản lý tại đây.</p><button type="button" onClick={save} disabled={saving}>{saving?'Đang lưu…':'Lưu nội dung'}</button></footer>
  </aside>}
 </div>
}
