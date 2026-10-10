import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeRoom,joinRoom,setReady,startRoom,leaveRoom,endRoom,playRoom,roomView,seatFor,hostSeat,ROOM_CODE} from '../engine/firebase-protocol.js';
import {renderPileInspector} from '../public/tabletop/action-dock.js';
const start=()=>{
 let room=makeRoom('PLAY','alice','Alice',{expansions:[]});room=joinRoom(room,'bob','Bob');
 room=setReady(setReady(room,'alice',true),'bob',true);return startRoom(room,'alice');
};
test('Four-letter codes are valid while legacy eight-hex codes remain readable',()=>{
 assert.match('PLAY',ROOM_CODE);assert.match('0123ABCD',ROOM_CODE);assert.doesNotMatch('ABC1',ROOM_CODE);
 const room=makeRoom('ABCD','a','A',{});assert.equal(room.hostSeat,0);assert.equal(room.ended,false);
});
test('Guest departure pauses actions; replacement inherits exactly the same hand and draft turn',()=>{
 let room=start(),before=JSON.stringify(room.game),v=room.version;
 room=leaveRoom(room,'bob');assert.equal(room.version,v+1);assert.equal(room.hostUid,'alice');assert.equal(room.guestUid,null);
 assert.equal(roomView(room,'alice').room.paused,true);assert.equal(roomView(room,'alice').room.host,true);
 assert.throws(()=>playRoom(room,'alice',room.version,{type:'draft',id:room.game.draft[0].id}),/paused/);
 assert.equal(JSON.stringify(room.game),before);
 room=joinRoom(room,'carol','Carol');assert.equal(roomView(room,'carol').room.seat,1);assert.equal(roomView(room,'alice').room.paused,false);
 assert.equal(JSON.stringify(room.game),before);assertConcealed(room,'carol');
 assert.throws(()=>roomView(room,'bob'),/another browser/);
});
function assertConcealed(room,uid){const view=roomView(room,uid);assert.equal(view.game.deck,undefined);assert.equal(view.game.rng,undefined);}
test('Host transfer preserves fixed seat indices and allows replacement of the previous host',()=>{
 let room=start(),snapshot=JSON.stringify(room.game);
 room=leaveRoom(room,'alice');assert.equal(hostSeat(room),1);assert.equal(seatFor(room,'bob'),1);
 assert.equal(roomView(room,'bob').room.host,true);assert.equal(roomView(room,'bob').room.paused,true);
 assert.throws(()=>endRoom(room,'alice'),/host/);
 room=joinRoom(room,'dana','Dana');assert.equal(seatFor(room,'dana'),0);assert.equal(hostSeat(room),1);
 assert.equal(roomView(room,'bob').room.host,true);assert.equal(roomView(room,'dana').room.host,false);
 assert.equal(roomView(room,'dana').room.paused,false);assert.equal(JSON.stringify(room.game),snapshot);
 room=leaveRoom(room,'bob');assert.equal(hostSeat(room),0);assert.equal(roomView(room,'dana').room.host,true);
});
test('Host end terminates the active game for both players; unauthorized end and join are refused',()=>{
 let room=start();assert.throws(()=>endRoom(room,'bob'),/Only the host/);
 room=endRoom(room,'alice');assert.equal(room.ended,true);assert.equal(room.game,null);
 assert.equal(roomView(room,'alice').room.ended,true);assert.equal(roomView(room,'bob').room.ended,true);
 assert.equal(roomView(room,'bob').game,null);
 assert.throws(()=>joinRoom(room,'eve','Eve'),/ended/);
 assert.throws(()=>leaveRoom(room,'bob'),/ended/);
});
test('Lobby host can leave, remaining guest becomes host, and replacement can ready and start',()=>{
 let room=joinRoom(makeRoom('JOIN','alice','Alice',{}),'bob','Bob');
 room=leaveRoom(room,'alice');assert.equal(hostSeat(room),1);
 room=joinRoom(room,'carol','Carol');assert.equal(seatFor(room,'carol'),0);
 room=setReady(setReady(room,'carol',true),'bob',true);
 assert.throws(()=>startRoom(room,'carol'),/Only the host/);
 room=startRoom(room,'bob');assert.equal(room.game.mode,'coop');
});
test('Both seats vacant closes room instead of leaving an ownerless joinable session',()=>{
 let room=makeRoom('EMPT','alone','Solo',{});room=leaveRoom(room,'alone');
 assert.equal(room.ended,true);assert.equal(room.game,null);
 assert.throws(()=>joinRoom(room,'new','New'),/ended/);
});
test('Firestore rules use authenticated blind seat claims and restrict private room reads',()=>{
 const rules=readFileSync('firestore.rules','utf8');
 assert.match(rules,/allow get: if member\(\)/);assert.match(rules,/claimSeat0\(\)/);assert.match(rules,/claimSeat1\(\)/);
 assert.match(rules,/function departing\(\)/);assert.match(rules,/function ending\(\)/);
 assert.match(readFileSync('public/firebase-room.js','utf8'),/store\.updateDoc\(ref/);
 assert.match(readFileSync('public/firebase-room.js','utf8'),/store\.increment\(1\)/);
});
test('Discard inspector puts newest card first in an overlapping, horizontally scrolling history',()=>{
 const cards=[{id:'a',kind:'location',color:'red',symbol:'sun'},{id:'b',kind:'location',color:'blue',symbol:'moon'},{id:'c',kind:'location',color:'green',symbol:'key'}];
 const html=renderPileInspector({discard:cards,pileInventory:[]},'discard');
 assert.match(html,/tt8-discard-history/);assert.match(html,/Recent discards, newest first/);
 assert.ok(html.indexOf('data-card-id="c"')<html.indexOf('data-card-id="b"')||html.indexOf('green')<html.indexOf('blue'));
 const css=readFileSync('public/tabletop/phase7c.css','utf8');assert.match(css,/tt8-discard-history\{[^}]*overflow-x:auto/);
});
test('Server and UI explicitly distinguish leaving from ending; all orientations share one resizing fitter',()=>{
 const server=readFileSync('server/index.js','utf8');const ui=readFileSync('public/app.js','utf8');
 assert.match(server,/operation==='leave'/);assert.match(server,/operation==='end'/);
 assert.match(ui,/async function departRoom/);assert.match(ui,/data-action="copyInvite"/);
 assert.match(ui,/state\.room\.paused/);
 const fit=readFileSync('public/tabletop/fit.js','utf8');assert.match(fit,/height\/scale/);
});
