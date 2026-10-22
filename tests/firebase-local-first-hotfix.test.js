import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createOptimisticQueue} from '../public/firebase-optimistic.js';
import {makeRoom,joinRoom,setReady,startRoom,playRoom,roomView} from '../engine/firebase-protocol.js';

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function basicHarness(){
 let authoritative={version:1,game:{count:0}},failed=[];
 const writes=[],shown=[];
 const queue=createOptimisticQueue({
  latest:()=>authoritative,
  predict:(room,cmd)=>({version:room.version+1,game:{count:room.game.count+cmd.delta}}),
  submit:async(cmd,expectedGame)=>{const deferredWrite=deferred();writes.push({cmd,expectedGame,...deferredWrite});const room=await deferredWrite.promise;authoritative=room;return room;},
  present:(room,optimistic)=>shown.push({room,optimistic}),
  failed:error=>failed.push(error)
 });
 return {queue,writes,shown,failed,get authoritative(){return authoritative;}};
}
test('online moves update synchronously and successive taps queue without network blocking',async()=>{
 const h=basicHarness();
 const a=h.queue.enqueue({delta:1});
 assert.equal(h.shown[0].room.game.count,1);
 assert.equal(h.writes.length,1);
 const b=h.queue.enqueue({delta:2});
 assert.equal(h.shown.at(-1).room.game.count,3);
 assert.equal(h.writes.length,1,'second write waits; second local action does not');
 assert.equal(h.queue.hasPending(),true);
 h.writes[0].resolve({version:2,game:{count:1}});
 await a.settled;await tick();
 assert.equal(h.writes.length,2);
 assert.equal(h.writes[1].expectedGame,JSON.stringify({count:1}));
 h.writes[1].resolve({version:3,game:{count:3}});
 await b.settled;await tick();
 assert.equal(h.queue.hasPending(),false);
 assert.equal(h.shown.at(-1).room.game.count,3);
 assert.equal(h.failed.length,0);
});
test('server rejection rolls back immediately and cancels every queued future action',async()=>{
 const h=basicHarness();const a=h.queue.enqueue({delta:1}),b=h.queue.enqueue({delta:1});
 h.writes[0].reject(Error('permission-denied'));
 await assert.rejects(a.settled,/permission-denied/);
 await assert.rejects(b.settled,/permission-denied/);
 assert.equal(h.shown.at(-1).room.game.count,0);
 assert.equal(h.failed.length,1);
 assert.equal(h.writes.length,1);
 assert.equal(h.queue.hasPending(),false);
});
test('public preview transactions can finish before the predicted action is committed',async()=>{
 const h=basicHarness(),barrier=deferred();
 const action=h.queue.enqueue({delta:1},barrier.promise);
 assert.equal(h.shown[0].room.game.count,1);
 assert.equal(h.writes.length,0);
 barrier.resolve();await tick();
 assert.equal(h.writes.length,1);
 h.writes[0].resolve({version:4,game:{count:1}}); // preview raised room version
 await action.settled;assert.equal(h.failed.length,0);
});
test('illegal local commands never enter the write queue or alter the visible game',()=>{
 const h=basicHarness();
 const rejecting=createOptimisticQueue({latest:()=>h.authoritative,predict:()=>{throw Error('Illegal move');},submit:()=>{throw Error('unreachable');},present:()=>{throw Error('unreachable');},failed:()=>{throw Error('unreachable');}});
 assert.throws(()=>rejecting.enqueue({delta:1}),/Illegal move/);
 assert.equal(rejecting.hasPending(),false);
});
test('multiplayer local prediction uses exactly the Firestore engine and filters the partner hand',()=>{
 let room=makeRoom('ABCD','host','A',{expansions:[]});
 room=joinRoom(room,'guest','B');room=setReady(room,'guest',true);room=startRoom(room,'host');
 const gameBefore=roomView(room,'host');
 const id=gameBefore.game.draft[0].id;
 const predicted=playRoom(room,'host',room.version,{type:'draft',id});
 const host=roomView(predicted,'host'),guest=roomView(predicted,'guest');
 assert.equal(host.version,room.version+1);
 assert.equal(guest.game.players[0].hand[0].kind,'hidden');
 assert.notEqual(guest.game.players[0].hand[0].kind,'location');
 assert.ok(host.game.players[0].hand.some(card=>card.id===id));
 assert.ok(gameBefore.game.draft.some(card=>card.id===id),'prediction never mutates confirmed state');
});
test('application predicts before awaiting Firebase and does not refetch after every committed play',()=>{
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const adapter=readFileSync(new URL('../public/firebase-room.js',import.meta.url),'utf8');
 assert.match(app,/firebase\.firebaseActionImmediate\(roomId,command/);
 assert.match(app,/void queued\.settled\.catch/);
 assert.match(adapter,/return roomView\(room,c\.uid\)/);
 assert.match(adapter,/const room=await c\.store\.runTransaction/);
 assert.match(adapter,/if\(!hasPendingFirebaseActions\(code\)\)onUpdate/);
});
