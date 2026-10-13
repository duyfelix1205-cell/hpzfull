import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync,readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {sessionClock,sessionStageView,countdownText} from '../../frontend/src/zwmarket-session-clock.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const source=file=>readFileSync(path.join(root,file),'utf8');

test('ISS-2026-0089/0091 seller workflow is authenticated and ownership scoped',()=>{
  const route=source('backend/src/routes/market-workflow.js');
  assert.match(route,/requireCustomerSession/);
  assert.match(route,/author_user_id=\$2/);
  assert.match(route,/'USER','PENDING','DRAFT'/);
  assert.match(route,/moderation_status='PENDING',publish_status='DRAFT'/);
  assert.match(route,/is_sold=true/);
});

test('ISS-2026-0092/0093 moderation preserves explicit rejected and hidden states',()=>{
  const admin=source('backend/src/routes/admin-market.js');
  const workflow=source('backend/src/routes/admin-market-workflow.js');
  assert.match(admin,/publish_status='HIDDEN'/);
  assert.match(admin,/moderation_status='APPROVED',publish_status='PUBLISHED'/);
  assert.match(workflow,/moderation_status='REJECTED',publish_status='DRAFT'/);
  assert.match(workflow,/moderation_note/);
});

test('ISS-2026-0094 contact is opt-in on public reads',()=>{
  const migration=source('backend/db/migrations/021_zwmarket_workflow.sql');
  const publicRoute=source('backend/src/routes/market.js');
  assert.match(migration,/contact_public boolean NOT NULL DEFAULT false/);
  assert.match(publicRoute,/CASE WHEN p\.contact_public THEN p\.seller_contact ELSE NULL END AS seller_contact/);
  assert.match(source('frontend/src/ZwMarketPage.jsx'),/Liên hệ người đăng/);
});

test('ISS-2026-0095/0096 market sessions preserve posts and history',()=>{
  const migration=source('backend/db/migrations/021_zwmarket_workflow.sql');
  const route=source('backend/src/routes/market-workflow.js');
  const admin=source('backend/src/routes/admin-market-workflow.js');
  assert.match(migration,/CREATE TABLE IF NOT EXISTS catalog_market_session /);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS catalog_market_session_post/);
  assert.doesNotMatch(migration,/DELETE\s+FROM|TRUNCATE|DROP\s+TABLE|UPDATE\s+catalog_market_post/i);
  assert.match(route,/post\.moderation_status!=='APPROVED'/);
  assert.match(route,/post\.publish_status!=='PUBLISHED'/);
  assert.match(route,/post\.is_sold/);
  assert.match(route,/ON CONFLICT\(session_id,post_id\) DO UPDATE SET removed_at=NULL/);
  assert.match(admin,/current\.status==='ENDED'/);
});

test('ZWMarket UI exposes seller, moderation, contact and session flows',()=>{
  const page=source('frontend/src/ZwMarketPage.jsx');
  const admin=source('frontend/src/WorkspaceAdmin.jsx');
  const sessions=source('frontend/src/ZwMarketAdminSessions.jsx');
  assert.match(page,/marketApi\.create/);
  assert.match(page,/marketApi\.update/);
  assert.match(page,/marketApi\.resubmit/);
  assert.match(page,/marketApi\.sold/);
  assert.match(page,/marketApi\.joinSession/);
  assert.match(page,/moderation_note/);
  assert.match(admin,/rejectMarketPost/);
  assert.match(admin,/ZwMarketAdminSessions/);
  assert.match(sessions,/setMarketSessionStatus/);
});


test('ISS-2026-0100 Hidden posts keep reason and only expose the Admin-selected next action',()=>{
  const migration=source('backend/db/migrations/022_zwmarket_visibility_lifecycle.sql');
  const admin=source('backend/src/routes/admin-market.js');
  const workflow=source('backend/src/routes/market-workflow.js');
  const page=source('frontend/src/ZwMarketPage.jsx');
  assert.match(migration,/hidden_action text/);
  assert.match(migration,/EDIT_RESUBMIT','CONTACT_HPZ','VIEW_ONLY/);
  assert.doesNotMatch(migration,/DELETE\s+FROM|TRUNCATE|DROP\s+TABLE|UPDATE\s+catalog_market_post/i);
  assert.match(admin,/publish_status='HIDDEN',moderation_note=\$2,hidden_action=\$3/);
  assert.match(admin,/HIDDEN_ACTIONS/);
  assert.match(workflow,/MARKET_POST_HIDDEN_READ_ONLY/);
  assert.match(workflow,/MARKET_POST_HIDDEN_EDIT_REQUIRED/);
  assert.match(page,/post\.hidden_action==='EDIT_RESUBMIT'/);
  assert.match(page,/post\.hidden_action==='CONTACT_HPZ'/);
  assert.match(page,/post\.moderation_status==='REJECTED'.*resubmit\(post\.post_id\)/s);
});

