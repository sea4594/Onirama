import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTabletopInteractions,soloLegalTargets,cooperativeLegalTargets} from '../public/tabletop/interactions.js';
import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';
import {newGame,viewFor} from '../engine/game.js';

const app=readFileSync('public/app.js','utf8');
const art=readFileSync('public/tabletop/card-system.css','utf8');
const shell=readFileSync('public/game-shell.css','utf8');
test('Fresh installs select Moonlit without overriding a saved valid theme',()=>{
 assert.match(app,/raw\.theme:'moonlit'/);
 assert.match(app,/catch\{return \{theme:'moonlit'/);
 assert.match(app,/THEME_PRESETS\.some\(p=>p\.id===raw\.theme\)\?raw\.theme/);
});
test('Hot Seat pass screen only shows the requested heading and named ready action',()=>{
 assert.match(app,/<h1>Pass Device<\/h1>/);
 assert.match(app,/btn\(`I’m \$\{escape\(state\.game\.players\[state\.game\.active\]/);
 assert.doesNotMatch(app,/Hand the device to|Their cards are hidden until/);
});
test('All expansion boards inherit the same felt-zone background as the base game',()=>{
 assert.match(art,/\.tt5-zone,\.tt2-zone,\.tt6-player,\.tt6-hand-block,\.tt6-piles\)\{background:var\(--table-zone\)!important\}/);
});
test('Rainbow goal is shaded across its body, keeps the same diamond size as other goals, and stays unclaimed',()=>{
 assert.match(art,/\.tt8-door-slot\.wild:not\(\.tt8-door-complete\) \.tt8-door-empty\{/);
 assert.match(art,/linear-gradient\(135deg,#a64b5a88/);
 assert.match(art,/\.tt8-door-empty>\.ui-icon\{\s*width:66%!important;height:66%!important/);
});
test('Cooperative hidden-card diamonds are centered on the card face, not an inline text box',()=>{
 const raw=newGame({mode:'coop',seed:12});raw.phase='action';raw.players[1].hand.push(raw.deck.pop());const g=viewFor(raw,0),markup=renderCooperativeTabletop(g,{seat:0});
 assert.match(markup,/tt6-card-back/);
 assert.match(art,/\.tt6-card-back>span\{position:absolute!important;inset:0!important/);
 assert.match(art,/\.tt6-card-back>span>\.ui-icon\{display:block!important;width:50%!important;height:50%!important/);
});
test('Resize and rotation refit after staged iOS viewport updates; double-tap manipulation does not disable pinch zoom',()=>{
 assert.match(app,/\[80,200,400,750,1200\]/);
 assert.match(app,/visualViewport\?\.addEventListener\?\.\('resize',fitAfterViewportSettles\)/);
 assert.match(app,/orientationchange',fitAfterViewportSettles/);
 assert.match(shell,/touch-action:manipulation/);
 assert.match(shell,/\[data-tt-card\]\{touch-action:none!important\}/);
 assert.doesNotMatch(readFileSync('public/index.html','utf8'),/user-scalable=no|maximum-scale=1/);
});
test('Tower placement targets are recomputed after rerenders and canceled drags clear selection',()=>{
 const game={mode:'solo',status:'active',phase:'action',active:0,players:[{hand:[{id:'tower-1',kind:'tower',color:'red',left:'sun',right:'moon'}],labyrinth:[]}],expansion:{towers:{alignment:[]}}};
 assert.deepEqual(soloLegalTargets(game,'tower-1'),['towerLeft','towerRight','discard']);
 const targets=['towerLeft','towerRight','discard'].map(name=>({dataset:{ttDrop:name},disabled:true,attrs:{},classes:new Set(),classList:{toggle(k,v){if(v)this._parent.classes.add(k);else this._parent.classes.delete(k);}},matches:s=>s==='button',setAttribute(k,v){this.attrs[k]=v}}));
 for(const el of targets)el.classList._parent=el;
 const classSet=new Set();const card={dataset:{ttCard:'tower-1'},classList:{add:k=>classSet.add(k),remove:k=>classSet.delete(k)},getBoundingClientRect:()=>({left:0,top:0,width:50,height:70}),cloneNode(){return {classList:{add(){}},removeAttribute(){},setAttribute(){},remove(){},style:{}};},closest:s=>s==='[data-tt-card]'?card:null,setAttribute(){}};
 const board={dataset:{selectedCard:'tower-1'},contains:()=>true,querySelectorAll:sel=>sel==='[data-tt-drop]'?targets:sel==='[data-tt-card]'?[card]:[]};
 const events=new Map(),winEvents=new Map();const root={querySelector:()=>board,addEventListener:(k,v)=>events.set(k,v),removeEventListener(){}};
 const oldWindow=globalThis.window,oldDocument=globalThis.document;let cleared=0,selected=0;
 globalThis.window={addEventListener:(k,v)=>winEvents.set(k,v),removeEventListener(){}};
 globalThis.document={body:{appendChild(){}},elementFromPoint:()=>null};
 try{
  const ctrl=createTabletopInteractions({root,getGame:()=>game,getSeat:()=>0,onSelect:()=>selected++,onClearSelection:()=>cleared++,onCommand:()=>{}});
  ctrl.syncTargets('tower-1');
  assert.ok(targets.every(el=>!el.disabled&&el.classes.has('tt3-target-ready')));
  events.get('pointerdown')({pointerId:1,button:0,pointerType:'touch',target:card,clientX:20,clientY:20});
  winEvents.get('pointermove')({pointerId:1,clientX:45,clientY:45,preventDefault(){}});
  winEvents.get('pointerup')({pointerId:1,clientX:20,clientY:20});
  assert.equal(cleared,1);assert.equal(selected,0);
  ctrl.dispose();
 }finally{globalThis.window=oldWindow;globalThis.document=oldDocument;}
 assert.match(app,/tabletopController\?\.syncTargets\?\.\(selected\|\|''\)/);
});
