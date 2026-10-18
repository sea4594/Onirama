import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,viewFor,act,assertConserved} from '../engine/game.js';
import {spellEligibility,renderSpellbook} from '../public/tabletop/spellbook.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';
import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';

const game=(mode='solo',hard=false)=>newGame({mode,seed:82,config:{expansions:['book'],difficulties:hard?{book:'hard'}:{}}});
const addPayment=(state,n)=>{state.discard.push(...state.deck.splice(0,n));return viewFor(state,0);};
test('Parallel Planning selects Goals only on tabletop, with cast enabled after two valid choices',()=>{
 const state=game(),v=addPayment(state,7);
 const html=renderSpellbook(v,{choice:'parallel',selectedGoals:[1,4]});
 assert.doesNotMatch(html,/tt24-spell-goals|data-action="goalPick:/);
 assert.match(html,/Tap the two Doors in the Doors area/);
 assert.match(html,/<button type="button" class="primary" data-action="castSpell" >Cast spell<\/button>/);
 assert.doesNotMatch(html,/more discarded cards needed/);
 assert.match(renderSpellbook(v,{choice:'parallel',selectedGoals:[1]}),/data-action="castSpell" disabled/);
 assert.equal(spellEligibility(v,'parallel',[1,4]).ready,true);
 assert.equal(spellEligibility(v,'parallel',[1,1]).ready,false);
 assert.equal(spellEligibility(v,'parallel',[1,30]).ready,false);
});
test('Spellbook availability reacts to payment, deck, and Nightmare conditions',()=>{
  const state=game(),v=viewFor(state,0);
  for(const spell of ['parallel','paradox','punishment'])assert.equal(spellEligibility(v,spell,[0,1]).ready,false);
  const html=renderSpellbook(v);
  assert.equal((html.match(/tt24-spell-unready/g)||[]).length,3);
  assert.ok(!html.includes('unavailable'));
  addPayment(state,10);
  const funded=viewFor(state,0);
  assert.equal(spellEligibility(funded,'parallel',[0,1]).ready,true);
  assert.equal(spellEligibility(funded,'paradox').ready,true);
  assert.equal(spellEligibility(funded,'punishment').ready,false);
  let fundedHtml=renderSpellbook(funded);
  assert.equal((fundedHtml.match(/tt24-spell-ready/g)||[]).length,2);
  assert.equal((fundedHtml.match(/tt24-spell-unready/g)||[]).length,1);
  const nightIndex=state.deck.findIndex(c=>c.kind==='nightmare');
  const night=state.deck.splice(nightIndex,1)[0];
  state.pending={type:'nightmare',card:night};state.phase='decision';
  assert.equal(spellEligibility(viewFor(state,0),'punishment').ready,true);
  state.pending.incubus=true;
  assert.equal(spellEligibility(viewFor(state,0),'punishment').ready,false);
  const empty=game();empty.discard.push(...empty.deck.splice(0));
  assert.equal(spellEligibility(viewFor(empty,0),'paradox').ready,false);
});
test('Parallel Planning casts with selected position indices in solo/co-op, both costs, and preserves card conservation',()=>{
  for(const mode of ['solo','coop'])for(const hard of [false,true]){
    let s=game(mode,hard),cost=hard?9:7;
    while(s.phase==='draft')s=act(s,{type:'draft',id:s.draft[0].id});
    s.discard.push(...s.deck.splice(0,cost));
    const goals=structuredClone(s.moduleState.book.goals);
    const v=viewFor(s,s.active);
    assert.equal(spellEligibility(v,'parallel',[0,goals.length-1]).ready,true);
    assert.match(renderSpellbook(v,{choice:'parallel',selectedGoals:[0,goals.length-1]}),/data-action="castSpell" >Cast spell/);
    const ids=s.discard.slice(0,cost).map(c=>c.id);
    s=act(s,{type:'cast',spell:'parallel',first:0,second:goals.length-1,costIds:ids});
    assertConserved(s);
    assert.deepEqual(s.moduleState.book.goals[0],goals.at(-1));
    assert.deepEqual(s.moduleState.book.goals.at(-1),goals[0]);
    assert.equal(s.moduleState.book.zones.removed.length,cost);
  }
});
test('Spellbook selection remains accessible in solo and cooperative tabletop and routed to UI action handler',()=>{
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/renderSpellbook\(g,\{choice:spellChoice,selectedGoals:spellGoals\}\)/);
  assert.match(app,/actionName\.startsWith\('goalPick:'\)/);
  assert.match(app,/spellEligibility\(g,spellChoice,spellGoals\)/);
  for(const mode of ['solo','coop']){
    const state=game(mode),v=viewFor(state,0);
    const html=mode==='solo'?renderSoloTabletop(v,{spellGoalMode:true,spellGoals:[0,1]}):renderCooperativeTabletop(v,{spellGoalMode:true,spellGoals:[0,1]});
    assert.match(html,/data-action="goalPick:0"/);
    assert.match(html,/data-action="goalPick:1"/);
    assert.equal((html.match(/tt8-goal-chosen/g)||[]).length,2);
    assert.equal((html.match(/class="tt24-door-picked"/g)||[]).length,2);
  }
});
