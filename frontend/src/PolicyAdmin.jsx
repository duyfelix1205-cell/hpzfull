import React,{useEffect,useState}from'react';
import{adminApi}from'./api.js';

const fallback={enabled:true,title:'Bảng chính sách',columns:['Hạng mục','Nội dung'],rows:[]};
export function PolicyAdmin(){
 const[data,setData]=useState(null),[message,setMessage]=useState(''),[saving,setSaving]=useState(false);
 useEffect(()=>{adminApi.getPolicy().then(r=>setData(r.content||fallback)).catch(e=>setMessage(e.message))},[]);
 const set=(key,value)=>setData(x=>({...x,[key]:value}));
 const addColumn=()=>setData(x=>({...x,columns:[...x.columns,`Cột ${x.columns.length+1}`],rows:x.rows.map(r=>[...r,''])}));
 const removeColumn=i=>setData(x=>x.columns.length<=1?x:{...x,columns:x.columns.filter((_,n)=>n!==i),rows:x.rows.map(r=>r.filter((_,n)=>n!==i))});
 const renameColumn=(i,value)=>setData(x=>({...x,columns:x.columns.map((c,n)=>n===i?value:c)}));
 const addRow=()=>setData(x=>({...x,rows:[...x.rows,x.columns.map(()=>'')]}));
 const removeRow=i=>setData(x=>({...x,rows:x.rows.filter((_,n)=>n!==i)}));
 const cell=(ri,ci,value)=>setData(x=>({...x,rows:x.rows.map((r,n)=>n===ri?r.map((v,m)=>m===ci?value:v):r)}));
 const save=async()=>{setSaving(true);try{const r=await adminApi.updatePolicy(data);setData(r.content);setMessage('Đã lưu bảng chính sách. Nội dung cũ trên trang Chính sách vẫn được giữ nguyên.')}catch(e){setMessage(e.message)}finally{setSaving(false)}};
 if(!data)return <main className="admin-shell"><header className="admin-top"><div><p className="eyebrow">NEXORA PRODUCT CATALOG</p><h1>Chính sách</h1></div></header>{message&&<div className="notice">{message}</div>}<section className="panel">Đang tải…</section></main>;
 return <main className="admin-shell"><header className="admin-top"><div><p className="eyebrow">NEXORA PRODUCT CATALOG</p><h1>Chính sách</h1><p>Bảng tùy chỉnh thêm mới; nội dung chính sách hiện tại không bị xóa hay ghi đè.</p></div><div><a className="admin-link-button" href="/chinhsach.html">Viewer ↗</a><button onClick={save} disabled={saving}>{saving?'Đang lưu…':'Lưu'}</button></div></header>{message&&<div className="notice">{message}</div>}<section className="panel admin-tool-panel"><label className="check"><input type="checkbox" checked={!!data.enabled} onChange={e=>set('enabled',e.target.checked)}/> Hiển thị bảng trên Viewer</label><label style={{display:'grid',gap:6,maxWidth:640,margin:'16px 0'}}>Tiêu đề bảng<input value={data.title||''} onChange={e=>set('title',e.target.value)}/></label><div className="policy-admin-actions"><button onClick={addColumn}>+ Thêm cột</button><button onClick={addRow}>+ Thêm dòng</button></div><div className="policy-table-scroll"><table className="policy-edit-table"><thead><tr>{data.columns.map((c,i)=><th key={i}><input value={c} onChange={e=>renameColumn(i,e.target.value)}/><button className="danger mini" disabled={data.columns.length<=1} onClick={()=>removeColumn(i)}>− Cột</button></th>)}<th>Thao tác</th></tr></thead><tbody>{data.rows.map((row,ri)=><tr key={ri}>{data.columns.map((_,ci)=><td key={ci}><textarea rows="3" value={row[ci]||''} onChange={e=>cell(ri,ci,e.target.value)}/></td>)}<td><button className="danger mini" onClick={()=>removeRow(ri)}>Xóa dòng</button></td></tr>)}</tbody></table></div>{!data.rows.length&&<p className="muted">Chưa có dòng. Nhấn “+ Thêm dòng” để bắt đầu.</p>}<div style={{display:'flex',justifyContent:'flex-end',marginTop:16}}><button onClick={save} disabled={saving}>{saving?'Đang lưu…':'Lưu bảng chính sách'}</button></div></section></main>;
}
