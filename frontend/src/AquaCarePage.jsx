import React,{useEffect,useMemo,useState}from'react';
import{aquaCareApi}from'./ecosystem-api.js';
import{publicApi}from'./api.js';
import{normalizeCatalogFish,filterCatalogFish,addCatalogFishSelection}from'./aquacare-fish-picker-model.js';
import{AquaTankCanvas}from'./AquaTankCanvas.jsx';
import{AquaCareWorkspace}from'./AquaCareV1Experience.jsx';
import{HPZAppShell,HPZContainer,HPZPageHeader,HPZButton,HPZCard,HPZCardHeader,HPZKpi,HPZTabs,HPZField,HPZModal,HPZNotice,HPZStatus,HPZEmptyState,HPZLoading}from'./ui/HPZUI.jsx';

const dt=value=>value?new Date(value).toLocaleString('vi-VN'):'-';
const issueTone=type=>['death'].includes(type)?'danger':['gasp','filter','water'].includes(type)?'warning':'info';
const waterLabel={clear:'Trong / không mùi',cloudy:'Đục / có mùi',green:'Xanh / nhiều rêu',unknown:'Chưa rõ'};
const filterLabel={ok:'Bình thường',weak:'Dòng yếu',off:'Không chạy',unknown:'Chưa rõ'};
const filterOptions=['Tràn trên','Tràn dưới','Bakki / giàn mưa','Lọc thùng','Lọc vách','Lọc treo / thác','Lọc mút / bio','Khác / chưa rõ'];
const emptySpecies=()=>({species_name:'',quantity:1,source:'MANUAL'});

