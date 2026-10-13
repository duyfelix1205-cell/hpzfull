const hash32=value=>{
  let h=2166136261;
  const s=String(value??'');
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
  return h>>>0;
};
const rand01=seed=>{
  let x=(seed>>>0)||1;
  x^=x<<13;x^=x>>>17;x^=x<<5;
  return [(x>>>0)/4294967296,x>>>0];
};
export const preferredZone=name=>{
  const v=String(name||'').toLowerCase();
  if(/cory|chuột|pleco|tỳ bà|ty ba|loach|chạch|chach|botia/.test(v))return'bottom';
  if(/betta|lia thia|cá rồng|ca rong|arowana|guppy|bảy màu|bay mau|molly|platy/.test(v))return'top';
  return'middle';
};
export const visualSource=item=>item?.visual_asset?.image_url?'real':'fallback';

export function buildFishInstances(items=[]){
  const out=[];
  for(const item of items){
    if(item?.item_type!=='FISH'||item?.removed_at)continue;
    const qty=Math.max(0,Math.trunc(Number(item?.quantity||0)));
    const name=item?.species_name||item?.product_name||'Cá';
    const zone=preferredZone(name);
    for(let index=0;index<qty;index++){
      const seedBase=hash32((item.tank_item_id||item.product_id||name)+'|'+index);
      let [r1,s1]=rand01(seedBase),[r2,s2]=rand01(s1),[r3,s3]=rand01(s2),[r4,s4]=rand01(s3),[r5]=rand01(s4);
      const yRange=zone==='top'?[0.08,0.38]:zone==='bottom'?[0.58,0.86]:[0.22,0.72];
      out.push({
        id:(item.tank_item_id||item.product_id||name)+'-'+index,
        item_id:item.tank_item_id||null,
        product_id:item.product_id||null,
        name,
        image_url:item?.visual_asset?.image_url||null,
        visual_source:visualSource(item),
        zone,
        x:0.06+r1*0.88,
        y:yRange[0]+r2*(yRange[1]-yRange[0]),
        speed:0.018+r3*0.022,
        direction:r4>.5?1:-1,
        phase:r5*Math.PI*2,
        scale:0.82+((seedBase%31)/100)
      });
    }
  }
  return out;
}

export function renderPolicy(total){
  const n=Math.max(0,Number(total||0));
  if(n<=40)return{fps:30,size:1};
  if(n<=120)return{fps:24,size:.84};
  if(n<=300)return{fps:20,size:.68};
  return{fps:16,size:.54};
}
