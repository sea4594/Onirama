import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeRoom,joinRoom,setReady,startRoom,playRoom,roomView,leaveRoom} from '../engine/firebase-protocol.js';
import {publicFrame,recordReplay,opponentReplay,replayCaption} from '../engine/replay.js';
import {newGame,act} from '../engine/game.js';
function started(){let r=joinRoom(makeRoom('REPL','first','First',{}),'second','Second');r=setReady(setReady(r,'first',true),'second',true);return startRoom(r,'first');}
test('Game start and drafting actions are replayable to partner without private hands or deck',()=>{
 let room=started();assert.equal(room.replay.length,1);assert.equal(room.replay[0].actor,null);assert.equal(room.replay[0].frame.deck,undefined);
 const first=room.game.draft[0].id;room=playRoom(room,'first',room.version,{type:'draft',id:first});
 const second=room.game.draft[0].id;room=playRoom(room,'second',room.version,{type:'draft',id:second});
 const forFirst=roomView(room,'first'),forSecond=roomView(room,'second');
 assert.equal(forFirst.replay.length,3);
 assert.equal(forSecond.replay.length,3);
 assert.equal(opponentReplay(forFirst.replay,0).length,2);
 assert.equal(opponentReplay(forSecond.replay,1).length,2);
 for(const view of [forFirst,forSecond])for(const entry of view.replay){
  assert.equal(entry.frame.deck,undefined);assert.equal(entry.frame.rng,undefined);
  assert.equal(entry.frame.pending?.cards,undefined);
  for(const player of entry.frame.players)for(const card of player.hand){assert.equal(card.kind,'hidden');assert.equal(card.color,undefined);assert.equal(card.id,undefined);}
 }
 assert.equal(room.game.players[0].hand.length,1);assert.equal(room.game.players[1].hand.length,1);
});
test('Recorded snapshots remain unchanged after future game actions and room replacement',()=>{
 let r=started();r=playRoom(r,'first',r.version,{type:'draft',id:r.game.draft[0].id});
 const original=JSON.stringify(r.replay),originalGame=JSON.stringify(r.game);
 r=leaveRoom(r,'first');r=joinRoom(r,'replacement','New player');
 assert.equal(JSON.stringify(r.game),originalGame);
 assert.equal(JSON.stringify(r.replay),original);
 assert.equal(roomView(r,'replacement').replay.length,2);
});
test('Replay history is size bounded over lengthy games and never stores sensitive engine fields',()=>{
 const game=newGame({mode:'coop',config:{expansions:[]}});
 let history=[];
 for(let i=0;i<125;i++)history=recordReplay(history,game,i%2,{type:'draft',id:'secret-card'});
 assert.ok(history.length<=36);
 assert.ok(JSON.stringify(history).length<=170000);
 for(const entry of history){assert.equal(entry.frame.deck,undefined);assert.equal(entry.frame.moduleState,undefined);assert.equal(entry.frame.pileInventory,undefined);assert.equal(entry.frame.events,undefined);assert.equal(entry.action,'draft');}
 assert.equal(replayCaption({action:'draft'}),'Drafted a card');
});
test('Unfamiliar older rooms have no replay and remain joinable',()=>{
 const room=started();delete room.replay;
 assert.deepEqual(roomView(room,'first').replay,[]);
 assert.deepEqual(opponentReplay(undefined,0),[]);
});
test('Reconnection, UI replay and Firebase rules include replay without allowing replay commands',()=>{
 const ui=readFileSync('public/app.js','utf8'),firebase=readFileSync('engine/firebase-protocol.js','utf8');
 const backend=readFileSync('server/index.js','utf8'),rules=readFileSync('firestore.rules','utf8');
 assert.match(ui,/replayOpen/);assert.match(ui,/data-replay-stage/);assert.match(ui,/retryStream\(\)/);assert.match(ui,/visibilitychange/);
 assert.match(firebase,/recordReplay/);assert.match(backend,/recordReplay/);
 assert.match(rules,/request.resource.data.replay is list/);
 assert.match(readFileSync('public/tabletop/phase9.css','utf8'),/pointer-events:none/);
});
test('An action that ends a turn still belongs to the turn that was played',()=>{
 const before={mode:'coop',turn:3,players:[{hand:[]},{hand:[]}],config:{expansions:[]}};
 const after={...before,turn:4};
 // Use complete engine states to preserve the public-view contract.
 const game=newGame({mode:'coop',config:{expansions:[]}});
 const r=recordReplay([],game,null);
 r.push({...r[0],actor:0,turn:3,frame:{...r[0].frame,turn:3}});
 const last=recordReplay(r,{...game,turn:4},0,{type:'confirmDraw'});
 assert.equal(last.at(-1).turn,3);
 assert.equal(opponentReplay(last,1).length,3);
});
