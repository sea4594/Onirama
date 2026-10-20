import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {moveOrderedCardToGap} from '../public/tabletop/interactions.js';

const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const app=read('public/app.js');
const css=read('public/tabletop/card-system.css');
const interactions=read('public/tabletop/interactions.js');
const interactiveCss=read('public/tabletop/interactions.css');
const start=app.indexOf('let prophecyDiscard=null,prophecyOrder=[];');
const end=app.indexOf('// The new solo and cooperative tabletops',start);
assert(start>=0&&end>start);
const ctx=vm.createContext({
  escape:String,
  card:c=>`<span class="card" data-card="${c.id}"></span>`,
  moveOrderedCardToGap,
});
vm.runInContext(app.slice(start,end),ctx);
const game={pending:{type:'prophecy',cards:['a','b','c','d'].map(id=>({id}))}};
const render=()=>{ctx.g=game;return vm.runInContext('prophecy(g)',ctx);};
const order=()=>Array.from(vm.runInContext('prophecyOrder',ctx));
const ids=html=>[...html.matchAll(/data-tt-order-id="(.*?)"/g)].map(m=>m[1]);

test('prophecy keeps a reordered sequence before any discard is selected',()=>{
  let html=render();
  assert.deepEqual(ids(html),['a','b','c','d']);
  assert.match(html,/data-action="prophecyConfirm" disabled/);
  // A first move must survive a new render even with no discard selected.
  vm.runInContext('prophecyOrder=moveOrderedCardToGap(prophecyOrder,"d",1)',ctx);
  html=render();
  assert.deepEqual(ids(html),['a','d','b','c']);
  assert.deepEqual(order(),['a','d','b','c']);
  assert.match(html,/Choose a card to discard before confirming/);
});

test('prophecy discard can be selected, undone, and changed without losing arrangement',()=>{
  vm.runInContext('prophecyDiscard="d"',ctx);
  let html=render();
  assert.deepEqual(ids(html),order().filter(id=>id!=='d'));
  assert.match(html,/data-action="prophecyConfirm" >/);
  assert.match(html,/Return discarded card to the ordered cards/);
  assert.match(html,/Tap to return this card/);
  vm.runInContext('prophecyDiscard=null',ctx);
  html=render();
  assert.deepEqual(ids(html),order());
  assert.match(html,/data-action="prophecyConfirm" disabled/);
  vm.runInContext('prophecyDiscard="a"',ctx);
  html=render();
  assert.deepEqual(ids(html),order().filter(id=>id!=='a'));
  assert.doesNotMatch(html,/data-action="prophecyConfirm" disabled/);
});

test('prophecy and all order decisions use an explicit insertion-gap interaction',()=>{
  assert.match(interactions,/function showGaps\(list,id,kind\)/);
  assert.match(interactions,/data-tt-order-gap/);
  assert.match(interactions,/marker\.dataset\.ttOrderGap=String\(gap\)/);
  assert.match(interactions,/onReorder\(kind,id,gap\)/);
  assert.doesNotMatch(interactions,/tap\.id!==id\)\{const from=tap\.id/);
  assert.match(interactions,/onUndiscard\(\)/);
  assert.match(app,/onUndiscard:\(\)=>\{/);
  assert.match(app,/const moved=moveOrderedCardToGap\(ids,from,gap\)/);
  assert.match(app,/moved\.splice\(Math\.min\(originalDiscardIndex,moved\.length\),0,prophecyDiscard\)/);
  assert.doesNotMatch(app,/if\(!prophecyDiscard\)return;const ids=prophecyOrder/);
  assert.match(interactiveCss,/\.tt5-order-gap\{/);
  assert.match(interactiveCss,/\.tt3-order-item\.tt5-order-selected\{border-color:var\(--ui-accent\);background:transparent/);
  assert.match(interactiveCss,/\.tt6-dock-decision :is\(\.tt3-order-list/);
});

test('spellbook keeps the decorated cover but no longer draws a protruding page block',()=>{
  assert.match(css,/\.tt2-root \.tt32-spell-book \.tt32-book-cover::after\{\s*content:none!important;display:none!important/);
  assert.doesNotMatch(css,/3px 3px 0 #e4d6ae,4px 4px 0 #a38c60/);
  assert.match(css,/\.tt32-spell-book \.tt32-book-cover\{[\s\S]*?border-left:7px solid/);
});
