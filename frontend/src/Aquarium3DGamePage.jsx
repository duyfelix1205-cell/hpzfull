import React,{useCallback,useEffect,useMemo,useRef,useState}from'react';
import * as THREE from'three';
import{OrbitControls}from'three/examples/jsm/controls/OrbitControls.js';
import{GLTFLoader}from'three/examples/jsm/loaders/GLTFLoader.js';
import{createRealFish01Template}from'./aquaworld-real-fish-01.js';

const SAVE_KEY='hpz.aquarium3d.save.v1';
const TANK={x:14,y:8,z:7,waterTop:3.45,bottom:-3.2};
const MODEL_ROOT='/assets/aquaworld/fish/';
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const SPECIES=[
 {id:'betta',name:'Betta',price:70,model:'01_betta.glb',size:.55,speed:.68,rarity:'Epic'},
 {id:'koi',name:'Koi',price:48,model:'02_koi.glb',size:.62,speed:.78,rarity:'Hiếm'},
 {id:'clownfish',name:'Clownfish',price:30,model:'03_clownfish.glb',size:.43,speed:1.06,rarity:'Phổ biến'},
 {id:'discus',name:'Discus',price:60,model:'04_discus.glb',size:.5,speed:.72,rarity:'Hiếm'},
 {id:'angelfish',name:'Angelfish',price:65,model:'05_angelfish.glb',size:.5,speed:.72,rarity:'Hiếm'},
 {id:'oranda',name:'Oranda Goldfish',price:52,model:'06_oranda_goldfish.glb',size:.52,speed:.7,rarity:'Khá hiếm'},
 {id:'arowana',name:'Arowana',price:95,model:'07_arowana.glb',size:.8,speed:.86,rarity:'Epic'},
 {id:'pufferfish',name:'Pufferfish',price:55,model:'08_pufferfish.glb',size:.48,speed:.66,rarity:'Khá hiếm'},
 {id:'blue_tang',name:'Blue Tang',price:58,model:'09_blue_tang.glb',size:.5,speed:1,rarity:'Hiếm'},
 {id:'shark',name:'Shark',price:140,model:'10_shark.glb',size:.9,speed:1.08,rarity:'Huyền thoại'},
 {id:'real_fish_01',name:'Cá thật mẫu 01',price:0,size:1.65,speed:.52,rarity:'Viewer prototype',viewerOnly:true,realistic:true}
];
const SPECIES_BY_ID=Object.fromEntries(SPECIES.map(x=>[x.id,x]));
const DEFAULT_COUNTS=Object.fromEntries(SPECIES.map(x=>[x.id,1]));
const normalizeCounts=raw=>{
 const out={...DEFAULT_COUNTS};
 for(const[id,count]of Object.entries(raw||{}))if(SPECIES_BY_ID[id])out[id]=Math.max(0,Math.floor(Number(count)||0));
 if(raw?.neon)out.clownfish=Math.max(out.clownfish,Math.floor(Number(raw.neon)||0));
 if(raw?.guppy)out.blue_tang=Math.max(out.blue_tang,Math.floor(Number(raw.guppy)||0));
 return out;
};
const initialSave=()=>({coins:120,clean:94,oxygen:96,theme:'nature',night:false,counts:{...DEFAULT_COUNTS},fed:0,eaten:0,visits:1});
const loadSave=()=>{try{const x=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');return x?{...initialSave(),...x,counts:normalizeCounts(x.counts)}:initialSave()}catch{return initialSave()}};
const saveState=s=>{try{localStorage.setItem(SAVE_KEY,JSON.stringify(s))}catch{}};
const money=n=>new Intl.NumberFormat('vi-VN').format(Math.max(0,Math.round(n)));
const rand=(a,b)=>a+Math.random()*(b-a);

function proceduralFish(spec,root){
 const bodyMat=new THREE.MeshStandardMaterial({color:0x58b8d8,roughness:.3,metalness:.04});
 const accentMat=new THREE.MeshStandardMaterial({color:0x87dff1,roughness:.34,transparent:true,opacity:.94});
 const body=new THREE.Mesh(new THREE.SphereGeometry(1,20,14),bodyMat);
 body.scale.set(spec.size*1.15,spec.size*.52,spec.size*.55);body.castShadow=true;root.add(body);
 const tail=new THREE.Mesh(new THREE.ConeGeometry(spec.size*.62,spec.size*.86,3),accentMat);
 tail.rotation.z=-Math.PI/2;tail.position.x=-spec.size*1.08;tail.scale.z=.35;root.add(tail);
 return[body,tail];
}
function makeFish(spec,index,templates){
 const group=new THREE.Group(),swimRoot=new THREE.Group();group.add(swimRoot);
 const clickables=[];
 const template=templates.get(spec.id);let realParts=null;
 if(template){
  const model=template.clone(true);model.scale.setScalar(spec.size);swimRoot.add(model);
  model.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;node.userData.fish=null;clickables.push(node)}});
  if(spec.realistic)realParts={
   body:model.getObjectByName('realBody'),tail:model.getObjectByName('realTail'),
   pL:model.getObjectByName('realPectoralPivotL'),pR:model.getObjectByName('realPectoralPivotR')
  };
 }else clickables.push(...proceduralFish(spec,swimRoot));
 group.position.set(rand(-5.5,5.5),rand(-2.2,2.5),rand(-2.5,2.5));
 const fish={id:spec.id+'-'+Date.now()+'-'+index+'-'+Math.random(),spec,group,swimRoot,clickables,realParts,target:new THREE.Vector3(rand(-5.5,5.5),rand(-2,2.6),rand(-2.5,2.5)),hunger:rand(72,100),phase:Math.random()*Math.PI*2};
 for(const mesh of clickables)mesh.userData.fish=fish;
 return fish;
}
function makeRock(scene,x,y,z,s,color=0x52615a){
 const m=new THREE.Mesh(new THREE.DodecahedronGeometry(s,0),new THREE.MeshStandardMaterial({color,roughness:.9}));
 m.position.set(x,y,z);m.scale.y=.6;m.rotation.set(rand(-.2,.2),rand(0,Math.PI),rand(-.1,.1));m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;
}
function makePlant(scene,x,z,h,color=0x42a86b){
 const group=new THREE.Group();group.position.set(x,TANK.bottom+.05,z);
 const stemMat=new THREE.MeshStandardMaterial({color:0x2f7f52,roughness:.7});
 const leafMat=new THREE.MeshStandardMaterial({color,roughness:.65,side:THREE.DoubleSide});
 const stem=new THREE.Mesh(new THREE.CylinderGeometry(.045,.065,h,8),stemMat);stem.position.y=h/2;group.add(stem);
 for(let i=0;i<7;i++){
  const leaf=new THREE.Mesh(new THREE.SphereGeometry(.3,12,8),leafMat);leaf.scale.set(.4,.12,1);leaf.position.set((i%2?1:-1)*.18,.35+i*h/8,0);leaf.rotation.z=(i%2?-.55:.55);leaf.rotation.y=rand(-.45,.45);group.add(leaf);
 }
 scene.add(group);return group;
}

