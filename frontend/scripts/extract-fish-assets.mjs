import {copyFileSync, mkdirSync, readdirSync, rmSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here=dirname(fileURLToPath(import.meta.url));
const frontendRoot=resolve(here,'..');
const sourceDir=resolve(frontendRoot,'assets/aquaworld/fish_3d_glb_10_species');
const outputDir=resolve(frontendRoot,'public/assets/aquaworld/fish');
const models=readdirSync(sourceDir).filter((name)=>name.endsWith('.glb'));

if(models.length!==10) throw new Error(`Expected 10 GLB models, found ${models.length}`);

rmSync(outputDir,{recursive:true,force:true});
mkdirSync(outputDir,{recursive:true});
for(const model of models) copyFileSync(resolve(sourceDir,model),resolve(outputDir,model));
console.log(`[aquaworld] copied ${models.length} GLB fish models to ${outputDir}`);
