import {icon} from '../public/icons.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {newGame,viewFor,act,assertConserved} from '../engine/game.js';
import {renderCard,renderDoors} from '../public/tabletop/cards.js';
import * as guest from '../public/guest-data.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';
import {renderGameDialog,decisionDialogKey,PENDING_DECISIONS,CONTEXT_DIALOGS,createDialogController} from '../public/tabletop/dialogs.js';
const all=['book','glyphs','dreamcatchers','towers','premonitions','crossroads','oniverse','mirrors','sphinx'];
const appSource=readFileSync('public/app.js','utf8'),css=readFileSync('public/tabletop/dialogs.css','utf8');
function uiContext(){
 const store=new Map(),app={innerHTML:'',addEventListener(){},querySelector(){return null}},localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
 const document={documentElement:{dataset:{}},querySelector:s=>s==='#app'?app:null};
 const ctx=vm.createContext({document,localStorage,location:{origin:'http://localhost',hostname:'localhost',hash:'#/'},addEventListener(){},navigator:{},confirm:()=>false,console,icon,renderCard,renderDoors,renderSoloTabletop,renderGameDialog,decisionDialogKey,createDialogController,applyTabletopMetrics(){},...guest,firebase:{firebaseConfigured:()=>false}});
 vm.runInContext(appSource.replace(/^import [^\n]+$/gm,''),ctx);return ctx;
}
function fixture(){return viewFor(newGame({mode:'solo',seed:731,config:{expansions:all,difficulties:{}}}),0);}
const card=(g)=>g.players[0].hand[0];
function pendingFixture(type,g){const c=card(g),d={id:'door-test',kind:'door',color:'red'};
 const pieces={
 sphinxName:{},sphinxResolve:{cards:[c,d],remaining:0},diver:{cards:[c],remaining:4},confusion:{},
 mirrorReward:{mirror:'blue',options:[c]},doorSearch:{color:'red',targets:[{id:'door-test',source:'deck'}]},
 door:{card:d,keys:[{id:c.id,zone:'hand'}]},nightmare:{card:{kind:'nightmare',id:'night-test'}},
 prophecy:{cards:[c]},happyDream:{},happyFetch:{options:[c]},rally:{card:{ability:'architect'},choices:[c.id]},
 premonitionPick:{options:['twoRed']},premonitionDoor:{choices:[{id:d.id,color:'red',owner:0}]},
 incantation:{cards:[c,d]},towerLook:{cards:[c]},spellPeek:{cards:[c]},happyPeek:{cards:[c]},denizenPeek:{cards:[c]},
 catchChoose:{choices:[0,1]},catchOverload:{choices:[0]},towerPenalty:{},moduleDecision:{id:'test',options:['alpha','beta']}
 };
 return {type,...pieces[type]};
}
test('every pending type renders within the mandatory temporary surface, without close/backdrop cancel',()=>{
 const ctx=uiContext(),g=fixture();assert.equal(PENDING_DECISIONS.length,23);
 for(const type of PENDING_DECISIONS){const pending=pendingFixture(type,g);g.phase='decision';g.pending=pending;ctx.game=g;
  const html=vm.runInContext('decision(game,true)',ctx);assert.equal(typeof html,'string',type);assert.ok(html.length>40,type);
  const wrapped=renderGameDialog({type,key:decisionDialogKey(g,0),html,mandatory:true});
  assert.match(wrapped,/role="dialog" aria-modal="true"/);assert.match(wrapped,/data-tt4-overlay="required"/);
  assert.doesNotMatch(wrapped,/data-action="dialogClose"/);assert.ok(wrapped.includes('class="tt4-content"'),type);
 }
});
test('optional contexts have accessible close controls and are not mistaken for mandatory decisions',()=>{
 assert.deepEqual(CONTEXT_DIALOGS,['mirrorPair','cyclobot','coopDiscard','spellbook']);
 for(const type of CONTEXT_DIALOGS){const html=renderGameDialog({type,key:'context:'+type,html:'<section class="decision"><h2>Choice</h2></section>'});
  assert.match(html,/data-tt4-overlay="optional"/);assert.match(html,/data-action="dialogClose"/);
  assert.match(html,/aria-label="Close dialog"/);
 }
});
test('only active seat gets a mandatory modal; no game or private deck content is leaked',()=>{
 const g=fixture();g.phase='decision';g.pending={type:'nightmare',card:{kind:'nightmare',id:'n'}};
 assert.ok(decisionDialogKey(g,0));assert.equal(decisionDialogKey(g,1),null);
 assert.equal(decisionDialogKey({...g,pending:null},0),null);
 assert.equal(decisionDialogKey({...g,status:'lost'},0),null);
 assert.equal(g.deck,undefined);
});
test('existing rules commands and event stack remain unchanged',()=>{
 let s=newGame({mode:'solo',seed:74,config:{expansions:[],difficulties:{}}});
 const c=s.players[0].hand.find(c=>c.kind==='location'&&c.symbol!=='key');assert.ok(c);
 s=act(s,{type:'play',id:c.id});assertConserved(s);
 assert.match(appSource,/action\(\{type:'prophecy'/);
 assert.match(appSource,/action\(\{type:'mirrorReward'/);
 assert.match(appSource,/action\(\{type:'moduleDecision'/);
 assert.match(appSource,/firebase\.firebaseAction/);
});
test('all prior inline decision placements removed and book spells work while an effect interrupts',()=>{
 assert.doesNotMatch(appSource,/\$\{expansionBoard\(g,canAct\)\}\$\{decision\(g,canAct\)\}/);
 assert.match(appSource,/g\.phase==='decision'&&spellOpen&&g\.expansion\?\.book/);
 assert.match(appSource,/data-action="openSpells"|btn\('Cast spell','openSpells'/);
 assert.match(appSource,/gameWorkspace\(state\.game,state\.room\)/);
 assert.match(readFileSync('public/index.html','utf8'),/tabletop\/dialogs\.css/);
});
test('dialogs trap focus and respect small portrait and short landscape viewports',()=>{
 assert.match(css,/max-height:min\(92dvh,920px\)/);
 assert.match(css,/max-height:min\(88dvh,880px\)/);
 assert.match(css,/max-height:calc\(100dvh - 10px\)/);
 assert.match(css,/overscroll-behavior:contain/);
 const source=readFileSync('public/tabletop/dialogs.js','utf8');assert.match(source,/e\.key!=='Tab'/);assert.match(source,/e\.key==='Escape'/);
});
