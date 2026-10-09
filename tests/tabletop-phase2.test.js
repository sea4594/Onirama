import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDeck,TOWER_FACES} from '../engine/cards.js';
import {PHYSICAL_CARD_TOTAL,PHYSICAL_COMPONENTS,INCUBUS_PAWN_COUNT} from '../engine/physical-inventory.js';
import {newGame,act,viewFor,assertConserved} from '../engine/game.js';
import {soloTabletopModel,renderSoloTabletop} from '../public/tabletop/solo-board.js';

const towerMap={
 red:[[3,'sun+moon','moon'],[4,'sun','moon'],[5,'','moon']],
 blue:[[3,'moon','sun+moon'],[4,'moon','moon'],[5,'moon','']],
 green:[[3,'sun','sun+moon'],[4,'sun','sun'],[5,'sun','']],
 brown:[[3,'sun+moon','sun'],[4,'moon','sun'],[5,'','sun']]
};
test('all 12 Tower face values exactly match supplied physical cards',()=>{
 const cards=createDeck(['towers']).filter(c=>c.kind==='tower');assert.equal(cards.length,12);
 for(const [color,variants] of Object.entries(towerMap))for(const [number,left,right] of variants){
  const match=cards.filter(c=>c.color===color&&c.number===number);assert.equal(match.length,1);
  assert.deepEqual([match[0].left,match[0].right],[left,right]);assert.deepEqual(TOWER_FACES[color][number],{left,right});
 }
});
test('full physical card inventory totals 192; non-draw objects accounted for',()=>{
 assert.equal(PHYSICAL_CARD_TOTAL,192);assert.equal(INCUBUS_PAWN_COUNT,1);
 assert.equal(PHYSICAL_COMPONENTS.reduce((n,x)=>n+x.drawn,0),155);
 assert.equal(PHYSICAL_COMPONENTS.reduce((n,x)=>n+x.offDeck.reduce((k,[,count])=>k+count,0),0),37);
 for(const c of PHYSICAL_COMPONENTS)assert.equal(c.drawn+c.offDeck.reduce((n,[,v])=>n+v,0),c.total);
});
test('base solo board renders all physical tabletop areas, five cards and eight Door slots',()=>{
 const s=newGame({mode:'solo',seed:112233,config:{expansions:[],difficulties:{}}});const g=viewFor(s,0);
 const html=renderSoloTabletop(g);for(const zone of ['tt2-doors','tt2-labyrinth','tt2-piles','tt2-hand'])assert.match(html,new RegExp(zone));
 assert.equal((html.match(/tt2-hand-card/g)||[]).length,5);
 assert.equal((html.match(/tt8-door-slot /g)||[]).length,8);
 assert.equal((html.match(/tt8-door-empty/g)||[]).length,8);
 assert.match(html,/Deck/);assert.match(html,/Discard/);assert.match(html,/Limbo/);
 assert.ok(!html.includes('board-side'));assertConserved(s);
});
test('playing/discarding via existing engine command remains valid with new renderer',()=>{
 for(let seed=0;seed<10;seed++){
  let s=newGame({mode:'solo',seed:seed+1000,config:{expansions:[],difficulties:{}}});
  for(let step=0;step<3&&s.status==='active';step++){
   const g=viewFor(s,0);if(s.phase!=='action')break;
   const chosen=g.players[0].hand.find(c=>c.kind==='location'&&c.symbol!==g.players[0].labyrinth.at(-1)?.symbol);
   assert.ok(chosen);
   const model=soloTabletopModel(g,{selectedId:chosen.id});assert.ok(model.canPlay);assert.ok(model.canDiscard);
   const html=renderSoloTabletop(g,{selectedId:chosen.id});assert.match(html,/data-tt-drop="play"/);assert.match(html,/data-tt-drop="discard"/);assert.doesNotMatch(html,/data-action="play"/);
   s=act(s,{type:'play',id:chosen.id});assertConserved(s);
   if(s.phase==='decision')break;
  }
 }
});
test('selected same-symbol card has disabled Play but retains Discard',()=>{
 const s=newGame({mode:'solo',seed:402,config:{expansions:[],difficulties:{}}});const g=viewFor(s,0);
 g.players[0].labyrinth.push({id:'existing',kind:'location',color:'red',symbol:g.players[0].hand[0].symbol});
 const m=soloTabletopModel(g,{selectedId:g.players[0].hand[0].id});assert.equal(m.canPlay,false);assert.equal(m.canDiscard,true);
 const html=renderSoloTabletop(g,{selectedId:g.players[0].hand[0].id});assert.match(html,/data-tt-drop="play"/);assert.match(html,/data-tt-drop="discard"/);assert.equal(m.canPlay,false);
});
test('decision, nonaction and finished states keep zones visible without illegal hand controls',()=>{
 const s=newGame({mode:'solo',seed:12,config:{expansions:[],difficulties:{}}});const g=viewFor(s,0);
 g.phase='decision';g.pending={type:'nightmare'};
 let html=renderSoloTabletop(g,{decisionHtml:'<section class="decision">Choose</section>'});assert.match(html,/tt2-decision/);assert.match(html,/Choose/);assert.doesNotMatch(html,/data-action="play"/);
 g.phase='ended';g.status='lost';html=renderSoloTabletop(g);assert.match(html,/tt2-finish/);assert.match(html,/tt2-piles/);
});
test('UI modules are pure projections and do not reveal draw deck contents',()=>{
 const s=newGame({mode:'solo',seed:24,config:{expansions:[],difficulties:{}}}),g=viewFor(s,0),before=JSON.stringify(g);
 const html=renderSoloTabletop(g);assert.equal(JSON.stringify(g),before);assert.equal(Object.hasOwn(g,'deck'),false);
 assert.ok(html.includes(`>${g.deckCount}<`));
});
test('production UI imports the solo renderer; no engine rewrites or account flows',()=>{
 const app=readFileSync('public/app.js','utf8'),html=readFileSync('public/index.html','utf8');
 assert.match(app,/renderSoloTabletop\(g/);assert.match(html,/tabletop\/solo.css/);assert.match(app,/firebase/);
});