function TankForm({tank,onClose,onSaved}){
  const existing=(tank?.items||[]).filter(x=>x.item_type==='FISH'&&x.source!=='HPZ_ORDER'&&!x.removed_at);
  const[form,setForm]=useState({name:tank?.name||'',estimated_volume_l:tank?.estimated_volume_l||'',tank_type:tank?.tank_type||'AQUARIUM',length_cm:tank?.length_cm||'',width_cm:tank?.width_cm||'',height_cm:tank?.height_cm||'',filter_type:tank?.filter_type||'Lọc thùng',has_air:tank?.has_air!==false,species:existing.map(x=>({product_id:x.product_id||null,species_name:x.species_name||x.product_name||'',quantity:x.quantity,source:x.source||'MANUAL'}))});
  const[catalogFish,setCatalogFish]=useState([]),[catalogLoading,setCatalogLoading]=useState(true),[catalogError,setCatalogError]=useState('');
  const[fishSearch,setFishSearch]=useState(''),[pickId,setPickId]=useState(''),[pickQty,setPickQty]=useState(1);
  const[busy,setBusy]=useState(false),[error,setError]=useState('');
  const set=(k,v)=>setForm(x=>({...x,[k]:v}));
  const setSpecies=(i,k,v)=>setForm(x=>({...x,species:x.species.map((s,n)=>n===i?{...s,[k]:v}:s)}));
  const removeSpecies=i=>setForm(x=>({...x,species:x.species.filter((_,n)=>n!==i)}));

  useEffect(()=>{let active=true;setCatalogLoading(true);publicApi.listProducts({}).then(r=>{if(!active)return;const items=normalizeCatalogFish(r.items||[]);setCatalogFish(items);setCatalogError('');setPickId(current=>current||items[0]?.product_id||'')}).catch(e=>active&&setCatalogError(e.message)).finally(()=>active&&setCatalogLoading(false));return()=>{active=false}},[]);
  const filteredFish=useMemo(()=>filterCatalogFish(catalogFish,fishSearch),[catalogFish,fishSearch]);
  useEffect(()=>{setPickId(current=>filteredFish.some(x=>x.product_id===current)?current:(filteredFish[0]?.product_id||''))},[filteredFish]);
  const catalogById=useMemo(()=>new Map(catalogFish.map(x=>[x.product_id,x])),[catalogFish]);
  const catalogRows=form.species.map((s,i)=>({s,i})).filter(x=>x.s.product_id);
  const manualRows=form.species.map((s,i)=>({s,i})).filter(x=>!x.s.product_id);
  const addCatalogFish=()=>{const product=catalogById.get(pickId);if(!product)return;setForm(x=>({...x,species:addCatalogFishSelection(x.species,product,pickQty)}));setPickQty(1)};

  const submit=async e=>{e.preventDefault();setBusy(true);setError('');try{
    const body={...form,estimated_volume_l:Number(form.estimated_volume_l),length_cm:form.length_cm===''?null:Number(form.length_cm),width_cm:form.width_cm===''?null:Number(form.width_cm),height_cm:form.height_cm===''?null:Number(form.height_cm),species:form.species.filter(x=>x.product_id||x.species_name.trim()).map(x=>({...x,quantity:Number(x.quantity)}))};
    const saved=tank?await aquaCareApi.updateTank(tank.tank_id,body):await aquaCareApi.createTank(body);onSaved(saved)
  }catch(err){setError(err.message)}finally{setBusy(false)}};

  return <HPZModal open title={tank?'Sửa thông tin bể':'Tạo bể mới'} subtitle="Hồ sơ bể được lưu theo customer_id trong AquaCare." onClose={onClose} wide>
    {error&&<HPZNotice type="error">{error}</HPZNotice>}<form onSubmit={submit}>
      <div className="hpz-grid hpz-grid--2"><HPZField label="Tên bể *" value={form.name} onChange={e=>set('name',e.target.value)} required maxLength={70}/><HPZField label="Thể tích ước tính (lít) *" type="number" min="1" max="50000" value={form.estimated_volume_l} onChange={e=>set('estimated_volume_l',e.target.value)} required/><HPZField label="Loại bể" as="select" value={form.tank_type} onChange={e=>set('tank_type',e.target.value)} options={[{value:'AQUARIUM',label:'Bể cá'},{value:'PLANTED',label:'Bể thủy sinh'},{value:'POND',label:'Hồ / pond'},{value:'OTHER',label:'Khác'}]}/><HPZField label="Hệ lọc" as="select" value={form.filter_type} onChange={e=>set('filter_type',e.target.value)} options={filterOptions.map(x=>({value:x,label:x}))}/><HPZField label="Dài (cm)" type="number" min="0" step="0.1" value={form.length_cm} onChange={e=>set('length_cm',e.target.value)}/><HPZField label="Rộng (cm)" type="number" min="0" step="0.1" value={form.width_cm} onChange={e=>set('width_cm',e.target.value)}/><HPZField label="Cao (cm)" type="number" min="0" step="0.1" value={form.height_cm} onChange={e=>set('height_cm',e.target.value)}/><HPZField label="Sủi / chuyển động mặt nước" as="select" value={form.has_air?'yes':'no'} onChange={e=>set('has_air',e.target.value==='yes')} options={[{value:'yes',label:'Có'},{value:'no',label:'Chưa có / không rõ'}]}/></div>

      <div className="aquacare-form-section"><b>Chọn cá từ Catalog</b><small>Danh sách lấy trực tiếp từ các sản phẩm cá đang Published trong Catalog. Chọn cá ở đây để AquaCare liên kết đúng product_id và dùng được ảnh thật khi Catalog có ảnh.</small></div>
      {catalogError&&<HPZNotice type="warning">Không tải được danh sách cá Catalog: {catalogError}. Dữ liệu cá đang có trong bể vẫn được giữ nguyên.</HPZNotice>}
      <div className="aquacare-catalog-picker">
        <HPZField label="Tìm cá" value={fishSearch} onChange={e=>setFishSearch(e.target.value)} placeholder="Nhập tên cá, tên khoa học hoặc mã sản phẩm…"/>
        <HPZField label="Cá trong Catalog" as="select" value={pickId} onChange={e=>setPickId(e.target.value)} disabled={catalogLoading||!filteredFish.length} options={catalogLoading?[{value:'',label:'Đang tải danh sách cá…'}]:filteredFish.length?filteredFish.map(x=>({value:x.product_id,label:x.name+(x.secondary_name?' · '+x.secondary_name:'')+(x.sale_status?' · '+x.sale_status:'')})):[{value:'',label:'Không tìm thấy cá phù hợp'}]}/>
        <HPZField label="Số lượng" type="number" min="1" max="10000" value={pickQty} onChange={e=>setPickQty(e.target.value)}/>
        <HPZButton type="button" onClick={addCatalogFish} disabled={catalogLoading||!catalogById.get(pickId)}>+ Thêm vào bể</HPZButton>
      </div>

      <div className="aquacare-form-section"><b>Cá đã chọn</b><small>{catalogRows.length?catalogRows.length+' loài từ Catalog':'Chưa chọn cá từ Catalog.'}</small></div>
      {catalogRows.length?<div className="aquacare-selected-fish">{catalogRows.map(({s,i})=>{const p=catalogById.get(s.product_id);return <div className="aquacare-selected-fish__row" key={s.product_id||i}>
        <div className="aquacare-selected-fish__media">{p?.primary_image_url?<img src={p.primary_image_url} alt={p.name}/>:<span>🐟</span>}</div>
        <div className="aquacare-selected-fish__name"><b>{p?.name||s.species_name}</b><small>{p?.secondary_name||s.product_id}{p?.sale_status?' · '+p.sale_status:''}</small></div>
        <HPZField label="Số con" type="number" min="1" max="10000" value={s.quantity} onChange={e=>setSpecies(i,'quantity',e.target.value)}/>
        <HPZButton type="button" variant="danger" onClick={()=>removeSpecies(i)}>Xóa</HPZButton>
      </div>})}</div>:<HPZEmptyState title="Chưa có cá từ Catalog">Dùng ô tìm kiếm và dropdown phía trên để thêm cá thực tế đang có trong Catalog.</HPZEmptyState>}

      <div className="aquacare-form-section aquacare-form-section--manual"><b>Cá ngoài Catalog / dữ liệu thủ công cũ</b><small>Giữ lại để không mất những loài đã nhập thủ công trước đây. Cá mới nên ưu tiên chọn từ Catalog.</small></div>
      {manualRows.length>0&&<div className="aquacare-species-editor">{manualRows.map(({s,i})=><div className="aquacare-species-row" key={'manual-'+i}><HPZField label="Tên loài" value={s.species_name} onChange={e=>setSpecies(i,'species_name',e.target.value)} placeholder="Tên cá ngoài Catalog"/><HPZField label="Số con" type="number" min="1" value={s.quantity} onChange={e=>setSpecies(i,'quantity',e.target.value)}/><HPZButton type="button" variant="danger" onClick={()=>removeSpecies(i)}>Xóa</HPZButton></div>)}</div>}
      <div className="hpz-actions"><HPZButton type="button" variant="secondary" onClick={()=>setForm(x=>({...x,species:[...x.species,emptySpecies()]}))}>+ Thêm cá ngoài Catalog</HPZButton><span className="aquacare-action-spacer"/><HPZButton type="button" variant="ghost" onClick={onClose}>Hủy</HPZButton><HPZButton disabled={busy}>{busy?'Đang lưu…':'Lưu bể'}</HPZButton></div>
    </form>
  </HPZModal>;
}

