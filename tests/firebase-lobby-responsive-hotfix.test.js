import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeRoom,joinRoom,setReady,updateSetup,startRoom,playRoom,roomView} from '../engine/firebase-protocol.js';
import {assertConserved} from '../engine/game.js';
import {toFirestore,fromFirestore} from '../public/firebase-wire.js';
const read=p=>readFileSync(p,'utf8');
const max=['book','glyphs','dreamcatchers','towers','premonitions','crossroads','oniverse','mirrors','sphinx'];
// This matches Firestore's nested-array constraint: an array cannot directly
// contain an array at any depth, but maps inside arrays can contain arrays.
function assertFirestoreSafe(value,inArray=false,path='$'){
 if(Array.isArray(value)){
  assert.equal(inArray,false,`Nested array at ${path}`);
  return value.forEach((v,i)=>assertFirestoreSafe(v,true,`${path}[${i}]`));
 }
 if(value&&typeof value==='object')for(const [k,v] of Object.entries(value))assertFirestoreSafe(v,false,`${path}.${k}`);
}
const makeReady=(exps,levels={})=>{
 let room=joinRoom(makeRoom('ABCD','host','Host',{expansions:[]},1000),'guest','Guest',1500);
 room=setReady(room,'guest',true,1600);
 room=updateSetup(room,'host',{expansions:exps,difficulties:levels},2000);
 assert.deepEqual(room.ready,[false,true]);
 return room;
};
test('Firestore serialization round-trips the full game and replay without unsupported nested arrays',()=>{
 for(const [expansions,difficulties] of [
  [[],{}], [['premonitions'],{premonitions:'extreme'}],
  [max,{premonitions:'extreme',towers:'hard',crossroads:'hard',book:'hard'}],
  [['incubus'],{incubus:'true'}]
 ]){
  let room=startRoom(makeReady(expansions,difficulties),'host',3000);
  const wire=toFirestore(room);
  assertFirestoreSafe(wire);
  assert.deepEqual(fromFirestore(wire),room);
  assertConserved(fromFirestore(wire).game);
  assert.equal(roomView(fromFirestore(wire),'guest').room.ready[1],true);
  for(let i=0;i<Math.min(4,room.game.draft.length);i++){
   const current=fromFirestore(toFirestore(room));
   room=playRoom(current,current.game.active===0?'host':'guest',current.version,{type:'draft',id:current.game.draft[0].id},3001+i);
   assertFirestoreSafe(toFirestore(room));
   assert.deepEqual(fromFirestore(toFirestore(room)),room);
   assertConserved(room.game);
  }
 }
});
test('Nested-array tags are used only when needed, including replay arrays and arbitrary list depth',()=>{
 const object={ready:[false,true],matrix:[[1,2],[],[3,[4]]],entries:[{stacks:[[1]]}],config:{expansions:['book']}};
 const wire=toFirestore(object);
 assert.deepEqual(wire.ready,object.ready);
 assert.deepEqual(wire.config,object.config);
 assertFirestoreSafe(wire);
 assert.deepEqual(fromFirestore(wire),object);
 const legacy=makeReady([]);assert.deepEqual(fromFirestore(legacy),legacy);
});
test('Host setup retains guest readiness; published Firestore rules allow this without weakening ready writes',()=>{
 let room=makeReady(['premonitions']);
 assert.equal(room.ready[1],true);
 room=updateSetup(room,'host',{expansions:['premonitions','towers'],difficulties:{premonitions:'extreme'}},3000);
 assert.deepEqual(room.ready,[false,true]);
 assert.doesNotThrow(()=>startRoom(room,'host',4000));
 const rules=read('firestore.rules');
 assert.match(rules,/request\.resource\.data\.ready == resource\.data\.ready/);
 assert.match(rules,/changedOnly\(\['config','updatedAt','version'\]\)/);
 assert.match(rules,/request\.resource\.data\.ready\[1-seat\(\)\] == resource\.data\.ready\[1-seat\(\)\]/);
 assert.doesNotMatch(rules.slice(rules.indexOf('function setupChange()'),rules.indexOf('function readyChange()')),/request\.resource\.data\.ready == \[false,false\]/);
});
test('Host uses immediate optimistic UI and a coalescing asynchronous lobby write queue',()=>{
 const app=read('public/app.js');
 assert.match(app,/setupPending=\{roomId,desired:config,optimistic:config,inFlight:false\}/);
 assert.match(app,/setupPending\.desired=config;setupPending\.optimistic=config/);
 assert.match(app,/config:room\.host&&setupPending\?\.roomId===room\.code\?setupPending\.optimistic:room\.config/);
 assert.match(app,/return queueLobbySetup\(true\)/);
 assert.match(app,/if\(!fast\|\|!syncLobbySetupControls\(\)\)render\(\)/);
 assert.match(app,/&&setupPending\?\.roomId!==room\.code\?'':'disabled'/);
 assert.doesNotMatch(app,/Changing expansions resets the guest's readiness/);
});
test('Difficulty selects are compact at Normal and expand only for long selected labels',()=>{
 const css=read('public/shell.css');
 assert.match(css,/\.shell \.shell-difficulty\{[^}]*width:86px;[^}]*box-sizing:border-box/);
 assert.match(css,/data-current-level=\"extreme\"/);
 assert.match(read('public/app.js'),/Very hard \(6\)/);
});
test('Firestore adapter handles every room transaction path, including viewing and leaving',()=>{
 const adapter=read('public/firebase-room.js');
 for(const code of ['tx.set(ref,toFirestore(next))','fromFirestore(snap.data())','toFirestore(leaveRoom(fromFirestore(snap.data()),c.uid))'])assert.ok(adapter.includes(code),code);
});