function AquariumScene({saveRef,onUi,selectedRef}){
 const hostRef=useRef(null),apiRef=useRef({});
 useEffect(()=>{
  const host=hostRef.current;if(!host)return;
  let disposed=false;
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(1.7,window.devicePixelRatio||1));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  host.appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x06151e);scene.fog=new THREE.FogExp2(0x0c2f3c,.026);
  const camera=new THREE.PerspectiveCamera(48,1,.1,100);camera.position.set(12,6.8,13);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.055;controls.target.set(0,-.2,0);controls.minDistance=9;controls.maxDistance=25;controls.minPolarAngle=.45;controls.maxPolarAngle=1.52;controls.enablePan=false;
  const hemi=new THREE.HemisphereLight(0xa7ebff,0x163324,1.6);scene.add(hemi);
  const key=new THREE.DirectionalLight(0xdff7ff,2.2);key.position.set(-5,9,6);key.castShadow=true;key.shadow.mapSize.set(1024,1024);scene.add(key);
  const rim=new THREE.PointLight(0x3bd5ff,24,22);rim.position.set(5,1,-3);scene.add(rim);
  const moon=new THREE.PointLight(0x795cff,0,18);moon.position.set(-4,3,1);scene.add(moon);

  const floorMat=new THREE.MeshStandardMaterial({color:0xc9b98a,roughness:.92,metalness:0});
  const floor=new THREE.Mesh(new THREE.BoxGeometry(TANK.x-.35,.25,TANK.z-.35),floorMat);floor.position.y=TANK.bottom-.08;floor.receiveShadow=true;scene.add(floor);
  const backMat=new THREE.MeshStandardMaterial({color:0x12323c,roughness:.85,side:THREE.DoubleSide});
  const back=new THREE.Mesh(new THREE.PlaneGeometry(TANK.x,TANK.y),backMat);back.position.set(0,.25,-TANK.z/2);scene.add(back);

  const glassMat=new THREE.MeshPhysicalMaterial({color:0x9edfff,transparent:true,opacity:.075,roughness:.05,metalness:0,transmission:.45,thickness:.18,side:THREE.DoubleSide,depthWrite:false});
  const glass=new THREE.Mesh(new THREE.BoxGeometry(TANK.x,TANK.y,TANK.z),glassMat);glass.position.y=.25;scene.add(glass);
  const edges=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(TANK.x,TANK.y,TANK.z)),new THREE.LineBasicMaterial({color:0x8bd7ee,transparent:true,opacity:.34}));edges.position.y=.25;scene.add(edges);

  const waterMat=new THREE.MeshPhysicalMaterial({color:0x2a95ad,transparent:true,opacity:.16,roughness:.14,metalness:0,transmission:.32,depthWrite:false,side:THREE.DoubleSide});
  const waterTop=new THREE.Mesh(new THREE.PlaneGeometry(TANK.x-.45,TANK.z-.45,18,10),waterMat);waterTop.rotation.x=-Math.PI/2;waterTop.position.y=TANK.waterTop;scene.add(waterTop);
  const waterBase=waterTop.geometry.attributes.position.array.slice();

  const decor=new THREE.Group();scene.add(decor);
  const archMat=new THREE.MeshStandardMaterial({color:0x6f766d,roughness:.9});
  for(let i=0;i<7;i++)makeRock(decor,rand(-5.5,5.5),TANK.bottom+.18,rand(-2.5,2.4),rand(.3,.8),0x667169);
  makeRock(decor,-2.2,TANK.bottom+.2,-.8,1.1,0x69756c);makeRock(decor,-1.35,TANK.bottom+.1,-1.05,.7,0x53605a);
  for(const p of[[-5.2,-2,2.2],[-4.6,-1.4,1.7],[-3.9,2.0,2.5],[3.7,-2.2,2.1],[4.9,.9,2.4],[2.8,2.2,1.5]])makePlant(decor,p[0],p[1],p[2],p[0]>0?0x49a96e:0x3d8f68);
  const drift=new THREE.Mesh(new THREE.CylinderGeometry(.12,.22,4.7,10),archMat);drift.position.set(.6,TANK.bottom+.42,.45);drift.rotation.z=Math.PI/2.6;drift.rotation.y=.4;drift.castShadow=true;decor.add(drift);

  const bubbleCount=260,bGeo=new THREE.BufferGeometry(),bPos=new Float32Array(bubbleCount*3),bSpeed=new Float32Array(bubbleCount);
  for(let i=0;i<bubbleCount;i++){bPos[i*3]=rand(-6.5,6.5);bPos[i*3+1]=rand(TANK.bottom,TANK.waterTop);bPos[i*3+2]=rand(-3.1,3.1);bSpeed[i]=rand(.18,.72)}
  bGeo.setAttribute('position',new THREE.BufferAttribute(bPos,3));
  const bubbles=new THREE.Points(bGeo,new THREE.PointsMaterial({color:0xb9f4ff,size:.035,transparent:true,opacity:.55,depthWrite:false}));scene.add(bubbles);

  const templates=new Map([['real_fish_01',createRealFish01Template()]]),fish=[],foods=[],clickables=[];
  const addFish=spec=>{const f=makeFish(spec,fish.length,templates);scene.add(f.group);fish.push(f);clickables.push(...f.clickables);return f};
  const rebuildFish=()=>{
   for(const f of fish)scene.remove(f.group);fish.length=0;clickables.length=0;
   for(const[id,count]of Object.entries(saveRef.current.counts||{})){const spec=SPECIES_BY_ID[id];if(!spec)continue;for(let i=0;i<count;i++)addFish(spec)}
  };
  rebuildFish();onUi({modelsLoaded:templates.size});
  const loader=new GLTFLoader();
  Promise.allSettled(SPECIES.filter(spec=>spec.model).map(spec=>new Promise(resolve=>loader.load(MODEL_ROOT+spec.model,gltf=>{templates.set(spec.id,gltf.scene);resolve()},undefined,()=>resolve())))).then(()=>{
   if(disposed)return;rebuildFish();onUi({modelsLoaded:templates.size});
  });

  const foodGeo=new THREE.SphereGeometry(.075,8,6),foodMat=new THREE.MeshStandardMaterial({color:0xd99b43,roughness:.8});
  const dropFood=(x=rand(-5.6,5.6),z=rand(-2.6,2.6))=>{const mesh=new THREE.Mesh(foodGeo,foodMat);mesh.position.set(clamp(x,-6,6),TANK.waterTop-.18,clamp(z,-2.8,2.8));scene.add(mesh);foods.push({mesh,v:rand(.25,.48)});saveRef.current.fed=(saveRef.current.fed||0)+1;saveRef.current.clean=clamp(saveRef.current.clean-.18,0,100);saveState(saveRef.current)};
  const scatterFood=()=>{for(let i=0;i<10;i++)setTimeout(()=>dropFood(rand(-5,5),rand(-2.3,2.3)),i*80)};
  const cleanTank=()=>{saveRef.current.clean=100;saveRef.current.coins=Math.max(0,saveRef.current.coins-4);saveState(saveRef.current)};
  const aerate=()=>{saveRef.current.oxygen=100;saveRef.current.coins=Math.max(0,saveRef.current.coins-3);saveState(saveRef.current)};
  const buyFish=id=>{const spec=SPECIES_BY_ID[id];if(!spec||saveRef.current.coins<spec.price)return false;saveRef.current.coins-=spec.price;saveRef.current.counts[id]=(saveRef.current.counts[id]||0)+1;addFish(spec);saveState(saveRef.current);return true};
  const setTheme=theme=>{saveRef.current.theme=theme;applyTheme(theme);saveState(saveRef.current)};
  const setNight=night=>{saveRef.current.night=night;hemi.intensity=night?.65:1.6;key.intensity=night?.55:2.2;rim.intensity=night?14:24;moon.intensity=night?38:0;scene.background.set(night?0x030711:0x06151e);scene.fog.color.set(night?0x071226:0x0c2f3c);saveState(saveRef.current)};
  const applyTheme=theme=>{
   if(theme==='river'){floorMat.color.set(0x7f735d);backMat.color.set(0x1a3531);waterMat.color.set(0x3b8190);rim.color.set(0x80e1ca)}
   else if(theme==='neon'){floorMat.color.set(0x1c1b2c);backMat.color.set(0x140d2a);waterMat.color.set(0x4e3d96);rim.color.set(0x00eaff)}
   else{floorMat.color.set(0xc9b98a);backMat.color.set(0x12323c);waterMat.color.set(0x2a95ad);rim.color.set(0x3bd5ff)}
  };
  applyTheme(saveRef.current.theme);setNight(Boolean(saveRef.current.night));

  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),topPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-TANK.waterTop);
  let pointerStart=null;
  const pointerDown=e=>{pointerStart={x:e.clientX,y:e.clientY}};
  const pointerUp=e=>{
   if(!pointerStart)return;const moved=Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y);pointerStart=null;if(moved>7)return;
   const r=renderer.domElement.getBoundingClientRect();pointer.x=((e.clientX-r.left)/r.width)*2-1;pointer.y=-((e.clientY-r.top)/r.height)*2+1;raycaster.setFromCamera(pointer,camera);
   const hits=raycaster.intersectObjects(clickables,false);if(hits.length){const f=hits[0].object.userData.fish;if(f){selectedRef.current=f;onUi({selected:{id:f.id,name:f.spec.name,rarity:f.spec.rarity,hunger:Math.round(f.hunger),species:f.spec.id}});return}}
   const p=new THREE.Vector3();if(raycaster.ray.intersectPlane(topPlane,p))dropFood(p.x,p.z);
  };
  renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);

  let last=performance.now(),uiClock=0,saveClock=0,raf=0;
  const clock=now=>{
   raf=requestAnimationFrame(clock);const dt=Math.min(.04,(now-last)/1000||.016);last=now;controls.update();
   saveRef.current.clean=clamp(saveRef.current.clean-dt*.0065,0,100);saveRef.current.oxygen=clamp(saveRef.current.oxygen-dt*.0045,0,100);
   const positions=bGeo.attributes.position.array;for(let i=0;i<bubbleCount;i++){positions[i*3+1]+=bSpeed[i]*dt;if(positions[i*3+1]>TANK.waterTop){positions[i*3+1]=TANK.bottom+rand(0,.3);positions[i*3]=rand(-6.4,6.4);positions[i*3+2]=rand(-3,3)}}bGeo.attributes.position.needsUpdate=true;
   const wp=waterTop.geometry.attributes.position.array;for(let i=0;i<wp.length;i+=3)wp[i+2]=waterBase[i+2]+Math.sin(now*.0015+waterBase[i]*.6+waterBase[i+1]*.4)*.035;waterTop.geometry.attributes.position.needsUpdate=true;waterTop.geometry.computeVertexNormals();
   for(let i=foods.length-1;i>=0;i--){const food=foods[i];food.mesh.position.y-=food.v*dt;food.mesh.rotation.x+=dt;food.mesh.rotation.z+=dt*.6;if(food.mesh.position.y<TANK.bottom+.25){scene.remove(food.mesh);foods.splice(i,1)}}
   for(const f of fish){
    f.hunger=clamp(f.hunger-dt*.12,0,100);
    let targetFood=null,best=999;for(const food of foods){const d=f.group.position.distanceTo(food.mesh.position);if(d<best&&d<5.2){best=d;targetFood=food}}
    if(targetFood)f.target.copy(targetFood.mesh.position);else if(f.group.position.distanceTo(f.target)<.55||Math.random()<dt*.04)f.target.set(rand(-5.6,5.6),rand(-2.45,2.65),rand(-2.6,2.6));
    const dir=f.target.clone().sub(f.group.position),d=dir.length();if(d>.01){dir.normalize();const moodSpeed=(.62+.38*saveRef.current.oxygen/100)*f.spec.speed*(targetFood?1.48:1);f.group.position.addScaledVector(dir,moodSpeed*dt);const yaw=Math.atan2(-dir.z,dir.x);let delta=((yaw-f.group.rotation.y+Math.PI)%(Math.PI*2))-Math.PI;f.group.rotation.y+=delta*Math.min(1,dt*4.5);f.swimRoot.rotation.x=THREE.MathUtils.lerp(f.swimRoot.rotation.x,-dir.y*.16,dt*3)}
    f.group.position.y=clamp(f.group.position.y+Math.sin(now*.0028+f.phase)*.0022,TANK.bottom+.4,TANK.waterTop-.35);f.swimRoot.rotation.z=Math.sin(now*.006*f.spec.speed+f.phase)*.035;
    if(f.realParts){
     const t=now*.001+f.phase;
     if(f.realParts.tail)f.realParts.tail.rotation.z=Math.sin(t*5.4)*.24;
     if(f.realParts.pL)f.realParts.pL.rotation.x=.18+Math.sin(t*3.1)*.14;
     if(f.realParts.pR)f.realParts.pR.rotation.x=-.18-Math.sin(t*3.1)*.14;
     const shader=f.realParts.body?.material?.userData?.shader;if(shader?.uniforms?.uFishTime)shader.uniforms.uFishTime.value=t;
    }
    if(targetFood&&best<.35){const idx=foods.indexOf(targetFood);if(idx>=0){scene.remove(targetFood.mesh);foods.splice(idx,1);f.hunger=100;saveRef.current.eaten=(saveRef.current.eaten||0)+1;saveRef.current.coins+=2;saveRef.current.clean=clamp(saveRef.current.clean-.06,0,100)}}
   }
   uiClock+=dt;saveClock+=dt;if(uiClock>.22){uiClock=0;const total=Object.values(saveRef.current.counts||{}).reduce((a,b)=>a+b,0);const avgH=fish.length?fish.reduce((a,f)=>a+f.hunger,0)/fish.length:0;onUi({coins:saveRef.current.coins,clean:saveRef.current.clean,oxygen:saveRef.current.oxygen,totalFish:total,fed:saveRef.current.fed,eaten:saveRef.current.eaten,theme:saveRef.current.theme,night:saveRef.current.night,happiness:Math.round(clamp((avgH*.55+saveRef.current.clean*.2+saveRef.current.oxygen*.25),0,100))})}if(saveClock>4){saveClock=0;saveState(saveRef.current)}
   renderer.render(scene,camera);
  };
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix()};resize();window.addEventListener('resize',resize);
  const focusFish=f=>{if(!f)return;selectedRef.current=f;onUi({selected:{id:f.id,name:f.spec.name,rarity:f.spec.rarity,hunger:Math.round(f.hunger),species:f.spec.id}});controls.target.copy(f.group.position);camera.position.copy(f.group.position).add(new THREE.Vector3(3,1.8,3.4));controls.update()};
  apiRef.current={dropFood,scatterFood,cleanTank,aerate,buyFish,setTheme,setNight,focusSelected:()=>focusFish(selectedRef.current),focusPrototype:()=>focusFish(fish.find(x=>x.spec.id==='real_fish_01')),reset:()=>{localStorage.removeItem(SAVE_KEY);location.reload()}};
  host.__aquariumApi=apiRef.current;raf=requestAnimationFrame(clock);
  return()=>{disposed=true;cancelAnimationFrame(raf);window.removeEventListener('resize',resize);renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);controls.dispose();renderer.dispose();host.innerHTML='';delete host.__aquariumApi}
 },[onUi,saveRef,selectedRef]);
 return <div ref={hostRef} className="aqua3d-stage"/>;
}