function LogForm({tankId,onClose,onSaved}){
  const[form,setForm]=useState({water_state:'clear',filter_state:'ok',temperature_c:'',ph:'',nh3_nh4_mg_l:'',no2_mg_l:'',note:''}),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const set=(k,v)=>setForm(x=>({...x,[k]:v}));
  const submit=async e=>{e.preventDefault();setBusy(true);setError('');try{await aquaCareApi.addLog(tankId,form);onSaved()}catch(err){setError(err.message)}finally{setBusy(false)}};
  return <HPZModal open title="Ghi nhật ký hôm nay" subtitle="Cập nhật nước, lọc và các chỉ số bạn đã đo." onClose={onClose} wide>{error&&<HPZNotice type="error">{error}</HPZNotice>}<form onSubmit={submit}><div className="hpz-grid hpz-grid--2"><HPZField label="Tình trạng nước" as="select" value={form.water_state} onChange={e=>set('water_state',e.target.value)} options={Object.entries(waterLabel).map(([value,label])=>({value,label}))}/><HPZField label="Lọc hôm nay" as="select" value={form.filter_state} onChange={e=>set('filter_state',e.target.value)} options={Object.entries(filterLabel).map(([value,label])=>({value,label}))}/><HPZField label="Nhiệt độ °C" type="number" min="0" max="45" step="0.1" value={form.temperature_c} onChange={e=>set('temperature_c',e.target.value)}/><HPZField label="pH" type="number" min="0" max="14" step="0.1" value={form.ph} onChange={e=>set('ph',e.target.value)}/><HPZField label="NH3/NH4 tổng mg/L" type="number" min="0" step="any" value={form.nh3_nh4_mg_l} onChange={e=>set('nh3_nh4_mg_l',e.target.value)}/><HPZField label="NO2 mg/L" type="number" min="0" step="any" value={form.no2_mg_l} onChange={e=>set('no2_mg_l',e.target.value)}/></div><HPZField label="Ghi chú chăm sóc" as="textarea" maxLength={500} value={form.note} onChange={e=>set('note',e.target.value)} placeholder="Cho ăn, thay nước, vệ sinh lọc..."/><div className="hpz-actions"><HPZButton type="button" variant="secondary" onClick={onClose}>Hủy</HPZButton><HPZButton disabled={busy}>{busy?'Đang lưu…':'Lưu nhật ký'}</HPZButton></div></form></HPZModal>;
}

