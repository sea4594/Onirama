import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,viewFor} from '../engine/game.js';
import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';

const css=readFileSync('public/tabletop/phase34.css','utf8');
const start=css.indexOf('/* Desktop co-op equipment atlas.');
const desktop=css.slice(start);

test('Desktop co-op has a landscape-only two-column atlas with the correct two feature rows',()=>{
 assert.ok(start>0);
 assert.match(desktop,/@media \(orientation:landscape\) and \(min-width:1000px\) and \(min-height:600px\)/);
 assert.match(desktop,/grid-template-areas:'doors towers' 'premonitions piles'!important/);
 assert.match(desktop,/\.tt17-coop-equipment>\.tt5-expansions\{\s*display:contents!important/);
 for(const [selector,area] of [
  ['.tt17-coop-doors','doors'],
  ['.tt17-coop-equipment>.tt8-towers-slot','towers'],
  ['.tt17-coop-equipment>.tt5-expansions>.tt5-premonitions','premonitions'],
  ['.tt17-coop-equipment>.tt6-piles','piles']
 ]){
  assert.ok(desktop.includes(selector),`missing desktop selector ${selector}`);
  assert.ok(desktop.includes(`grid-area:${area}!important`),`missing ${area} placement`);
 }
 assert.match(desktop,/\.tt17-coop-equipment,\s*\.game-viewport/);
 assert.match(desktop,/grid-column:1\/-1!important;grid-row:auto!important/);
});

test('Desktop co-op has explicit no-expansion and one-feature fallbacks',()=>{
 assert.match(desktop,/:not\(:has\(\.tt8-towers-slot\)\)/);
 assert.match(desktop,/:not\(:has\(\.tt5-premonitions\)\)/);
 assert.match(desktop,/grid-template-areas:'doors doors' 'piles piles'!important/);
});

test('Both online seats and all equipment combinations retain the correct live DOM grouping',()=>{
 const cases=[[],['towers'],['premonitions'],['towers','premonitions'],['towers','premonitions','dreamcatchers','book','mirrors']];
 for(const expansions of cases){
  for(const seat of [0,1]){
   const game=newGame({mode:'coop',seed:514,config:{expansions}});
   const html=renderCooperativeTabletop(viewFor(game,seat),{seat});
   assert.match(html,/class="tt6-grid tt17-coop-grid"/);
   assert.match(html,/class="tt17-coop-doors"/);
   assert.match(html,/class="tt17-coop-equipment"/);
   assert.match(html,/class="tt6-piles"/);
   assert.equal(html.includes('class="tt8-towers-slot"'),expansions.includes('towers'));
   assert.equal(html.includes('class="tt5-zone tt5-premonitions"'),expansions.includes('premonitions'));
   assert.match(html,/class="tt17-coop-labyrinths"/);
   assert.match(html,/class="tt17-coop-hands"/);
  }
 }
});
