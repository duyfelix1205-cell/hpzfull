export const normalizeCatalogFish=items=>(items||[])
  .filter(x=>x?.product_id&&x?.name)
  .map(x=>({
    product_id:String(x.product_id),
    name:String(x.name),
    secondary_name:String(x.secondary_name||''),
    sale_status:String(x.sale_status||''),
    primary_image_url:x.primary_image_url||null
  }))
  .sort((a,b)=>a.name.localeCompare(b.name,'vi'));

export const normalizeFishSearchText=value=>String(value??'')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'')
  .replace(/đ/g,'d')
  .replace(/Đ/g,'D')
  .toLocaleLowerCase('vi-VN')
  .replace(/[^a-z0-9]+/g,' ')
  .trim();

export function filterCatalogFish(items=[],query=''){
  const q=normalizeFishSearchText(query);
  if(!q)return items;
  const tokens=q.split(/\s+/).filter(Boolean);
  return items.filter(x=>{
    const haystack=normalizeFishSearchText([x.name,x.secondary_name,x.product_id].filter(Boolean).join(' '));
    return tokens.every(token=>haystack.includes(token));
  });
}

export function addCatalogFishSelection(species=[],product,quantity=1){
  if(!product?.product_id)return species;
  const qty=Math.max(1,Math.trunc(Number(quantity)||1));
  const index=species.findIndex(x=>String(x.product_id||'')===String(product.product_id));
  if(index>=0)return species.map((x,i)=>i===index?{...x,quantity:Number(x.quantity||0)+qty,species_name:product.name,product_id:product.product_id,source:'MANUAL'}:x);
  return [...species,{product_id:product.product_id,species_name:product.name,quantity:qty,source:'MANUAL'}];
}
