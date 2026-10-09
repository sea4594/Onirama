import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {makeRoom,joinRoom,setReady,startRoom,playRoom,roomView,seatFor,ROOM_COLLECTION} from '../engine/firebase-protocol.js';
import {assertConserved} from '../engine/game.js';
const config={expansions:['glyphs','crossroads','oniverse','mirrors'],difficulties:{crossroads:'hard'}};
function started(setup=config){const a=makeRoom('0123ABCD','host-uid','Host',setup,1000);const b=joinRoom(a,'guest-uid','Guest',2000);const c=setReady(setReady(b,'host-uid',true),'guest-uid',true);return startRoom(c,'host-uid');}
test('Firebase code rooms have separate immutable seats, ready states, and support rejoining',()=>{
 const r=makeRoom('A1B2C3D4','alice','Alice',{},100);
 assert.equal(r.hostUid,'alice');assert.equal(r.guestUid,null);assert.equal(roomView(r,'alice').room.seat,0);
 assert.equal(joinRoom(r,'bob','Bob',101).guestUid,'bob');
 let a=joinRoom(r,'bob','Bob',101);assert.equal(joinRoom(a,'bob','Changed',102),a,'Same anonymous guest resumes rather than claims a new seat');
 assert.throws(()=>joinRoom(a,'intruder','Eve',103),/full/);assert.throws(()=>joinRoom(r,'bob','Bob',r.expiresAt),/expired/);
 assert.throws(()=>startRoom(a,'bob'),/Only the host/);assert.throws(()=>startRoom(a,'alice'),/ready/);
 a=setReady(a,'alice',true);assert.deepEqual(a.ready,[true,false]);a=setReady(a,'bob',true);assert.deepEqual(a.ready,[true,true]);
 assert.throws(()=>setReady(a,'outsider',true),/member/);assert.equal(seatFor(a,'bob'),1);
});
test('Cloud transactions preserve versions, enforce active seat, and hide private hand in UI view',()=>{
 let r=started(),a=roomView(r,'host-uid'),b=roomView(r,'guest-uid');assert.equal(r.game.phase,'draft');
 assert.equal(a.room.seat,0);assert.equal(b.room.seat,1);assert.equal(a.game.deck,undefined);assert.equal(b.game.deck,undefined);
 const draft=r.game.draft[0].id;r=playRoom(r,'host-uid',r.version,{type:'draft',id:draft});assertConserved(r.game);
 assert.equal(r.game.active,1);assert.equal(roomView(r,'guest-uid').game.players[0].hand[0].kind,'hidden');
 assert.notEqual(roomView(r,'host-uid').game.players[0].hand[0].kind,'hidden');
 assert.throws(()=>playRoom(r,'host-uid',r.version,{type:'draft',id:r.game.draft[0].id}),/not your turn/);
 assert.throws(()=>playRoom(r,'guest-uid',r.version-1,{type:'draft',id:r.game.draft[0].id}),/State changed/);
 r=playRoom(r,'guest-uid',r.version,{type:'draft',id:r.game.draft[0].id});assertConserved(r.game);
 assert.throws(()=>roomView(r,'random-uid'),/another browser session/);
});
test('All four host and guest draft decisions and post-draft legal actions use the shared engine',()=>{
 let r=started({expansions:[]});for(let i=0;i<6;i++){const uid=r.game.active===0?'host-uid':'guest-uid';r=playRoom(r,uid,r.version,{type:'draft',id:r.game.draft[0].id});assertConserved(r.game);}
 assert.equal(r.game.phase,'action');assert.equal(r.game.players[0].hand.length,3);assert.equal(r.game.players[1].hand.length,3);assert.equal(r.game.shared.length,2);
 const uid=r.game.active===0?'host-uid':'guest-uid',card=r.game.players[r.game.active].hand.find(x=>x.kind==='location');
 r=playRoom(r,uid,r.version,{type:'play',id:card.id});assertConserved(r.game);assert.equal(r.version,11);
 assert.equal(roomView(r,'guest-uid').game.deck,undefined);
});
test('All seven standard expansions plus promos initialize consistently in Firestore rooms',()=>{
 const combinations=[[],['book'],['glyphs','towers','dreamcatchers'],['premonitions','crossroads','oniverse'],['mirrors','sphinx'],['book','glyphs','dreamcatchers','towers','premonitions','crossroads','oniverse','mirrors','sphinx']];
 for(const expansions of combinations){const room=started({expansions});assertConserved(room.game);assert.equal(roomView(room,'guest-uid').game.mode,'coop');}
});
test('Browser bundle and published Pages configuration include Firebase transport, no server URL requirement',()=>{
 const dir=mkdtempSync(join(tmpdir(),'onirama-firebase-pages-'));
 try{
  const env={...process.env,ONIRAMA_API_ORIGIN:'',ONIRAMA_FIREBASE_API_KEY:'example-key',ONIRAMA_FIREBASE_AUTH_DOMAIN:'example.firebaseapp.com',ONIRAMA_FIREBASE_PROJECT_ID:'example',ONIRAMA_FIREBASE_APP_ID:'1:123:web:abc'};
  execFileSync(process.execPath,['scripts/build-pages.js',dir],{env});
  const config=readFileSync(join(dir,'runtime-config.js'),'utf8');assert.match(config,/example\.firebaseapp\.com/);assert.match(config,/ONIRAMA_FIREBASE_CONFIG/);
  assert.ok(readFileSync(join(dir,'firebase-room.js'),'utf8').includes('onSnapshot'));
  assert.ok(readFileSync(join(dir,'engine/firebase-protocol.js'),'utf8').includes('playRoom'));
  assert.throws(()=>execFileSync(process.execPath,['scripts/build-pages.js',dir],{env:{...env,ONIRAMA_FIREBASE_PROJECT_ID:''},stdio:'pipe'}));
 }finally{rmSync(dir,{recursive:true,force:true});}
 const rules=readFileSync('firestore.rules','utf8');assert.ok(rules.includes(ROOM_COLLECTION));assert.match(rules,/allow list: if false/);assert.match(rules,/request\.auth\.uid/);
});
test('Local Node server can serve the same engine module paths as GitHub Pages',()=>{
 const code=readFileSync('server/index.js','utf8');
 assert.match(code,/requested\.startsWith\('\/engine\/'\)/);
 assert.match(code,/const directory=fromEngine\?resolve\(root,'\.\.\/engine'\):root/);
});
