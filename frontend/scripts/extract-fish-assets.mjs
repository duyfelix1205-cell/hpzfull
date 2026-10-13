import {mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {basename,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inflateRawSync} from 'node:zlib';

const here=dirname(fileURLToPath(import.meta.url));
const frontendRoot=resolve(here,'..');
const archivePath=resolve(frontendRoot,'assets/aquaworld/fish_3d_glb_10_species.zip');
const outputDir=resolve(frontendRoot,'public/assets/aquaworld/fish');
const EXPECTED_MODELS=10;

const zip=readFileSync(archivePath);

rmSync(outputDir,{recursive:true,force:true});
mkdirSync(outputDir,{recursive:true});

let offset=0;
let extracted=0;
while(offset+30<=zip.length){
  const signature=zip.readUInt32LE(offset);
  if(signature!==0x04034b50)break;
  const flags=zip.readUInt16LE(offset+6);
  const method=zip.readUInt16LE(offset+8);
  const compressedSize=zip.readUInt32LE(offset+18);
  const uncompressedSize=zip.readUInt32LE(offset+22);
  const nameLength=zip.readUInt16LE(offset+26);
  const extraLength=zip.readUInt16LE(offset+28);
  if(flags&0x08)throw new Error('Unsupported ZIP data descriptor');
  const nameStart=offset+30;
  const nameEnd=nameStart+nameLength;
  const dataStart=nameEnd+extraLength;
  const dataEnd=dataStart+compressedSize;
  const name=zip.subarray(nameStart,nameEnd).toString('utf8');
  if(dataEnd>zip.length)throw new Error(`Corrupt ZIP entry: ${name}`);
  if(name.endsWith('.glb')){
    const compressed=zip.subarray(dataStart,dataEnd);
    const asset=method===0?compressed:method===8?inflateRawSync(compressed):null;
    if(!asset)throw new Error(`Unsupported ZIP compression method ${method}: ${name}`);
    if(asset.length!==uncompressedSize)throw new Error(`GLB size mismatch: ${name}`);
    if(asset.subarray(0,4).toString('ascii')!=='glTF')throw new Error(`Invalid GLB header: ${name}`);
    writeFileSync(resolve(outputDir,basename(name)),asset);
    extracted++;
  }
  offset=dataEnd;
}

if(extracted!==EXPECTED_MODELS)throw new Error(`Expected ${EXPECTED_MODELS} GLB models, extracted ${extracted}`);
console.log(`[aquaworld] extracted ${extracted} GLB fish models to ${outputDir}`);
