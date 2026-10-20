import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,viewFor} from '../engine/game.js';
import {actionDockPrompt,renderActionDock} from '../public/tabletop/action-dock.js';
import {readFileSync} from 'node:fs';
const base=()=>viewFor(newGame({seed:171,config:{expansions:[]}}),0);
const title=(type,options={},pending={})=>{
 const g=base();g.phase='decision';g.pending={type,...pending};return actionDockPrompt(g,0,options).title;
};
test('every bottom-panel decision heading describes the player action, not just the card name',()=>{
 const cases={
  sphinxName:'Sphinx: name an aspect',sphinxResolve:'Sphinx: arrange revealed cards',
  diver:'Diver: reveal or stop',confusion:'Confusion: reorder your hand',
  mirrorReward:'Mirror: choose cards',doorSearch:'Retrieve a Door',
  door:'Drawn Door: use a Key?',nightmare:'Nightmare: choose a penalty',
  prophecy:'Prophecy: arrange / choose discard',happyDream:'Happy Dream: choose an effect',
  happyFetch:'Happy Dream: choose a card',rally:'Rally a Denizen: choose a card',
  premonitionPick:'Choose a Dark Premonition',premonitionDoor:'Dark Premonition: remove a Door',
  premonitionKeys:'Dark Premonition: discard Keys',premonitionNightmare:'Dark Premonition: return a Nightmare',
  incantation:'Incantation: arrange cards',incantationOrder:'Incantation: arrange remaining cards',
  towerLook:'Tower: arrange revealed cards',spellPeek:'Paradoxical Prophecy: choose a card',
  happyPeek:'Happy Dream: discard and arrange',
  catchChoose:'Catch the Limbo cards',catchOverload:'Overload!',towerPenalty:'Choose a Tower',
  moduleDecision:'Choose an effect',coopSwap:'Swap cards or pass',
  drawReady:'Draw a card',drawn:'Continue drawing'
 };
 for(const [type,expected] of Object.entries(cases))assert.equal(title(type),expected,type);
 for(const value of Object.values(cases))assert.ok(value.length<=45,value);
});
test('headers update as multi-step decisions progress, using legal rules context',()=>{
 assert.equal(title('nightmare',{nightChoice:'key'}),'Nightmare: discard a Key');
 assert.equal(title('nightmare',{nightChoice:'door'}),'Nightmare: remove a Door');
 assert.equal(title('prophecy',{prophecyDiscard:'selected-card'}),'Prophecy: arrange remaining cards');
 assert.equal(title('doorSearch',{doorSearchChromatic:true}),'Chromatic Chaos: choose a Door');
 assert.equal(title('happyDream',{happyBanishMode:true}),'Happy Dream: remove a Premonition');
 assert.equal(title('incantation',{}, {cards:[{kind:'location'},{kind:'door'}]}),'Incantation: choose a Door');
 assert.equal(title('incantation',{}, {cards:[{kind:'location'}]}),'Incantation: arrange cards');
 assert.equal(title('diver',{}, {cards:[{kind:'nightmare'}]}),'Diver: resolve a Nightmare');
 assert.equal(title('denizenPeek',{}, {place:'top'}),'Squirrel Spies: arrange cards');
 assert.equal(title('denizenPeek',{}, {place:'bottom'}),'Harpoon Hunter: arrange cards');
 assert.equal(title('premonitionKeys',{}, {count:1}),'Dark Premonition: discard 1 Key');
 assert.equal(title('premonitionKeys',{}, {count:2}),'Dark Premonition: discard 2 Keys');
 assert.equal(title('sphinxResolve',{}, {aspect:'blue',cards:[{kind:'location',color:'blue',symbol:'sun'}]}),'Sphinx: choose a top card');
 assert.equal(title('sphinxResolve',{}, {aspect:'blue',cards:[{kind:'location',color:'red',symbol:'moon'}]}),'Sphinx: return cards to bottom');
 assert.equal(title('sphinxResolve',{}, {aspect:'red',cards:[{kind:'location',color:'wild',symbol:'sun'}]}),'Sphinx: choose a top card');
 for(const [mirror,action] of [['red','choose cards'],['blue','choose cards'],['brown','choose Doors'],['key','choose Doors'],['glyph','choose Doors']])
  assert.equal(title('mirrorReward',{}, {mirror}),`${mirror[0].toUpperCase()}${mirror.slice(1)} Mirror: ${action}`);
});
test('optional denizens/spells override interrupted decision headings; optional freeing stays consistent',()=>{
 const g=base();g.phase='decision';g.pending={type:'nightmare'};
 assert.equal(actionDockPrompt(g,0,{dialog:{type:'denizen',title:'Keeper: choose a card to store'}}).title,'Keeper: choose a card to store');
 assert.equal(actionDockPrompt(g,0,{dialog:{type:'denizen'}}).title,'Use a Denizen?');
 assert.equal(actionDockPrompt(g,0,{dialog:{type:'spellbook',title:'Parallel Planning: choose two Goals'}}).title,'Parallel Planning: choose two Goals');
 assert.equal(actionDockPrompt(g,0,{dialog:{type:'spellbook'}}).title,'Book of Steps: cast a spell');
 assert.equal(actionDockPrompt(g,0,{dialog:{type:'freeSearch',freeing:true,title:'Other'}}).title,'Free a dreamcatcher?');
 assert.equal(actionDockPrompt(g,0,{dialog:{type:'mirrorPair'}}).title,'Mirror: choose two cards');
 assert.equal(actionDockPrompt(g,0,{dialog:{type:'cyclobot'}}).title,'Cyclobot: choose a Location');
 assert.equal(actionDockPrompt({...g,phase:'turnComplete'},0,{dialog:{type:'denizen',title:'Use this Denizen?'}}).title,'Use this Denizen?');
 assert.equal(actionDockPrompt(g,1,{dialog:{type:'denizen'}}).title,'Waiting for partner');
 const html=renderActionDock(g,0,{dialog:{type:'denizen',title:'Keeper: choose a card to store',html:'<button>Use</button>'}});
 assert.match(html,/<strong role="status">Keeper: choose a card to store<\/strong>/);
 const app=readFileSync('public/app.js','utf8');
 assert.match(app,/return \{type:'denizen',title,key:/);
 assert.match(app,/return \{type:'spellbook',title:/);
 assert.match(app,/prophecyDiscard,failsafeChoosing,nightChoice,happyBanishMode,doorSearchChromatic/);
});
test('routine gameplay and companion wait states remain accurate',()=>{
 const g=base();assert.equal(actionDockPrompt(g,0).title,'Play or discard');
 assert.equal(actionDockPrompt({...g,phase:'refill'},0).title,'Draw a card');
 assert.equal(actionDockPrompt({...g,phase:'turnComplete'},0).title,'End your turn');
 assert.equal(actionDockPrompt({...g,phase:'draft'},0).title,'Draft a card');
 assert.equal(actionDockPrompt({...g,phase:'action'},0,{failsafeChoosing:true}).title,'Failsafe: choose a Dreamcatcher');
 assert.equal(actionDockPrompt({...g,phase:'draft'},1).title,'Partner drafting');
 assert.equal(actionDockPrompt({...g,phase:'refill'},1).title,'Partner drawing');
 assert.equal(actionDockPrompt({...g,status:'won'},0).title,'You escaped the dream!');
});
