import React,{useEffect,useMemo,useState}from'react';
import{adminApi}from'./api.js';

export function LookupSelect({fieldKey,value,onChange,allowCreate=true,label='Tùy chọn'}){
 const[items,setItems]=useState([]),[busy,setBusy]=useState(false),[open,setOpen]=useState(false),[message,setMessage]=useState('');
 const load=async()=>{setBusy(true);try{const r=await adminApi.listLookupOptions(fieldKey);setItems(r.items||[]);setMessage('')}catch(e){setMessage(e.message)}finally{setBusy(false)}};
 useEffect(()=>{load()},[fieldKey]);
 const values=useMemo(()=>{const out=[...items];if(value&&!out.some(x=>x.value===value))out.unshift({option_id:`current:${value}`,value,label:value,system_locked:false,current_only:true});return out},[items,value]);
 const add=async()=>{const text=prompt(`Thêm ${label}`);if(!text?.trim())return;try{const r=await adminApi.createLookupOption(fieldKey,{value:text.trim(),label:text.trim()});await load();onChange(r.value);setOpen(true)}catch(e){alert(e.message)}};
 const edit=async item=>{const text=prompt(`Sửa ${label}`,item.label);if(!text?.trim()||text.trim()===item.label)return;try{await adminApi.updateLookupOption(fieldKey,item.option_id,{label:text.trim()});await load()}catch(e){alert(e.message)}};
 const remove=async item=>{if(item.current_only)return;if(!confirm(`Xóa “${item.label}” khỏi danh sách ${label}? Dữ liệu cá cũ đang dùng giá trị này sẽ không bị xóa.`))return;try{await adminApi.deleteLookupOption(fieldKey,item.option_id);await load()}catch(e){alert(e.message)}};
 return <div className="lookup-select"><div className="lookup-select-row"><select value={value||''} onChange={e=>onChange(e.target.value)} disabled={busy}><option value="">-- Chọn --</option>{values.map(x=><option key={x.option_id} value={x.value}>{x.label}</option>)}</select>{allowCreate&&<button type="button" className="lookup-mini" title="Thêm lựa chọn" onClick={add}>+</button>}<button type="button" className="lookup-mini" title="Quản lý lựa chọn" onClick={()=>setOpen(x=>!x)}>±</button></div>{message&&<small className="error">{message}</small>}{open&&<div className="lookup-manager">{items.map(x=><div key={x.option_id}><span>{x.label}</span><code>{x.value}</code><button type="button" onClick={()=>edit(x)}>Sửa</button><button type="button" className="danger mini" disabled={x.system_locked} title={x.system_locked?'Giá trị kỹ thuật hệ thống, không thể xóa':''} onClick={()=>remove(x)}>−</button></div>)}{!items.length&&<small>Chưa có lựa chọn.</small>}</div>}</div>;
}
