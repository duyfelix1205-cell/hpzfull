export const GAME_CATEGORIES=[
  {id:'all',label:'Tất cả',icon:'✦'},
  {id:'farm',label:'Nông trại',icon:'🌱'},
  {id:'fishing',label:'Câu cá',icon:'🎣'},
  {id:'aquarium',label:'Cá & bể',icon:'🐠'},
  {id:'adventure',label:'Phiêu lưu',icon:'✦'}
];

export const GAME_REGISTRY=[
  {
    id:'nong-trai-cua-ba',
    name:'Nông Trại Của Ba',
    kicker:'Nông trại · Câu cá · Chăm sóc',
    description:'Một thế giới nông trại thư giãn để trồng cây, thu hoạch, câu cá và tận hưởng nhịp sống chậm.',
    href:'https://nongtraicuaba.vercel.app/',
    external:true,
    status:'LIVE',
    statusLabel:'Đang mở',
    featured:true,
    categories:['farm','fishing'],
    tags:['Nông trại','Câu cá','Thư giãn'],
    cover:'farm',
    coverIcon:'🧑‍🌾',
    coverAccent:'🌻',
    playersLabel:'Chơi ngay'
  },
  {
    id:'aquarium-3d',
    name:'HPZ AquaWorld 3D',
    kicker:'Bể cá 3D · Chăm cá · Trang trí',
    description:'Một bể cá 3D sống động để ngắm, cho cá ăn, chăm nước, sưu tầm cá và thay đổi phong cách thủy sinh.',
    href:'/game/aquarium-3d',
    external:false,
    status:'BETA',
    statusLabel:'Beta',
    featured:false,
    categories:['aquarium'],
    tags:['Bể cá 3D','Chăm cá','Thư giãn'],
    cover:'aquarium3d',
    coverIcon:'🐟',
    coverAccent:'🪸',
    playersLabel:'Mở bể 3D'
  },
  {
    id:'wildwood',
    name:'Rừng Linh Mộc',
    kicker:'Phiêu lưu · Chiến đấu · Gieo mầm',
    description:'Đi sâu vào khu rừng huyền ảo, chiến đấu với Bóng Rừng, thu thập Mầm Sáng và đánh thức Cây Trái Tim.',
    href:'/game/wildwood',
    external:false,
    status:'BETA',
    statusLabel:'Beta',
    featured:false,
    categories:['adventure'],
    tags:['Phiêu lưu','Chiến đấu','Khám phá'],
    cover:'wildwood',
    coverIcon:'🗡️',
    coverAccent:'🌲',
    playersLabel:'Vào rừng'
  },
  {
    id:'aquaquest',
    name:'HPZ AquaQuest',
    kicker:'Xóm ven sông · Nông trại · Phòng cá',
    description:'Nông trại ven sông của HPZ với thu hoạch, câu cá, chăm bể, chợ và nhiệm vụ mỗi ngày.',
    href:'/game/aquaquest',
    external:false,
    status:'BETA',
    statusLabel:'Beta',
    featured:false,
    categories:['farm','fishing','aquarium'],
    tags:['Nông trại','Câu cá','Aquarium'],
    cover:'aquaquest',
    coverIcon:'🐠',
    coverAccent:'🏡',
    playersLabel:'Vào game'
  }
];

export const gameById=id=>GAME_REGISTRY.find(game=>game.id===id)||null;
