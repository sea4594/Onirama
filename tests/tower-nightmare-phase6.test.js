import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,act,assertConserved,viewFor} from '../engine/game.js';
import {renderTowerTabletop} from '../public/tabletop/expansions.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';
import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';
import {actionDockPrompt} from '../public/tabletop/action-dock.js';
const source=readFileSync('public/app.js','utf8'),css=readFileSync('public/tabletop/card-system.css','utf8');
const take=(deck,fn,to)=>{const i=deck.findIndex(fn);assert.ok(i>=0);const [c]=deck.splice(i,1);to.push(c);return c;};
const setup=(mode='solo')=>{
 let s=newGame({mode,seed:1099,config:{expansions:['towers'],difficulties:{towers:'hard'}}});
 if(mode==='coop')while(s.phase==='draft')s=act(s,{type:'draft',id:s.draft[0].id});
 const a=s.moduleState.towers.zones.alignment;
 const towers=[take(s.deck,c=>c.kind==='tower',a),take(s.deck,c=>c.kind==='tower',a),take(s.deck,c=>c.kind==='tower',a)];
 const nightmare=take(s.deck,c=>c.kind==='nightmare',[]);s.pending={type:'nightmare',card:nightmare};s.phase='decision';assertConserved(s);
 s=act(s,{type:'nightmare',option:'reveal'});assert.equal(s.pending?.type,'towerPenalty');assertConserved(s);
 return {s,towers,nightmare};
};
test('Phase 6: Nightmare Tower choices are selectable without replacing Tower face markup',()=>{
 const {s,towers}=setup(),g=viewFor(s,0),ids=new Set(towers.map(c=>c.id));
 const ordinary=renderTowerTabletop(g,{decisionTargets:new Set()});
 const selecting=renderTowerTabletop(g,{decisionTargets:ids});
 assert.equal((ordinary.match(/class="card (?:red|blue|green|brown) card-kind-tower tiny"/g)||[]).length,3);
 assert.equal((selecting.match(/class="card (?:red|blue|green|brown) card-kind-tower tiny tt7-eligible"/g)||[]).length,3);
 assert.equal((selecting.match(/data-pick="/g)||[]).length,3);
 for(const html of [ordinary,selecting]){
  assert.equal((html.match(/tt11-tower-emblem/g)||[]).length,3);
  assert.equal((html.match(/tt11-tower-number/g)||[]).length,3);
  assert.equal((html.match(/tt8-tower-left/g)||[]).length,3);
  assert.equal((html.match(/tt8-tower-right/g)||[]).length,3);
 }
 assert.match(css,/\.tt8-towers-slot \.tt5-preview button\.card\.card-kind-tower\{[^}]*padding:0!important/);
 assert.match(css,/button\.card\.card-kind-tower:focus-visible\{[^}]*outline:3px/);
 assert.match(source,/if\(p\.type==='towerPenalty'\)return action\(\{type:'towerPenalty',option:'discard',towerId:id\}\)/);
 assert.match(source,/Tap an outlined Tower to destroy it/);
 assert.equal(actionDockPrompt(g,0).title,'Choose a Tower');
});
test('Phase 6: the same Tower selection is rendered in solo and cooperative layouts',()=>{
 for(const mode of ['solo','coop']){
  const {s,towers}=setup(mode),g=viewFor(s,0),targets=new Set(towers.map(c=>c.id));
  const html=mode==='solo'?renderSoloTabletop(g,{decisionTargets:targets}):renderCooperativeTabletop(g,{seat:0,decisionTargets:targets});
  for(const tower of towers)assert.match(html,new RegExp(`data-pick="${tower.id}"`));
  assert.equal((html.match(/class="card (?:red|blue|green|brown) card-kind-tower tiny tt7-eligible"/g)||[]).length,3);
 }
});
test('Phase 6: resolving Tower destruction or False Destruction conserves cards',()=>{
 for(const mode of ['solo','coop']){
  const {s,towers,nightmare}=setup(mode),first=towers[0];
  const removed=act(s,{type:'towerPenalty',option:'discard',towerId:first.id});
  assertConserved(removed);assert.ok(removed.discard.some(c=>c.id===first.id));assert.ok(removed.discard.some(c=>c.id===nightmare.id));
  assert.equal(removed.moduleState.towers.zones.alignment.length,2);
  const spared=act(s,{type:'towerPenalty',option:'fake'});assertConserved(spared);
  assert.equal(spared.moduleState.towers.zones.alignment.length,3);
  assert.ok(spared.limbo.some(c=>c.id===nightmare.id)||spared.deck.some(c=>c.id===nightmare.id));
 }
});
test('Phase 6: a middle Tower cannot be destroyed if its neighbors would conflict',()=>{
 const {s,towers}=setup(),a=s.moduleState.towers.zones.alignment;
 a[0].right='sun';a[2].left='sun';assertConserved(s);
 assert.throws(()=>act(s,{type:'towerPenalty',option:'discard',towerId:towers[1].id}),/Removing this Tower/);
 assertConserved(s);assert.equal(a.length,3);
 // Ends are always legal alternatives.
 const legal=act(s,{type:'towerPenalty',option:'discard',towerId:towers[0].id});assertConserved(legal);
});
