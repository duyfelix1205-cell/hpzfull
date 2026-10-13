import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, normalizeEmail, normalizePhone, tokenHash, verifyPassword } from '../src/lib/customer-auth.js';

test('customer auth normalizes identity inputs',()=>{
  assert.equal(normalizeEmail('  User@GMAIL.com '),'user@gmail.com');
  assert.equal(normalizePhone('+84 912 345 678'),'0912345678');
  assert.equal(normalizePhone('0912.345.678'),'0912345678');
});

test('customer password hash is salted and verifiable',async()=>{
  const a=await hashPassword('my-secret-123');
  const b=await hashPassword('my-secret-123');
  assert.notEqual(a,b);
  assert.equal(await verifyPassword('my-secret-123',a),true);
  assert.equal(await verifyPassword('wrong-password',a),false);
});

test('token hash does not expose raw token',()=>{
  const raw='reset-token-example';
  const hashed=tokenHash(raw);
  assert.notEqual(hashed,raw);
  assert.match(hashed,/^[a-f0-9]{64}$/);
});
