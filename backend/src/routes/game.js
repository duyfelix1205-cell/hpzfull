import { Router } from 'express';
import { many, one, tx } from '../db.js';
import { AppError } from '../lib/errors.js';
import { requireCustomerSession } from '../middleware/customer-session.js';
import { mediaPublicUrl } from '../lib/media.js';
import { fetchWorld,gamePriceFromCatalog,rarityForRoll,GAME_MISSIONS,GAME_ITEMS,hanoiDateKey } from '../lib/game-world.js';

const r=Router();
r.use(requireCustomerSession);

const clip=(v,max=120)=>String(v??'').trim().slice(0,max);
const int=(v,fallback=1)=>{const n=Math.trunc(Number(v));return Number.isFinite(n)?n:fallback};
const today=()=>hanoiDateKey(new Date());

async function ensurePlayer(client,accountId){
  const date=today();
  const player=await one(`
    INSERT INTO game.player(account_id,last_login_date)
    VALUES($1,$2::date)
    ON CONFLICT(account_id) DO UPDATE SET
      streak_days=CASE
        WHEN game.player.last_login_date=$2::date THEN game.player.streak_days
        WHEN game.player.last_login_date=$2::date-1 THEN game.player.streak_days+1
        ELSE 1
      END,
      last_login_date=$2::date,
      updated_at=now()
    RETURNING *`,[accountId,date],client);

  const defaults=[
    [GAME_ITEMS.vegetables,4],
    [GAME_ITEMS.eggs,2],
    [GAME_ITEMS.bait,8],
    [GAME_ITEMS.fish_feed,5],
    [GAME_ITEMS.river_stone,0]
  ];
  for(const [item,qty] of defaults){
    await client.query(`
      INSERT INTO game.inventory(account_id,item_code,item_name,item_type,quantity)
      VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(account_id,item_code) DO NOTHING`,
      [accountId,item.code,item.name,item.type,qty]);
  }
  const aquarium=await one(`
    INSERT INTO game.aquarium(account_id)
    VALUES($1)
    ON CONFLICT(account_id) DO UPDATE SET updated_at=game.aquarium.updated_at
    RETURNING *`,[accountId],client);
  await client.query(`
    INSERT INTO game.daily_progress(account_id,game_date)
    VALUES($1,$2::date)
    ON CONFLICT(account_id,game_date) DO NOTHING`,[accountId,date]);

  // Gentle time progression: care matters, but the game never kills fish while the player is away.
  await client.query(`
    UPDATE game.fish
       SET hunger=GREATEST(35,hunger-LEAST(12,FLOOR(EXTRACT(EPOCH FROM(now()-updated_at))/7200)::int)),
           happiness=GREATEST(45,happiness-LEAST(8,FLOOR(EXTRACT(EPOCH FROM(now()-updated_at))/10800)::int)),
           updated_at=now()
     WHERE account_id=$1 AND updated_at<now()-interval '2 hours'`,[accountId]);
  return {player,aquarium};
}

async function addInventory(client,accountId,item,delta){
  const row=await one(`
    INSERT INTO game.inventory(account_id,item_code,item_name,item_type,quantity)
    VALUES($1,$2,$3,$4,GREATEST(0,$5))
    ON CONFLICT(account_id,item_code) DO UPDATE SET
      quantity=GREATEST(0,game.inventory.quantity+$5),
      updated_at=now()
    RETURNING *`,[accountId,item.code,item.name,item.type,delta],client);
  return row;
}

async function takeInventory(client,accountId,itemCode,qty){
  const row=await one(`
    UPDATE game.inventory SET quantity=quantity-$3,updated_at=now()
     WHERE account_id=$1 AND item_code=$2 AND quantity>=$3
    RETURNING *`,[accountId,itemCode,qty],client);
  if(!row)throw new AppError('Không đủ vật phẩm.',{status:409,code:'GAME_INVENTORY_SHORT'});
  return row;
}

