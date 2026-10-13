import * as THREE from 'three';

// Viewer-quality runtime proxy derived from the uploaded high-poly STL:
// colorful fish 3d model.stl (~94 MiB, ~1.98M triangles).
// The profile below preserves its deep-bodied silhouette and proportions while
// keeping the browser mesh lightweight enough for smooth inspection.
const ZX=0.4518;
const YX=0.1934;
const PROFILE=[
 [-.50,.0813,.0523,.1815],[-.464,.0764,.0874,.2690],[-.429,.0658,.1179,.3829],
 [-.393,.0587,.1514,.4243],[-.357,.0630,.1826,.4036],[-.321,.0658,.2074,.4082],
 [-.286,.0625,.2361,.4079],[-.250,.0533,.2520,.4317],[-.214,.0445,.2662,.4564],
 [-.179,.0429,.2815,.4749],[-.143,.0511,.2941,.4835],[-.107,.0460,.3180,.4825],
 [-.071,.0186,.3421,.4685],[-.036,-.0175,.3652,.4422],[0,-.0338,.3787,.4069],
 [.036,.0711,.3112,.3735],[.071,.0751,.3009,.3282],[.107,.0444,.3177,.2782],
 [.143,.0207,.3308,.2311],[.179,-.0356,.1783,.2002],[.214,-.0244,.0844,.1743],
 [.250,-.0543,.0836,.1382],[.286,-.0500,.0730,.1120],[.320,-.0420,.0580,.0900]
];

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const rgb=(hex)=>new THREE.Color(hex);

function bodyColor(x,z,ySide){
  const zn=clamp((z+.22)/.44);
  const belly=rgb(0xcfd6c9),mid=rgb(0x607e7b),back=rgb(0x1d332f);
  const c=belly.clone().lerp(mid,clamp(zn/.58)).lerp(back,clamp((zn-.52)/.48));
  const lateral=Math.exp(-Math.pow((zn-.52)/.085,2))*(1-ySide);
  c.multiplyScalar(1-.13*lateral);
  const sheen=(1-ySide)*(.5+.5*Math.sin((x+.5)*24+zn*10));
  c.r=clamp(c.r+sheen*.025);c.g=clamp(c.g+sheen*.055);c.b=clamp(c.b+sheen*.052);
  const warm=clamp((-.27-x)/.23)*clamp((.46-zn)/.46)*.12;
  c.lerp(rgb(0x9a5b3d),warm);
  return c;
}

function makeScaleTexture(){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle='rgba(62,78,74,.16)';ctx.lineWidth=.65;
  for(let row=0;row<15;row++){
    const y=7+row*8.6,offset=row%2?7:0;
    for(let x=-5+offset;x<265;x+=14){
      ctx.beginPath();ctx.arc(x,y,7,Math.PI*.15,Math.PI*.85);ctx.stroke();
    }
  }
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(1.4,1.2);
  tex.anisotropy=4;return tex;
}

function makeBodyGeometry(){
  const seg=28,verts=[],colors=[],uvs=[],indices=[];
  for(let i=0;i<PROFILE.length;i++){
    const[x,zc,zr,yr]=PROFILE[i];
    for(let j=0;j<seg;j++){
      const a=j/seg*Math.PI*2;
      const y=Math.sin(a)*yr*YX;
      const z=(zc+Math.cos(a)*zr)*ZX;
      verts.push(x,y,z);
      const c=bodyColor(x,z,Math.abs(Math.sin(a)));
      colors.push(c.r,c.g,c.b);uvs.push(i/(PROFILE.length-1),j/seg);
    }
  }
  for(let i=0;i<PROFILE.length-1;i++)for(let j=0;j<seg;j++){
    const a=i*seg+j,b=i*seg+(j+1)%seg,c=(i+1)*seg+j,d=(i+1)*seg+(j+1)%seg;
    indices.push(a,c,b,b,c,d);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  g.setIndex(indices);g.computeVertexNormals();
  return g;
}

function makeFinShape(points,material,name){
  const shape=new THREE.Shape();shape.moveTo(points[0][0],points[0][1]);
  for(let i=1;i<points.length;i++)shape.lineTo(points[i][0],points[i][1]);
  shape.closePath();
  const g=new THREE.ShapeGeometry(shape,2);g.rotateX(Math.PI/2);
  const mesh=new THREE.Mesh(g,material);mesh.name=name;mesh.castShadow=false;
  return mesh;
}

function makePectoral(side,material){
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute([
    0,0,0, .15,0,-.01, .12,.116*side,-.12
  ],3));
  g.setIndex([0,1,2]);g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,material);mesh.name=side>0?'realPectoralL':'realPectoralR';
  return mesh;
}

