import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=rel=>readFileSync(new URL('../../'+rel,import.meta.url),'utf8');

test('ISS-2026-0023 STOCK is wired through homepage and public mini-tab',()=>{
 const s=source('frontend/src/PublicApp.jsx');
 assert.match(s,/listProducts\(\{sale_status:'STOCK'\}\)/);
 assert.match(s,/params\.get\('sale_status'\)/);
 assert.match(s,/sale_status:saleStatus/);
 assert.match(s,/Có sẵn · STOCK/);
});
test('homepage does not render hard-coded fallback before persisted content resolves',()=>{
 const s=source('frontend/src/PublicApp.jsx');
 assert.match(s,/\[site,setSite\]=useState\(null\)/);
 assert.match(s,/setSite\(s\.status==='fulfilled'&&s\.value\?\.content\?s\.value\.content:HOME_FALLBACK\)/);
 assert.match(s,/if\(!site\)return <div className="hpz-app" aria-busy="true"/);
 assert.doesNotMatch(s,/\[site,setSite\]=useState\(HOME_FALLBACK\)/);
});
test('homepage restores animated configured reviews and moves Google Map to location section',()=>{
 const s=source('frontend/src/PublicApp.jsx');
 assert.match(s,/const reviews=site\.reviews\?\.items\|\|\[\]/);
 assert.match(s,/review-marquee/);
 assert.match(s,/store-location/);
 assert.match(s,/googleMapsEmbed/);
 assert.doesNotMatch(s,/Cá khỏe, shop tư vấn nhiệt tình/);
});
test('legacy fake review cleanup is fingerprinted and preserves customized production reviews',()=>{
 const migration=source('backend/db/migrations/014_remove_legacy_fake_reviews.sql');
 const site=source('backend/src/lib/site-content.js');
 assert.match(site,/reviews:\{enabled:true,title:'Khách hàng nói gì',[^\n]*items:\[\]\}/);
 for(const text of [
  'Giao hàng cẩn thận, cá không sốc nước. Recommend.',
  'Giá hợp lý, anh chủ rành cá thật. Mua ủng hộ lần 2 rồi.',
  'Cá betta đẹp xuất sắc, màu rực. Đóng gói kỹ.',
  'Tư vấn bể, lọc nhiệt tình dù mình mua ít. Quý thật.'
 ]) assert.match(migration,new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 assert.match(migration,/item->>'name' = 'Khách hàng HPZ'/);
 assert.doesNotMatch(migration,/Hữu Tuấn/);
 assert.doesNotMatch(migration,/Nguyễn Hữu Hùng/);
});
test('ISS-2026-0026 policy table is additive and workspaces remain present',()=>{
 const policy=source('frontend/src/LegacyPolicy.jsx');
 const router=source('frontend/src/AdminRouter.jsx');
 assert.match(policy,/publicApi\.getPolicy/);
 assert.match(policy,/policy-view-table/);
 assert.match(router,/ZWmarket/);
 assert.match(router,/HPz Aquacare/);
});
test('ISS-2026-0027 fish and tank classification live inside their editors',()=>{
 const fish=source('frontend/src/AdminApp.jsx'),tank=source('frontend/src/TankAdmin.jsx'),inline=source('frontend/src/InlineCategoryManager.jsx');
 assert.match(fish,/InlineCategoryManager kind="fish"/);
 assert.match(tank,/InlineCategoryManager kind="tank"/);
 assert.match(inline,/listTankCategories/);
 assert.match(inline,/setProductCategories/);
});

test('ISS-2026-0042 AquaCare fish search is accent-normalized and token based',()=>{
 const picker=source('frontend/src/aquacare-fish-picker-model.js');
 assert.match(picker,/normalize\('NFD'\)/);
 assert.match(picker,/replace\(\/\[\\u0300-\\u036f\]\/g,''\)/);
 assert.match(picker,/tokens\.every\(token=>haystack\.includes\(token\)\)/);
});

test('ISS-2026-0043 AquaCare tank modal stays above page chrome and within laptop width',()=>{
 const ui=source('frontend/src/ui/HPZUI.jsx');
 const theme=source('frontend/src/ui/hpz-theme.css');
 const css=source('frontend/src/aquacare.css');
 assert.match(ui,/createPortal\(modal,document\.body\)/);
 assert.match(theme,/\.hpz-modal-backdrop\{overflow-y:auto;overscroll-behavior:contain\}/);
 assert.match(theme,/100dvh/);
 assert.match(css,/grid-template-columns:minmax\(0,1\.1fr\) minmax\(0,1\.8fr\) minmax\(88px,\.5fr\) auto/);
 assert.match(css,/\.aquacare-catalog-picker \.hpz-field\{margin:0;min-width:0\}/);
});

test('standalone product create cooperates with trigger-seeded catalog_content row',()=>{
 const route=source('backend/src/routes/admin-products.js');
 const seed=source('backend/db/migrations/002_sync_content_seed.sql');
 assert.match(seed,/AFTER INSERT ON catalog_product_source/);
 assert.match(seed,/INSERT INTO catalog_content\(product_id\)/);
 assert.match(route,/ON CONFLICT\(product_id\) DO UPDATE SET/);
 assert.match(route,/slug=EXCLUDED\.slug/);
 assert.doesNotMatch(route,/Tên\/slug\/product_id đã tồn tại/);
});

test('ISS-2026-0046 product videos render inline while preserving source data',()=>{
 const admin=source('frontend/src/AdminApp.jsx');
 const tankAdmin=source('frontend/src/TankAdmin.jsx');
 const viewer=source('frontend/src/PublicApp.jsx');
 const video=source('frontend/src/ProductVideo.jsx');
 const css=source('frontend/src/standalone.css');
 const productSchema=source('backend/db/migrations/001_catalog_core.sql');
 const tankMigration=source('backend/db/migrations/020_tank_video_url.sql');
 const tankRoute=source('backend/src/routes/admin-tanks.js');
 assert.match(admin,/type="file" multiple/);
 assert.match(admin,/for\(const file of uploadFiles\)/);
 assert.match(admin,/Link video thực tế/);
 assert.match(tankAdmin,/Link video thực tế/);
 assert.match(tankAdmin,/video_url/);
 assert.match(viewer,/detail-gallery-nav/);
 assert.match(viewer,/ProductVideo url=\{item\.video_url\}/);
 assert.match(video,/facebook\.com\/plugins\/video\.php/);
 assert.match(video,/youtube-nocookie\.com\/embed/);
 assert.match(video,/player\.vimeo\.com\/video/);
 assert.match(video,/<video src=\{source\.src\} controls playsInline/);
 assert.match(video,/type:'link'/);
 assert.match(css,/detail-video-embed/);
 assert.match(productSchema,/video_url text/);
 assert.match(tankMigration,/ADD COLUMN IF NOT EXISTS video_url text/);
 assert.doesNotMatch(tankMigration,/DELETE\s+FROM|TRUNCATE|DROP\s+TABLE|UPDATE\s+catalog_tank/i);
 assert.match(tankRoute,/video_url=\$9/);
});
test('ISS-2026-0034 STOCK filter matches semantic stock statuses without rewriting production rows',()=>{
  const route=source('backend/src/routes/catalog.js');
  assert.ok(route.includes("^STOCK($|[[:space:]_/-])"));
  assert.doesNotMatch(source('backend/db/migrations/015_product_size_variants.sql'),/UPDATE\s+catalog_product_source/i);
});
test('ISS-2026-0033 size pricing editor is mounted and preserves the current product price',()=>{
  const migration=source('backend/db/migrations/015_product_size_variants.sql');
  const adminApp=source('frontend/src/AdminApp.jsx');
  const admin=source('frontend/src/ProductSizeVariants.jsx');
  const publicPrice=source('frontend/src/ProductPriceDisplay.jsx');
  const publicRoute=source('backend/src/routes/catalog.js');
  const variantRoute=source('backend/src/routes/admin-product-variants.js');
  assert.match(migration,/CREATE TABLE IF NOT EXISTS catalog_product_size_variant/);
  assert.doesNotMatch(migration,/DELETE FROM|TRUNCATE|DROP TABLE|UPDATE catalog_product_source/i);
  assert.match(adminApp,/import\{ProductSizeVariants\}from'\.\/ProductSizeVariants\.jsx'/);
  assert.match(adminApp,/<ProductSizeVariants productId=\{selected\.product_id\}\/>/);
  assert.match(admin,/không xóa mã cá cũ/);
  assert.match(admin,/Chưa tải xong dữ liệu size\. Hệ thống không ghi đè dữ liệu hiện tại\./);
  assert.match(publicPrice,/variant_id:'__legacy__'/);
  assert.match(publicPrice,/giá hiện tại/);
  assert.match(publicRoute,/c\.size_text/);
  assert.match(publicRoute,/s\.combo_prices_text_json/);
  assert.match(variantRoute,/CATALOG_VARIANT_ITEMS_REQUIRED/);
  assert.match(source('frontend/src/PublicApp.jsx'),/ProductPriceDisplay product=\{p\} compact/);
  assert.match(source('frontend/src/PublicApp.jsx'),/ProductPriceDisplay product=\{item\} detail/);
});
test('ZWMarket is a public DB-backed marketplace with admin moderation and future user ownership',()=>{
  const migration=source('backend/db/migrations/016_zwmarket_posts.sql');
  const app=source('backend/src/app.js');
  const publicRoute=source('backend/src/routes/market.js');
  const visibility=source('backend/src/lib/market-visibility.js');
  const adminRoute=source('backend/src/routes/admin-market.js');
  const main=source('frontend/src/main.jsx');
  const publicPage=source('frontend/src/ZwMarketPage.jsx');
  const admin=source('frontend/src/WorkspaceAdmin.jsx');
  const viewer=source('frontend/src/ViewerEnhancements.jsx');
  assert.match(migration,/CREATE TABLE IF NOT EXISTS catalog_market_post/);
  assert.match(migration,/author_user_id text/);
  assert.match(migration,/moderation_status text/);
  assert.doesNotMatch(migration,/DELETE FROM|TRUNCATE|DROP TABLE|UPDATE catalog_/i);
  assert.match(app,/\/api\/v1\/catalog\/market/);
  assert.match(app,/\/api\/v1\/admin\/catalog\/market/);
  assert.match(publicRoute,/publicMarketVisibilitySql\('p'\)/);
  assert.match(visibility,/publish_status='PUBLISHED'/);
  assert.match(visibility,/moderation_status='APPROVED'/);
  assert.doesNotMatch(publicRoute,/router\.post|router\.put|router\.delete/);
  assert.match(adminRoute,/router\.post\('\/'/);
  assert.match(main,/market\?ZwMarketPage/);
  assert.match(publicPage,/function ZwmShell/);
  assert.match(publicPage,/CALM DIGITAL NIGHT MARKET/);
  assert.match(publicPage,/marketApi\.mine\(\)/);
  assert.match(admin,/CMS & MODERATION/);
  assert.match(admin,/publishMarketPost/);
  assert.match(viewer,/href="\/zwmarket"/);
});


test('ISS-2026-0109 Longfin preserves the supplied UX master while Catalog owns business logic',()=>{
  const page=source('frontend/src/LongfinCampaign.jsx');
  const experience=source('frontend/public/campaigns/mi-an-longfin/source/experience.html');
  const hub=source('frontend/src/ContentHub.jsx');
  const migration=source('backend/db/migrations/023_longfin_campaign.sql');
  assert.match(hub,/\/nhat-bao\/mi-an-longfin\/experience/);
  assert.match(hub,/LongfinCampaign/);
  assert.match(page,/\/campaigns\/mi-an-longfin\/source\/experience\.html/);
  assert.match(page,/<iframe/);
  assert.match(migration,/'JOURNAL_TYPE','CAMPAIGN','Chiến dịch'/);
  assert.match(migration,/'\/nhat-bao\/mi-an-longfin\/experience'/);
  assert.match(migration,/'PUBLISHED'/);
  assert.doesNotMatch(migration,/DELETE\s+FROM|TRUNCATE|DROP\s+TABLE|UPDATE\s+catalog_/i);

  for(const marker of [
    'HPZ_Mi_An_Longfin_Prototype.html',
    'UX_MASTER_SHA256:c96cc2af297c71e6b05182defa92f4d94ba470b215c6e421ef32380f6ebabbf0',
    'id="entry"',
    'id="aquarium"',
    'class="progress"',
    'class="hotspot"',
    'class="route"',
    'class="steps"',
    'class="choice-row"',
    'class="quantity"',
    'class="gallery"',
    'id="lightbox"',
    'id="motion"',
    'MI ẤN<span>LONGFIN</span>'
  ]) assert.ok(experience.includes(marker),'missing UX master marker: '+marker);

  assert.match(experience,/CHƯA NHẬN ĐƠN/);
  assert.match(experience,/Campaign Experience thuộc Nhật Báo HPZ Catalog/);
  assert.match(experience,/href="\/nhat-bao"/);
  assert.match(experience,/279000/);
  assert.match(experience,/Giá đề xuất trong UX Source · chờ HPZ Catalog xác nhận/);
  assert.match(experience,/Đặt trước 50%/);
  assert.match(experience,/Thanh toán toàn bộ/);
  assert.match(experience,/Thử luồng đặt trước/);
  assert.match(experience,/id="orderDialog"/);
  assert.match(experience,/Không tạo đơn hàng và không thu tiền/);
  assert.match(experience,/integration:\{order:null,payment:null\}/);
  assert.doesNotMatch(experience,/fetch\([^)]*(order|payment)|\/api\/v1\/.*(order|payment)/i);
  assert.match(experience,/assets\/preorder-source\.jpg/);
  assert.match(experience,/assets\/gallery-source-02\.jpg/);
  assert.match(experience,/Trở lại Nhật Báo/);
});


test('Longfin Campaign CMS keeps public viewer read-only and requires dedicated admin credentials',()=>{
  const page=source('frontend/src/LongfinCampaign.jsx');
  const route=source('backend/src/routes/campaign-editor.js');
  const migration=source('backend/db/migrations/024_campaign_inline_editor.sql');
  const app=source('backend/src/app.js');
  assert.match(migration,/CREATE TABLE IF NOT EXISTS catalog_campaign_editor_access/);
  assert.match(migration,/VALUES \('admin','8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',true\)/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS catalog_campaign_content/);
  assert.doesNotMatch(migration,/DELETE\s+FROM|TRUNCATE|DROP\s+TABLE/i);
  assert.match(app,/\/api\/v1\/catalog\/campaigns/);
  assert.match(route,/r\.get\('\/:campaignKey\/content'/);
  assert.match(route,/r\.post\('\/:campaignKey\/editor\/login'/);
  assert.match(route,/r\.put\('\/:campaignKey\/editor\/content',requireEditor/);
  assert.match(route,/x-campaign-admin-username/);
  assert.match(route,/x-campaign-admin-password/);
  assert.match(page,/Quản trị nội dung/);
  assert.match(page,/HPZ CAMPAIGN CMS/);
  assert.match(page,/collectTextNodes/);
  assert.match(page,/ATTRIBUTE_COPY/);
  assert.match(page,/data-tip/);
  assert.match(page,/data-pause-text/);
  assert.match(page,/data-copy-text/);
  assert.match(page,/Khôi phục text gốc/);
  assert.match(page,/Giá trị tính toán\/quantity\/trạng thái runtime được khóa/);
  assert.doesNotMatch(page,/contentEditable/);
});

test('Longfin Campaign CMS persists editorial copy without adding order/payment integration',()=>{
  const route=source('backend/src/routes/campaign-editor.js');
  const page=source('frontend/src/LongfinCampaign.jsx');
  assert.match(route,/copy_json/);
  assert.match(route,/updated_by/);
  assert.match(route,/cleanCopy/);
  assert.match(page,/SAVE_API/);
  assert.match(page,/Khách hàng tải lại trang sẽ thấy bản mới/);
  assert.doesNotMatch(route,/order|payment/i);
});


test('Longfin Campaign CMS covers interaction copy while computed monetary values stay logic-owned',()=>{
  const page=source('frontend/src/LongfinCampaign.jsx');
  const experience=source('frontend/public/campaigns/mi-an-longfin/source/experience.html');
  assert.match(experience,/data-ready-text="Ảnh gốc HPZ · sẵn sàng khám phá"/);
  assert.match(experience,/data-error-text="Chuyển động chưa tải được · vẫn có thể xem chiến dịch"/);
  assert.match(experience,/data-copy-text="Giá đề xuất trong UX Source · chờ HPZ Catalog xác nhận"/);
  assert.match(experience,/data-pause-text="Tạm dừng chuyển động"/);
  assert.match(experience,/data-play-text="Bật chuyển động"/);
  assert.match(experience,/data-total-label="Tổng tham khảo"/);
  assert.match(experience,/dataset\.copyText/);
  assert.match(experience,/dataset\.unitText/);
  assert.match(page,/\['\[data-tip\]','data-tip','Tooltip hotspot'\]/);
  assert.match(page,/updateSimulation/);
  assert.match(page,/motionLabel/);
  assert.match(page,/DYNAMIC_IDS=new Set\(\['price','priceNote','total','pay','orderSummary','loadStatus','motion'\]\)/);
});


test('ZWMarket account control uses the shared Catalog account destinations',()=>{
  const page=source('frontend/src/ZwMarketPage.jsx');
  assert.match(page,/accountHref=account\?'\/me':'\/login\?next=\/market'/);
  assert.match(page,/className="zwm-account-link" href=\{accountHref\}/);
  assert.match(page,/aria-label=\{account\?'Mở My HPZ':'Đăng nhập HPZ'\}/);
  assert.doesNotMatch(page,/<b>\{name\}⌄<\/b>/);
});


test('ISS-2026-0114 Longfin adds a blank custom payment choice without creating payment business logic',()=>{
  const experience=source('frontend/public/campaigns/mi-an-longfin/source/experience.html');
  assert.match(experience,/data-mode="custom"/);
  assert.match(experience,/id="customPay"/);
  assert.match(experience,/value="" placeholder=""/);
  assert.match(experience,/aria-label="Số tiền tự điền"/);
  assert.match(experience,/payments:\[\.5,1,'custom'\]/);
  assert.match(experience,/function currentPayment\(\)/);
  assert.match(experience,/mode==='custom'/);
  assert.match(experience,/payment===null\?'—':money\(payment\)/);
  assert.match(experience,/data-custom-label="Tự điền"/);
  assert.match(experience,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(experience,/fetch\([^)]*(order|payment)|\/api\/v1\/.*(order|payment)/i);
});
