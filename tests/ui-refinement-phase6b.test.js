import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {newGame,viewFor,act} from '../engine/game.js';import {renderCard} from '../public/tabletop/cards.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';
import {renderPileInspector,renderActionDock,actionDockPrompt} from '../public/tabletop/action-dock.js';
const app=readFileSync('public/app.js','utf8'),css=readFileSync('public/tabletop/action-dock.css','utf8');
test('Location faces have only artwork; their identity remains accessible to assistive technology and inspection',()=>{
 const h=renderCard({id:'card-red',kind:'location',color:'red',symbol:'sun'},{select:true});
 assert.match(h,/data-pick="card-red"/);assert.match(h,/aria-label="red sun"/);assert.doesNotMatch(h,/class="card-label"/);
 assert.match(renderCard({kind:'door',color:'blue'}),/class="card-label"/);
});
test('existing hand and acquired Door cards are actionable during mandatory decisions without copying them into the dock',()=>{
 const s=newGame({mode:'solo',seed:23}),g=viewFor(s,0),key=g.players[0].hand[0];
 g.phase='decision';g.pending={type:'rally',choices:[key.id]};
 const handHtml=renderSoloTabletop(g,{decisionTargets:new Set([key.id])});
 assert.match(handHtml,new RegExp(`data-pick="${key.id}"`));assert.match(handHtml,/tt7-eligible/);
 g.players[0].doors.push({id:'door1',kind:'door',color:'red'});
 const doorHtml=renderSoloTabletop(g,{decisionTargets:new Set(['door1'])});assert.match(doorHtml,/data-pick="door1"/);
});
test('cooperative hand and public Door targets remain selectable during a decision, not the hidden partner hand',()=>{
 let s=newGame({mode:'coop',seed:37});while(s.phase==='draft')s=act(s,{type:'draft',id:s.draft[0].id});
 const g=viewFor(s,0),id=g.players[0].hand[0].id,other=s.players[1].hand[0].id;g.phase='decision';
 const html=renderCooperativeTabletop(g,{seat:0,decisionTargets:new Set([id,other])});
 assert.match(html,new RegExp(`data-pick="${id}"`));assert.doesNotMatch(html,new RegExp(`data-pick="${other}"`));
});
test('nightmare stage buttons, prophecy discard slot and dock scroll containment are explicit',()=>{
 assert.match(app,/nightChoose:key/);assert.match(app,/nightChoose:door/);assert.match(app,/nightReveal/);assert.match(app,/nightHand/);assert.match(app,/tt7-prophecy-slot/);
 assert.match(app,/onDiscard:id/);assert.match(app,/if\(!prophecyDiscard\)return/);
 assert.match(css,/\.tt6-dock-scroll\{[^}]*overflow:hidden/);assert.match(css,/user-select:none!important/);
 assert.doesNotMatch(app,/data-mirror-pair=/);assert.doesNotMatch(app,/id="swapPersonal"|id="swapShared"/);
});
test('pile inventories show card pictures plus zero-inclusive counts, never text-only entries',()=>{
 const g=viewFor(newGame({seed:71,config:{expansions:['glyphs','towers']}}),0);
 const html=renderPileInspector(g,'deck');assert.match(html,/tt7-inventory-card/);assert.match(html,/class="card red tiny"/);
 assert.match(html,/aria-label="Red Sun Location: \d+ of \d+"/);assert.match(html,/tt10-count-track/);assert.doesNotMatch(html,/small>\/\d+/);
 assert.doesNotMatch(html,/>Red Sun Location<\/span>/);
});
test('compact status strings do not include unnecessary directions',()=>{
 const g=viewFor(newGame({seed:48}),0);g.phase='decision';g.pending={type:'nightmare'};
 assert.equal(actionDockPrompt(g,0).title,'Nightmare!');
 const html=renderActionDock(g,0,{dialog:{type:'nightmare',html:'<button>Reveal 5</button>'}});
 assert.match(html,/Nightmare!/);assert.doesNotMatch(html,/Choose from the options|official penalties|unavailable resources/);
});
test('free Dreamcatcher placement happens automatically; only overload requires choosing',()=>{
 const source=readFileSync('engine/game.js','utf8');assert.match(source,/if\(empty\.length\)\{const i=empty\[0\]/);
 assert.match(source,/type:'catchOverload'/);assert.doesNotMatch(source,/type:empty\.length\?'catchChoose'/);
});
