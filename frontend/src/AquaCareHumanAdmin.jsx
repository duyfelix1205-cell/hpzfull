import React,{useCallback,useEffect,useState} from 'react';
import {adminApi,adminSession} from './api.js';
import './aquacare-human-admin.css';

const stateName={ACTIVE:'Đang chăm sóc',WAITING:'Chờ thông tin',INACTIVE_UNRESOLVED:'Tạm ngừng, chưa giải quyết',RESOLVED:'Đã giải quyết'};
const humanName={NONE:'Chưa yêu cầu',REQUESTED:'Khách cần HPZ',ACKNOWLEDGED:'HPZ đã tiếp nhận',CONTRIBUTED:'HPZ đã phản hồi'};
const actions={HUMAN_ACKNOWLEDGED:'Xác nhận tiếp nhận',HUMAN_CONTRIBUTED:'Ghi phản hồi',REQUEST_INFO:'Yêu cầu thêm thông tin',
 HUMAN_INACTIVE:'Tạm ngừng, chưa giải quyết',RESUME:'Tiếp tục chăm sóc',HUMAN_RESOLVED:'Xác nhận đã giải quyết'};
const eligible=x=>{
 if(!x||x.status==='RESOLVED')return [];
 const a=[];
 if(x.human_state==='REQUESTED')a.push('HUMAN_ACKNOWLEDGED');
 if(['ACKNOWLEDGED','CONTRIBUTED'].includes(x.human_state))a.push('HUMAN_CONTRIBUTED');
 if(x.status==='ACTIVE')a.push('REQUEST_INFO');
 if(x.status==='WAITING'&&x.human_state==='CONTRIBUTED')a.push('HUMAN_INACTIVE');
 if(['WAITING','INACTIVE_UNRESOLVED'].includes(x.status))a.push('RESUME');
 if(['ACTIVE','WAITING'].includes(x.status))a.push('HUMAN_RESOLVED');
 return a;
};
const dt=x=>x?new Date(x).toLocaleString('vi-VN'):'—';