export function Aquarium3DGamePage(){
 const saveRef=useRef(loadSave()),selectedRef=useRef(null);
 const[ui,setUi]=useState(()=>{const s=saveRef.current;return{coins:s.coins,clean:s.clean,oxygen:s.oxygen,totalFish:Object.values(s.counts).reduce((a,b)=>a+b,0),fed:s.fed,eaten:s.eaten,theme:s.theme,night:s.night,happiness:92,modelsLoaded:0,selected:null}});
 const[panel,setPanel]=useState(true),[notice,setNotice]=useState('Chạm vào mặt nước để rắc thức ăn');
 const api=()=>document.querySelector('.aqua3d-stage')?.__aquariumApi;
 useEffect(()=>{document.title='HPZ AquaWorld 3D — Bể cá sống động'},[]);
 const sync=useCallback(p=>setUi(v=>({...v,...p})),[]);
 const act=(fn,msg)=>{const a=api();if(!a?.[fn])return;a[fn]();if(msg){setNotice(msg);setTimeout(()=>setNotice('Chạm vào mặt nước để rắc thức ăn'),2200)}};
 const buy=id=>{const a=api(),spec=SPECIES_BY_ID[id];if(!a?.buyFish)return;if(a.buyFish(id)){setNotice('Đã thả '+spec.name+' vào bể');setTimeout(()=>setNotice('Chạm vào mặt nước để rắc thức ăn'),2200)}else{setNotice('Chưa đủ Ngọc Biển để mua '+spec.name);setTimeout(()=>setNotice('Chạm vào mặt nước để rắc thức ăn'),2200)}};
 const mission=useMemo(()=>[
   {label:'Cá ăn 8 viên thức ăn',done:ui.eaten>=8,progress:Math.min(ui.eaten,8)+' / 8'},
   {label:'Giữ oxy trên 80%',done:ui.oxygen>=80,progress:Math.round(ui.oxygen)+'%'},
   {label:'Bể sạch trên 75%',done:ui.clean>=75,progress:Math.round(ui.clean)+'%'}
 ],[ui]);
 const completed=mission.filter(x=>x.done).length;
 return <div className={'aqua3d-app theme-'+ui.theme+(ui.night?' is-night':'')}>
   <AquariumScene saveRef={saveRef} onUi={sync} selectedRef={selectedRef}/>
   <div className="aqua3d-caustic"/>
   <a className="aqua3d-back" href="/game">← Game Hub</a>
   <div className="aqua3d-topbar">
     <div className="aqua3d-brand"><span>HPZ ORIGINAL</span><b>AQUAWORLD <i>3D</i></b></div>
     <div className="aqua3d-vitals">
       <span><small>Hạnh phúc</small><b>{ui.happiness}%</b></span>
       <span><small>Oxy</small><b>{Math.round(ui.oxygen)}%</b></span>
       <span><small>Sạch</small><b>{Math.round(ui.clean)}%</b></span>
       <span className="coin"><small>AquaCoin</small><b>◈ {money(ui.coins)}</b></span>
     </div>
     <button className="aqua3d-manage" onClick={()=>setPanel(v=>!v)}>{panel?'Đóng':'Quản lý'} ☰</button>
   </div>

   <div className="aqua3d-hint">{ui.modelsLoaded<SPECIES.length?'Đang nạp cá 3D '+ui.modelsLoaded+'/'+SPECIES.length:notice}</div>
   <div className="aqua3d-quick">
     <button onClick={()=>act('scatterFood','Đàn cá đang bơi tới ăn')}>✦<span>Cho ăn</span></button>
     <button onClick={()=>act('cleanTank','Kính và nền bể đã được làm sạch')}>◌<span>Vệ sinh</span></button>
     <button onClick={()=>act('aerate','Oxy đã được bổ sung')}>◉<span>Sục oxy</span></button>
     <button onClick={()=>{api()?.setNight(!ui.night);setUi(v=>({...v,night:!v.night}))}}>{ui.night?'☀':'☾'}<span>{ui.night?'Ban ngày':'Ban đêm'}</span></button>
     <button onClick={()=>act('focusPrototype','Đang focus Cá thật mẫu 01')}>◎<span>Cá thật</span></button>
   </div>

   {panel&&<aside className="aqua3d-panel">
     <section className="aqua3d-section intro"><span className="eyebrow">BỂ CỦA BẠN</span><div className="aqua3d-aquarium-title"><h1>Thủy cung sống</h1><span>{ui.totalFish} cá</span></div><p>Xoay để ngắm toàn bộ bể, cuộn để zoom và chạm trực tiếp lên cá để xem chi tiết. Model 3D: {ui.modelsLoaded}/{SPECIES.length}. Cá thật mẫu 01 được dựng từ profile của STL bạn cung cấp, ưu tiên quan sát hình dáng và chuyển động.</p></section>
     {ui.selected&&<section className="aqua3d-selected"><div><span>ĐANG THEO DÕI</span><h3>{ui.selected.name}</h3><small>{ui.selected.rarity} · Đói {100-ui.selected.hunger}%</small></div><button onClick={()=>api()?.focusSelected()}>Focus</button></section>}
     <section className="aqua3d-section"><div className="aqua3d-section-head"><div><span className="eyebrow">NHIỆM VỤ BỂ</span><h2>Chăm bể hôm nay</h2></div><b>{completed}/3</b></div><div className="aqua3d-missions">{mission.map((m,i)=><div key={i} className={m.done?'done':''}><i>{m.done?'✓':i+1}</i><span><b>{m.label}</b><small>{m.progress}</small></span></div>)}</div></section>
     <section className="aqua3d-section"><div className="aqua3d-section-head"><div><span className="eyebrow">THẢ THÊM CÁ</span><h2>Cửa hàng cá</h2></div></div><div className="aqua3d-shop">{SPECIES.filter(s=>!s.viewerOnly).map(s=><button key={s.id} onClick={()=>buy(s.id)}><span className={'fish-dot '+s.id}/><span><b>{s.name}</b><small>{s.rarity}</small></span><em>◈ {s.price}</em></button>)}</div></section>
     <section className="aqua3d-section"><span className="eyebrow">PHONG CÁCH BỂ</span><div className="aqua3d-themes">{[['nature','Tự nhiên'],['river','Suối đá'],['neon','Neon đêm']].map(([id,label])=><button className={ui.theme===id?'active':''} key={id} onClick={()=>{api()?.setTheme(id);setUi(v=>({...v,theme:id}))}}><i/>{label}</button>)}</div></section>
     <section className="aqua3d-section stats"><div><b>{ui.eaten}</b><small>Viên đã ăn</small></div><div><b>{ui.fed}</b><small>Viên đã rắc</small></div><div><b>{ui.totalFish}</b><small>Cá trong bể</small></div></section>
   </aside>}
   <div className="aqua3d-help"><span>🖱 Kéo: xoay bể</span><span>⌁ Cuộn: zoom</span><span>☝ Chạm nước: cho ăn</span><span>🐠 Chạm cá: xem cá</span></div>
 </div>;
}
