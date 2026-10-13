import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { many, one, tx } from '../db.js';
import { AppError } from '../lib/errors.js';

const router=Router();
const nullableNumber=(value,label)=>{
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  if(!Number.isFinite(n))throw new AppError(`${label} không hợp lệ`,{code:'CATALOG_VARIANT_NUMBER_INVALID'});
  return n;
};
const asObject=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const select=`SELECT variant_id,product_id,size_label,list_price,price_text,combo_prices_json,combo_prices_text_json,available_qty,sort_order,is_active,created_at,updated_at FROM catalog_product_size_variant`;

router.get('/:productId/variants',async(req,res,next)=>{try{
  const product=await one('SELECT product_id FROM catalog_product_source WHERE product_id=$1',[req.params.productId]);
  if(!product)throw new AppError('Product not found',{code:'NOT_FOUND',status:404});
  res.json({items:await many(`${select} WHERE product_id=$1 ORDER BY sort_order,created_at`,[req.params.productId])});
}catch(e){next(e)}});

router.put('/:productId/variants',async(req,res,next)=>{try{
  if(!Array.isArray(req.body?.items))throw new AppError('Danh sách kích thước không hợp lệ',{code:'CATALOG_VARIANT_ITEMS_REQUIRED'});
  const items=req.body.items;
  if(items.length>30)throw new AppError('Tối đa 30 kích thước cho một cá',{code:'CATALOG_VARIANT_LIMIT'});
  const normalized=items.map((item,index)=>{
    const sizeLabel=String(item?.size_label||'').trim();
    if(!sizeLabel)throw new AppError('Tên kích thước là bắt buộc',{code:'CATALOG_VARIANT_SIZE_REQUIRED'});
    if(sizeLabel.length>80)throw new AppError('Tên kích thước quá dài',{code:'CATALOG_VARIANT_SIZE_TOO_LONG'});
    return {
      variant_id:/^[0-9a-f-]{36}$/i.test(String(item?.variant_id||''))?String(item.variant_id):randomUUID(),
      size_label:sizeLabel,
      list_price:nullableNumber(item?.list_price,'Giá'),
      price_text:String(item?.price_text||'').trim()||null,
      combo_prices_json:asObject(item?.combo_prices_json),
      combo_prices_text_json:asObject(item?.combo_prices_text_json),
      available_qty:nullableNumber(item?.available_qty,'Tồn kho'),
      sort_order:Number.isFinite(Number(item?.sort_order))?Number(item.sort_order):index,
      is_active:item?.is_active!==false
    };
  });
  const seen=new Set();
  for(const item of normalized){const key=item.size_label.toLocaleLowerCase('vi');if(seen.has(key))throw new AppError('Kích thước bị trùng',{code:'CATALOG_VARIANT_DUPLICATE_SIZE'});seen.add(key)}
  await tx(async client=>{
    const product=(await client.query('SELECT product_id FROM catalog_product_source WHERE product_id=$1',[req.params.productId])).rows[0];
    if(!product)throw new AppError('Product not found',{code:'NOT_FOUND',status:404});
    await client.query('DELETE FROM catalog_product_size_variant WHERE product_id=$1',[req.params.productId]);
    for(const item of normalized)await client.query(`INSERT INTO catalog_product_size_variant(variant_id,product_id,size_label,list_price,price_text,combo_prices_json,combo_prices_text_json,available_qty,sort_order,is_active,updated_at) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,now())`,[
      item.variant_id,req.params.productId,item.size_label,item.list_price,item.price_text,JSON.stringify(item.combo_prices_json),JSON.stringify(item.combo_prices_text_json),item.available_qty,item.sort_order,item.is_active
    ]);
  });
  res.json({items:await many(`${select} WHERE product_id=$1 ORDER BY sort_order,created_at`,[req.params.productId])});
}catch(e){next(e)}});

export default router;
