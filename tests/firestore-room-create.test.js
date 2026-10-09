import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {allocateRoom} from '../engine/firebase-protocol.js';
const denied=()=>Object.assign(new Error('Missing or insufficient permissions'),{code:'permission-denied'});
test('Room creation writes a valid, uniquely identified room without a missing-document pre-read',async()=>{
  const writes=[];
  const code=await allocateRoom(async (id,doc)=>{writes.push([id,doc]);},()=> 'E2B4C6A8','host','Host',{});
  assert.equal(code,'E2B4C6A8');assert.equal(writes.length,1);
  assert.equal(writes[0][1].code,code);assert.equal(writes[0][1].hostUid,'host');
  assert.deepEqual(writes[0][1].ready,[false,false]);assert.equal(writes[0][1].game,null);
  assert.equal(writes[0][1].version,0);
  const client=readFileSync('public/firebase-room.js','utf8');
  const create=client.split('export async function createFirebaseRoom')[1].split('export async function joinFirebaseRoom')[0];
  assert.match(create,/c\.store\.setDoc/);assert.doesNotMatch(create,/tx\.get|runTransaction/);
});
test('Room creation retries a colliding code without overwriting an existing room',async()=>{
  let attempts=0;const written=[];
  const code=await allocateRoom(async(id,doc)=>{
    attempts++;
    if(id==='1234ABCD')throw denied();
    written.push(doc);
  },()=>attempts===0?'1234ABCD':'2345BCDE','host','Host',{});
  assert.equal(code,'2345BCDE');assert.equal(attempts,2);assert.equal(written.length,1);
});
test('Persistent permission-denied returns actionable Firebase console instructions',async()=>{
  let attempts=0;
  await assert.rejects(allocateRoom(async()=>{attempts++;throw denied();},()=> '1234ABCD','host','Host',{},3),
    err=>err.code==='permission-denied'&&/firestore\.rules/.test(err.message)&&/onirama-5124e/.test(err.message));
  assert.equal(attempts,3);
});
test('Other Firestore failures are surfaced immediately, never masked as permission errors',async()=>{
  let attempts=0;
  await assert.rejects(allocateRoom(async()=>{attempts++;throw Object.assign(Error('No network'),{code:'unavailable'});},()=> '1234ABCD','host','Host',{}),/No network/);
  assert.equal(attempts,1);
});
test('Published create rule limits ownership and forbids overwriting existing rooms',()=>{
  const rules=readFileSync('firestore.rules','utf8');
  assert.match(rules,/allow create: if signedIn\(\)/);
  assert.match(rules,/request\.resource\.data\.hostUid == request\.auth\.uid/);
  assert.match(rules,/request\.resource\.data\.version == 0/);
  assert.match(rules,/allow update: if signedIn\(\) && nextVersion\(\)/);
});