function IssueForm({tank,onClose,onSaved}){
  const fish=(tank?.items||[]).filter(x=>x.item_type==='FISH'&&!x.removed_at),[form,setForm]=useState({issue_type:'',affected_tank_item_id:'',affected_count:'',onset:'Hôm nay',description:''}),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const set=(k,v)=>setForm(x=>({...x,[k]:v}));
  const types=[['','Chọn vấn đề'],['gasp','Cá thở gấp / nổi đầu'],['spots','Đốm lạ / nghi bệnh ngoài da'],['fin','Rách vây / vết thương'],['eating','Cá bỏ ăn / lờ đờ'],['water','Nước đục / có mùi'],['filter','Lọc / sủi gặp sự cố'],['death','Cá chết / xấu nhanh'],['other','Vấn đề khác']];
  const submit=async e=>{e.preventDefault();setBusy(true);setError('');try{await aquaCareApi.addIssue(tank.tank_id,{...form,affected_count:form.affected_count===''?0:Number(form.affected_count)});onSaved()}catch(err){setError(err.message)}finally{setBusy(false)}};
  return <HPZModal open title="Báo vấn đề mới" subtitle="AquaCare chỉ đưa hướng kiểm tra ban đầu dựa trên thông tin bể và nhật ký, không tự chẩn đoán bệnh." onClose={onClose} wide>{error&&<HPZNotice type="error">{error}</HPZNotice>}<form onSubmit={submit}><div className="hpz-grid hpz-grid--2"><HPZField label="Vấn đề chính *" as="select" value={form.issue_type} onChange={e=>set('issue_type',e.target.value)} options={types.map(([value,label])=>({value,label}))} required/><HPZField label="Loài bị ảnh hưởng" as="select" value={form.affected_tank_item_id} onChange={e=>set('affected_tank_item_id',e.target.value)} options={[{value:'',label:'Chưa rõ / toàn bể'},...fish.map(x=>({value:x.tank_item_id,label:(x.species_name||x.product_name||'Cá')+' · '+x.quantity+' con'}))]}/><HPZField label="Số cá bị ảnh hưởng" type="number" min="0" value={form.affected_count} onChange={e=>set('affected_count',e.target.value)}/><HPZField label="Bắt đầu từ" as="select" value={form.onset} onChange={e=>set('onset',e.target.value)} options={['Hôm nay','Vài ngày trước','Khoảng một tuần trước','Không rõ'].map(x=>({value:x,label:x}))}/></div><HPZField label="Mô tả và những gì đã thử" as="textarea" maxLength={800} value={form.description} onChange={e=>set('description',e.target.value)}/><div className="hpz-actions"><HPZButton type="button" variant="secondary" onClick={onClose}>Hủy</HPZButton><HPZButton variant="danger" disabled={busy}>{busy?'Đang ghi nhận…':'Ghi nhận vấn đề'}</HPZButton></div></form></HPZModal>;
}

