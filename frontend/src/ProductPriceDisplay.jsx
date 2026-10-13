import React,{useEffect,useMemo,useState}from'react';
import'./product-variants.css';

const money=v=>v===null||v===undefined||v===''?'Liên hệ':new Intl.NumberFormat('vi-VN').format(Number(v))+'₫';
const readablePrice=v=>{const raw=String(v??'').trim();return /^\d+(?:[.,]\d+)?$/.test(raw)?money(Number(raw.replace(',','.'))):raw};
const priceOf=x=>x?.price_text?readablePrice(x.price_text):money(x?.list_price??x?.price);
const combosOf=x=>{const t=x?.combo_prices_text_json||{},n=x?.combo_prices_json||{};return ['3','5','10'].map(k=>[k,t[k]||t[`combo${k}`]||(n[k]!=null?money(n[k]):'')]).filter(([,v])=>v).map(([k,v])=>[k,readablePrice(v)])};
const normSize=v=>String(v||'').trim().toLocaleLowerCase('vi');
const hasBasePricing=p=>Boolean(String(p?.size_text||'').trim())&&(
  p?.list_price!==null&&p?.list_price!==undefined&&p?.list_price!==''||
  String(p?.price_text||'').trim()||
  Object.keys(p?.combo_prices_text_json||{}).length||
  Object.keys(p?.combo_prices_json||{}).length
);

export function ProductPriceDisplay({product,compact=false,detail=false}){
  const variants=useMemo(()=>Array.isArray(product?.size_variants)?product.size_variants.filter(v=>v?.is_active!==false):[],[product?.size_variants]);
  const options=useMemo(()=>{
    if(!variants.length)return [];
    const baseSize=String(product?.size_text||'').trim();
    const duplicateBase=baseSize&&variants.some(v=>normSize(v?.size_label)===normSize(baseSize));
    const base=hasBasePricing(product)&&!duplicateBase?{
      variant_id:'__legacy__',
      size_label:baseSize,
      list_price:product?.list_price,
      price_text:product?.price_text,
      combo_prices_json:product?.combo_prices_json,
      combo_prices_text_json:product?.combo_prices_text_json,
      available_qty:product?.available_qty,
      is_legacy:true
    }:null;
    return base?[base,...variants]:variants;
  },[product,variants]);
  const[selectedId,setSelectedId]=useState(options[0]?.variant_id||'');
  const optionKey=options.map(v=>v.variant_id).join('|');
  useEffect(()=>setSelectedId(options[0]?.variant_id||''),[product?.product_id,optionKey]);
  const selected=options.find(v=>v.variant_id===selectedId)||options[0]||null;
  const source=selected||product;
  const combos=combosOf(source);
  return <div className={`variant-price ${compact?'variant-price--compact':''}`}>{options.length>0&&<label className="variant-select"><span>Kích thước</span><select value={selected?.variant_id||''} onChange={e=>setSelectedId(e.target.value)}>{options.map(v=><option key={v.variant_id} value={v.variant_id}>{v.size_label}{v.is_legacy?' · giá hiện tại':''}</option>)}</select></label>}<div className={detail?'detail-price':'price'}>{priceOf(source)}</div>{combos.length>0&&(compact?<div className="variant-combos-compact">{combos.map(([k,v])=><span key={k}>C{k}: {v}</span>)}</div>:<div className="combo-box">{combos.map(([k,v])=><div className="info-row" key={k}><span className="k">Combo {k}</span><strong>{v}</strong></div>)}</div>)}</div>;
}
