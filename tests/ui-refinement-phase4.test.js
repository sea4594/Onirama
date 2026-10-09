import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {tabletopShape,tabletopDimensions,fitTabletop} from '../public/tabletop/fit.js';
import {newGame,viewFor} from '../engine/game.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';
import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';
const css=readFileSync('public/tabletop/responsive.css','utf8');
test('Phase 4 selects four distinct physical arrangements based on usable shape',()=>{
 assert.equal(tabletopShape(320,568),'portrait');
 assert.equal(tabletopShape(844,390),'short');
 assert.equal(tabletopShape(1024,768),'medium');
 assert.equal(tabletopShape(1440,900),'wide');
 assert.equal(tabletopDimensions(390,844,'coop',6).columns,2);
 assert.equal(tabletopDimensions(844,390,'solo',6).columns,3);
 assert.equal(tabletopDimensions(1440,900,'solo',6).columns,4);
});
test('Dense screens reduce expansion layout pressure before attempting whole-board zoom',()=>{
 for(const pressure of ['tight','minimum'])assert.ok(css.includes(`data-tt4-pressure="${pressure}"`));
 for(const shape of ['wide','medium','short','portrait'])assert.ok(css.includes(`data-tt4-shape="${shape}"`));
 const source=readFileSync('public/tabletop/fit.js','utf8');
 assert.ok(source.indexOf("['normal',1]")<source.indexOf("let lower=.25"));
 assert.match(source,/reflowLabyrinths\(table\)/);
 assert.match(css,/\.tt5-expansions\{grid-area:expansions/);
 assert.match(css,/\.tt6-grid\{/);
});
test('The tabletop remains a pure visual projection, with every enabled expansion component still present',()=>{
 const expansions=['book','glyphs','dreamcatchers','towers','premonitions','crossroads','oniverse','mirrors','sphinx'];
 for(const mode of ['solo','coop']){
  const g=viewFor(newGame({mode,seed:91,config:{expansions}}),0);
  const html=mode==='solo'?renderSoloTabletop(g):renderCooperativeTabletop(g,{seat:0});
  for(const zone of ['goals','alignment','catchers','premonitions','denizens','mirrors'])assert.ok(html.includes(`data-tt-zone="${zone}"`),`${mode}: ${zone}`);
  for(const action of ['openGamePause','openGameRules'])assert.ok(html.includes(`data-action="${action}"`),action);
  assert.match(html,/data-tabletop-scroll=/);
 }
});
test('Cooperative Door count is placed alongside turn status instead of over expansion tiles',()=>{
 const g=viewFor(newGame({mode:'coop',seed:11,config:{expansions:['book']}}),0);
 const html=renderCooperativeTabletop(g,{seat:0});
 const head=html.slice(html.indexOf('<div class="tt6-top">'),html.indexOf('</div>'));
 assert.match(head,/class="tt6-doors-total"/);
 assert.equal((html.match(/class="tt6-doors-total"/g)||[]).length,1);
});
test('Fit handles missing or unmeasurable viewports without touching the game state',()=>{
 assert.equal(fitTabletop(null,null),null);
 assert.equal(fitTabletop({clientWidth:0,clientHeight:500},{}),null);
});
test('GitHub Pages includes responsive CSS and visual viewport reflow',()=>{
 assert.ok(readFileSync('public/index.html','utf8').includes('tabletop/responsive.css'));
 assert.ok(readFileSync('public/app.js','utf8').includes("fitTabletop(viewport,table"));
 assert.ok(readFileSync('public/app.js','utf8').includes("window.visualViewport?.addEventListener?.('resize',resizeGameplay)"));
});
test('Cooperative drafting is a shared full-width zone, while private hands remain obscured',()=>{
 const g=viewFor(newGame({mode:'coop',seed:18,config:{expansions:['book','mirrors']}}),0);
 const html=renderCooperativeTabletop(g,{seat:0});
 assert.match(html,/data-phase="draft"/);
 assert.match(html,/<section class="tt6-draft"/);
 assert.ok(html.indexOf('<div class="tt6-center">')<html.indexOf('<section class="tt6-draft"'));
 assert.ok(html.indexOf('<section class="tt6-draft"')<html.indexOf('<div class="tt6-self">'));
 assert.match(html,/Partner&#39;s hand/);
});
