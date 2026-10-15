import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderCard} from '../public/tabletop/cards.js';
import {renderExpansionTabletop,premonitionFace} from '../public/tabletop/expansions.js';
import {renderPileInspector,actionDockPrompt} from '../public/tabletop/action-dock.js';
import {newGame,viewFor,act} from '../engine/game.js';
const app=readFileSync('public/app.js','utf8');
const css=readFileSync('public/tabletop/phase18.css','utf8');
const game=expansions=>viewFor(newGame({seed:19,config:{expansions}}),0);
test('card types have wordless distinct face art; Denizens retain their names',()=>{
 const kinds=['door','nightmare','lostDream','happyDream','deadEnd','sphinx','diver','confusion'];
 const faces=kinds.map(kind=>renderCard({kind,color:kind==='door'?'red':undefined}));
 for(const html of faces)assert.doesNotMatch(html,/class="card-label"/);
 assert.equal(new Set(faces.map(h=>h.match(/<svg[^>]*>([\s\S]*?)<\/svg>/)?.[1])).size,kinds.length);
 const denizens=['architect','cyclobot','squirrel','harpoon','hammer','chromatic','mirror','keeper'];
 const art=denizens.map(ability=>renderCard({kind:'denizen',ability},{tiny:true}));
 assert.equal(new Set(art.map(h=>h.match(/<svg[^>]*>([\s\S]*?)<\/svg>/)?.[1])).size,8);
 for(const html of art)assert.match(html,/class="card-label"/);
 assert.match(css,/\.card\.tiny \.symbol \.ui-icon/);assert.match(css,/min-width:0!important/);
});
test('brighter, distinct four-color tokens are used by cards, Mirrors, Book goals and Door slots',()=>{
 for(const color of ['red','blue','green','brown']){
  assert.match(css,new RegExp('\\-\\-'+color+':#[a-f\\d]{6}','i'));
  assert.match(css,new RegExp('tt5-goal-face\\.'+color));
  assert.match(css,new RegExp('tt5-mirror-symbol\\.'+color));
  assert.match(css,new RegExp('tt8-door-empty\\.'+color));
 }
 const tokens=['red','blue','green','brown'].map(c=>css.match(new RegExp('\\-\\-'+c+':(#[a-f\\d]{6})','i'))?.[1]);assert.equal(new Set(tokens).size,4);
});
test('all Premonitions have different wordless progress-marked pictograms; reserve is a blank card back',()=>{
 const ids=['red2','green2','blue2','brown2','pair2','doors5','rainbow4','doors3'];
 assert.equal(new Set(ids.map(id=>premonitionFace(id))).size,8);
 for(const id of ids){assert.match(premonitionFace(id),/tt18-pm-art/);assert.doesNotMatch(premonitionFace(id),/>Warning|>Reserve/);}
 const html=renderExpansionTabletop(game(['premonitions']));assert.match(html,/data-action="inspectPile:reserve"/);
 assert.doesNotMatch(html,/tt14-reserve-label|Reserve ·/);assert.match(html,/tt14-reserve-back/);
 const inspector=renderPileInspector(game(['premonitions']),'reserve');assert.match(inspector,/tt18-pm-art/);
});
test('Door gain/pass, legal crossroad selection and Dreamcatcher overload sacrifice are distinct',()=>{
 assert.match(app,/data-action=\"useKey:gain\"/);assert.match(app,/btn\('Pass','useKey:limbo'/);
 assert.match(app,/actionName==='useKey:gain'/);assert.match(app,/type:'chooseDoor',keyId:best.id/);
 assert.match(app,/`Sacrifice \${i\+1}`/);
 assert.doesNotMatch(app,/Send Door to Limbo|btn\(`Free \${i\+1}`,`catchOverload/);
 const status=game(['dreamcatchers']);status.phase='decision';status.pending={type:'catchOverload',choices:[0]};assert.equal(actionDockPrompt(status,0).title,'Sacrifice a Dreamcatcher');
});
test('discard history is chronological and retains every card with newest to the right',()=>{
 const cards=[{id:'first',kind:'location',color:'red',symbol:'sun'},{id:'middle',kind:'location',color:'blue',symbol:'moon'},{id:'last',kind:'location',color:'green',symbol:'key'}];
 const html=renderPileInspector({discard:cards,pileInventory:[]},'discard');
 assert.ok(html.indexOf('data-tt-motion-id="first"')<html.indexOf('data-tt-motion-id="middle"'));
 assert.ok(html.indexOf('data-tt-motion-id="middle"')<html.indexOf('data-tt-motion-id="last"'));
 assert.match(app,/newDiscardStrip.scrollLeft=discardWasAtEnd\?newDiscardStrip.scrollWidth:discardX/);
 assert.match(css,/grid-template-columns:repeat\(auto-fill,minmax/);
});