test('ISS-2026-0101 public visibility follows Upcoming/Open/Ended and Sold grace window',()=>{
  const migration=source('backend/db/migrations/022_zwmarket_visibility_lifecycle.sql');
  const visibility=source('backend/src/lib/market-visibility.js');
  const publicRoute=source('backend/src/routes/market.js');
  const workflow=source('backend/src/routes/market-workflow.js');
  const page=source('frontend/src/ZwMarketPage.jsx');
  assert.match(migration,/sold_at timestamptz/);
  assert.match(migration,/sold_visibility_until timestamptz/);
  assert.match(visibility,/DEFAULT_SOLD_VISIBILITY_HOURS=36/);
  assert.match(visibility,/participationSql\(alias,'OPEN'\)/);
  assert.match(visibility,/participationSql\(alias,'UPCOMING'\)/);
  assert.match(visibility,/participationSql\(alias,'ENDED'\)/);
  assert.match(visibility,/sold_visibility_until IS NULL OR .*sold_visibility_until>now\(\)/s);
  assert.match(publicRoute,/publicMarketVisibilitySql\('p'\)/);
  assert.match(publicRoute,/marketPhaseSql\('p'\)/);
  assert.match(workflow,/session\.status==='UPCOMING'\?\[\]/);
  assert.match(workflow,/soldVisibilitySql\('p'\)/);
  assert.match(workflow,/sold_at=COALESCE\(sold_at,now\(\)\)/);
  assert.match(workflow,/sold_visibility_until=COALESCE/);
  assert.match(page,/Phiên chưa mở/);
  assert.match(page,/Liên hệ HPZ/);
  assert.match(page,/soldExpired/);
});