function Overview({tank,purchased,onReload,onEdit,onLog,onIssue}){
  const latest=tank.logs?.[0]||{},fish=tank.items?.filter(x=>x.item_type==='FISH'&&!x.removed_at)||[],total=fish.reduce((s,x)=>s+Number(x.quantity||0),0),open=tank.issues?.filter(x=>x.status!=='RESOLVED')||[],openReminders=tank.reminders?.filter(x=>x.status!=='RESOLVED')||[];
  const attach=async item=>{await aquaCareApi.attachPurchased(tank.tank_id,{order_id:item.order_id,product_id:item.product_id});onReload()};
  return <>
    <HPZCard tone="hero" className="aquacare-tank-hero"><div><span className="hpz-eyebrow">BỂ ĐANG CHỌN</span><h2>{tank.name}</h2><p>{Number(tank.estimated_volume_l).toLocaleString('vi-VN')}L · {tank.filter_type||'Chưa rõ lọc'} · {total} cá · {fish.length} nhóm</p></div><HPZStatus tone={open.length?'warning':'success'}>{open.length?open.length+' vấn đề đang theo dõi':'Ổn định'}</HPZStatus></HPZCard>
    <div className="aquacare-overview-grid hpz-section"><HPZCard><AquaTankCanvas tank={tank}/><div className="hpz-actions aquacare-action-bar"><HPZButton onClick={onLog}>+ Ghi nhật ký</HPZButton><HPZButton variant="danger" onClick={onIssue}>⚠ Báo vấn đề</HPZButton><HPZButton variant="secondary" onClick={onEdit}>Sửa bể</HPZButton></div></HPZCard><HPZCard><HPZCardHeader eyebrow="TÌNH TRẠNG HÔM NAY" title="Thông số gần nhất" meta={latest.created_at?'Cập nhật '+dt(latest.created_at):'Chưa có nhật ký'}/><div className="aquacare-metrics"><div><span>Nước</span><b>{waterLabel[latest.water_state]||'Chưa rõ'}</b></div><div><span>Lọc</span><b>{filterLabel[latest.filter_state]||'Chưa rõ'}</b></div><div><span>Nhiệt độ</span><b>{latest.temperature_c!=null?latest.temperature_c+'°C':'-'}</b></div><div><span>pH</span><b>{latest.ph??'-'}</b></div><div><span>NH3/NH4</span><b>{latest.nh3_nh4_mg_l??'-'}</b></div><div><span>NO2</span><b>{latest.no2_mg_l??'-'}</b></div></div></HPZCard></div>
    <div className="hpz-grid hpz-grid--2 hpz-section"><HPZCard><HPZCardHeader eyebrow="VIỆC CẦN LÀM" title="Nhắc chăm sóc"/>{openReminders.length?openReminders.slice(0,6).map(x=><div className="aquacare-list-row" key={x.reminder_id}><div><b>{x.title}</b><small>{x.due_at?dt(x.due_at):'Không đặt hạn'}</small></div><HPZButton variant="ghost" onClick={async()=>{await aquaCareApi.updateReminder(x.reminder_id,{status:'DONE'});onReload()}}>Xong</HPZButton></div>):<HPZEmptyState title="Chưa có nhắc việc">Bạn có thể quản lý các việc định kỳ trong AquaCare ở phase tiếp theo.</HPZEmptyState>}</HPZCard><HPZCard><HPZCardHeader eyebrow="HOẠT ĐỘNG GẦN ĐÂY" title="Nhật ký"/>{tank.logs?.length?tank.logs.slice(0,6).map(x=><div className="aquacare-list-row" key={x.log_id}><div><b>{waterLabel[x.water_state]||'Nhật ký chăm sóc'}</b><small>{dt(x.created_at)} · Lọc {filterLabel[x.filter_state]||'-'}{x.note?' · '+x.note:''}</small></div></div>):<HPZEmptyState title="Chưa có nhật ký">Nhấn “Ghi nhật ký” để bắt đầu theo dõi.</HPZEmptyState>}</HPZCard></div>
    {purchased.length>0&&<HPZCard className="hpz-section"><HPZCardHeader eyebrow="TỪ CRM ORDERS" title="Bạn vừa mua tại HPZ" meta="Chỉ thêm vào bể sau khi bạn chọn"/><div className="aquacare-purchases">{purchased.slice(0,8).map(x=><div key={x.order_id+'-'+x.product_id}><div><b>{x.product_name}</b><small>{x.quantity} · {x.order_code} · {x.order_date?new Date(x.order_date).toLocaleDateString('vi-VN'):'-'}</small></div><HPZButton variant="secondary" onClick={()=>attach(x)}>Thêm vào {tank.name}</HPZButton></div>)}</div></HPZCard>}
    <HPZCard className="hpz-section"><HPZCardHeader eyebrow="SỰ CỐ ĐANG THEO DÕI" title={open.length?open.length+' vấn đề đang mở':'Không có vấn đề đang mở'}/>{open.length?open.map(x=><IssueCard key={x.issue_id} issue={x} onReload={onReload}/>):<HPZEmptyState title="Bể chưa ghi nhận sự cố">Nếu có dấu hiệu bất thường, dùng “Báo vấn đề” để lưu tình trạng và nhận checklist ban đầu.</HPZEmptyState>}</HPZCard>
  </>;
}

