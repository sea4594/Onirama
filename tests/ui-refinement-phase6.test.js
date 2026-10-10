import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {newGame,viewFor} from '../engine/game.js';
import {createDeck} from '../engine/cards.js';
import {pileInventory} from '../engine/pile-inventory.js';
import {gapAtPoint} from '../public/tabletop/interactions.js';
import {DOCK_PENDING_TYPES,actionDockPrompt,renderActionDock,renderPileInspector} from '../public/tabletop/action-dock.js';
const ALL=['book','glyphs','dreamcatchers','towers','premonitions','crossroads','oniverse','mirrors','sphinx'];
test('inventory includes zero-count base categories and enabled extensions with true original totals',()=>{
 for(const expansions of [[],ALL]){const s=newGame({seed:43,config:{expansions}});const rows=pileInventory(s),v=viewFor(s,0);
  assert.equal(rows.reduce((n,r)=>n+r.total,0),createDeck(expansions).length);
  for(const zone of ['deck','discard','limbo'])assert.equal(rows.reduce((n,r)=>n+r[zone],0),s[zone].length);
  assert.equal(v.deck,undefined);assert.equal(v.pileInventory.length,rows.length);
  assert.ok(rows.filter(r=>r.section==='base'&&r.key.includes(':location:')).length===12);
  assert.ok(rows.some(r=>r.label==='Nightmare'&&r.total===10));
  assert.ok(rows.some(r=>r.section==='base'&&r.kind!=='bogus'&&r.discard===0));
  if(expansions.length)for(const ext of ['glyphs','dreamcatchers','towers','premonitions','crossroads','oniverse','sphinx'])assert.ok(rows.some(r=>r.section===ext),ext);
  assert.doesNotMatch(JSON.stringify(v.pileInventory),/"id":"c\d+"/);
 }
});
test('pile counts track actual moves and remain consistent in both player views',()=>{
 const s=newGame({mode:'coop',seed:55,config:{expansions:ALL}});
 s.discard.push(s.deck.pop());s.limbo.push(s.deck.pop());
 const v0=viewFor(s,0),v1=viewFor(s,1);
 assert.deepEqual(v0.pileInventory,v1.pileInventory);
 for(const pile of ['deck','discard','limbo'])assert.equal(v0.pileInventory.reduce((n,r)=>n+r[pile],0),s[pile].length);
 for(const pile of ['deck','discard','limbo']){
  const html=renderPileInspector(v0,pile);assert.match(html,/data-pile-inspector/);if(pile!=='limbo'){assert.match(html,/tt10-count-track/);assert.match(html,/tt7-inventory-card/);}else{assert.match(html,/Cards in Limbo/);assert.doesNotMatch(html,/tt10-count-track/);}assert.doesNotMatch(html,/>Red Sun Location<\//);
 }
});
test('all engine decision kinds have a user-facing prompt and decision controls stay in fixed dock',()=>{
 const g=viewFor(newGame({mode:'solo',seed:32}),0);
 for(const type of DOCK_PENDING_TYPES){const fake={...g,phase:'decision',pending:{type}};const prompt=actionDockPrompt(fake,0);assert.ok(prompt.title&&prompt.title!=='Resolve the card effect',type);
  const html=renderActionDock(fake,0,{dialog:{type,html:'<button data-action="resolve">Resolve</button>'}});assert.match(html,/data-dock-decision/);assert.match(html,/Resolve/);
 }
 assert.match(actionDockPrompt({...g,phase:'decision',pending:{type:'prophecy'}},0,{prophecyDiscard:'c1'}).title,/Prophecy/);
 assert.match(actionDockPrompt({...g,phase:'refill'},0).title,/Draw/);
 assert.match(actionDockPrompt({...g,phase:'draft'},1).title,/draft/i);
 const app=readFileSync('public/app.js','utf8');assert.match(app,/gameWorkspace\(state\.game,state\.room\)/);assert.match(app,/tt6-table-slot/);assert.doesNotMatch(app,/\+\(inGame\?gameDialog\(state\.game,state\.room\)/);
 const css=readFileSync('public/tabletop/action-dock.css','utf8');assert.match(css,/grid-template-rows:minmax\(0,1fr\) 132px/);assert.match(css,/grid-template-columns:minmax\(0,1fr\) 234px/);
});

test('landscape multi-row card reorder uses both axes',()=>{
 const rows=[[0,0],[55,0],[0,75],[55,75]].map(([left,top])=>({getBoundingClientRect:()=>({left,top,width:48,height:68,bottom:top+68})}));
 const list={querySelectorAll:()=>rows};
 assert.equal(gapAtPoint(list,0,4),0);assert.equal(gapAtPoint(list,102,4),2);
 assert.equal(gapAtPoint(list,0,90),2);assert.equal(gapAtPoint(list,102,90),4);
});

test('selection with no legal move receives informative prompt',()=>{const g=viewFor(newGame({seed:66}),0);assert.match(actionDockPrompt(g,0,{selectedId:'c999',legal:[]}).title,/Play \/ discard/);});
