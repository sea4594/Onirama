import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame} from '../engine/game.js';
import {publicFrame} from '../engine/replay.js';
import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';
import {renderActionDock} from '../public/tabletop/action-dock.js';
import {arrangeGameplayHand} from '../public/tabletop/orientation.js';

const css=readFileSync('public/tabletop/phase9.css','utf8');
const replayJS=readFileSync('public/multiplayer-replay.js','utf8');
const gameApp=readFileSync('public/app.js','utf8');

test('replay reuses the gameplay board renderer, dock and full-screen geometry',()=>{
 assert.match(replayJS,/renderCooperativeTabletop\(entry\.frame/);
 assert.match(replayJS,/renderActionDock\(game,seat\)/);
 assert.match(replayJS,/class=\"tt6-table-slot\"/);
 assert.match(replayJS,/class=\"tt6-hand-shelf\"/);
 assert.match(replayJS,/class=\"tt9-replay-stage page game-viewport\"/);
 assert.match(replayJS,/data-replay-stage inert aria-hidden/);
 assert.match(replayJS,/tt9-replay-toolbar/);
 assert.match(replayJS,/data-action=\"replayClose\"/);
 assert.match(replayJS,/data-action=\"replayPlay\"/);
 for(const seat of [0,1]){
  const frame=publicFrame(newGame({mode:'coop',seed:890+seat,config:{expansions:['towers','dreamcatchers','premonitions','mirrors','book','oniverse']}}));
  const board=renderCooperativeTabletop(frame,{seat,canAct:false,connected:true});
  const dock=renderActionDock(frame,seat);
  assert.match(board,/tt2-root/);assert.match(board,/tt8-towers-slot/);
  assert.match(board,/tt5-catchers/);assert.match(board,/tt5-premonitions/);
  assert.match(dock,/tt6-workspace/);
 }
});

test('replay is read-only and snapshots never expose private hand identities',()=>{
 const raw=newGame({mode:'coop',seed:777,config:{expansions:[]}});
 const frame=publicFrame(raw);
 assert.equal(frame.players[0].hand.every(c=>c.kind==='hidden'&&!c.id),true);
 assert.equal(frame.players[1].hand.every(c=>c.kind==='hidden'&&!c.id),true);
 assert.match(replayJS,/data-replay-stage inert/);
 assert.doesNotMatch(replayJS,/\bapplyCommand\s*\(|\bdispatch\s*\(/);
});

test('replay uses the game fitter and hand relocation, and never shrinks the stage for its toolbar',()=>{
 assert.match(replayJS,/fitLandscapeDock\(shell,landscape\)/);
 assert.match(replayJS,/arrangeGameplayHand\(layer,landscape\)/);
 assert.match(replayJS,/sizeLandscapeHands\(shell\.querySelector\('\.tt6-hand-shelf'\)\)/);
 assert.match(replayJS,/getComputedStyle\(live\).*--tt6-dock-height/);
 assert.match(css,/\.tt9-replay-stage\.page\.game-viewport\{[^}]*position:absolute;inset:0;width:100%;height:100%/);
 assert.match(css,/\.tt9-replay-stage\.page\.game-viewport\{[^}]*margin:0;padding:0/);
 assert.match(css,/\.tt9-replay-toolbar\{position:absolute;z-index:/);
 assert.doesNotMatch(css,/grid-template-rows:auto minmax\(0,1fr\) auto/);
 assert.match(gameApp,/fitReplay\(layer,entry\)/);
});

function element(){return {parentNode:null,parentElement:null,children:[],isConnected:false,get firstElementChild(){return this.children.find(c=>!c.comment)||null;},appendChild(child){child.parentNode?.removeChild(child);this.children.push(child);child.parentNode=this;child.parentElement=this;child.isConnected=true;},insertBefore(child,next){child.parentNode?.removeChild(child);const i=this.children.indexOf(next);assert(i>=0);this.children.splice(i,0,child);child.parentNode=this;child.parentElement=this;child.isConnected=true;},removeChild(child){const i=this.children.indexOf(child);assert(i>=0);this.children.splice(i,1);child.parentNode=null;child.parentElement=null;child.isConnected=false;}};}
function stage(){const parent=element(),shelf=element(),hand=element(),board=element();parent.appendChild(hand);hand.style={removeProperty(){}};board.querySelector=()=>parent.children.includes(hand)?hand:null;shelf.clientWidth=0;shelf.clientHeight=0;const shell={querySelector(k){return k==='.tt2-root'?board:k==='.tt6-hand-shelf'?shelf:null;}};const root={querySelector(k){return k==='.game-viewport'?shell:null;}};return {parent,shelf,hand,root};}
test('live and replay hand anchors are isolated across rotation and repeated fitting',()=>{
 const a=stage(),b=stage();
 const prior=globalThis.document;
 globalThis.document={createComment(){return {comment:true,isConnected:false,remove(){this.parentNode?.removeChild(this);}};}};
 try{
  arrangeGameplayHand(a.root,true);arrangeGameplayHand(b.root,true);
  assert.equal(a.shelf.firstElementChild,a.hand);assert.equal(b.shelf.firstElementChild,b.hand);
  arrangeGameplayHand(a.root,true);arrangeGameplayHand(b.root,true);
  assert.equal(a.parent.children.length,1);assert.equal(b.parent.children.length,1);
  arrangeGameplayHand(a.root,false);arrangeGameplayHand(b.root,false);
  assert.equal(a.parent.firstElementChild,a.hand);assert.equal(b.parent.firstElementChild,b.hand);
  assert.equal(a.shelf.children.length,0);assert.equal(b.shelf.children.length,0);
 }finally{globalThis.document=prior;}
});
