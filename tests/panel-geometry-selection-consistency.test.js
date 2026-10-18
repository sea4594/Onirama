import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {newGame,viewFor} from '../engine/game.js';
const file=name=>readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const css=file('public/tabletop/card-system.css'),app=file('public/app.js');
function ui(s){
 const begin=app.indexOf('function searchableCatchers('),end=app.indexOf('function decision(g,canAct)',begin);
 assert(begin>=0&&end>begin);
 const ctx=vm.createContext({COLOR:['red','blue','green','brown'],escape:String,btn:(label,route)=>`<button data-action="${route}">${label}</button>`,card:()=>'<span class="card"></span>'});
 vm.runInContext('let doorSearchIntent=null,doorSearchChromatic=false;'+app.slice(begin,end),ctx);
 ctx.g=viewFor(s,s.active);
 return vm.runInContext('doorSearchDecision(g,g.pending)',ctx);
}
function fixture(){const s=newGame({seed:8282,config:{expansions:['dreamcatchers']}});s.phase='decision';s.pending={type:'doorSearch',color:'blue'};return s;}

test('Door options use consistent bold source and nonbold shuffle text, including catcher and failed-search paths',()=>{
 const s=fixture(),i=s.deck.findIndex(c=>c.kind==='door'&&c.color==='blue');assert(i>=0);
 s.moduleState.dreamcatchers.zones.catch1.push(...s.deck.splice(i,1));
 let html=ui(s);
 assert.match(html,/<strong>from deck<\/strong><span class="tt21-source">Shuffle<\/span>/);
 assert.match(html,/<strong>from catcher 2<\/strong><span class="tt21-source">No shuffle<\/span>/);
 for(let j=s.deck.length-1;j>=0;j--)if(s.deck[j].kind==='door'&&s.deck[j].color==='blue')s.discard.push(...s.deck.splice(j,1));
 html=ui(s);assert.match(html,/<strong>from catcher 2<\/strong><span class="tt21-source">Shuffle<\/span>/);
 assert.equal((html.match(/<strong>from catcher 2<\/strong>/g)||[]).length,2);
 assert.doesNotMatch(html,/then take ·|Catcher 2 · no shuffle|<strong>Search &amp; shuffle<\/strong>/);
});

test('Dock height never depends on the device safe-area inset or the current game decision',()=>{
 const phase16=file('public/tabletop/phase16.css');
 assert.match(phase16,/--tt6-dock-height:188px!important/);
 assert.match(phase16,/--tt6-dock-height:116px!important/);
 assert.match(css,/\.game-viewport>\.tt6-table-slot\{bottom:var\(--tt6-dock-height\)!important\}/);
 assert.match(css,/\.game-viewport>\.tt6-workspace\{height:var\(--tt6-dock-height\)!important;max-height:var\(--tt6-dock-height\)!important;padding-bottom:5px!important\}/);
 assert.doesNotMatch(css,/--tt6-dock-height:calc\([^}]*safe-area-inset-bottom/);
 assert.match(css,/\.tt6-dock-scroll\{box-sizing:border-box;flex:1 1 0!important;min-height:0!important;/);
 assert.match(css,/overflow-y:auto!important;overflow-x:hidden!important/);
});

test('Freeing and Failsafe use matching solid eligible-target styles with no flashing or color wash',()=>{
 const search=css.match(/\.game-viewport \.tt5-catcher\.tt-search-free-eligible\{([^}]+)\}/)?.[1];
 const failsafe=css.match(/\.game-viewport \.tt5-catcher\.tt23-failsafe-target\{([^}]+)\}/)?.[1];
 assert(search&&failsafe);
 for(const body of [search,failsafe]){
  assert.match(body,/outline:3px solid #f9d986!important/);
  assert.match(body,/box-shadow:none!important/);
  assert.match(body,/filter:none!important/);
 }
 assert.match(search,/animation:none!important/);
 assert.match(css,/\.tt5-catcher\.tt-search-free-chosen\{outline:3px solid/);
 assert.doesNotMatch(css,/@keyframes tt-free-pulse/);
});

test('Buttons and selections share clear, non-recoloring styles',()=>{
 assert.match(css,/Unified selection/);
 assert.match(css,/outline:3px solid var\(--table-gold\)!important/);
 assert.match(css,/\.card\.tt7-eligible:not\(\.selected\)\{\s*outline:3px solid #f9d986!important/);
 assert.match(css,/\.tt6-workspace button:focus-visible,/);
 assert.match(css,/\.tt6-workspace :is\(\.tt6-dock-button,\.tt21-search-choice,\.tt21-chromatic,\.tt21-muted,\.tt7-option,\.tt16-spell-choice\)\{min-height:36px\}/);
 assert.match(css,/\.tt6-workspace button:disabled\{opacity:\.46!important/);
 assert.match(css,/\.tt21-search-choice strong\{font-size:11px;font-weight:750/);
 assert.match(css,/\.tt21-search-choice \.tt21-source\{font-size:10px/);
});
