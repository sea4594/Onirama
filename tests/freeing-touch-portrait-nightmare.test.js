import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,viewFor} from '../engine/game.js';
import {renderActionDock,actionDockPrompt} from '../public/tabletop/action-dock.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';
import {renderDoorSlots} from '../public/tabletop/door-slots.js';

const source=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const css=source('public/tabletop/card-system.css'),styles=source('public/styles.css'),app=source('public/app.js');
const game=(phase='decision')=>({status:'active',phase,active:0,players:[{name:'Player'}],pending:{type:'doorSearch'}});

test('Every optional Dreamcatcher Freeing step uses the same complete dock title, never Door or Spellbook',()=>{
 for(const [g,dialog] of [[game(),{type:'doorSearch',freeing:true,html:'<p>Free a dreamcatcher?</p>'}],[game('action'),{type:'freeSearch',freeing:true,html:'<p>Free a dreamcatcher?</p>'}]]){
  assert.equal(actionDockPrompt(g,0,{dialog}).title,'Free a dreamcatcher?');
  const html=renderActionDock(g,0,{dialog});
  assert.match(html,/<strong role="status">Free a dreamcatcher\?<\/strong>/);
  assert.doesNotMatch(html,/<strong role="status">(?:Door|Spellbook)<\/strong>/);
 }
 assert.equal(actionDockPrompt(game(),0,{dialog:{type:'doorSearch',freeing:false}}).title,'Door');
 assert.equal(actionDockPrompt(game(),1,{dialog:{type:'doorSearch',freeing:true}}).title,'Partner resolving');
 assert.equal((app.match(/<p>Free a dreamcatcher\?<\/p>/g)||[]).length,2);
 assert.doesNotMatch(app,/Trigger a freeing\?/);
 assert.match(app,/freeing:g\.pending\.type==='doorSearch'&&Boolean\(doorSearchIntent\)/);
 assert.match(app,/type:'freeSearch',freeing:true/);
});

test('Nightmare eligible Door remains the same slot and card face, only an outlined button',()=>{
 const doors=['red','blue','green','brown'].flatMap((color,i)=>[0,1].map(n=>({id:`d${i}-${n}`,kind:'door',color})));
 const baseline=renderDoorSlots(doors,{expansions:[]});
 const eligible=renderDoorSlots(doors,{expansions:[]},{targets:new Set([doors[0].id,doors[3].id])});
 assert.equal((baseline.match(/class="tt8-door-slot /g)||[]).length,8);
 assert.equal((eligible.match(/class="tt8-door-slot /g)||[]).length,8);
 assert.equal((eligible.match(/<button class="card [^\"]*card-kind-door tiny tt7-eligible"/g)||[]).length,2);
 assert.equal((eligible.match(/<div class="card [^\"]*card-kind-door tiny"/g)||[]).length,6);
 assert.match(css,/\.tt8-door-slot>button\.card\.tiny\{[^}]*padding:0!important/);
 assert.match(css,/\.tt8-door-slot>button\.card\.tiny\{[^}]*aspect-ratio:1\/1\.42!important/);
});

test('Premonitions move directly beneath Doors only in mobile portrait, without card size changes',()=>{
 const state=newGame({seed:3001,config:{expansions:['premonitions','dreamcatchers','towers','oniverse']}});
 const html=renderSoloTabletop(viewFor(state,0));
 assert.match(html,/data-tt-zone="premonitions"/);
 assert.match(html,/data-tt-zone="catchers"/);
 assert.match(css,/@media \(orientation:portrait\) and \(max-width:679px\)/);
 assert.match(css,/grid-template-areas:'doors doors' 'premonitions premonitions' 'towers towers' 'catchers catchers'/);
 assert.match(css,/\.tt9-exp-primary\{display:contents!important\}/);
 assert.match(css,/\.tt5-zone\.tt5-premonitions\{grid-area:premonitions!important\}/);
 assert.match(css,/\.tt5-zone\.tt5-catchers\{grid-area:catchers!important\}/);
 // No new card width, height, or aspect-ratio declarations within the portrait layout block.
 const portrait=css.slice(css.lastIndexOf('/* In phone portrait'));
 assert.doesNotMatch(portrait,/(?:\.tt5-premonition|\.tt5-catcher)\{[^}]*(?:height:|width:|aspect-ratio:)/);
});

test('Touch-only devices never receive desktop hover washes or false button selection',()=>{
 const hoverRules=[
  'button:not(.card):hover:not(:disabled){background:#415273;border-color:#c5b28a}',
  '.primary:hover:not(:disabled){background:#e5bf83}',
  'button:not(.card):hover:not(:disabled){background:var(--ui-border);border-color:var(--ui-accent)}',
  'button.primary:hover:not(:disabled){filter:brightness(1.14);background:var(--ui-accent)}'
 ];
 for(const rule of hoverRules)assert.ok(styles.includes(`@media (hover:hover) and (pointer:fine){${rule}}`));
 assert.match(app,/app\.addEventListener\('pointerdown',\(\)=>\{lastInputWasKeyboard=false;/);
 assert.match(app,/const focusKind=lastInputWasKeyboard\?/);
 assert.match(app,/nightChoice==='door'/);
 assert.match(app,/aria-pressed="\$\{chosen\}"/);
});
