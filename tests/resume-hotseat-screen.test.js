import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {newGame} from '../engine/game.js';
import {icon} from '../public/icons.js';
import {renderCard,renderDoors} from '../public/tabletop/cards.js';
import * as guest from '../public/guest-data.js';
import {renderOverlay} from '../public/game-overlay.js';
const source=readFileSync('public/app.js','utf8').replace(/^import [^\n]+$/gm,'');
function ui(route='#/'){
 const db=new Map(),storage={getItem:k=>db.get(k)??null,setItem:(k,v)=>db.set(k,v),removeItem:k=>db.delete(k)};
 const app={innerHTML:'',addEventListener(){}};
 const location={hash:route,origin:'https://sea4594.github.io',hostname:'sea4594.github.io',pathname:'/Onirama/',search:''};
 const document={documentElement:{dataset:{}},querySelector:q=>q==='#app'?app:null};
 const ctx=vm.createContext({app,document,location,localStorage:storage,window:{},navigator:{},addEventListener(){},console,icon,renderCard,renderDoors,...guest,firebase:{firebaseConfigured:()=>true}});
 vm.runInContext(source,ctx);
 return {app,ctx,storage,location,render:()=>vm.runInContext('render()',ctx)};
}
const storeGame=(u,mode,status='active')=>{const g=newGame({mode,names:mode==='solo'?['You']:['Alice','Bob'],manualTurnEnd:mode==='coop'});g.status=status;u.storage.setItem(mode==='solo'?'onirama.solo.v1':'onirama.hotseat.v1',JSON.stringify(g));};
test('solo home offers only Play solo and the active solo resume choice',()=>{
 const u=ui();assert.match(u.app.innerHTML,/Play solo/);assert.doesNotMatch(u.app.innerHTML,/Resume game|Resume saved hot seat|Learn to play/);
 storeGame(u,'coop');u.render();assert.doesNotMatch(u.app.innerHTML,/Resume game/);
 storeGame(u,'solo');u.render();assert.match(u.app.innerHTML,/data-action="resumeLocalSolo"[^>]*>Resume game/);assert.doesNotMatch(u.app.innerHTML,/resumeLocalHotseat/);
 storeGame(u,'solo','won');u.render();assert.doesNotMatch(u.app.innerHTML,/Resume game/);
 u.storage.setItem('onirama.solo.v1','{');u.render();assert.doesNotMatch(u.app.innerHTML,/Resume game/);
});
test('hot seat with active save offers only New game and Resume game, setup opens on request',async()=>{
 const u=ui('#/multiplayer');storeGame(u,'coop');vm.runInContext("multiplayerTab='hotseat';render()",u.ctx);
 assert.match(u.app.innerHTML,/data-action="hotseatNewGame"[^>]*>New game/);
 assert.match(u.app.innerHTML,/data-action="resumeLocalHotseat"[^>]*>Resume game/);
 assert.doesNotMatch(u.app.innerHTML,/hotseatName1|data-expansion="book"|data-action="startHotseat"|Resume saved solo/);
 await vm.runInContext('handle("hotseatNewGame")',u.ctx);
 assert.match(u.app.innerHTML,/hotseatName1|hotseatName2/);assert.match(u.app.innerHTML,/data-action="startHotseat"/);
 vm.runInContext("multiplayerTab='online';hotseatNewGame=false;multiplayerTab='hotseat';render()",u.ctx);
 assert.match(u.app.innerHTML,/data-action="resumeLocalHotseat"/);
});
test('hot-seat pause hides online room controls and Exit returns to Hot Seat menu',async()=>{
 const u=ui('#/multiplayer');storeGame(u,'coop');
 assert.match(source,/multiplayer:state\.room\?\.mode==='coop'&&!IS_HOTSEAT\(\)/);
 const localPause=renderOverlay('pause',[],true,{multiplayer:false});
 assert.doesNotMatch(localPause,/Leave game|End game for both/);
 const onlinePause=renderOverlay('pause',[],true,{multiplayer:true,host:true});
 assert.match(onlinePause,/data-action="gameGoHome" class="primary">Exit game<\/button>/);assert.doesNotMatch(onlinePause,/Leave game/);assert.match(onlinePause,/End game for both/);
 vm.runInContext('session={id:"hotseat",seat:0}',u.ctx);
 await vm.runInContext('handle("gameGoHome")',u.ctx);
 assert.equal(u.location.hash,'#/multiplayer');assert.match(u.app.innerHTML,/data-action="resumeLocalHotseat"/);
 assert.doesNotMatch(u.app.innerHTML,/data-action="leaveRoom"|data-action="endRoom"/);
});