function IssueCard({issue,onReload}){
  return <article className="aquacare-issue"><div className="aquacare-issue__head"><div><HPZStatus tone={issueTone(issue.issue_type)}>{issue.status==='RESOLVED'?'ĐÃ XÁC NHẬN':'ĐANG CHĂM SÓC'}</HPZStatus><h3>{issue.label}</h3><small>{dt(issue.created_at)} · {issue.affected_species_name||'Chưa rõ loài'}{issue.affected_count?' · '+issue.affected_count+' con':''} · {issue.onset}</small></div>{issue.status!=='RESOLVED'&&<HPZButton variant="secondary" onClick={async()=>{const basis=window.prompt('Căn cứ xác nhận kết quả (ít nhất 8 ký tự):');if(!basis||basis.trim().length<8)return;if(!window.confirm('Bạn xác nhận đã có kết quả với căn cứ vừa nhập?'))return;await aquaCareApi.updateIssue(issue.issue_id,{status:'RESOLVED',confirmed:true,resolution_basis:basis.trim()});onReload()}}>Xác nhận kết quả</HPZButton>}</div>{issue.description&&<p>{issue.description}</p>}<div className="aquacare-guidance">{(issue.guidance||[]).map((g,i)=><div key={i} className={'aquacare-guide aquacare-guide--'+g.level}><b>{g.title}</b><p>{g.body}</p></div>)}</div></article>;
}

