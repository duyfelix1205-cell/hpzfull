import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildWorld,festivalFor,gamePriceFromCatalog,rarityForRoll,weatherMood,GAME_MISSIONS } from '../src/lib/game-world.js';

const source=rel=>readFileSync(new URL('../../'+rel,import.meta.url),'utf8');

test('AquaQuest migration is additive and isolated from Catalog/AquaCare data',()=>{
  const sql=source('backend/db/migrations/019_aquaquest_game_r1.sql');
  assert.match(sql,/CREATE SCHEMA IF NOT EXISTS game/);
  assert.match(sql,/CREATE TABLE IF NOT EXISTS game\.player/);
  assert.match(sql,/CREATE TABLE IF NOT EXISTS game\.aquarium/);
  assert.match(sql,/CREATE TABLE IF NOT EXISTS game\.fish/);
  assert.match(sql,/CREATE TABLE IF NOT EXISTS game\.daily_progress/);
  assert.doesNotMatch(sql,/DELETE\s+FROM|TRUNCATE|DROP\s+(?:TABLE|SCHEMA)|UPDATE\s+(?:catalog_|aquacare\.|customer_)/i);
});

test('AquaQuest real-world model turns weather and calendar into safe game modifiers',()=>{
  const rainy=weatherMood({temperature_2m:27,precipitation:3,rain:3,weather_code:61,wind_speed_10m:8});
  assert.equal(rainy.id,'RAIN');
  assert.ok(rainy.fishing_bonus>0);
  const hot=weatherMood({temperature_2m:36,precipitation:0,weather_code:1,wind_speed_10m:5});
  assert.equal(hot.id,'HOT');
  assert.ok(hot.aquarium_temperature_delta>0);
  const saturday=festivalFor(new Date('2026-10-03T03:00:00Z'));
  assert.equal(saturday.id,'WEEKEND_MARKET');
  const world=buildWorld({current:{temperature_2m:31,relative_humidity_2m:70,precipitation:0,wind_speed_10m:9,is_day:1,time:'2026-10-03T10:00'},source:'test',date:new Date('2026-10-03T03:00:00Z')});
  assert.equal(world.location,'Hà Nội');
  assert.equal(world.source,'test');
});

test('AquaQuest economy helpers keep Catalog prices inside game-only bounds',()=>{
  assert.equal(gamePriceFromCatalog(92000),92);
  assert.equal(gamePriceFromCatalog(1000),20);
  assert.equal(gamePriceFromCatalog(999999),250);
  assert.equal(rarityForRoll(.01),'EPIC');
  assert.equal(rarityForRoll(.8),'COMMON');
  assert.equal(GAME_MISSIONS.length,5);
  const provider=source('backend/src/lib/game-world.js');
  assert.match(provider,/api\.met\.no\/weatherapi\/locationforecast\/2\.0\/compact/);
  assert.match(provider,/source_label='MET Norway'/);
  assert.doesNotMatch(provider,/api\.open-meteo\.com/);
});

test('AquaQuest is routed, authenticated and discoverable from Catalog navigation',()=>{
  const app=source('backend/src/app.js');
  const route=source('backend/src/routes/game.js');
  const main=source('frontend/src/main.jsx');
  const ui=source('frontend/src/ui/HPZUI.jsx');
  const page=source('frontend/src/GamePage.jsx');
  assert.match(app,/\/api\/v1\/game/);
  assert.match(route,/r\.use\(requireCustomerSession\)/);
  assert.match(route,/AQUARIUM_FEED/);
  assert.match(route,/FISH_CAST/);
  assert.match(route,/MARKET_SELL/);
  assert.match(route,/leaderboard/);
  assert.match(main,/path==='\/game'/);
  assert.match(main,/GamePage/);
  assert.match(ui,/\['game','\/game','Game'\]/);
  assert.match(page,/PHÒNG CÁ CỦA BÀ/);
  assert.match(page,/Đua top xóm ven sông/);
  assert.match(page,/Nông trại/);
  assert.match(page,/Câu cá/);
  assert.match(page,/Chợ/);
});

