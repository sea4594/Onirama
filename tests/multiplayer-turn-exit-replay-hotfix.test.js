import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {newGame,act,viewFor} from '../engine/game.js';
import {makeRoom,joinRoom,setReady,startRoom,endRoom,roomView} from '../engine/firebase-protocol.js';
import {opponentReplay} from '../engine/replay.js';
import {resetHotseatReplay,advanceHotseatReplay,readHotseatReplay} from '../engine/hotseat-replay.js';
import {renderActionDock,dockWithReplay} from '../public/tabletop/action-dock.js';
import {renderOverlay} from '../public/game-overlay.js';
import {icon} from '../public/icons.js';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/^import [^\n]+$/gm,'');
function storage(){const db=new Map();return {getItem:k=>db.get(k)??null,setItem:(k,v)=>db.set(k,v),removeItem:k=>db.delete(k)};}
function fakeClient(){
 const app={innerHTML:'',addEventListener(){}},store=storage(),location={hostname:'sea4594.github.io',origin:'https://sea4594.github.io',pathname:'/Onirama/',search:'',hash:'#/multiplayer'};
 const writes=[];
 const firebase={firebaseConfigured:()=>true,firebaseLeave:async code=>{writes.push(['leave',code]);},firebaseEnd:async code=>{writes.push(['end',code]);}};
 const document={documentElement:{dataset:{}},querySelector:q=>q==='#app'?app:null};
 const ctx=vm.createContext({document,app,location,localStorage:store,window:{},navigator:{},addEventListener(){},console,icon,confirm:()=>true,firebase});
 vm.runInContext(source,ctx);
 const enter=(seat=0)=>vm.runInContext(`session={id:'ROOM',uid:'u${seat}',seat:${seat},transport:'firebase'};state={room:{id:'ROOM',code:'ROOM',mode:'coop',started:true,host:${seat===0},seat:${seat}},game:{status:'active'}};version=2;`,ctx);
 return {app,store,location,writes,ctx,enter};
}

test('Replay sits next to Pause with one distinct control for online and hotseat',()=>{
 const game=viewFor(newGame({mode:'coop',seed:11,manualTurnEnd:true}),0);
 const ordinary=renderActionDock(game,0);
 assert.equal(dockWithReplay(ordinary,false),ordinary);
 const dock=dockWithReplay(ordinary,true);
 assert.match(dock,/<div class="tt6-dock-status">[\s\S]*data-action="replayOpen"[\s\S]*data-action="openGamePause"/);
 assert.equal((dock.match(/data-action="replayOpen"/g)||[]).length,1);
 assert.equal((dock.match(/data-action="openGamePause"/g)||[]).length,1);
 assert.ok(dock.indexOf('data-action="replayOpen"')<dock.indexOf('data-action="openGamePause"'));
 const paused='<section data-action-dock><div class="tt6-dock-status"><strong>Waiting</strong><button type="button" class="game-menu-trigger tt27-dock-menu" data-action="openGamePause">Pause</button></div></section>';
 assert.match(dockWithReplay(paused,true),/data-action="replayOpen".*data-action="openGamePause"/);
 const css=readFileSync(new URL('../public/tabletop/phase34.css',import.meta.url),'utf8');
 assert.match(css,/right:38px!important/);
 assert.match(css,/\.tt34-wait-turn[\s\S]*pointer-events:none/);
});

test('Hotseat replays live across turns, hides all private hand faces, and resets for new games',()=>{
 const store=storage();let game=newGame({mode:'coop',seed:482,manualTurnEnd:true,config:{expansions:['book','towers','premonitions']}});
 resetHotseatReplay(store,game);
 assert.equal(readHotseatReplay(store,game).length,1);
 for(let i=0;i<6;i++){
  const previous=game;const command={type:'draft',id:game.draft[0].id};game=act(game,command);
  advanceHotseatReplay(store,previous,game,command);
  assert.equal(readHotseatReplay(store,game).length,i+2);
 }
 const frames=readHotseatReplay(store,game);
 assert.equal(frames.at(-1).actor,1);
 assert.ok(opponentReplay(frames,0).length>=2);
 assert.ok(opponentReplay(frames,1).length>=2);
 for(const item of frames){
  assert.equal(item.frame.deck,undefined);
  for(const player of item.frame.players){for(const c of player.hand){assert.equal(c.kind,'hidden');assert.equal(c.id,undefined);}}
 }
 const fresh=newGame({mode:'coop',seed:894,manualTurnEnd:true});resetHotseatReplay(store,fresh);
 assert.equal(readHotseatReplay(store,fresh).length,1,'old turns must not be replayed in the next game');
 store.setItem('onirama.hotseat.replay.v1','invalid json');assert.deepEqual(readHotseatReplay(store,fresh),[]);
});

test('Host end state is visible to both members; guest cleanup returns to multiplayer',()=>{
 let room=makeRoom('ROOM','host','Host',{});room=joinRoom(room,'guest','Guest');room=startRoom(setReady(room,'guest',true),'host');
 room=endRoom(room,'host');
 assert.equal(roomView(room,'guest').room.ended,true);
 assert.equal(roomView(room,'host').room.ended,true);
 const guest=fakeClient();guest.enter(1);
 vm.runInContext('closeEndedRoom()',guest.ctx);
 assert.equal(guest.location.hash,'#/multiplayer');
 assert.equal(guest.store.getItem('onirama.session'),null);
 assert.match(guest.app.innerHTML,/Multiplayer/);
});

test('Online quit and host end both exit to multiplayer, even if a snapshot wins the Firebase race',async()=>{
 const guest=fakeClient();guest.enter(1);
 await vm.runInContext('handle("gameGoHome")',guest.ctx);
 assert.deepEqual(guest.writes,[['leave','ROOM']]);
 assert.equal(guest.location.hash,'#/multiplayer');
 const host=fakeClient();host.enter(0);
 await vm.runInContext('handle("endRoom")',host.ctx);
 assert.deepEqual(host.writes,[['end','ROOM']]);
 assert.equal(host.location.hash,'#/multiplayer');
 const racy=fakeClient();racy.enter(0);
 racy.ctx.firebase.firebaseEnd=async code=>{racy.writes.push(['end',code]);vm.runInContext('closeEndedRoom()',racy.ctx);};
 await vm.runInContext('handle("endRoom")',racy.ctx);
 assert.deepEqual(racy.writes,[['end','ROOM']]);
 assert.equal(racy.location.hash,'#/multiplayer');
 assert.doesNotMatch(racy.app.innerHTML,/The host ended the game/);
});

test('Online, hotseat, and solo menus maintain distinct exit destinations',()=>{
 const host=renderOverlay('pause',[],true,{multiplayer:true,host:true});
 assert.match(host,/Exit to multiplayer/);assert.match(host,/End game for both/);
 assert.doesNotMatch(host,/data-action="leaveRoom"/);
 const guest=renderOverlay('pause',[],true,{multiplayer:true,host:false});
 assert.match(guest,/Exit to multiplayer/);assert.doesNotMatch(guest,/End game for both/);
 assert.match(renderOverlay('pause',[],true,{hotseat:true}),/Exit to multiplayer/);
 assert.match(renderOverlay('pause',[],false,{}),/Exit game/);
 const src=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(src,/state\.room\.seat!==state\.game\.active/);
 assert.match(src,/state\.room\.mode==='coop'&&!state\.room\.paused/);
 assert.match(src,/\$\{content\}\$\{waitingIndicator\}/);
});
