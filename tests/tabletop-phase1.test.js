import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderCard,renderDoors,cardDescription,htmlEscape} from '../public/tabletop/cards.js';
import {planTabletop,applyTabletopMetrics,REFERENCE_VIEWPORTS} from '../public/tabletop/layout.js';
import {zonesFor,assertZoneCoverage,EXPANSION_ZONES,PENDING_DECISIONS,EXTRA_INTERACTIONS} from '../public/tabletop/zones.js';
import {newGame,viewFor} from '../engine/game.js';
const standards=['book','glyphs','dreamcatchers','towers','premonitions','crossroads','oniverse','mirrors','sphinx'];
test('Responsive layout plans preserve every required zone at every reference viewport and density',()=>{
 for(const [width,height] of REFERENCE_VIEWPORTS)for(const mode of ['solo','coop'])for(const expansions of [[],['book','glyphs','towers','dreamcatchers'],standards]){
  const plan=planTabletop({width,height,mode,expansions});const expected=zonesFor({mode,expansions});
  assert.deepEqual(plan.zones,expected);assert.deepEqual(assertZoneCoverage(plan.zones,{mode,expansions}),{missing:[],unexpected:[]});
  assert.ok(plan.cardWidth>=42&&plan.cardWidth<=110);assert.ok(plan.compactWidth>=30&&plan.compactWidth<=60);
  assert.equal(new Set(plan.zones).size,plan.zones.length);
  assert.equal(plan.regions.core.length+plan.regions.players.length+plan.regions.expansions.length,plan.zones.length);
  assert.ok(width/height>=1.12?plan.orientation==='landscape':plan.orientation==='portrait');
 }
});
test('Zones cover every standard expansion, optional Incubus, and both multiplayer seats',()=>{
 assert.deepEqual(Object.keys(EXPANSION_ZONES),[...standards,'incubus']);
 const plan=planTabletop({width:390,height:844,mode:'coop',expansions:standards});
 for(const required of ['p0-hand','p1-hand','p0-labyrinth','p1-labyrinth','p0-doors','p1-doors','shared-hand','draft','draw','discard','limbo','catchers','alignment','goals','spellbook','premonitions','denizens','mirrors'])assert.ok(plan.zones.includes(required),required);
 assert.ok(zonesFor({expansions:['incubus']}).includes('incubus'));
 assert.throws(()=>zonesFor({expansions:['unknown']}),/Unknown expansion/);
});
test('Inventory enumerates all 23 engine decision types, plus contextual operations',()=>{
 const source=readFileSync('public/app.js','utf8');
 assert.equal(PENDING_DECISIONS.length,23);assert.equal(new Set(PENDING_DECISIONS).size,23);
 for(const kind of PENDING_DECISIONS)assert.ok(source.includes(`'${kind}'`),`Unrepresented decision ${kind}`);
 assert.ok(EXTRA_INTERACTIONS.includes('cooperative-discard-swap'));
});
test('Card primitives keep original action IDs, selected state, escaping, and masking',()=>{
 const c={id:'a" onfocus="alert(1)',kind:'location',color:'blue',symbol:'key'};
 const html=renderCard(c,{select:true,selectedId:c.id});assert.match(html,/data-pick="a&quot; onfocus=&quot;alert\(1\)"/);assert.match(html,/aria-pressed="true"/);
 assert.ok(!html.includes('data-pick="a" onfocus='));assert.match(renderCard(c,{select:false}),/class="card blue/);
 assert.match(renderCard({id:'hidden',kind:'hidden'}),/Hidden/);
 assert.equal(htmlEscape('<script>'),'&lt;script&gt;');assert.equal(cardDescription({kind:'door',expansion:'oniverse'}),'Door to the Oniverse');
 assert.match(renderDoors({doors:[{id:'d',kind:'door',color:'red'}]}),/door-group/);
});
test('Layout planner is presentation-only: running it cannot mutate the engine or expose private cards',()=>{
 const game=newGame({mode:'coop',seed:53,config:{expansions:standards}}),before=JSON.stringify(game);
 for(const [w,h] of REFERENCE_VIEWPORTS)planTabletop({width:w,height:h,mode:'coop',expansions:standards});
 assert.equal(JSON.stringify(game),before);
 const view=viewFor(game,0);assert.equal(view.deck,undefined);
});
test('Layout metrics update DOM styling without touching gameplay data or DOM children',()=>{
 const calls=new Map();const element={dataset:{},style:{setProperty:(k,v)=>calls.set(k,v)},getBoundingClientRect:()=>({width:844,height:390})};
 const plan=applyTabletopMetrics(element,{mode:'solo',expansions:[]});
 assert.equal(element.dataset.tabletopLayout,plan.layout);assert.ok(calls.get('--tabletop-card-width').endsWith('px'));
 assert.equal(applyTabletopMetrics(null,{}),null);
});