async function award(client,accountId,{xp=0,coins=0,reputation=0}={}){
  const player=await one(`
    UPDATE game.player SET
      xp=xp+$2,
      aqua_coin=GREATEST(0,aqua_coin+$3),
      reputation=GREATEST(0,reputation+$4),
      level=GREATEST(level,FLOOR((xp+$2)/120.0)::int+1),
      updated_at=now()
    WHERE account_id=$1
    RETURNING *`,[accountId,xp,coins,reputation],client);
  return player;
}

async function countAction(client,accountId,action,increment=1){
  const date=today();
  const row=await one(`
    INSERT INTO game.daily_progress(account_id,game_date,action_counts)
    VALUES($1,$2::date,jsonb_build_object($3::text,$4::int))
    ON CONFLICT(account_id,game_date) DO UPDATE SET
      action_counts=jsonb_set(
        game.daily_progress.action_counts,
        ARRAY[$3::text],
        to_jsonb(COALESCE((game.daily_progress.action_counts->>$3::text)::int,0)+$4::int),
        true
      ),
      updated_at=now()
    RETURNING *`,[accountId,date,action,increment],client);
  return row;
}

async function logAction(client,accountId,action,detail={}){
  await client.query('INSERT INTO game.activity(account_id,action_type,detail_jsonb) VALUES($1,$2,$3::jsonb)',[accountId,action,JSON.stringify(detail)]);
}

async function cooldown(client,accountId,action,seconds){
  const row=await one('SELECT created_at FROM game.activity WHERE account_id=$1 AND action_type=$2 ORDER BY created_at DESC LIMIT 1',[accountId,action],client);
  if(row){
    const remaining=seconds-Math.floor((Date.now()-new Date(row.created_at).getTime())/1000);
    if(remaining>0)throw new AppError(`Chờ ${remaining}s rồi làm tiếp nhé.`,{status:429,code:'GAME_COOLDOWN'});
  }
}

async function catalogFish(client,limit=8){
  const rows=await many(`
    SELECT s.product_id,s.product_name AS name,c.secondary_name,s.list_price,s.price_text,m.storage_key
      FROM catalog_product_source s
      JOIN catalog_content c USING(product_id)
      LEFT JOIN LATERAL (
        SELECT storage_key FROM catalog_media
         WHERE product_id=s.product_id AND media_type='IMAGE'
         ORDER BY is_primary DESC,sort_order,created_at LIMIT 1
      ) m ON true
     WHERE c.publish_status='PUBLISHED'
       AND COALESCE(s.product_type,'FISH')='FISH'
     ORDER BY c.featured DESC,c.sort_order,s.product_name
     LIMIT $1`,[limit],client);
  return rows.map(({storage_key,...x})=>({...x,game_price:gamePriceFromCatalog(x.list_price),image_url:storage_key?mediaPublicUrl(storage_key):null}));
}

function missionView(daily){
  const counts=daily?.action_counts||{};
  return GAME_MISSIONS.map(m=>({
    ...m,
    progress:Math.min(m.target,Number(counts[m.id]||0)),
    done:Number(counts[m.id]||0)>=m.target
  }));
}

async function stateFor(accountId){
  const world=await fetchWorld();
  return tx(async client=>{
    const {player,aquarium}=await ensurePlayer(client,accountId);
    const [inventory,fish,daily,market,recent,leaderboard]=await Promise.all([
      many('SELECT item_code,item_name,item_type,quantity FROM game.inventory WHERE account_id=$1 ORDER BY item_type,item_name',[accountId],client),
      many(`
        SELECT f.*,m.storage_key
          FROM game.fish f
          LEFT JOIN LATERAL (
            SELECT storage_key FROM catalog_media
             WHERE product_id=f.product_id AND media_type='IMAGE'
             ORDER BY is_primary DESC,sort_order,created_at LIMIT 1
          ) m ON true
         WHERE f.account_id=$1 ORDER BY f.acquired_at DESC`,[accountId],client),
      one('SELECT * FROM game.daily_progress WHERE account_id=$1 AND game_date=$2::date',[accountId,today()],client),
      catalogFish(client,8),
      many('SELECT action_type,detail_jsonb,created_at FROM game.activity WHERE account_id=$1 ORDER BY created_at DESC LIMIT 12',[accountId],client),
      many(`SELECT p.account_id,COALESCE(NULLIF(a.display_name,''),'Người chơi HPZ') AS display_name,p.level,p.xp,p.reputation
              FROM game.player p JOIN customer_accounts a USING(account_id)
             ORDER BY p.xp DESC,p.reputation DESC,p.updated_at ASC LIMIT 20`,[],client)
    ]);
    const aquariumFish=fish.filter(x=>x.aquarium_id===aquarium.aquarium_id);
    const storedFish=fish.filter(x=>!x.aquarium_id);
    return {
      player,
      inventory,
      aquarium:{
        ...aquarium,
        effective_temperature_c:Number(aquarium.temperature_c)+Number(world.mood.aquarium_temperature_delta||0),
        fish_count:aquariumFish.length,
        fish:aquariumFish.map(({storage_key,...x})=>({...x,image_url:storage_key?mediaPublicUrl(storage_key):null}))
      },
      fish_storage:storedFish.map(({storage_key,...x})=>({...x,image_url:storage_key?mediaPublicUrl(storage_key):null})),
      daily:{...daily,missions:missionView(daily)},
      market,
      recent_activity:recent,
      leaderboard,
      world
    };
  });
}

