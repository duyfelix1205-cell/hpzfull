import fs from 'node:fs';
import path from 'node:path';
import { pool } from './db.js';
import { confirmLegacyMapping, importConfirmedLegacy, listLegacyMappings, stageLegacyDataset } from './services/legacy-migration.js';

const [command,arg1,arg2,...rest] = process.argv.slice(2);
try {
  if (command === 'stage') {
    if (!arg1) throw new Error('Usage: npm run legacy -- stage <effective-legacy.json>');
    const payload=JSON.parse(fs.readFileSync(path.resolve(arg1),'utf8'));
    console.log(JSON.stringify(await stageLegacyDataset(payload),null,2));
  } else if (command === 'status') {
    const rows=await listLegacyMappings(arg1);
    const counts=rows.reduce((a,r)=>((a[r.match_status]=(a[r.match_status]||0)+1),a),{});
    console.log(JSON.stringify({ count:rows.length,counts,items:rows },null,2));
  } else if (command === 'confirm') {
    if (!arg1 || !arg2) throw new Error('Usage: npm run legacy -- confirm <legacy_key> <PRD-id>');
    console.log(JSON.stringify(await confirmLegacyMapping(arg1,arg2),null,2));
  } else if (command === 'import') {
    const dryRun=!rest.includes('--apply');
    console.log(JSON.stringify(await importConfirmedLegacy({legacyRoot:arg1?path.resolve(arg1):null,dryRun}),null,2));
  } else {
    throw new Error('Commands: stage <json> | status [MATCHED|UNMATCHED|REVIEW_REQUIRED] | confirm <legacy_key> <PRD-id> | import [legacy-root] [--apply]');
  }
} finally { await pool.end(); }
