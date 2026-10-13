import React,{useEffect,useState} from 'react';
import {aquaCareApi} from './ecosystem-api.js';
import {HPZButton,HPZCard,HPZCardHeader,HPZField,HPZModal,HPZEmptyState,HPZNotice,HPZStatus} from './ui/HPZUI.jsx';

const types=[['gasp','Cá thở gấp / nổi đầu'],['spots','Đốm lạ / nghi bệnh ngoài da'],
 ['fin','Rách vây / vết thương'],['eating','Cá bỏ ăn / lờ đờ'],['water','Nước đục / có mùi'],
 ['filter','Lọc / sủi gặp sự cố'],['death','Cá chết / xấu nhanh'],['other','Vấn đề khác']];
const statusLabels={ACTIVE:'Đang chăm sóc',WAITING:'Đang chờ thông tin',
 INACTIVE_UNRESOLVED:'Tạm ngừng — chưa rõ kết quả',RESOLVED:'Đã xác nhận kết quả'};
const humanLabels={NONE:'Chưa yêu cầu',REQUESTED:'Đã yêu cầu · chờ HPZ tiếp nhận',
 ACKNOWLEDGED:'HPZ đã tiếp nhận',CONTRIBUTED:'HPZ đã đóng góp'};
const date=x=>x?new Date(x).toLocaleString('vi-VN'):'—';
const initial=()=>({issue_type:'other',tank_id:'',onset:'Hôm nay',content:'',kind:'OBSERVATION',confirmed:false});

