import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,viewFor} from '../engine/game.js';
import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';
import {renderActionDock} from '../public/tabletop/action-dock.js';
import {renderRulesReference} from '../public/rules-guide.js';
import {renderOverlay} from '../public/game-overlay.js';
const read=p=>readFileSync(p,'utf8');
test('co-op draft choices exist in the bottom panel only, for the active seat',()=>{
 const g=newGame({mode:'coop',seed:22,config:{expansions:[]}});
 for(const seat of [0,1]){
  const view=viewFor(g,seat),board=renderCooperativeTabletop(view,{seat}),dock=renderActionDock(view,seat);
  assert.doesNotMatch(board,/tt6-draft-cards|class="tt6-draft"/);
  assert.match(dock,/data-action-dock/);
  assert.match(dock,/class="tt28-draft-cards"/);
  assert.equal((dock.match(/data-pick="/g)||[]).length,seat===g.active?8:0);
  assert.equal((dock.match(/card-kind-location/g)||[]).length,8);
 }
});
test('co-op portrait layout has no space-between rows; premonitions follow doors and towers grow',()=>{
 const s=read('public/tabletop/phase17.css');
 assert.match(s,/orientation:portrait[^]*tt17-coop-grid\.tt6-grid\{justify-content:flex-start!important/);
 assert.match(s,/\.tt5-premonitions\{order:2/);
 assert.match(s,/\.tt17-coop-doors\{order:1/);
 assert.match(s,/\.tt8-towers-slot\{order:3;flex:1 1/);
 assert.match(s,/\.tt17-coop-labyrinths\{order:8/);
});
test('settings and rules remove obsolete shortcuts but retain searchable rules and tutorial',()=>{
 const app=read('public/app.js'),css=read('public/shell.css'),rules=renderRulesReference();
 assert.match(app,/shell-settings-tabs/);
 assert.match(app,/renderSettingsContents/);
 const settingsView=read('public/game-overlay.js');
 assert.match(settingsView,/shell-settings-commit/);
 assert.match(settingsView,/History &amp; statistics/);
 assert.match(app,/data-action="tutorial">Guided tutorial/);
 assert.doesNotMatch(rules,/Complete base rules, co-op play|guide-chapter-nav/);
 assert.match(rules,/data-guide-search/);
 assert.match(css,/shell-settings-tabs>a\.active/);
 assert.match(css,/shell-multiplayer:has\(\.shell-primary-actions\) \.shell-primary-actions\{width:100%;max-width:none/);
 const overlay=renderOverlay('pause',[],false,{tab:'settings'});
 for(const removed of ['cardSize','contrast','textSize'])assert.doesNotMatch(overlay,new RegExp(`data-setting="${removed}"`));
});
test('navigation header contains only the brand, with no redundant settings or rules buttons',()=>{
 const app=read('public/app.js');const nav=app.slice(app.indexOf('function nav(){'),app.indexOf('function bottomNav()'));
 assert.match(nav,/class="brand"/);
 assert.doesNotMatch(nav,/nav-right|aria-label="Rules"|aria-label="Settings"/);
});
