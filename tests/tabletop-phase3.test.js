import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,viewFor,act,assertConserved} from '../engine/game.js';
import {soloLegalTargets,targetState,moveOrderedCard} from '../public/tabletop/interactions.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';
import {renderCard} from '../public/tabletop/cards.js';

function fixture(seed=17){return viewFor(newGame({mode:'solo',seed,config:{expansions:[],difficulties:{}}}),0);}
test('legal target list matches engine action restrictions per card without exposing draw order',()=>{
 for(let seed=1;seed<=50;seed++){
  const g=fixture(seed);
  for(const c of g.players[0].hand){
   assert.deepEqual(soloLegalTargets(g,c.id),['play','discard']);
   assert.deepEqual(targetState(g,c.id),{play:true,discard:true});
   assert.deepEqual(soloLegalTargets(g,'invalid-card'),[]);
  }
  assert.equal(g.deck,undefined);
 }
});
test('same-symbol play is disabled; discarding remains legal even with same symbol',()=>{
 const g=fixture(51),card=g.players[0].hand[0];g.players[0].labyrinth.push({kind:'location',symbol:card.symbol,color:'red',id:'played'});
 assert.deepEqual(soloLegalTargets(g,card.id),['discard']);
 assert.deepEqual(targetState(g,card.id),{play:false,discard:true});
 let html=renderSoloTabletop(g,{selectedId:card.id});assert.match(html,/data-tt-drop="play"/);assert.match(html,/data-tt-drop="discard"/);
 assert.match(html,/class="tt3-zone-action"[^>]* disabled/);
 assert.match(html,/class="tt3-zone-action tt3-discard-action"[^>]*>↳/);
});
test('stale, inactive, decision, opponent and invalid card actions return no targets',()=>{
 const g=fixture(52),id=g.players[0].hand[0].id;
 for(const phase of ['decision','draft','ended']){g.phase=phase;assert.deepEqual(soloLegalTargets(g,id),[]);}
 g.phase='action';g.status='lost';assert.deepEqual(soloLegalTargets(g,id),[]);g.status='active';
 assert.deepEqual(soloLegalTargets(g,id,-1),[]);
 assert.deepEqual(soloLegalTargets(g,id,1),[]);
 assert.deepEqual(soloLegalTargets(g,'missing'),[]);
 g.players[0].hand[0]={kind:'deadEnd',id};assert.deepEqual(soloLegalTargets(g,id),[]);
});
test('tap and pointer targets map only to original play/discard action types',()=>{
 const g=fixture(53),id=g.players[0].hand[0].id,html=renderSoloTabletop(g,{selectedId:id});
 assert.equal((html.match(/data-tt-card=/g)||[]).length,5);
 assert.match(html,new RegExp(`data-selected-card="${id}"`));
 assert.match(html,/data-tt-drop="play"/);assert.match(html,/data-tt-drop="discard"/);
 assert.match(html,/aria-label="Play selected Location in the Labyrinth"/);
 assert.match(html,/aria-label="Discard selected Location"/);
 assert.ok(!html.includes('data-tt-drop="draw"'));
 assert.match(renderCard(g.players[0].hand[0],{interactive:true,select:true}),/data-tt-card=/);
 assert.doesNotMatch(renderCard(g.players[0].hand[0]),/data-tt-card=/);
});
test('engine conservation is unaffected by the gesture-to-command adapter',()=>{
 for(let seed=75;seed<120;seed++){
  const state=newGame({mode:'solo',seed,config:{expansions:[],difficulties:{}}}),g=viewFor(state,0);
  const c=g.players[0].hand[0],type=soloLegalTargets(g,c.id)[0];
  const advanced=act(state,{type,id:c.id});assertConserved(advanced);
 }
});
test('production bindings preserve Firebase and only attach to base solo board',()=>{
 const app=readFileSync('public/app.js','utf8'),css=readFileSync('public/tabletop/interactions.css','utf8');
 assert.match(app,/createTabletopInteractions\(/);
 assert.match(app,/soloLegalTargets\(state\.game,id,state\.room\?\.seat\)/);
 assert.match(app,/action\(\{type,id\}\)/);
 assert.match(app,/firebase\.firebaseAction/);
 assert.match(css,/touch-action:none/);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(readFileSync('public/index.html','utf8'),/tabletop\/interactions\.css/);
});

test('visual reorder helper does not alter source array and preserves card multiset',()=>{
 const input=['a','b','c','d','e'];assert.deepEqual(moveOrderedCard(input,'a','d'),['b','c','a','d','e']);
 assert.deepEqual(moveOrderedCard(input,'e','b'),['a','e','b','c','d']);
 assert.deepEqual(moveOrderedCard(input,'c','c'),input);
 assert.deepEqual(moveOrderedCard(input,'missing','a'),input);
 assert.deepEqual(moveOrderedCard(input,'a','missing'),input);
 assert.deepEqual(input,['a','b','c','d','e']);
});
test('all permitted order decisions support progressive drag without replacing arrow controls',()=>{
 const app=readFileSync('public/app.js','utf8');
 assert.match(app,/data-tt-order-group=\"effect\"/);
 assert.match(app,/data-tt-order-group=\"prophecy\"/);
 assert.match(app,/data-tt-order-handle/);
 assert.match(app,/createDecisionReorder/);
 assert.match(app,/prophecyOrder=moveOrderedCard/);
 assert.match(app,/effectOrder=moveOrderedCard/);
 assert.match(app,/prophecyUp:/);assert.match(app,/effectUp:/);
});
