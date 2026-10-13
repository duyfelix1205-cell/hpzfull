import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { toLegacyRecord } from '../src/lib/legacy.js';

const legacyRoot = path.resolve(process.argv[2] || '');
const output = path.resolve(process.argv[3] || './effective-legacy.json');
if (!legacyRoot || !fs.existsSync(legacyRoot)) throw new Error('Usage: node scripts/extract-effective-legacy.mjs <legacy-repo-root> [output.json]');

const jsRoot = path.join(legacyRoot, 'assets/js');
const scripts = [
  'fish-data.js','fish-fix.js','chuotmy-fix.js','paraiba-fix.js','red-devil-fix.js',
  'cobalt-fix.js','royal-fix.js','mana-altum-fix.js','ica-bar-fix.js','red-allen-fix.js'
];
const context = {
  console,
  document: { addEventListener(){}, getElementById(){ return null; } },
  location: { search: '' },
  URLSearchParams
};
vm.createContext(context);
for (const file of scripts) {
  const full = path.join(jsRoot, file);
  if (!fs.existsSync(full)) throw new Error(`Missing legacy runtime script: ${file}`);
  vm.runInContext(fs.readFileSync(full, 'utf8'), context, { filename: file });
}
const fish = JSON.parse(vm.runInContext('JSON.stringify(FISH)', context));
const items = fish.map((record,index) => toLegacyRecord(record,index));
const payload = {
  metadata: {
    source: 'HPZ Aquaroom legacy runtime',
    extracted_at: new Date().toISOString(),
    script_order: scripts,
    effective_count: items.length
  },
  items
};
fs.writeFileSync(output, JSON.stringify(payload,null,2) + '\n');
console.log(JSON.stringify({ output, effective_count: items.length, with_gallery: items.filter(x=>x.gallery.length).length }, null, 2));
