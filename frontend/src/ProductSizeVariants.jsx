import React,{useEffect,useState}from'react';
import{adminApi}from'./api.js';
import'./product-variants.css';

const empty=()=>({variant_id:'',size_label:'',list_price:'',price_text:'',combo3:'',combo5:'',combo10:'',available_qty:'',is_active:true});
const normalize=v=>({
  variant_id:v?.variant_id||'',size_label:v?.size_label||'',list_price:v?.list_price??'',price_text:v?.price_text||'',available_qty:v?.available_qty??'',is_active:v?.is_active!==false,
  combo3:v?.combo_prices_text_json?.['3']||v?.combo_prices_text_json?.combo3||v?.combo_prices_json?.['3']||'',
  combo5:v?.combo_prices_text_json?.['5']||v?.combo_prices_text_json?.combo5||v?.combo_prices_json?.['5']||'',
  combo10:v?.combo_prices_text_json?.['10']||v?.combo_prices_text_json?.combo10||v?.combo_prices_json?.['10']||''
});
const numericCombo=v=>Object.fromEntries([['3',v.combo3],['5',v.combo5],['10',v.combo10]].map(([k,x])=>[k,String(x||'').replace(/\D/g,'')]).filter(([,x])=>x).map(([k,x])=>[k,Number(x)]));
const textCombo=v=>Object.fromEntries([['3',v.combo3],['5',v.combo5],['10',v.combo10]].filter(([,x])=>String(x||'').trim()));

export function ProductSizeVariants({productId}){
  const[items,setItems]=useState([]),[message,setMessage]=useState(''),[loading,setLoading]=useState(false),[ready,setReady]=useState(false);
  useEffect(()=>{
    let ok=true;
    setItems([]);setMessage('');setReady(false);
    if(!productId)return()=>{ok=false};
    setLoading(true);
    adminApi.listProductVariants(productId)
      .then(r=>{if(!ok)return;setItems((r.items||[]).map(normalize));setReady(true)})
      .catch(e=>{if(!ok)return;setMessage('Không tải được bộ giá size: '+e.message);setReady(false)})
      .finally(()=>ok&&setLoading(false));
    return()=>{ok=false};
  },[productId]);
  const patch=(i,k,val)=>setItems(xs=>xs.map((x,n)=>n===i?{...x,[k]:val}:x));
  const add=()=>{if(!ready)return;setItems(xs=>[...xs,empty()])};
  const remove=i=>setItems(xs=>xs.filter((_,n)=>n!==i));
  const save=async()=>{
    if(!ready||!productId){setMessage('Chưa tải xong dữ liệu size. Hệ thống không ghi đè dữ liệu hiện tại.');return}
    try{
      setLoading(true);
      const payload=items.map((v,i)=>({variant_id:v.variant_id||undefined,size_label:v.size_label,list_price:v.list_price,price_text:v.price_text,available_qty:v.available_qty,sort_order:i,is_active:v.is_active,combo_prices_json:numericCombo(v),combo_prices_text_json:textCombo(v)}));
      const r=await adminApi.saveProductVariants(productId,payload);
      setItems((r.items||[]).map(normalize));
      setMessage('Đã lưu bộ giá theo kích thước');
    }catch(e){setMessage(e.message)}finally{setLoading(false)}
  };
  return <section className="variant-admin"><div className="variant-admin__head"><div><h3>Bộ giá theo kích thước</h3><p>Giá/combo gốc ở “Thông tin bán hàng” vẫn được giữ nguyên. Các dòng dưới đây chỉ bổ sung giá theo size; không tự gộp, không xóa mã cá cũ.</p></div><button type="button" disabled={!ready||loading} onClick={add}>+ Thêm size</button></div>{message&&<p className="variant-note">{message}</p>}{loading&&!ready?<p>Đang tải bộ giá hiện tại…</p>:<div className="variant-admin__rows">{items.map((v,i)=><div className="variant-admin__row" key={v.variant_id||`new-${i}`}><input value={v.size_label} onChange={e=>patch(i,'size_label',e.target.value)} placeholder="Size, VD: 3-4cm"/><input type="number" value={v.list_price} onChange={e=>patch(i,'list_price',e.target.value)} placeholder="Giá số"/><input value={v.price_text} onChange={e=>patch(i,'price_text',e.target.value)} placeholder="Giá hiển thị"/><input value={v.combo3} onChange={e=>patch(i,'combo3',e.target.value)} placeholder="Combo 3"/><input value={v.combo5} onChange={e=>patch(i,'combo5',e.target.value)} placeholder="Combo 5"/><input value={v.combo10} onChange={e=>patch(i,'combo10',e.target.value)} placeholder="Combo 10"/><input type="number" value={v.available_qty} onChange={e=>patch(i,'available_qty',e.target.value)} placeholder="Tồn"/><label className="variant-active"><input type="checkbox" checked={v.is_active} onChange={e=>patch(i,'is_active',e.target.checked)}/> Hiện</label><button type="button" className="danger mini" onClick={()=>remove(i)}>−</button></div>)}</div>}<div className="variant-admin__actions"><button type="button" disabled={loading||!ready} onClick={save}>Lưu bộ giá size</button></div></section>;
}
