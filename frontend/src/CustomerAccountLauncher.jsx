import React,{useEffect,useState}from'react';
import{customerAuthApi}from'./customer-auth-api.js';

export function CustomerAccountLauncher(){
 const[label,setLabel]=useState('Tài khoản');
 useEffect(()=>{let alive=true;customerAuthApi.me().then(r=>{if(!alive)return;const a=r?.account,p=r?.customer_profile;setLabel(p?.loyalty?.current_points!==undefined?`${a?.display_name||'Thành viên'} · ${Number(p.loyalty.current_points||0).toLocaleString('vi-VN')} điểm`:(a?.display_name||'Tài khoản'))}).catch(()=>{});return()=>{alive=false}},[]);
 return <a className="customer-account-launcher" href="/account" aria-label="Mở tài khoản khách hàng"><span className="customer-account-launcher__mark">HPZ</span><span>{label}</span></a>
}
