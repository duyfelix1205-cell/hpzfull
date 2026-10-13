// Approved 24 labels from FV05 Manifest, used only for presentation.
export const ZWM_ICON_CATEGORY_MAP=Object.freeze({
  'Cá cảnh':'fish',
  'Tép cảnh':'shrimp',
  'Cây thủy sinh':'aquatic-plants',
  'Hardscape':'hardscape',
  'Nền':'substrate',
  'Thiết bị':'equipment',
  'Phụ kiện':'accessories',
  'Thức ăn':'fish-food',
  'Thuốc & Chăm sóc':'medicine-care',
  'Sinh sản & Giống':'breeding',
  'Cá theo đàn':'community-fish',
  'Cá đặc biệt':'special-fish',
  'Ốc cảnh':'snails',
  'Cua & Sinh vật khác':'invertebrates',
  'San hô':'coral',
  'Lũa':'driftwood',
  'Lá khô':'leaf-litter',
  'Trang trí':'decorations',
  'Dụng cụ':'tools',
  'Bể & Set bể':'aquarium-sets',
  'Hàng thanh lý':'clearance',
  'Túi mù / Event':'blind-box-event',
  'Trao đổi / Giao lưu':'trade-exchange',
  'Ưu đãi':'deals'
});
const normalized=value=>String(value??'').normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('vi-VN');
const lookup=new Map(Object.entries(ZWM_ICON_CATEGORY_MAP).map(([label,id])=>[normalized(label),id]));

export const resolveZwmCategoryIcon=category=>lookup.get(normalized(category))||null;