function installBodySwimShader(material){
  material.onBeforeCompile=shader=>{
    shader.uniforms.uFishTime={value:0};
    shader.vertexShader='uniform float uFishTime;\n'+shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       float rear=smoothstep(0.02,0.32,position.x);
       float wave=sin(uFishTime*5.4 + position.x*9.0);
       transformed.y += wave * 0.021 * rear * rear;`
    );
    material.userData.shader=shader;
  };
  material.customProgramCacheKey=()=> 'hpz-real-fish-01-v1';
}

export function createRealFish01Template(){
  const group=new THREE.Group();group.name='realFish01';
  const bodyMat=new THREE.MeshPhysicalMaterial({
    vertexColors:true,map:makeScaleTexture(),roughness:.54,metalness:0,
    clearcoat:.08,clearcoatRoughness:.7,sheen:.16,sheenColor:new THREE.Color(0x9bc7bd),
    sheenRoughness:.72,ior:1.34,specularIntensity:.32
  });
  installBodySwimShader(bodyMat);
  const body=new THREE.Mesh(makeBodyGeometry(),bodyMat);body.name='realBody';body.castShadow=true;body.receiveShadow=true;group.add(body);

  const finMat=new THREE.MeshPhysicalMaterial({
    color:0xa94128,roughness:.5,metalness:0,transparent:true,opacity:.76,
    side:THREE.DoubleSide,depthWrite:true,clearcoat:.04
  });
  const dorsal=makeFinShape([[-.17,.132],[-.055,.228],[.095,.218],[.165,.125]],finMat,'realDorsal');group.add(dorsal);
  const anal=makeFinShape([[.045,-.123],[.125,-.213],[.215,-.155],[.235,-.075]],finMat,'realAnal');group.add(anal);
  const pelvic=makeFinShape([[-.115,-.118],[-.055,-.205],[.018,-.128]],finMat,'realPelvic');group.add(pelvic);

  const tailPivot=new THREE.Group();tailPivot.name='realTail';tailPivot.position.x=.305;
  const tail=makeFinShape([[0,.052],[.178,.174],[.115,.018],[.168,-.245],[0,-.058]],finMat,'realTailFin');
  tailPivot.add(tail);group.add(tailPivot);

  const pL=new THREE.Group();pL.name='realPectoralPivotL';pL.position.set(-.13,.064,.015);pL.add(makePectoral(1,finMat));group.add(pL);
  const pR=new THREE.Group();pR.name='realPectoralPivotR';pR.position.set(-.13,-.064,.015);pR.add(makePectoral(-1,finMat));group.add(pR);

  const eyeMat=new THREE.MeshPhysicalMaterial({color:0x080b09,roughness:.14,metalness:0,clearcoat:1,clearcoatRoughness:.06});
  const irisMat=new THREE.MeshPhysicalMaterial({color:0x9b7842,roughness:.3,metalness:.08,clearcoat:.35});
  for(const side of[-1,1]){
    const eye=new THREE.Mesh(new THREE.SphereGeometry(.015,18,12),eyeMat);
    eye.position.set(-.398,.064*side,.051);group.add(eye);
    const iris=new THREE.Mesh(new THREE.SphereGeometry(.0075,14,9),irisMat);
    iris.position.set(-.404,.076*side,.052);group.add(iris);
  }

  group.userData.viewerPrototype=true;
  return group;
}

export const REAL_FISH_01_META={
  id:'real_fish_01',
  name:'Cá thật mẫu 01',
  source:'uploaded STL silhouette/profile',
  sourceTriangles:1978908,
  runtimeMode:'profile-derived viewer mesh',
  palette:'natural silver-olive body / warm translucent fins'
};