export function AquaCareWorkspace({tanks=[],selected,setSelected,revision=0,onCreateTank,onReload,children}){
 const [area,setArea]=useState('today'),[relationship,setRelationship]=useState(null),
  [normal,setNormal]=useState(null),[incidents,setIncidents]=useState([]),
  [history,setHistory]=useState([]),[historyTotal,setHistoryTotal]=useState(0),[historyTank,setHistoryTank]=useState(''),
  [incidentId,setIncidentId]=useState(''),[incident,setIncident]=useState(null),
  [modal,setModal]=useState(''),[form,setForm]=useState(initial),
  [busy,setBusy]=useState(false),[error,setError]=useState(''),
  [incidentFilter,setIncidentFilter]=useState('ONGOING');

 const refresh=async()=>{
  const values=await Promise.allSettled([
   aquaCareApi.relationship(),aquaCareApi.normalCare(),aquaCareApi.incidents(),
   aquaCareApi.history(historyTank)
  ]);
  if(values[0].status==='fulfilled')setRelationship(values[0].value);
  if(values[1].status==='fulfilled')setNormal(values[1].value);
  if(values[2].status==='fulfilled')setIncidents(values[2].value.items||[]);
  if(values[3].status==='fulfilled'){setHistory(values[3].value.items||[]);setHistoryTotal(Number(values[3].value.total||0));}
  const bad=values.find(x=>x.status==='rejected');
  if(bad)setError(bad.reason?.message||'Không tải được một phần dữ liệu chăm sóc.');
 };
 useEffect(()=>{refresh().catch(e=>setError(e.message))},[revision,historyTank]);
 useEffect(()=>{if(!incidentId){setIncident(null);return;}let valid=true;
  aquaCareApi.getIncident(incidentId).then(x=>valid&&setIncident(x)).catch(e=>valid&&setError(e.message));
  return()=>{valid=false};},[incidentId,revision]);

 const open=(mode,values={})=>{setError('');setForm({...initial(),...values});setModal(mode)};
 const change=(field,value)=>setForm(v=>({...v,[field]:value}));
 const updateAll=async(id=incidentId)=>{
  await refresh();
  if(id){const x=await aquaCareApi.getIncident(id);setIncident(x);setIncidentId(id);}
  if(onReload)await onReload();
 };
 const perform=async e=>{
  e.preventDefault();setBusy(true);setError('');
  try{
   const text=form.content.trim();
   let created=null;
   if(modal==='concern'){
    created=await aquaCareApi.createIncident({tank_id:form.tank_id||null,issue_type:form.issue_type,
      onset:form.onset,description:text});
   }else if(modal==='observation'){
    await aquaCareApi.observation({tank_id:form.tank_id||null,kind:form.kind,content:text});
   }else if(modal==='guidance'){
    await aquaCareApi.askGuidance({tank_id:form.tank_id||null,question:text});
   }else if(modal==='recurrence'){
    created=await aquaCareApi.recurrence(incidentId,{description:text,onset:form.onset});
   }else{
    await aquaCareApi.incidentEvent(incidentId,{action:modal,content:text,confirmed:form.confirmed});
   }
   setModal('');await updateAll(created?.issue_id||incidentId);
   if(created?.issue_id)setArea('care');
  }catch(err){setError(err.message)}finally{setBusy(false)}
 };
 const loadMore=async()=>{try{const nextPage=Math.floor(history.length/50)+1;const result=await aquaCareApi.history(historyTank,nextPage);setHistory(x=>[...x,...(result.items||[])]);setHistoryTotal(Number(result.total||0));}catch(e){setError(e.message)}};
 const start=async()=>{
  setBusy(true);setError('');
  try{await aquaCareApi.startCare();await updateAll()}catch(err){setError(err.message)}finally{setBusy(false)}
 };
 const ongoing=incidents.filter(x=>x.status!=='RESOLVED');
 const visibleIncidents=incidentFilter==='ONGOING'?ongoing:incidents;
 const selectedName=tanks.find(x=>x.tank_id===selected)?.name||'Bể đã chọn';
 const openIncident=id=>{setArea('care');setIncidentId(id)};
 const viewEvents=incident?.events||[];

 return <div className="aquacare-v1 aquacare-violet-workspace" data-active-area={area}>
  <div className="aquacare-violet-context" aria-label="Tổng quan chăm sóc">
   <span className="aquacare-violet-context__brand"><span className="aquacare-violet-pulse" aria-hidden="true"/> HPZ AQUACARE / HÀNH TRÌNH CHĂM SÓC</span>
   <span className="aquacare-violet-context__count">{tanks.length} bể theo dõi · {ongoing.length} vấn đề cần chú ý</span>
  </div>
  {error&&<HPZNotice type="error">{error}</HPZNotice>}
  <nav className="aquacare-v1-nav" aria-label="Khu vực AquaCare">
   {[['today','Hôm nay'],['tanks','Bể của tôi'],['care','Chăm sóc']].map(([id,name])=>
    <button type="button" key={id} className={area===id?'active':''} onClick={()=>setArea(id)}>{name}</button>)}
  </nav>

  {area==='today'&&<>
   <section className="aquacare-violet-area-intro" aria-label="Tổng quan hôm nay">
    <div><span className="aquacare-violet-area-intro__eyebrow">01 / CARE HOME</span>
      <h2>Hôm nay, mình chăm bể thế nào?</h2>
      <p>Mọi quan sát đều được lưu vào hành trình thật của bạn. Không cần có bể mới bắt đầu chăm sóc.</p>
    </div>
    <div className="aquacare-violet-quick-actions">
      <button type="button" onClick={()=>open('observation')}><span aria-hidden="true">✦</span> Ghi quan sát</button>
      <button type="button" onClick={()=>setArea('tanks')}><span aria-hidden="true">◈</span> Xem bể của tôi</button>
      <button type="button" onClick={()=>setArea('care')}><span aria-hidden="true">◉</span> Tiếp tục chăm sóc</button>
    </div>
   </section>
   <HPZCard tone="hero" className="aquacare-violet-care-launch"><HPZCardHeader eyebrow="HPZ · Người bạn đồng hành"
    title={relationship?.started?'Chào bạn, hôm nay thế nào?':'Chào mừng đến AquaCare'}
    meta="Chăm sóc có thể bắt đầu ngay cả khi bạn chưa có bể."/>
    <p>AquaCare lưu quan sát và diễn biến thực tế theo hồ sơ Customer, không chẩn đoán bệnh tự động.</p>
    <div className="hpz-actions">{!relationship?.started&&<HPZButton onClick={start} disabled={busy}>Bắt đầu AquaCare</HPZButton>}
     <HPZButton onClick={()=>open('concern')}>Báo vấn đề</HPZButton>
     <HPZButton variant="secondary" onClick={()=>open('guidance')}>Hỏi về chăm sóc</HPZButton></div>
   </HPZCard>
   <div className="hpz-grid hpz-grid--2 hpz-section">
    <HPZCard><HPZCardHeader eyebrow="TIẾP TỤC CHĂM SÓC" title={ongoing.length+' vấn đề đang theo dõi'}/>
     {ongoing.length?ongoing.slice(0,5).map(x=><button key={x.issue_id} type="button"
      className="aquacare-v1-list-btn" onClick={()=>openIncident(x.issue_id)}>
      <b>{types.find(t=>t[0]===x.issue_type)?.[1]||x.issue_type}</b>
      <small>{statusLabels[x.status]} · {x.tank_name||'Chưa xác định bể'}</small></button>):
      <HPZEmptyState title="Không có Incident đang mở">Bạn vẫn có thể hỏi hướng dẫn, ghi quan sát hoặc bổ sung bể khi thuận tiện.</HPZEmptyState>}
    </HPZCard>
    <HPZCard><HPZCardHeader eyebrow="CHĂM SÓC THƯỜNG NGÀY" title="Basic Normal Care"/>
     {(normal?.guidance||[]).map((s,i)=><p className="aquacare-v1-guidance" key={i}>{s}</p>)}
     <small>Nhật ký thực tế gần nhất: {normal?.latest_recorded_log?date(normal.latest_recorded_log.created_at):'Chưa có số đo nào được ghi.'}</small>
     <div className="hpz-actions"><HPZButton variant="secondary" onClick={()=>open('observation')}>Ghi quan sát / sự kiện</HPZButton></div>
    </HPZCard>
   </div>
   <HPZCard className="hpz-section"><HPZCardHeader eyebrow="HỒ SƠ BỂ" title="Bể của tôi"/>
    {tanks.length?<div className="aquacare-v1-tanks">{tanks.slice(0,3).map(t=><button type="button" key={t.tank_id}
      onClick={()=>{setSelected(t.tank_id);setArea('tanks')}}>{t.name} · {Number(t.fish_count||0)} cá</button>)}</div>:
      <HPZEmptyState title="Bạn chưa có bể">Vẫn có thể được hỗ trợ và lưu lịch sử chăm sóc trước khi khai báo bể.</HPZEmptyState>}
    <div className="hpz-actions"><HPZButton variant="secondary" onClick={onCreateTank}>+ Tạo bể</HPZButton></div>
   </HPZCard>
  </>}

  {area==='tanks'&&<>
   <section className="aquacare-violet-area-intro aquacare-violet-area-intro--compact" aria-label="Bể của tôi">
    <div><span className="aquacare-violet-area-intro__eyebrow">02 / MY AQUARIUM</span>
      <h2>Thế giới nhỏ, chăm sóc mỗi ngày.</h2>
      <p>Bể cá, nhật ký, cá từ Catalog và các thay đổi đều được lưu theo hồ sơ thật của bạn.</p>
    </div>
    <div className="aquacare-violet-overview-number"><b>{tanks.length}</b><small>BỂ ĐANG LƯU</small></div>
   </section>
   {tanks.length>1&&<div className="aquacare-violet-tank-rail" aria-label="Chuyển nhanh giữa các bể">{tanks.map(t=>
    <button type="button" key={t.tank_id} className={selected===t.tank_id?'active':''} onClick={()=>setSelected(t.tank_id)}
      aria-pressed={selected===t.tank_id}><span aria-hidden="true">◈</span><b>{t.name}</b><small>{Number(t.fish_count||0)} cá</small></button>)}</div>}
   <div className="aquacare-v1-toolbar"><strong>Bể của tôi</strong>
    <div className="hpz-actions">{tanks.length>0&&<select className="aquacare-picker" aria-label="Chọn bể"
      value={selected} onChange={e=>setSelected(e.target.value)}>
      {tanks.map(t=><option key={t.tank_id} value={t.tank_id}>{t.name}</option>)}
     </select>}
     <HPZButton onClick={onCreateTank}>+ Tạo bể</HPZButton></div>
   </div>
   {tanks.length?children:<HPZCard><HPZEmptyState title="Chưa có bể cá" action={<HPZButton onClick={onCreateTank}>Tạo bể đầu tiên</HPZButton>}>
    Bạn có thể tạo bể sau; Concern không bắt buộc có bể.</HPZEmptyState></HPZCard>}
  </>}

  {area==='care'&&<>
   <section className="aquacare-violet-area-intro aquacare-violet-area-intro--compact" aria-label="Chăm sóc liên tục">
    <div><span className="aquacare-violet-area-intro__eyebrow">03 / CARE JOURNEY</span>
      <h2>Chăm sóc là một hành trình, không phải một lần hỏi.</h2>
      <p>Theo dõi diễn biến, hướng dẫn, bằng chứng và sự hỗ trợ thật từ HPZ — tất cả trong một nơi.</p>
    </div>
    <div className="aquacare-violet-overview-number"><b>{ongoing.length}</b><small>ĐANG THEO DÕI</small></div>
   </section>
   <div className="aquacare-stage04-actions" aria-label="Tác vụ chăm sóc Stage04">
     <button type="button" onClick={()=>setArea('today')}><span aria-hidden="true">🌿</span><b>Hướng dẫn chăm sóc</b><small>Chăm sóc cơ bản hôm nay</small></button>
     <button type="button" onClick={()=>open('concern')}><span aria-hidden="true">🛟</span><b>Báo vấn đề</b><small>HPZ cùng bạn theo dõi</small></button>
     <button type="button" onClick={()=>open('guidance')}><span aria-hidden="true">💬</span><b>Hỏi về chăm sóc</b><small>Không bắt buộc tạo Incident</small></button>
     <button type="button" onClick={()=>document.querySelector('.aquacare-v1-history-filter')?.scrollIntoView({behavior:'smooth',block:'start'})}><span aria-hidden="true">📖</span><b>Lịch sử chăm sóc</b><small>Xem lại hành trình thực</small></button>
    </div>
    <div className="aquacare-v1-toolbar"><strong>Care Experience</strong>
    <div className="hpz-actions"><HPZButton onClick={()=>open('concern')}>+ Báo Concern</HPZButton>
    <HPZButton variant="secondary" onClick={()=>open('guidance')}>Hỏi hướng dẫn</HPZButton></div>
   </div>
   <div className="hpz-grid hpz-grid--2 hpz-section">
    <HPZCard><HPZCardHeader eyebrow="SỰ CỐ & THEO DÕI" title="Incident của bạn"/>
      <div className="aquacare-stage04-filter" role="group" aria-label="Lọc vấn đề chăm sóc">
       <button type="button" className={incidentFilter==='ONGOING'?'active':''} aria-pressed={incidentFilter==='ONGOING'} onClick={()=>setIncidentFilter('ONGOING')}>Đang theo dõi</button>
       <button type="button" className={incidentFilter==='ALL'?'active':''} aria-pressed={incidentFilter==='ALL'} onClick={()=>setIncidentFilter('ALL')}>Tất cả</button>
      </div>
     {visibleIncidents.length?visibleIncidents.map(x=><button key={x.issue_id} type="button" className={'aquacare-v1-list-btn '+(incidentId===x.issue_id?'active':'')}
      onClick={()=>setIncidentId(x.issue_id)}><b>{types.find(t=>t[0]===x.issue_type)?.[1]||x.issue_type}</b>
      <small>{statusLabels[x.status]||x.status} · {x.tank_name||'Không gắn bể'} · {date(x.created_at)}</small></button>):
     <HPZEmptyState title="Chưa có vấn đề nào">Quan sát hoặc hỏi hướng dẫn không tự tạo Incident.</HPZEmptyState>}
    </HPZCard>
    <HPZCard><HPZCardHeader eyebrow="SC04 · INCIDENT EXPERIENCE" title={incident?types.find(t=>t[0]===incident.issue_type)?.[1]||'Incident':'Chọn một vấn đề'}/>
     {incident?<div className="aquacare-v1-incident">
      <p><HPZStatus tone={incident.status==='RESOLVED'?'success':'warning'}>{statusLabels[incident.status]||incident.status}</HPZStatus></p>
      <p>Care Decision: <b>{incident.care_decision}</b> (không phải Incident State)</p>
      {incident.decision?.note&&<small>{incident.decision.note}</small>}
      <div className="aquacare-guidance">{(incident.guidance||[]).map((step,i)=>
       <div key={i} className={'aquacare-guide aquacare-guide--'+step.level}>
        <b>{step.title}</b><p>{step.body}</p>
       </div>)}</div>
      <p>HPZ Human: <b>{humanLabels[incident.human_state]||'Chưa rõ'}</b></p>
      <p>Ngữ cảnh: {tanks.find(t=>t.tank_id===incident.tank_id)?.name||'Chưa xác định bể'}</p>
      {incident.description&&<p>{incident.description}</p>}
      {incident.status==='RESOLVED'&&<p>Người xác nhận: {incident.resolution_by||'Dữ liệu cũ'} · {incident.resolution_basis||'Lịch sử cũ chưa có căn cứ chi tiết.'}</p>}
      {incident.status!=='RESOLVED'&&<div className="hpz-actions">
       <HPZButton variant="secondary" onClick={()=>open('EVIDENCE')}>+ Bằng chứng</HPZButton>
       <HPZButton variant="secondary" onClick={()=>open('OUTCOME')}>Diễn biến</HPZButton>
       <HPZButton variant="secondary" onClick={()=>open('NO_OUTCOME')}>Chưa có kết quả</HPZButton>
       {incident.human_state==='NONE'&&<HPZButton onClick={()=>open('REQUEST_HUMAN')}>Yêu cầu HPZ</HPZButton>}
       {['WAITING','INACTIVE_UNRESOLVED'].includes(incident.status)&&
         <HPZButton variant="secondary" onClick={()=>open('RESUME')}>Tiếp tục chăm sóc</HPZButton>}
       {['ACTIVE','WAITING'].includes(incident.status)&&<HPZButton variant="secondary" onClick={()=>open('CONFIRM_RESOLUTION')}>Xác nhận kết quả</HPZButton>}
      </div>}
      {incident.status==='RESOLVED'&&<HPZButton onClick={()=>open('recurrence')}>Báo tái phát — Incident mới</HPZButton>}
      <h3>Diễn biến &amp; bằng chứng</h3>
      {viewEvents.length?viewEvents.map(x=><div className="aquacare-v1-event" key={x.event_id}>
        <b>{x.event_type}</b><small>{date(x.created_at)} · {x.actor_type}</small><p>{x.content}</p></div>):
        <p>Chưa có sự kiện nào.</p>}
     </div>:<HPZEmptyState title="Chọn Incident">Xem timeline, cung cấp bằng chứng và yêu cầu HPZ Human thực sự tiếp nhận.</HPZEmptyState>}
    </HPZCard>
   </div>
   <HPZCard className="hpz-section"><HPZCardHeader eyebrow="CARE HISTORY" title="Lịch sử chăm sóc liên tục"/>
    <label className="aquacare-v1-history-filter">Lọc theo bể
     <select value={historyTank} onChange={e=>setHistoryTank(e.target.value)}>
      <option value="">Toàn Customer</option>{tanks.map(x=><option value={x.tank_id} key={x.tank_id}>{x.name}</option>)}
     </select></label>
    {history.length?history.map(ev=><div className="aquacare-v1-event" key={ev.event_id}>
     <b>{ev.event_type}</b><small>{date(ev.created_at)} · {ev.actor_type||'Customer'} · {ev.tank_id?tanks.find(t=>t.tank_id===ev.tank_id)?.name||'Bể đã lưu':'Chưa gắn bể'}</small>
     <p>{ev.content}</p>{ev.issue_id&&<button type="button" className="aquacare-v1-text-button" onClick={()=>setIncidentId(ev.issue_id)}>Mở Incident →</button>}</div>):
     <HPZEmptyState title="Chưa có Care History">Bắt đầu chăm sóc hoặc ghi quan sát để tạo lịch sử thực tế.</HPZEmptyState>}
    {history.length<historyTotal&&<div className="hpz-actions"><HPZButton variant="secondary" type="button" onClick={loadMore}>Xem thêm lịch sử ({history.length}/{historyTotal})</HPZButton></div>}
   </HPZCard>
   <HPZCard className="hpz-section"><HPZCardHeader eyebrow="NORMAL CARE" title="Hướng dẫn chăm sóc cơ bản"/>
    {(normal?.guidance||[]).map((x,i)=><p key={i}>{x}</p>)}
    <div className="hpz-actions"><HPZButton variant="secondary" onClick={()=>open('observation')}>Ghi quan sát</HPZButton></div>
   </HPZCard>
  </>}

  {modal&&<HPZModal open wide onClose={()=>!busy&&setModal('')} title={{
    concern:'Báo Concern (không bắt buộc có bể)',observation:'Ghi nhận quan sát / sự kiện',
    guidance:'Hỏi hướng dẫn chăm sóc',recurrence:'Báo tái phát — Incident mới',
    EVIDENCE:'Bổ sung bằng chứng',OUTCOME:'Cập nhật diễn biến',
    NO_OUTCOME:'Ghi nhận chưa có kết quả',RESUME:'Tiếp tục chăm sóc',
    REQUEST_HUMAN:'Yêu cầu HPZ Human',CONFIRM_RESOLUTION:'Xác nhận kết quả có căn cứ'
   }[modal]||'Cập nhật Care'}>
    <form onSubmit={perform} className="aquacare-v1-form">
     {['concern','observation','guidance'].includes(modal)&&<>
      <HPZField as="select" label="Bể liên quan (không bắt buộc)" value={form.tank_id}
       onChange={e=>change('tank_id',e.target.value)}
       options={[{value:'',label:'Chưa xác định bể'},...tanks.map(x=>({value:x.tank_id,label:x.name}))]}/>
      {modal==='concern'&&<><HPZField as="select" label="Loại vấn đề"
       value={form.issue_type} onChange={e=>change('issue_type',e.target.value)}
       options={types.map(([value,label])=>({value,label}))}/>
       <HPZField as="select" label="Bắt đầu từ" value={form.onset} onChange={e=>change('onset',e.target.value)}
       options={['Hôm nay','Vài ngày trước','Khoảng một tuần trước','Không rõ'].map(x=>({value:x,label:x}))}/></>}
      {modal==='observation'&&<HPZField as="select" label="Loại ghi nhận" value={form.kind}
       onChange={e=>change('kind',e.target.value)}
       options={[{value:'OBSERVATION',label:'Quan sát'},{value:'EVENT',label:'Sự kiện'}]}/>}
     </>}
     {modal==='recurrence'&&<HPZField label="Thời điểm tái phát" value={form.onset} onChange={e=>change('onset',e.target.value)}/>}
     {modal==='EVIDENCE'&&<HPZNotice type="info">Media chưa hỗ trợ upload thật ở V1. Chỉ lưu mô tả/bằng chứng dạng văn bản; không hiển thị tệp giả.</HPZNotice>}
     {modal==='REQUEST_HUMAN'&&<HPZNotice type="info">AquaCare ghi nhận yêu cầu thực tế. Chỉ khi nhân viên HPZ thao tác qua quyền Admin thì trạng thái mới là Đã tiếp nhận.</HPZNotice>}
     {modal==='guidance'&&<HPZNotice type="info">Câu hỏi được lưu trong Care History; không tự tạo Incident và chưa có xác nhận HPZ tiếp nhận.</HPZNotice>}
     {modal==='NO_OUTCOME'&&<HPZNotice type="info">Không có kết quả không đồng nghĩa đã giải quyết; Incident State được giữ nguyên.</HPZNotice>}
     <HPZField as="textarea" label={modal==='CONFIRM_RESOLUTION'?'Kết quả & căn cứ xác nhận':modal==='guidance'?'Câu hỏi':'Mô tả / thông tin thực tế'}
      required={['observation','guidance','recurrence','EVIDENCE','OUTCOME','RESUME','CONFIRM_RESOLUTION'].includes(modal)}
      maxLength={modal==='concern'?800:3000} value={form.content} onChange={e=>change('content',e.target.value)}
      placeholder="Chỉ ghi thông tin thực tế; không suy đoán dữ liệu chưa đo."/>
     {modal==='CONFIRM_RESOLUTION'&&<label className="aquacare-v1-confirm">
       <input type="checkbox" checked={form.confirmed} onChange={e=>change('confirmed',e.target.checked)}/>
       Tôi xác nhận sự cố đã có kết quả với căn cứ ở trên.
      </label>}
     <div className="hpz-actions"><HPZButton type="button" variant="secondary" onClick={()=>setModal('')}>Hủy</HPZButton>
      <HPZButton disabled={busy||(modal==='CONFIRM_RESOLUTION'&&!form.confirmed)}>
       {busy?'Đang lưu…':'Lưu vào Care History'}</HPZButton></div>
    </form>
   </HPZModal>}
 </div>;
}