r.get('/state',async(req,res,next)=>{try{
  res.set('Cache-Control','no-store');
  res.json(await stateFor(req.customerAccount.account_id));
}catch(e){next(e)}});

r.get('/world',async(_req,res,next)=>{try{
  res.set('Cache-Control','no-store');
  res.json(await fetchWorld());
}catch(e){next(e)}});

r.post('/action',async(req,res,next)=>{try{
  const accountId=req.customerAccount.account_id;
  const action=clip(req.body?.action,40).toUpperCase();
  const payload=req.body?.payload||{};
  const world=(['HARVEST','FISH_CAST','MARKET_SELL'].includes(action))?await fetchWorld():null;
  const result=await tx(async client=>{
    await ensurePlayer(client,accountId);

    if(action==='HARVEST'){
      await cooldown(client,accountId,action,12);
      const bonus=world?.mood?.farm_bonus||0;
      const qty=2+(Math.random()<0.25+bonus?1:0);
      await addInventory(client,accountId,GAME_ITEMS.vegetables,qty);
      await award(client,accountId,{xp:8,coins:3});
      await countAction(client,accountId,'HARVEST');
      const detail={qty,message:`Thu hoạch được ${qty} bó rau. Bà gật gù: “Rau này ra chợ là có người hỏi giá ngay.”`};
      await logAction(client,accountId,action,detail);
      return detail;
    }

    if(action==='FEED_CHICKENS'){
      await cooldown(client,accountId,action,18);
      const eggs=1+(Math.random()<0.35?1:0);
      await addInventory(client,accountId,GAME_ITEMS.eggs,eggs);
      await award(client,accountId,{xp:6,coins:2});
      await countAction(client,accountId,'FEED_CHICKENS');
      const detail={eggs,message:`Gà ăn no và để lại ${eggs} quả trứng. Một con vẫn nhìn bạn như chưa từng được ăn.`};
      await logAction(client,accountId,action,detail);
      return detail;
    }

    if(action==='FISH_CAST'){
      await cooldown(client,accountId,action,4);
      await takeInventory(client,accountId,GAME_ITEMS.bait.code,1);
      const fishChance=Math.min(.96,.78+Math.max(0,Number(world?.mood?.fishing_bonus||0)));
      if(Math.random()>fishChance){
        await addInventory(client,accountId,GAME_ITEMS.river_stone,1);
        await award(client,accountId,{xp:4});
        const detail={caught:false,item:'Đá cuội',message:'Kéo lên được một viên đá rất có tiềm năng… làm đồ trang trí.'};
        await logAction(client,accountId,action,detail);
        return detail;
      }
      const product=await one(`
        SELECT s.product_id,s.product_name AS name,c.secondary_name,s.list_price
          FROM catalog_product_source s JOIN catalog_content c USING(product_id)
         WHERE c.publish_status='PUBLISHED' AND COALESCE(s.product_type,'FISH')='FISH'
         ORDER BY random() LIMIT 1`,[],client);
      const rarity=rarityForRoll(Math.random(),Math.max(0,Number(world?.mood?.fishing_bonus||0))/2);
      const fallback=['Cá rô ven sông','Cá mương ánh bạc','Cá nhỏ xóm mình'][Math.floor(Math.random()*3)];
      const fish=await one(`
        INSERT INTO game.fish(account_id,product_id,fish_name,source,rarity,health,hunger,happiness,size_cm)
        VALUES($1,$2,$3,'CAUGHT',$4,94,70,82,$5)
        RETURNING *`,[accountId,product?.product_id||null,product?.name||fallback,rarity,Number((2+Math.random()*7).toFixed(1))],client);
      const coinBonus={COMMON:4,UNCOMMON:8,RARE:16,EPIC:30}[rarity]||4;
      await award(client,accountId,{xp:12,coins:coinBonus,reputation:rarity==='EPIC'?2:1});
      await countAction(client,accountId,'FISH_CAST');
      const detail={caught:true,fish,weather:world?.mood?.label,message:`Câu được ${fish.fish_name} · ${rarity}. Bà bảo: “Đẹp đấy, mang về bể hay bán thì tùy cháu, đừng hỏi bà giá.”`};
      await logAction(client,accountId,action,detail);
      return detail;
    }

    if(action==='BUY_BAIT'){
      const qty=Math.max(1,Math.min(20,int(payload.qty,5))),cost=qty*2;
      const p=await one('SELECT aqua_coin FROM game.player WHERE account_id=$1',[accountId],client);
      if(Number(p.aqua_coin)<cost)throw new AppError('Không đủ AquaCoin.',{status:409,code:'GAME_COIN_SHORT'});
      await award(client,accountId,{coins:-cost});
      await addInventory(client,accountId,GAME_ITEMS.bait,qty);
      const detail={qty,cost,message:`Mua ${qty} mồi câu, hết ${cost} AquaCoin.`};await logAction(client,accountId,action,detail);return detail;
    }

    if(action==='BUY_FEED'){
      const qty=Math.max(1,Math.min(20,int(payload.qty,3))),cost=qty*5;
      const p=await one('SELECT aqua_coin FROM game.player WHERE account_id=$1',[accountId],client);
      if(Number(p.aqua_coin)<cost)throw new AppError('Không đủ AquaCoin.',{status:409,code:'GAME_COIN_SHORT'});
      await award(client,accountId,{coins:-cost});
      await addInventory(client,accountId,GAME_ITEMS.fish_feed,qty);
      const detail={qty,cost,message:`Mua ${qty} phần thức ăn cá.`};await logAction(client,accountId,action,detail);return detail;
    }

    if(action==='BUY_FISH'){
      const productId=clip(payload.product_id,100);
      const product=await one(`
        SELECT s.product_id,s.product_name AS name,s.list_price
          FROM catalog_product_source s JOIN catalog_content c USING(product_id)
         WHERE s.product_id=$1 AND c.publish_status='PUBLISHED' AND COALESCE(s.product_type,'FISH')='FISH'`,[productId],client);
      if(!product)throw new AppError('Cá này hiện không có trong quầy game.',{status:404,code:'GAME_FISH_NOT_FOUND'});
      const cost=gamePriceFromCatalog(product.list_price);
      const p=await one('SELECT aqua_coin FROM game.player WHERE account_id=$1',[accountId],client);
      if(Number(p.aqua_coin)<cost)throw new AppError('Không đủ AquaCoin.',{status:409,code:'GAME_COIN_SHORT'});
      await award(client,accountId,{coins:-cost,xp:5});
      const fish=await one(`
        INSERT INTO game.fish(account_id,product_id,fish_name,source,rarity,health,hunger,happiness,size_cm)
        VALUES($1,$2,$3,'PURCHASED','COMMON',96,78,80,4)
        RETURNING *`,[accountId,product.product_id,product.name],client);
      const detail={fish,cost,message:`Đã đón ${fish.fish_name} về nhà. Cá đang chờ được thả vào bể.`};await logAction(client,accountId,action,detail);return detail;
    }

    if(action==='AQUARIUM_ADD'){
      const fishId=clip(payload.fish_id,80);
      const aquarium=await one('SELECT * FROM game.aquarium WHERE account_id=$1',[accountId],client);
      const count=Number((await one('SELECT count(*)::int AS n FROM game.fish WHERE account_id=$1 AND aquarium_id=$2',[accountId,aquarium.aquarium_id],client)).n);
      if(count>=aquarium.capacity)throw new AppError('Bể đã đủ cá. Hãy nâng cấp ở phiên bản sau hoặc đưa bớt cá ra kho.',{status:409,code:'GAME_AQUARIUM_FULL'});
      const fish=await one(`
        UPDATE game.fish SET aquarium_id=$3,happiness=LEAST(100,happiness+5),updated_at=now()
         WHERE fish_id=$1 AND account_id=$2 AND aquarium_id IS NULL RETURNING *`,[fishId,accountId,aquarium.aquarium_id],client);
      if(!fish)throw new AppError('Không tìm thấy cá trong kho.',{status:404,code:'GAME_FISH_NOT_FOUND'});
      await award(client,accountId,{xp:4,reputation:1});
      const detail={fish,message:`${fish.fish_name} đã bơi vào bể mới. Có vẻ nó đang đi kiểm tra từng góc nhà.`};await logAction(client,accountId,action,detail);return detail;
    }

    if(action==='AQUARIUM_REMOVE'){
      const fishId=clip(payload.fish_id,80);
      const fish=await one('UPDATE game.fish SET aquarium_id=NULL,updated_at=now() WHERE fish_id=$1 AND account_id=$2 RETURNING *',[fishId,accountId],client);
      if(!fish)throw new AppError('Không tìm thấy cá.',{status:404,code:'GAME_FISH_NOT_FOUND'});
      const detail={fish,message:`${fish.fish_name} đã được chuyển về khu chờ.`};await logAction(client,accountId,action,detail);return detail;
    }

    if(action==='AQUARIUM_FEED'){
      await cooldown(client,accountId,action,20);
      const aquarium=await one('SELECT * FROM game.aquarium WHERE account_id=$1',[accountId],client);
      const n=Number((await one('SELECT count(*)::int n FROM game.fish WHERE account_id=$1 AND aquarium_id=$2',[accountId,aquarium.aquarium_id],client)).n);
      if(!n)throw new AppError('Bể chưa có cá để cho ăn.',{status:409,code:'GAME_AQUARIUM_EMPTY'});
      await takeInventory(client,accountId,GAME_ITEMS.fish_feed.code,1);
      await client.query('UPDATE game.fish SET hunger=LEAST(100,hunger+28),happiness=LEAST(100,happiness+6),updated_at=now() WHERE account_id=$1 AND aquarium_id=$2',[accountId,aquarium.aquarium_id]);
      await client.query('UPDATE game.aquarium SET cleanliness=GREATEST(0,cleanliness-2),last_fed_at=now(),updated_at=now() WHERE aquarium_id=$1',[aquarium.aquarium_id]);
      await award(client,accountId,{xp:8});
      await countAction(client,accountId,'AQUARIUM_FEED');
      const detail={message:'Cả đàn ùa lên ăn như thể từ sáng tới giờ chưa ai từng cho ăn.'};await logAction(client,accountId,action,detail);return detail;
    }

    if(action==='AQUARIUM_CLEAN'){
      await cooldown(client,accountId,action,30);
      const aquarium=await one(`
        UPDATE game.aquarium SET cleanliness=LEAST(100,cleanliness+24),oxygen=LEAST(100,oxygen+6),beauty=LEAST(100,beauty+2),last_cleaned_at=now(),updated_at=now()
         WHERE account_id=$1 RETURNING *`,[accountId],client);
      await award(client,accountId,{xp:10,reputation:1});
      const detail={aquarium,message:'Kính sạch bóng. Bà đi ngang qua bảo: “Giờ mới nhìn rõ con cá nào đang giả vờ đói.”'};await logAction(client,accountId,action,detail);return detail;
    }

    if(action==='MARKET_SELL'){
      const veg=await one('SELECT quantity FROM game.inventory WHERE account_id=$1 AND item_code=$2',[accountId,GAME_ITEMS.vegetables.code],client);
      const eggs=await one('SELECT quantity FROM game.inventory WHERE account_id=$1 AND item_code=$2',[accountId,GAME_ITEMS.eggs.code],client);
      const sellVeg=Math.min(3,Number(veg?.quantity||0)),sellEgg=Math.min(2,Number(eggs?.quantity||0));
      if(!sellVeg&&!sellEgg)throw new AppError('Chưa có rau hoặc trứng để mang ra chợ.',{status:409,code:'GAME_MARKET_EMPTY'});
      if(sellVeg)await takeInventory(client,accountId,GAME_ITEMS.vegetables.code,sellVeg);
      if(sellEgg)await takeInventory(client,accountId,GAME_ITEMS.eggs.code,sellEgg);
      const base=sellVeg*12+sellEgg*18;
      const eventBonus=world?.festival?.bonus==='market'?1.15:1;
      const coins=Math.round(base*eventBonus);
      await award(client,accountId,{xp:12,coins,reputation:2});
      await countAction(client,accountId,'MARKET_SELL');
      const detail={sellVeg,sellEgg,coins,message:`Bán hết giỏ hàng được ${coins} AquaCoin. Một cô khách hỏi giá ba lần rồi vẫn mua đúng giá ban đầu.`};await logAction(client,accountId,action,detail);return detail;
    }

    if(action==='SELL_FISH'){
      const fishId=clip(payload.fish_id,80);
      const fish=await one('SELECT * FROM game.fish WHERE fish_id=$1 AND account_id=$2',[fishId,accountId],client);
      if(!fish)throw new AppError('Không tìm thấy cá.',{status:404,code:'GAME_FISH_NOT_FOUND'});
      const value={COMMON:18,UNCOMMON:32,RARE:60,EPIC:110}[fish.rarity]||18;
      await client.query('DELETE FROM game.fish WHERE fish_id=$1 AND account_id=$2',[fishId,accountId]);
      await award(client,accountId,{coins:value,xp:5,reputation:1});
      const detail={fish_name:fish.fish_name,coins:value,message:`Thương lái mua ${fish.fish_name} với giá ${value} AquaCoin.`};await logAction(client,accountId,action,detail);return detail;
    }

    if(action==='CHAT_NPC'){
      await cooldown(client,accountId,action,45);
      const lines=[
        'Bà Tám bảo cá nhà bạn bơi có phong thái của người không phải trả tiền điện.',
        'Ông chú đầu ngõ hỏi nuôi cá có lời không, rồi kể chuyện câu cá 20 phút.',
        'Bà bảo làm vừa thôi, ngắm bể năm phút cũng được tính là việc quan trọng.'
      ];
      const message=lines[Math.floor(Math.random()*lines.length)];
      await award(client,accountId,{xp:2});
      const detail={message};await logAction(client,accountId,action,detail);return detail;
    }

    if(action==='CLAIM_DAILY'){
      const daily=await one('SELECT * FROM game.daily_progress WHERE account_id=$1 AND game_date=$2::date FOR UPDATE',[accountId,today()],client);
      const missions=missionView(daily);
      if(!missions.every(x=>x.done))throw new AppError('Hoàn thành đủ nhiệm vụ ngày rồi quay lại nhận rương nhé.',{status:409,code:'GAME_DAILY_INCOMPLETE'});
      if(daily.reward_claimed)throw new AppError('Rương hôm nay đã nhận rồi.',{status:409,code:'GAME_DAILY_CLAIMED'});
      await client.query('UPDATE game.daily_progress SET reward_claimed=true,updated_at=now() WHERE account_id=$1 AND game_date=$2::date',[accountId,today()]);
      await award(client,accountId,{xp:60,coins:120,reputation:4});
      const detail={coins:120,xp:60,message:'Mở Rương Xóm Nhỏ: +120 AquaCoin, +60 XP. Bà nói thưởng xong thì mai vẫn phải dậy sớm.'};await logAction(client,accountId,action,detail);return detail;
    }

    throw new AppError('Hành động game không hợp lệ.',{status:400,code:'GAME_ACTION_INVALID'});
  });
  res.json({ok:true,result,state:await stateFor(accountId)});
}catch(e){next(e)}});

export default r;
