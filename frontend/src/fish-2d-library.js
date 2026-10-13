export const FISH_2D_ATLAS='/assets/fish2d/fish-2d-real-v1.webp';
export const FISH_2D_CELL={width:100,height:50,columns:5,rows:2};

const normalize=value=>String(value||'')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'')
  .toLowerCase()
  .replace(/đ/g,'d')
  .replace(/[^a-z0-9]+/g,' ')
  .trim();

export const FISH_2D_SPECIES=[
  {id:'betta',name:'Betta',variant:'Royal Blue',col:0,row:0,palette:['#2352A3','#5C63D9','#4FA8FF'],aliases:['betta','lia thia','siamese fighting']},
  {id:'koi',name:'Koi',variant:'Kohaku',col:1,row:0,palette:['#F4F0E8','#E85C3A','#C73A25'],aliases:['koi','chep koi','carp koi']},
  {id:'clownfish',name:'Clownfish',variant:'Ocellaris',col:2,row:0,palette:['#EE6D18','#F7F5EC','#25221F'],aliases:['clownfish','clown fish','ca he','ocellaris']},
  {id:'discus',name:'Discus',variant:'Blue Turquoise',col:3,row:0,palette:['#2D9AA0','#78D9D4','#7B4E47'],aliases:['discus','ca dia','dia beo','blue turquoise']},
  {id:'angelfish',name:'Angelfish',variant:'Silver',col:4,row:0,palette:['#D4D9DE','#343A40','#C9B06F'],aliases:['angelfish','angel fish','ca than tien','than tien']},
  {id:'oranda',name:'Oranda Goldfish',variant:'Orange White',col:0,row:1,palette:['#EF8A25','#F4EFE4','#E56C19'],aliases:['oranda','oranda goldfish','ca vang oranda','goldfish']},
  {id:'arowana',name:'Arowana',variant:'Golden',col:1,row:1,palette:['#D3A63C','#7A5A20','#F1D98B'],aliases:['arowana','ca rong','golden arowana']},
  {id:'puffer',name:'Pufferfish',variant:'Spotted',col:2,row:1,palette:['#B9AE53','#EDE3C4','#38362C'],aliases:['pufferfish','puffer fish','ca noc','spotted puffer']},
  {id:'blue_tang',name:'Blue Tang',variant:'Pacific Blue',col:3,row:1,palette:['#2169CF','#1C2535','#F2CE2B'],aliases:['blue tang','pacific blue tang','dory','ca duoi gai xanh']},
  {id:'shark',name:'Shark',variant:'Reef Gray',col:4,row:1,palette:['#75838D','#52616B','#D4DADF'],aliases:['shark','reef shark','ca map']}
];

export function fish2dSpeciesForName(name){
  const value=normalize(name);
  if(!value)return null;
  return FISH_2D_SPECIES.find(spec=>spec.aliases.some(alias=>value.includes(normalize(alias))))||null;
}

export function fish2dSprite(name){
  const species=fish2dSpeciesForName(name);
  if(!species)return null;
  return{
    ...species,
    atlas_url:FISH_2D_ATLAS,
    sx:species.col*FISH_2D_CELL.width,
    sy:species.row*FISH_2D_CELL.height,
    sw:FISH_2D_CELL.width,
    sh:FISH_2D_CELL.height
  };
}

export function fish2dBackgroundStyle(name){
  const species=fish2dSpeciesForName(name);
  if(!species)return null;
  const x=FISH_2D_CELL.columns===1?0:(species.col/(FISH_2D_CELL.columns-1))*100;
  const y=FISH_2D_CELL.rows===1?0:(species.row/(FISH_2D_CELL.rows-1))*100;
  return{
    backgroundImage:`url("${FISH_2D_ATLAS}")`,
    backgroundSize:`${FISH_2D_CELL.columns*100}% ${FISH_2D_CELL.rows*100}%`,
    backgroundPosition:`${x}% ${y}%`,
    backgroundRepeat:'no-repeat'
  };
}