export function AquaCareHumanAdmin(){
 const [password,setPassword]=useState(''),[filter,setFilter]=useState('REQUESTED'),
 [rows,setRows]=useState([]),[id,setId]=useState(''),[item,setItem]=useState(null),
 [action,setAction]=useState(''),[content,setContent]=useState(''),[confirmed,setConfirmed]=useState(false),
 [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const load=useCallback(async()=>{
  try{const result=await adminApi.listHumanCareIncidents(filter);setRows(result.items||[]);setError('')}
  catch(e){setError(e.message);setRows([])}
 },[filter]);
 useEffect(()=>{load()},[load]);
 useEffect(()=>{
  if(!id){setItem(null);return;}
  let active=true;
  adminApi.getHumanCareIncident(id).then(x=>{if(active)setItem(x)})
   .catch(e=>{if(active)setError(e.message)});
  return()=>{active=false};
 },[id]);
 const refresh=async()=>{
  await load();
  if(id){try{setItem(await adminApi.getHumanCareIncident(id))}catch(e){setError(e.message)}}
 };
 const login=async e=>{
  e.preventDefault();
  if(password)adminSession.set(password);
  setPassword('');
  await refresh();
 };
 const submit=async e=>{
  e.preventDefault();
  const reason=content.trim();
  if(!id||!action)return;
  if(action==='HUMAN_RESOLVED'&&(!confirmed||reason.length<8)){
   setError('Cần xác nhận và ghi căn cứ ít nhất 8 ký tự.');return;
  }
  if(['HUMAN_CONTRIBUTED','REQUEST_INFO','HUMAN_INACTIVE','RESUME'].includes(action)&&!reason){
   setError('Cần nội dung thao tác thực tế.');return;
  }
  setBusy(true);setMessage('');setError('');
  try{
   await adminApi.updateHumanCareIncident(id,{action,content:reason,confirmed:action==='HUMAN_RESOLVED'&&confirmed});
   setMessage('Đã lưu phản hồi HPZ Human vào đúng Incident và Care History.');
   await refresh();setAction('');setContent('');setConfirmed(false);
  }catch(err){setError(err.message)}finally{setBusy(false)}
 };
 const options=eligible(item);
 return <main className="admin-shell aquacare-human-admin">
  <header className="admin-top"><div><p className="eyebrow">NEXORA PRODUCT CATALOG · HPZ AQUACARE</p>
   <h1>HPZ Human · Tiếp nhận chăm sóc</h1>
   <p>Tiếp nhận và theo dõi Incident trong khu vực Admin hiện có. Không giả lập phản hồi của nhân viên.</p></div>
   <a href="/care">Xem AquaCare khách hàng ↗</a>
  </header>
  <section className="panel admin-tool-panel">
   <h2>Xác thực HPZ Human</h2>
   <p>Trang này dùng quyền Admin hiện tại và không chấp nhận header test. Nếu dùng SSO, phiên đăng nhập sẽ được kiểm tra tự động.</p>
   <form className="human-login" onSubmit={login}>
    <label>Mật khẩu Admin (chế độ standalone)
     <input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/>
    </label><button type="submit">Xác thực / Tải lại</button>
   </form>
   {error&&<p role="alert" className="human-error">{error}</p>}
   {message&&<p role="status" className="human-success">{message}</p>}
  </section>
  <div className="human-columns">
   <section className="panel admin-tool-panel">
    <h2>Hàng đợi Incident</h2>
    <div className="human-toolbar"><label>Lọc
     <select value={filter} onChange={e=>{setFilter(e.target.value);setId('')}}>
      <option value="REQUESTED">Khách đang yêu cầu HPZ</option>
      <option value="">Tất cả</option>
      {Object.entries(stateName).map(([k,v])=><option key={k} value={k}>{v}</option>)}
     </select></label><button type="button" onClick={refresh}>Làm mới</button></div>
    <p>{rows.length} Incident</p>
    <div className="human-list">
     {rows.map(x=><button type="button" key={x.issue_id} className={'human-row '+(x.issue_id===id?'selected':'')} onClick={()=>setId(x.issue_id)}>
      <strong>{x.issue_type} · {stateName[x.status]||x.status}</strong>
      <small>Customer: {x.customer_id} · {x.tank_name||'Không gắn bể'}</small>
      <small>{humanName[x.human_state]||x.human_state} · {dt(x.updated_at)}</small>
     </button>)}
     {!rows.length&&<p>Không có Incident trong bộ lọc hoặc chưa xác thực.</p>}
    </div>
   </section>
   <section className="panel admin-tool-panel">
    <h2>Chi tiết &amp; lịch sử HPZ</h2>
    {!item?<p>Chọn Incident để xem và thao tác.</p>:<>
     <div className="human-detail">
      <p><b>Incident:</b> <code>{item.issue_id}</code></p>
      <p><b>Trạng thái:</b> {stateName[item.status]||item.status}</p>
      <p><b>Nhân sự:</b> {humanName[item.human_state]||item.human_state}</p>
      <p><b>Care Decision:</b> {item.care_decision} (không phải trạng thái)</p>
      <p><b>Nội dung:</b> {item.description||'Chưa có mô tả'}</p>
      {item.resolution_basis&&<p><b>Căn cứ:</b> {item.resolution_basis}</p>}
      {item.status==='INACTIVE_UNRESOLVED'&&<p className="human-warning">Phải tiếp tục chăm sóc và có căn cứ mới trước khi xác nhận RESOLVED.</p>}
     </div>
     {!!options.length&&<form className="human-action-form" onSubmit={submit}>
      <label>Thao tác
       <select value={action} required onChange={e=>{setAction(e.target.value);setConfirmed(false)}}>
        <option value="">Chọn thao tác</option>
        {options.map(k=><option value={k} key={k}>{actions[k]}</option>)}
       </select>
      </label>
      <label>Thông tin thực tế / căn cứ
       <textarea rows={4} maxLength={4000} value={content} onChange={e=>setContent(e.target.value)}
        required={action!=='HUMAN_ACKNOWLEDGED'} placeholder="Ghi tình trạng, yêu cầu hoặc phản hồi thực tế"/>
      </label>
      {action==='HUMAN_RESOLVED'&&<label className="human-check">
       <input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
       Tôi xác nhận có đủ căn cứ giải quyết.
      </label>}
      <button disabled={busy||!action||(action==='HUMAN_RESOLVED'&&!confirmed)} type="submit">
       {busy?'Đang lưu…':'Ghi vào Care History'}
      </button>
     </form>}
     <h3>Timeline của Incident</h3>
     <div className="human-history">
      {(item.events||[]).map(x=><article key={x.event_id}>
       <strong>{x.event_type}</strong><small>{dt(x.created_at)} · {x.actor_type} · {x.actor_id||''}</small>
       <p>{x.content||'—'}</p>
      </article>)}
      {!(item.events||[]).length&&<p>Chưa có diễn biến.</p>}
     </div>
    </>}
   </section>
  </div>
 </main>;
}
