export const DEFAULT_HOMEPAGE = {
  document_title:'HPZ Aquaroom — Showroom cá cảnh Cầu Giấy, Hà Nội',
  header:{brand_name:'HPZ AQUAROOM',brand_tagline:'SHOWROOM CÁ CẢNH',home_label:'Trang chủ',fish_label:'Danh sách cá',tanks_label:'Danh sách bể',policy_label:'Chính sách',contact_label:'Liên hệ'},
  hero:{enabled:true,eyebrow:'Thế giới cá cảnh',title:'Dưới lòng đại dương thu nhỏ',description:'HPZ Aquaroom — cá cảnh, bể cá và tư vấn setup tại Hà Nội.',primary_label:'Xem danh sách cá →',primary_href:'/beca.html',secondary_label:'Xem danh sách bể',secondary_href:'/be.html'},
  about:{enabled:true,title:'Về HPZ Aquaroom',body:'HPZ Aquaroom chuyên cá cảnh và bể cá. Danh mục trên website được quản lý trực tiếp trên NEXORA Product Catalog để shop có thể cập nhật ảnh, giá và nội dung ngay khi cần.',address_label:'Địa chỉ',address_text:'Cầu Giấy, Hà Nội, Việt Nam',contact_label:'Liên hệ',contact_text:'facebook.com/hpzaquaroom',contact_href:'https://www.facebook.com/hpzaquaroom'},
  fish:{enabled:true,title:'Cá đang có tại HPZ',subtitle:'Các mã đang ở trạng thái STOCK.',button_label:'Xem cá đang STOCK →',button_href:'/beca.html?sale_status=STOCK',limit:4},
  tanks:{enabled:true,title:'Mẫu bể cá',button_label:'Xem tất cả bể →',button_href:'/be.html',limit:4},
  reviews:{enabled:true,title:'Khách hàng nói gì',google_maps_url:'https://share.google/OEz6JjgsN0O9w9OmJ',google_maps_query:'HPZ Aquaroom Cầu Giấy Hà Nội',items:[]},
  contact:{enabled:true,title:'Liên hệ với shop',body:'Nhắn HPZ Aquaroom qua Facebook để được tư vấn cá, bể và setup.',button_label:'Mở Facebook HPZ Aquaroom →',button_href:'https://www.facebook.com/hpzaquaroom'},
  footer:{location:'Cầu Giấy, Hà Nội',facebook_label:'Facebook',facebook_href:'https://www.facebook.com/hpzaquaroom',copyright:'© 2026 HPZ Aquaroom.'}
};

export const DEFAULT_POLICY_TABLE={
  enabled:true,
  title:'Bảng chính sách',
  columns:['Hạng mục','Nội dung'],
  rows:[]
};

const text=(v,f,max=500)=>typeof v==='string'?v.slice(0,max):f;
const flag=(v,f)=>typeof v==='boolean'?v:f;
const number=(v,f,min,max)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):f;
export function normalizeHomepage(input={}){
  const d=DEFAULT_HOMEPAGE;
  const h=input.header||{}, hero=input.hero||{}, about=input.about||{}, fish=input.fish||{}, tanks=input.tanks||{}, reviews=input.reviews||{}, contact=input.contact||{}, footer=input.footer||{};
  const reviewItems=Array.isArray(reviews.items)?reviews.items.slice(0,20).map(r=>({text:text(r?.text,'',1000),name:text(r?.name,'Khách hàng HPZ',120),stars:number(r?.stars,5,1,5)})).filter(r=>r.text.trim()):[];
  return {
    document_title:text(input.document_title,d.document_title,180),
    header:{brand_name:text(h.brand_name,d.header.brand_name,80),brand_tagline:text(h.brand_tagline,d.header.brand_tagline,100),home_label:text(h.home_label,d.header.home_label,40),fish_label:text(h.fish_label,d.header.fish_label,60),tanks_label:text(h.tanks_label,d.header.tanks_label,60),policy_label:text(h.policy_label,d.header.policy_label,60),contact_label:text(h.contact_label,d.header.contact_label,60)},
    hero:{enabled:flag(hero.enabled,d.hero.enabled),eyebrow:text(hero.eyebrow,d.hero.eyebrow,120),title:text(hero.title,d.hero.title,180),description:text(hero.description,d.hero.description,500),primary_label:text(hero.primary_label,d.hero.primary_label,100),primary_href:text(hero.primary_href,d.hero.primary_href,500),secondary_label:text(hero.secondary_label,d.hero.secondary_label,100),secondary_href:text(hero.secondary_href,d.hero.secondary_href,500)},
    about:{enabled:flag(about.enabled,d.about.enabled),title:text(about.title,d.about.title,160),body:text(about.body,d.about.body,2000),address_label:text(about.address_label,d.about.address_label,80),address_text:text(about.address_text,d.about.address_text,300),contact_label:text(about.contact_label,d.about.contact_label,80),contact_text:text(about.contact_text,d.about.contact_text,300),contact_href:text(about.contact_href,d.about.contact_href,500)},
    fish:{enabled:flag(fish.enabled,d.fish.enabled),title:text(fish.title,d.fish.title,160),subtitle:text(fish.subtitle,d.fish.subtitle,500),button_label:text(fish.button_label,d.fish.button_label,100),button_href:text(fish.button_href,d.fish.button_href,500),limit:number(fish.limit,d.fish.limit,1,12)},
    tanks:{enabled:flag(tanks.enabled,d.tanks.enabled),title:text(tanks.title,d.tanks.title,160),button_label:text(tanks.button_label,d.tanks.button_label,100),button_href:text(tanks.button_href,d.tanks.button_href,500),limit:number(tanks.limit,d.tanks.limit,1,12)},
    reviews:{enabled:flag(reviews.enabled,d.reviews.enabled),title:text(reviews.title,d.reviews.title,160),google_maps_url:text(reviews.google_maps_url,d.reviews.google_maps_url,1000),google_maps_query:text(reviews.google_maps_query,d.reviews.google_maps_query,300),items:reviewItems},
    contact:{enabled:flag(contact.enabled,d.contact.enabled),title:text(contact.title,d.contact.title,160),body:text(contact.body,d.contact.body,1000),button_label:text(contact.button_label,d.contact.button_label,120),button_href:text(contact.button_href,d.contact.button_href,500)},
    footer:{location:text(footer.location,d.footer.location,200),facebook_label:text(footer.facebook_label,d.footer.facebook_label,80),facebook_href:text(footer.facebook_href,d.footer.facebook_href,500),copyright:text(footer.copyright,d.footer.copyright,200)}
  };
}

export function normalizePolicyTable(input={}){
  const d=DEFAULT_POLICY_TABLE;
  const rawColumns=Array.isArray(input.columns)?input.columns:[];
  const columns=(rawColumns.length?rawColumns:d.columns).slice(0,12).map((x,i)=>text(x,`Cột ${i+1}`,120).trim()||`Cột ${i+1}`);
  const rows=(Array.isArray(input.rows)?input.rows:[]).slice(0,100).map(row=>{
    const cells=Array.isArray(row)?row:[];
    return columns.map((_,i)=>text(cells[i],'',2000));
  });
  return {enabled:flag(input.enabled,d.enabled),title:text(input.title,d.title,160),columns,rows};
}
