import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {tabletopShape,tabletopDimensions,fitTabletop} from '../public/tabletop/fit.js';
import {newGame,viewFor} from '../engine/game.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';
import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';
import {renderActionDock} from '../public/tabletop/action-dock.js';
const css=readFileSync('public/tabletop/responsive.css','utf8');
test('Phase 4 selects four distinct physical arrangements based on usable shape',()=>{
 assert.equal(tabletopShape(320,568),'portrait');
 assert.equal(tabletopShape(844,390),'short');
 assert.equal(tabletopShape(1024,768),'medium');
 assert.equal(tabletopShape(1440,900),'wide');
 assert.ok(tabletopDimensions(390,844,'coop',6).mini>=25);
 assert.ok(tabletopDimensions(844,390,'solo',6).card>45);
 assert.ok(tabletopDimensions(1440,900,'solo',6).card>75);
});
test('Dense screens reduce expansion pressure before a width-preserving paint-only fit',()=>{
 for(const pressure of ['tight','minimum'])assert.ok(css.includes(`data-tt4-pressure="${pressure}"`));
 for(const shape of ['wide','medium','short','portrait'])assert.ok(css.includes(`data-tt4-shape="${shape}"`));
 const source=readFileSync('public/tabletop/fit.js','utf8');
 assert.ok(source.indexOf("['comfortable','compact','dense','ultra']")<source.indexOf("let zoom=1"));
 assert.match(source,/table\.style\.transform=.*scale/);
 assert.doesNotMatch(source,/table\.style\.zoom=String\(middle\)/);
 assert.match(source,/overlapRows\(table\)/);
 assert.match(css,/\.tt5-expansions\{grid-area:expansions/);
 assert.match(css,/\.tt6-grid\{/);
});
test('The tabletop remains a pure visual projection, with every enabled expansion component still present',()=>{
 const expansions=['book','glyphs','dreamcatchers','towers','premonitions','crossroads','oniverse','mirrors','sphinx'];
 for(const mode of ['solo','coop']){
  const g=viewFor(newGame({mode,seed:91,config:{expansions}}),0);
  const html=mode==='solo'?renderSoloTabletop(g):renderCooperativeTabletop(g,{seat:0});
  for(const zone of ['alignment','catchers','premonitions','denizens','mirrors'])assert.ok(html.includes(`data-tt-zone="${zone}"`),`${mode}: ${zone}`);
  assert.match(html,/data-action="openSpells"/);assert.doesNotMatch(html,/data-tt-zone="goals"/);
  assert.doesNotMatch(html,/data-action="openGamePause"|data-action="openGameRules"/);
  assert.match(html,/data-tabletop-scroll=/);
 }
});
test('Cooperative Door count stays in the Doors section, without a gameplay header',()=>{
 const g=viewFor(newGame({mode:'coop',seed:11,config:{expansions:['book']}}),0);
 const html=renderCooperativeTabletop(g,{seat:0});
 assert.doesNotMatch(html,/class="tt6-top"|class="tt2-game-name"|class="tt6-turn"/);
 assert.match(html,/class="tt6-region-heading"><strong>Doors<\/strong>/);
});
test('Fit handles missing or unmeasurable viewports without touching the game state',()=>{
 assert.equal(fitTabletop(null,null),null);
 assert.equal(fitTabletop({clientWidth:0,clientHeight:500},{}),null);
});
test('GitHub Pages includes responsive CSS and visual viewport reflow',()=>{
 assert.ok(readFileSync('public/index.html','utf8').includes('tabletop/responsive.css'));
 assert.ok(readFileSync('public/app.js','utf8').includes("fitTabletop(viewport,table"));
 assert.ok(readFileSync('public/app.js','utf8').includes("window.visualViewport?.addEventListener?.('resize',fitAfterViewportSettles)"));
});
test('Cooperative drafting uses the fixed bottom dock and does not duplicate cards on the board',()=>{
 const g=viewFor(newGame({mode:'coop',seed:18,config:{expansions:['book','mirrors']}}),0);
 const html=renderCooperativeTabletop(g,{seat:0});
 assert.match(html,/data-phase="draft"/);
 assert.doesNotMatch(html,/<section class="tt6-draft/);
 assert.match(html,/Partner&#39;s hand/);
 const dock=renderActionDock(g,0);
 assert.match(dock,/tt28-draft-cards/);
 assert.equal((dock.match(/data-pick=/g)||[]).length,8);
});
