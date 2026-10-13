const HANOI={name:'Hà Nội',latitude:21.0285,longitude:105.8542};

const localParts=(date=new Date())=>{
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',hourCycle:'h23'
  }).formatToParts(date);
  return Object.fromEntries(parts.map(x=>[x.type,x.value]));
};

export function hanoiDateKey(date=new Date()){
  const p=localParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

export function timeOfDay(date=new Date()){
  const hour=Number(localParts(date).hour||0);
  if(hour<5)return {id:'NIGHT',label:'Đêm',hour};
  if(hour<11)return {id:'MORNING',label:'Buổi sáng',hour};
  if(hour<14)return {id:'NOON',label:'Buổi trưa',hour};
  if(hour<18)return {id:'AFTERNOON',label:'Buổi chiều',hour};
  return {id:'EVENING',label:'Buổi tối',hour};
}

export function festivalFor(date=new Date()){
  const p=localParts(date),month=Number(p.month),day=Number(p.day),weekday=p.weekday;
  if(month===1&&day<=7)return {id:'NEW_YEAR',name:'Phiên chợ đầu năm',emoji:'🧧',bonus:'market'};
  if(month===10&&day>=25)return {id:'HALLOWEEN',name:'Đêm hội cá ma',emoji:'🎃',bonus:'fishing'};
  if(month===12&&day>=20)return {id:'CHRISTMAS',name:'Lễ hội bể cá mùa đông',emoji:'🎄',bonus:'aquarium'};
  if(weekday==='Sat'||weekday==='Sun')return {id:'WEEKEND_MARKET',name:'Chợ phiên cuối tuần',emoji:'🎪',bonus:'market'};
  return {id:'VILLAGE_DAY',name:'Ngày thường ở xóm ven sông',emoji:'🌾',bonus:'balanced'};
}

export function weatherMood(current={}){
  const temperature=Number(current.temperature_2m);
  const precipitation=Number(current.precipitation||0);
  const rain=Number(current.rain||0);
  const wind=Number(current.wind_speed_10m||0);
  const code=Number(current.weather_code||0);
  const isRain=precipitation>0||rain>0||[51,53,55,61,63,65,80,81,82,95,96,99].includes(code);
  if(isRain)return {
    id:'RAIN',label:'Có mưa',emoji:'🌧️',
    fishing_bonus:0.18,farm_bonus:0.08,aquarium_temperature_delta:-0.4,
    headline:'Mưa làm bờ sông nhộn nhịp hơn — hôm nay cá dễ cắn câu.',
    joke:'Bà bảo: “Mưa thì rau vui, cá vui, còn người phơi quần áo thì chưa chắc.”'
  };
  if(Number.isFinite(temperature)&&temperature>=34)return {
    id:'HOT',label:'Nắng nóng',emoji:'☀️',
    fishing_bonus:-0.05,farm_bonus:-0.05,aquarium_temperature_delta:1.2,
    headline:'Trời nóng — rau khát nước và bể cá cần để ý nhiệt độ.',
    joke:'Bà bảo: “Nắng này trứng chưa chiên đã thấy có áp lực rồi.”'
  };
  if(Number.isFinite(temperature)&&temperature<=18)return {
    id:'COOL',label:'Trời lạnh',emoji:'🧥',
    fishing_bonus:0.03,farm_bonus:-0.02,aquarium_temperature_delta:-1,
    headline:'Trời lạnh — cá ăn chậm hơn, bể cần ổn định nhiệt.',
    joke:'Bà bảo: “Lạnh thế này con gà còn muốn xin cái chăn.”'
  };
  if(wind>=28)return {
    id:'WINDY',label:'Gió mạnh',emoji:'💨',
    fishing_bonus:-0.03,farm_bonus:0,aquarium_temperature_delta:-0.2,
    headline:'Gió khá mạnh — bờ sông khó câu hơn một chút.',
    joke:'Bà bảo: “Cái nón bay trước người thì coi như hôm nay gió có thành tích.”'
  };
  return {
    id:'FAIR',label:'Thời tiết dễ chịu',emoji:'🌤️',
    fishing_bonus:0.05,farm_bonus:0.05,aquarium_temperature_delta:0,
    headline:'Thời tiết đẹp — một ngày lý tưởng để chăm vườn và ngắm cá.',
    joke:'Bà bảo: “Trời đẹp thế này mà không làm gì thì cũng… hợp lý.”'
  };
}

export function buildWorld({current=null,source='fallback',date=new Date()}={}){
  const tod=timeOfDay(date),festival=festivalFor(date),mood=weatherMood(current||{temperature_2m:28});
  const temperature=Number(current?.temperature_2m);
  return {
    location:HANOI.name,
    source,
    observed_at:current?.time||date.toISOString(),
    temperature_c:Number.isFinite(temperature)?temperature:28,
    humidity_percent:Number(current?.relative_humidity_2m||70),
    precipitation_mm:Number(current?.precipitation||0),
    wind_kmh:Number(current?.wind_speed_10m||0),
    is_day:current?.is_day==null?(tod.id!=='NIGHT'&&tod.id!=='EVENING'):Boolean(current.is_day),
    time_of_day:tod,
    festival,
    mood
  };
}

let weatherCache={expiresAt:0,value:null};

export async function fetchWorld({signal}={}){
  if(weatherCache.value&&weatherCache.expiresAt>Date.now())return weatherCache.value;
  const url='https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=21.0285&lon=105.8542';
  try{
    const own=!signal&&typeof AbortSignal!=='undefined'&&AbortSignal.timeout?AbortSignal.timeout(4500):signal;
    const response=await fetch(url,{
      signal:own,
      headers:{'user-agent':'catalog.hungtp.click AquaQuest/1.0 https://catalog.hungtp.click/'}
    });
    if(!response.ok)throw new Error('weather '+response.status);
    const data=await response.json();
    const row=data?.properties?.timeseries?.[0];
    const details=row?.data?.instant?.details||{};
    const next=row?.data?.next_1_hours||row?.data?.next_6_hours||{};
    const precipitation=Number(next?.details?.precipitation_amount||0);
    const current={
      time:row?.time,
      temperature_2m:details.air_temperature,
      relative_humidity_2m:details.relative_humidity,
      precipitation,
      rain:precipitation,
      weather_code:precipitation>0?61:0,
      wind_speed_10m:details.wind_speed,
      is_day:null
    };
    const world=buildWorld({current,source:'met-no'});
    world.source_label='MET Norway';
    world.attribution_url='https://api.met.no/';
    weatherCache={value:world,expiresAt:Date.now()+15*60*1000};
    return world;
  }catch{
    const world=buildWorld({source:'fallback'});
    world.source_label='Dữ liệu thời gian dự phòng';
    world.attribution_url=null;
    return world;
  }
}

export function gamePriceFromCatalog(listPrice){
  const n=Number(listPrice||0);
  if(!Number.isFinite(n)||n<=0)return 45;
  return Math.max(20,Math.min(250,Math.round(n/1000)));
}

export function rarityForRoll(roll,bonus=0){
  const r=Math.max(0,Math.min(0.999,Number(roll)-Number(bonus||0)));
  if(r<0.04)return 'EPIC';
  if(r<0.14)return 'RARE';
  if(r<0.34)return 'UNCOMMON';
  return 'COMMON';
}

export const GAME_MISSIONS=[
  {id:'HARVEST',label:'Thu hoạch 2 lần',target:2,reward:20,emoji:'🌱'},
  {id:'FEED_CHICKENS',label:'Cho gà ăn',target:1,reward:15,emoji:'🐔'},
  {id:'FISH_CAST',label:'Câu được 1 con cá',target:1,reward:30,emoji:'🎣'},
  {id:'AQUARIUM_FEED',label:'Cho cá trong bể ăn',target:1,reward:20,emoji:'🐠'},
  {id:'MARKET_SELL',label:'Bán một chuyến hàng ở chợ',target:1,reward:25,emoji:'🧺'}
];

export const GAME_ITEMS={
  vegetables:{code:'vegetables',name:'Rau vườn',type:'CROP'},
  eggs:{code:'eggs',name:'Trứng gà',type:'ANIMAL'},
  bait:{code:'bait',name:'Mồi câu',type:'BAIT'},
  fish_feed:{code:'fish_feed',name:'Thức ăn cá',type:'FEED'},
  river_stone:{code:'river_stone',name:'Đá cuội trang trí',type:'DECOR'}
};
