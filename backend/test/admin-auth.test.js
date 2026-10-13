import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAdminActor, parseRoles } from '../src/lib/admin-auth.js';

test('parseRoles deduplicates trusted roles',()=>assert.deepEqual(parseRoles('catalog-admin, viewer, catalog-admin'),['catalog-admin','viewer']));
test('trusted header auth requires allowed role',()=>{const req={headers:{'x-nexora-user-id':'USR-1','x-nexora-roles':'viewer,catalog-admin'}};const actor=buildAdminActor(req,{adminAuthMode:'trusted_headers',adminAllowedRoles:['catalog-admin']});assert.equal(actor.userId,'USR-1');assert.ok(actor.roles.includes('catalog-admin'))});
test('trusted header auth rejects missing role',()=>{assert.throws(()=>buildAdminActor({headers:{'x-nexora-user-id':'USR-1','x-nexora-roles':'viewer'}},{adminAuthMode:'trusted_headers',adminAllowedRoles:['catalog-admin']}),/role required/i)});