function LogsTab({tank}){return <HPZCard><HPZCardHeader eyebrow="NHẬT KÝ THEO DÕI" title={tank.name}/>{tank.logs?.length?tank.logs.map(x=><div className="aquacare-log-row" key={x.log_id}><time>{dt(x.created_at)}</time><div><b>{waterLabel[x.water_state]} · Lọc {filterLabel[x.filter_state]}</b><span>{x.temperature_c!=null?'Nhiệt độ '+x.temperature_c+'°C · ':''}{x.ph!=null?'pH '+x.ph+' · ':''}{x.nh3_nh4_mg_l!=null?'NH3/NH4 '+x.nh3_nh4_mg_l+' · ':''}{x.no2_mg_l!=null?'NO2 '+x.no2_mg_l:''}</span>{x.note&&<p>{x.note}</p>}</div></div>):<HPZEmptyState title="Chưa có nhật ký"/>}</HPZCard>}
function IssuesTab({tank,onReload}){return <HPZCard><HPZCardHeader eyebrow="SỰ CỐ & QUY TRÌNH" title={tank.name}/>{tank.issues?.length?tank.issues.map(x=><IssueCard key={x.issue_id} issue={x} onReload={onReload}/>):<HPZEmptyState title="Chưa có vấn đề nào">Bể vẫn có thể ghi nhật ký bình thường.</HPZEmptyState>}</HPZCard>}