test('Game tab is a scalable Game Hub that launches registered games',()=>{
  const main=source('frontend/src/main.jsx');
  const hub=source('frontend/src/GameHubPage.jsx');
  const registry=source('frontend/src/game-registry.js');
  const css=source('frontend/src/game-hub.css');
  assert.match(main,/GameHubPage/);
  assert.match(main,/gameHub=path==='\/game'/);
  assert.match(main,/game\?\(gameHub\?GameHubPage:\(wildwood\?WildwoodGamePage:\(aquarium3d\?Aquarium3DGamePage:GamePage\)\)\)/);
  assert.match(registry,/id:'nong-trai-cua-ba'/);
  assert.match(registry,/https:\/\/nongtraicuaba\.vercel\.app\//);
  assert.match(registry,/id:'aquaquest'/);
  assert.match(registry,/href:'\/game\/aquaquest'/);
  assert.match(hub,/HPZ GAME HUB/);
  assert.match(hub,/Chơi gần đây/);
  assert.match(hub,/GAME_CATEGORIES/);
  assert.match(hub,/hpz\.gamehub\.recent\.v1/);
  assert.match(css,/\.gamehub-grid\{/);
  assert.match(css,/@media\(max-width:620px\)/);
});

test('Wildwood is an isolated playable canvas adventure registered in the Game Hub',()=>{
  const main=source('frontend/src/main.jsx');
  const page=source('frontend/src/WildwoodGamePage.jsx');
  const css=source('frontend/src/wildwood-game.css');
  const registry=source('frontend/src/game-registry.js');
  assert.match(main,/WildwoodGamePage/);
  assert.match(main,/wildwood=path==='\/game\/wildwood'/);
  assert.match(registry,/id:'wildwood'/);
  assert.match(registry,/href:'\/game\/wildwood'/);
  assert.match(registry,/categories:\['adventure'\]/);
  assert.match(page,/hpz\.wildwood\.save\.v1/);
  assert.match(page,/requestAnimationFrame/);
  assert.match(page,/Space/);
  assert.match(page,/ShiftLeft/);
  assert.match(page,/KeyE/);
  assert.match(page,/Mầm Sáng/);
  assert.match(page,/Cây Trái Tim/);
  assert.match(page,/wildwood-mobile-controls/);
  assert.match(css,/\.wildwood-canvas/);
  assert.match(css,/\.wildwood-joystick/);
  assert.doesNotMatch(page,/fetch\(|gameApi|catalogApi|customerApi/);
});

test('AquaWorld 3D is an isolated Three.js aquarium game registered in the Game Hub',()=>{
  const main=source('frontend/src/main.jsx');
  const page=source('frontend/src/Aquarium3DGamePage.jsx');
  const css=source('frontend/src/aquarium3d-game.css');
  const registry=source('frontend/src/game-registry.js');
  const pkg=source('frontend/package.json');
  assert.match(main,/Aquarium3DGamePage/);
  assert.match(main,/aquarium3d=path==='\/game\/aquarium-3d'/);
  assert.match(registry,/id:'aquarium-3d'/);
  assert.match(registry,/href:'\/game\/aquarium-3d'/);
  assert.match(registry,/categories:\['aquarium'\]/);
  assert.match(pkg,/"three": "\^0\.180\.0"/);
  assert.match(page,/from'three'/);
  assert.match(page,/OrbitControls/);
  assert.match(page,/hpz\.aquarium3d\.save\.v1/);
  assert.match(page,/scatterFood/);
  assert.match(page,/cleanTank/);
  assert.match(page,/aerate/);
  assert.match(page,/buyFish/);
  assert.match(page,/Chạm vào mặt nước để rắc thức ăn/);
  assert.match(page,/Ngọc Biển/);
  assert.match(css,/\.aqua3d-stage/);
  assert.match(css,/\.aqua3d-panel/);
  assert.doesNotMatch(page,/fetch\(|gameApi|catalogApi|customerApi/);
});

test('AquaQuest R2 keeps a fixed mobile frame with draggable wide worlds and lively character actions',()=>{
  const page=source('frontend/src/GamePage.jsx');
  const css=source('frontend/src/game.css');
  const ui=source('frontend/src/ui/HPZUI.jsx');
  assert.match(page,/function SceneViewport/);
  assert.match(page,/onPointerDown=\{pointerDown\}/);
  assert.match(page,/Kéo để khám phá/);
  assert.match(page,/targets=\{HARVEST:/);
  assert.match(page,/motion:'feeding-chickens'/);
  assert.match(page,/aq-caught-fish/);
  assert.match(page,/aq-aquarium-feed-fx/);
  assert.match(page,/bottomNav=\{false\}/);
  assert.match(css,/\.aq-scene-pan\{[\s\S]*overflow:auto/);
  assert.match(css,/touch-action:pan-x pan-y/);
  assert.match(css,/\.aq-world-canvas\{width:1040px!important/);
  assert.match(css,/@keyframes aq-player-walk/);
  assert.match(css,/@keyframes aq-cast-rod/);
  assert.match(css,/@keyframes aq-food-fall/);
  assert.match(css,/@media\(max-width:620px\)\{[\s\S]*width:960px!important/);
  assert.match(ui,/bottomNav=true/);
  assert.match(ui,/\{bottomNav&&<HPZBottomNav/);
});



test('AquaQuest aquarium uses shared 2D fish visuals without changing game actions or economy',()=>{
  const page=source('frontend/src/GamePage.jsx');
  const css=source('frontend/src/game.css');
  assert.match(page,/fish2dBackgroundStyle/);
  assert.match(page,/function Fish2DSprite/);
  assert.match(page,/className="aq-fish2d-sprite"/);
  assert.match(page,/AQUARIUM_FEED/);
  assert.match(page,/AQUARIUM_CLEAN/);
  assert.match(page,/AQUARIUM_ADD/);
  assert.match(page,/AQUARIUM_REMOVE/);
  assert.match(css,/\.aq-swim\.has-fish2d/);
  assert.match(css,/\.aq-fish2d-sprite/);
  assert.doesNotMatch(page,/\/api\/v1\/.*fish2d|fetch\([^)]*fish2d/i);
});

test('AquaQuest daily progress SQL gives PostgreSQL explicit parameter types',()=>{
  const route=source('backend/src/routes/game.js');
  assert.match(route,/jsonb_build_object\(\$3::text,\$4::int\)/);
  assert.match(route,/ARRAY\[\$3::text\]/);
  assert.match(route,/->>\$3::text/);
  assert.match(route,/\+\$4::int/);
});

test('AquaQuest keeps virtual currency separate from CRM loyalty points',()=>{
  const route=source('backend/src/routes/game.js');
  const migration=source('backend/db/migrations/019_aquaquest_game_r1.sql');
  assert.match(migration,/aqua_coin integer/);
  assert.doesNotMatch(route,/point_history|loyalty|customerOrdersAdapter|CRM Orders/i);
});
