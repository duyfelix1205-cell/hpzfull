import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const source=path=>readFileSync(resolve(root,path),'utf8');

const MODEL_FILES=[
 '01_betta.glb','02_koi.glb','03_clownfish.glb','04_discus.glb','05_angelfish.glb',
 '06_oranda_goldfish.glb','07_arowana.glb','08_pufferfish.glb','09_blue_tang.glb','10_shark.glb'
];

test('AquaWorld ships and renders the ten supplied GLB fish species',()=>{
 const page=source('frontend/src/Aquarium3DGamePage.jsx');
 const pkg=source('frontend/package.json');
 assert.ok(page.includes('GLTFLoader'));
 assert.ok(page.includes("MODEL_ROOT='/assets/aquaworld/fish/'"));
 assert.ok(page.includes('modelsLoaded'));
 for(const file of MODEL_FILES)assert.ok(page.includes(file),file+' should be registered');
 assert.ok(pkg.includes('"prebuild": "npm run prepare:fish-assets"'));
 execFileSync(process.execPath,['frontend/scripts/extract-fish-assets.mjs'],{cwd:root,stdio:'pipe'});
 const output=resolve(root,'frontend/public/assets/aquaworld/fish');
 assert.deepEqual(readdirSync(output).sort(),MODEL_FILES.slice().sort());
 for(const file of MODEL_FILES){
  const glb=readFileSync(resolve(output,file));
  assert.equal(glb.subarray(0,4).toString('ascii'),'glTF',file+' must be a GLB');
  assert.ok(glb.length>100000,file+' should contain the supplied full 3D model');
 }
});


test('AquaWorld real-fish prototype preserves the uploaded STL silhouette while staying viewer-safe',()=>{
 const page=source('frontend/src/Aquarium3DGamePage.jsx');
 const model=source('frontend/src/aquaworld-real-fish-01.js');
 const css=source('frontend/src/aquarium3d-game.css');

 assert.match(model,/sourceTriangles:1978908/);
 assert.match(model,/PROFILE=\[/);
 assert.match(model,/MeshPhysicalMaterial/);
 assert.match(model,/vertexColors:true/);
 assert.match(model,/roughness:\.54/);
 assert.match(model,/transparent:true,opacity:\.76/);
 assert.match(model,/realTail/);
 assert.match(model,/realPectoralPivotL/);
 assert.match(model,/SphereGeometry\(\.015/);
 assert.match(model,/uFishTime/);
 assert.match(model,/makeScaleTexture/);

 assert.match(page,/id:'real_fish_01'/);
 assert.match(page,/viewerOnly:true,realistic:true/);
 assert.match(page,/createRealFish01Template\(\)/);
 assert.match(page,/focusPrototype/);
 assert.match(page,/f\.realParts\.tail\.rotation\.z/);
 assert.match(page,/SPECIES\.filter\(s=>!s\.viewerOnly\)/);
 assert.match(page,/ui\.modelsLoaded<SPECIES\.length/);
 assert.match(css,/grid-template-columns:repeat\(5,1fr\)/);

 // The prototype is a frontend-only viewer mesh: no new API/DB contract.
 assert.doesNotMatch(model,/fetch\(|\/api\/v1|localStorage|indexedDB/i);
});