export function AquaCarePage(){
  const[careRevision,setCareRevision]=useState(0);
  const[tanks,setTanks]=useState([]),[selected,setSelected]=useState(''),[detail,setDetail]=useState(null),[purchased,setPurchased]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(null),[tab,setTab]=useState('overview'),[modal,setModal]=useState('');
  const loadList=async(prefer)=>{const r=await aquaCareApi.listTanks();setTanks(r.items||[]);const next=prefer||selected||r.items?.[0]?.tank_id||'';setSelected(next);return next};
  const loadDetail=async id=>{if(!id){setDetail(null);return}setDetail(await aquaCareApi.getTank(id))};
  const reload=async(prefer)=>{try{const id=await loadList(prefer);await Promise.all([loadDetail(id),aquaCareApi.purchasedItems().then(r=>setPurchased(r.items||[])).catch(()=>setPurchased([]))]);setError(null);setCareRevision(v=>v+1)}catch(e){setError(e)}};
  useEffect(()=>{document.title='AquaCare — HPZ Aquaroom';(async()=>{try{await reload()}finally{setLoading(false)}})()},[]);
  useEffect(()=>{if(selected&&!loading)loadDetail(selected).catch(setError)},[selected]);
  const currentSummary=useMemo(()=>tanks.find(x=>x.tank_id===selected),[tanks,selected]);
  if(loading)return <HPZAppShell active="care" className="aquacare-violet-app aquacare-v1-replacement aquacare-violet-gate"><HPZContainer><HPZLoading label="Đang mở AquaCare…"/></HPZContainer></HPZAppShell>;
  if(error?.status===401)return <HPZAppShell active="care" className="aquacare-violet-app aquacare-v1-replacement aquacare-violet-gate"><HPZContainer><HPZPageHeader eyebrow="AQUACARE" title="Bể cá của bạn, luôn trong tầm mắt." subtitle="Đăng nhập để tạo bể số, ghi nhật ký và theo dõi sự cố."/><HPZCard><HPZEmptyState title="Bạn chưa đăng nhập" action={<HPZButton href="/login">Đăng nhập</HPZButton>}>AquaCare gắn dữ liệu với tài khoản HPZ của bạn.</HPZEmptyState></HPZCard></HPZContainer></HPZAppShell>;
  if(error?.code==='CUSTOMER_LINK_REQUIRED'||error?.status===409)return <HPZAppShell active="care" className="aquacare-violet-app aquacare-v1-replacement aquacare-violet-gate"><HPZContainer><HPZPageHeader eyebrow="AQUACARE" title="Liên kết hồ sơ HPZ để bắt đầu" subtitle="AquaCare dùng customer_id ổn định để bảo đảm dữ liệu bể không bị tách khỏi tài khoản thành viên."/><HPZCard><HPZEmptyState title="Chưa liên kết số điện thoại" action={<HPZButton href="/me">Mở My HPZ để liên kết</HPZButton>}>Sau khi liên kết, quay lại AquaCare để tạo bể.</HPZEmptyState></HPZCard></HPZContainer></HPZAppShell>;
  return <HPZAppShell active="care" className="aquacare-violet-app aquacare-v1-replacement"><HPZContainer className="aquacare-violet-container">
    <header className="aquacare-violet-hero" aria-label="AquaCare Violet Abyss">
      <div className="aquacare-violet-hero-copy"><span className="aquacare-violet-kicker">HPZ AQUAROOM <span aria-hidden="true">/</span> AQUACARE</span>
      <h1>Chăm sóc cùng HPZ</h1>
      <p>Hôm nay · Bể của tôi · Chăm sóc. Đồng hành với thế giới dưới nước của bạn.</p>
      <span className="aquacare-violet-caption">VIOLET ABYSS / V1 · FUNCTIONAL UX V1.1</span></div>
      <div className="aquacare-violet-hero-mark" aria-hidden="true"><span>HPZ</span><small>AQUACARE</small></div>
    </header>
    {error&&<HPZNotice type="error">{error.message}</HPZNotice>}
    <main className="aquacare-violet-functional" id="aquacare-main">
      <AquaCareWorkspace tanks={tanks} selected={selected} setSelected={setSelected} revision={careRevision} onCreateTank={()=>setModal('tank-new')} onReload={()=>reload(selected)}>
        {!detail?<HPZCard><HPZEmptyState title="Chưa có bể cá" action={<HPZButton onClick={()=>setModal('tank-new')}>Tạo bể đầu tiên</HPZButton>}>Bắt đầu bằng tên bể, thể tích, hệ lọc và các loài cá đang nuôi.</HPZEmptyState></HPZCard>:<><div className="hpz-kpi-grid hpz-section"><HPZKpi label="Thể tích" value={Number(detail.estimated_volume_l).toLocaleString('vi-VN')+'L'} meta={detail.tank_type}/><HPZKpi label="Số cá" value={(detail.items||[]).filter(x=>x.item_type==='FISH').reduce((s,x)=>s+Number(x.quantity||0),0)} meta={(detail.items||[]).filter(x=>x.item_type==='FISH').length+' nhóm'}/><HPZKpi label="Sự cố mở" value={(detail.issues||[]).filter(x=>x.status!=='RESOLVED').length} meta="Đang theo dõi"/><HPZKpi label="Nhật ký" value={(detail.logs||[]).length} meta={detail.logs?.[0]?'Gần nhất '+dt(detail.logs[0].created_at):'Chưa có'}/></div><HPZTabs value={tab} onChange={setTab} items={[['overview','Tổng quan'],['logs','Nhật ký'],['issues','Sự cố']]}/>{tab==='overview'&&<Overview tank={detail} purchased={purchased} onReload={()=>reload(selected)} onEdit={()=>setModal('tank-edit')} onLog={()=>setModal('log')} onIssue={()=>setModal('issue')}/>} {tab==='logs'&&<LogsTab tank={detail}/>} {tab==='issues'&&<IssuesTab tank={detail} onReload={()=>reload(selected)}/>}</>}
      </AquaCareWorkspace>
    </main>
    {modal==='tank-new'&&<TankForm onClose={()=>setModal('')} onSaved={async x=>{setModal('');await reload(x.tank_id)}}/>}{modal==='tank-edit'&&detail&&<TankForm tank={detail} onClose={()=>setModal('')} onSaved={async x=>{setModal('');await reload(x.tank_id)}}/>}{modal==='log'&&detail&&<LogForm tankId={detail.tank_id} onClose={()=>setModal('')} onSaved={async()=>{setModal('');await reload(detail.tank_id)}}/>}{modal==='issue'&&detail&&<IssueForm tank={detail} onClose={()=>setModal('')} onSaved={async()=>{setModal('');await reload(detail.tank_id)}}/>}
  </HPZContainer></HPZAppShell>;
}
