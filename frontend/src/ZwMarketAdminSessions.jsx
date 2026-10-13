import React,{useEffect,useState}from'react';
import{adminApi}from'./api.js';

const empty=()=>({name:'',description:'',category:'',starts_at:'',ends_at:''});
const dateInput=v=>v?new Date(v).toISOString().slice(0,16):'';

export function ZwMarketAdminSessions(){
  const[items,setItems]=useState([]),[selected,setSelected]=useState(null),[draft,setDraft]=useState(empty()),[message,setMessage]=useState('');
  const load=async()=>{try{const r=await adminApi.listMarketSessions();setItems(r.items||[])}catch(e){setMessage(e.message)}};
  useEffect(()=>{load()},[]);
  const choose=item=>{setSelected(item);setDraft({name:item.name||'',description:item.description||'',category:item.category||'',starts_at:dateInput(item.starts_at),ends_at:dateInput(item.ends_at)});setMessage('')};
  const set=(k,v)=>setDraft(x=>({...x,[k]:v}));
  const create=async()=>{try{const item=await adminApi.createMarketSession({name:'Phiên ZWMarket mới'});await load();choose(item);setMessage('Đã tạo phiên nháp.')}catch(e){setMessage(e.message)}};
  const save=async()=>{if(!selected)return;try{const item=await adminApi.updateMarketSession(selected.session_id,{...draft,starts_at:draft.starts_at||null,ends_at:draft.ends_at||null});choose(item);await load();setMessage('Đã lưu thông tin phiên.')}catch(e){setMessage(e.message)}};
  const status=async value=>{if(!selected)return;try{const item=await adminApi.setMarketSessionStatus(selected.session_id,value);choose(item);await load();setMessage(value==='ENDED'?'Đã kết thúc phiên, bài và lịch sử vẫn được giữ nguyên.':'Đã cập nhật trạng thái phiên.')}catch(e){setMessage(e.message)}};
  return <section className="panel zw-session-admin"><div className="editor-head"><div><small>ISS-2026-0095 / 0096</small><h2>Phiên chợ ZWMarket</h2></div><button onClick={create}>+ Tạo phiên</button></div>{message&&<div className="notice">{message}</div>}<div className="zw-session-admin-grid"><div className="zw-session-list">{items.map(x=><button key={x.session_id} className={selected?.session_id===x.session_id?'active':''} onClick={()=>choose(x)}><b>{x.name}</b><small>{x.status} · {x.post_count||0} bài</small></button>)}{!items.length&&<p className="muted">Chưa có phiên chợ.</p>}</div>{selected?<div><div className="form-grid"><label>Tên phiên<input value={draft.name} onChange={e=>set('name',e.target.value)}/></label><label>Danh mục giới hạn<input value={draft.category} onChange={e=>set('category',e.target.value)} placeholder="Để trống = mọi danh mục"/></label><label>Bắt đầu<input type="datetime-local" value={draft.starts_at} onChange={e=>set('starts_at',e.target.value)}/></label><label>Kết thúc<input type="datetime-local" value={draft.ends_at} onChange={e=>set('ends_at',e.target.value)}/></label><label className="wide">Mô tả<textarea rows="3" value={draft.description} onChange={e=>set('description',e.target.value)}/></label></div><div className="zw-admin-actions"><button onClick={save} disabled={selected.status==='ENDED'}>Lưu</button>{selected.status!=='ENDED'&&<><button onClick={()=>status('UPCOMING')}>Sắp diễn ra</button><button onClick={()=>status('OPEN')}>Mở phiên</button><button onClick={()=>status('ENDED')}>Kết thúc</button></>}</div><p className="muted">Kết thúc phiên không đánh dấu bài là đã bán và không xóa lịch sử tham gia.</p></div>:<div className="empty"><p>Chọn một phiên để chỉnh sửa hoặc vận hành.</p></div>}</div></section>;
}