test('ISS-2026-0102/0104/0130 ZWMarket preserves Visual Master structure while isolating Stage art',()=>{
  const page=source('frontend/src/ZwMarketPage.jsx');
  const css=source('frontend/src/zwmarket.css');
  const admin=source('frontend/src/WorkspaceAdmin.jsx');
  const stagePath=path.join(root,'frontend/public/zwmarket/stage.png');
  const logoPath=path.join(root,'frontend/public/zwmarket/logo.jpg');

  assert.match(page,/\['home','⌂','Chợ'\]/);
  assert.match(page,/\['explore','⌕','Khám phá'\]/);
  assert.match(page,/\['create','＋','Đăng hàng'\]/);
  assert.match(page,/\['mine','▣','Bài của tôi'\]/);
  assert.match(page,/Thông báo/);
  assert.match(page,/Hướng dẫn/);
  assert.match(page,/CALM DIGITAL NIGHT MARKET/);
  assert.match(page,/Vừa có hàng mới lên chợ/);
  assert.match(page,/Phiên chợ sắp tới/);
  assert.match(page,/Chợ của bạn/);
  assert.match(page,/Hàng mới lên chợ/);
  assert.match(page,/marketApi\.sessions\(true\)/);
  assert.match(page,/formatCountdown/);
  assert.match(page,/zwm-stage-stats/);
  assert.match(page,/zwm-stage-quote/);
  assert.match(page,/zwm-side-art/);
  assert.match(page,/zwm-side-quote/);
  assert.match(page,/zwm-side-mark/);
  assert.match(page,/Lượt xem/);
  assert.match(page,/Lượt liên hệ/);
  assert.match(page,/Phiên chưa mở/);
  assert.match(page,/User khác không thấy hàng trước giờ mở/);
  assert.match(page,/Liên hệ HPZ/);
  assert.match(page,/Không còn khả dụng/);
  assert.match(page,/Lưu & gửi duyệt lại/);
  assert.match(page,/Hàng','Giá','Giao nhận & liên hệ','Phiên \/ Xem lại/);
  assert.doesNotMatch(page,/localStorage\.getItem\('zwm-theme'\)|data-theme=/);
  assert.doesNotMatch(page,/checkout|thanh toán|đặt hàng/i);

  assert.match(css,/90ec01747891960f5e0adb5aceb992be8a7f4cbd094b59da52cdefa38e364e1e/);
  assert.match(css,/--bg:#00131f/);
  assert.match(css,/--navy:#001925/);
  assert.match(css,/--mint:#58e8df/);
  assert.match(css,/\.zwm-shell--rail\{grid-template-columns:205px minmax\(0,1fr\) 308px!important\}/);
  assert.match(css,/height:72px!important/);
  assert.match(css,/padding:139px 18px 20px 0!important/);
  assert.match(css,/height:322px!important/);
  assert.match(css,/top:37px!important;width:41%!important/);
  assert.match(css,/width:132px!important;height:97px!important/);
  assert.match(css,/background:linear-gradient\(90deg,#58e8df,#52d9d4\)!important/);
  assert.ok(css.includes('background:radial-gradient(ellipse at 78% 60%,rgba(24,52,61,.3),transparent 72%)'), 'Stage bitmap must not be reused as sidebar art');
  assert.match(css,/right:42px;top:138px;width:250px/);
  assert.match(css,/grid-template-columns:2fr repeat\(3,1fr\)!important/);
  assert.match(css,/grid-template-columns:repeat\(5,minmax\(130px,1fr\)\)!important/);
  assert.match(css,/url\('\/zwmarket\/stage\.png'\)/);
  assert.match(css,/@media\(max-width:1100px\)/);
  assert.match(css,/@media\(max-width:720px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);

  assert.ok(existsSync(stagePath));
  assert.ok(existsSync(logoPath));
  assert.equal(createHash('sha256').update(readFileSync(stagePath)).digest('hex'),'826f972c903ae44dfac4d91ac493d921ad0e853e30adf6319b373a2dfe50005d');
  assert.equal(createHash('sha256').update(readFileSync(logoPath)).digest('hex'),'e3d023e42e8d64721ad67afcab1d6f6fba35da2fabf45f68c6609afcc0a8700f');

  const moderationIndex=admin.indexOf('<section className="admin-grid">');
  const sessionIndex=admin.indexOf('<ZwMarketAdminSessions/>');
  assert.ok(moderationIndex>=0&&sessionIndex>moderationIndex,'Admin must prioritize moderation/attention before session management');
});


test('ISS-2026-0112 Session Stage countdown follows timestamps without mutating business status',()=>{
  const start='2026-10-08T10:00:00.000Z',end='2026-10-08T12:00:00.000Z';
  const session={status:'UPCOMING',starts_at:start,ends_at:end};
  const before=sessionStageView(session,Date.parse('2026-10-08T09:30:00.000Z'));
  assert.equal(before.phase,'UPCOMING');
  assert.equal(before.countdown,'00:30:00');
  assert.equal(before.progress,0);

  const live=sessionStageView(session,Date.parse('2026-10-08T11:00:00.000Z'));
  assert.equal(live.phase,'OPEN');
  assert.equal(live.countdown,'01:00:00');
  assert.equal(Math.round(live.progress),50);
  assert.equal(session.status,'UPCOMING','display clock must not alter stored business status');

  const ended=sessionStageView({...session,status:'OPEN'},Date.parse('2026-10-08T12:30:00.000Z'));
  assert.equal(ended.phase,'ENDED');
  assert.equal(ended.countdown,'');
  assert.equal(ended.progress,100);

  const invalid=sessionClock({status:'OPEN',starts_at:null,ends_at:null},Date.parse('2026-10-08T11:00:00.000Z'));
  assert.equal(invalid.hasTimeline,false);
  assert.equal(invalid.progress,null);
  assert.equal(countdownText(90061000),'1 ngày 01:01:01');
});

test('ISS-2026-0112 ZWMarket renders session timeline and contains no DEMO production badge',()=>{
  const page=source('frontend/src/ZwMarketPage.jsx');
  const css=source('frontend/src/zwmarket.css');
  assert.match(page,/sessionStageView\(activeSession,now\)/);
  assert.match(page,/zwm-stage-timeline/);
  assert.match(page,/stageView\.progress/);
  assert.match(page,/stageView\.phase==='ENDED'/);
  assert.match(css,/\.zwm-stage-timeline__bar/);
  assert.doesNotMatch(page,/\bDEMO\b/);
});
