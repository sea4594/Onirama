import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,viewFor} from '../engine/game.js';
import {renderActionDock} from '../public/tabletop/action-dock.js';
import {renderOverlay} from '../public/game-overlay.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';
import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';
import {renderSpellbook,spellEligibility} from '../public/tabletop/spellbook.js';
const text=path=>readFileSync(path,'utf8');
test('game header is removed in both modes and the dock owns the sole pause control',()=>{
 for(const mode of ['solo','coop']){
  const g=viewFor(newGame({seed:78,mode,config:{expansions:['book']}}),0);
  const board=mode==='solo'?renderSoloTabletop(g):renderCooperativeTabletop(g,{seat:0});
  assert.doesNotMatch(board,/class="tt2-top"|class="tt6-top"|tt2-game-name|>Turn \d+|data-action="openGameRules"|data-action="openGamePause"/);
  const dock=renderActionDock(g,0);
  assert.equal((dock.match(/data-action="openGamePause"/g)||[]).length,1);
  assert.match(dock,/<div class="tt6-dock-status">[\s\S]*tt27-dock-menu/);
 }
});
test('menu defaults to Log, contains Settings and Rules, and never requires a separate rules button',()=>{
 const first=renderOverlay('pause',[],false,{log:['First turn']});
 for(const tab of ['log','settings','rules'])assert.match(first,new RegExp(`data-action="gameMenuTab:${tab}"`));
 assert.match(first,/game-menu-tab-log"[^>]*aria-selected="true"/);
 assert.match(first,/id="game-menu-panel-settings"[^>]*hidden/);
 assert.match(first,/id="game-menu-panel-rules"[^>]*hidden/);
 assert.match(first,/First turn/);
 const settings=renderOverlay('pause',[],false,{tab:'settings'});
 assert.match(settings,/game-menu-tab-settings"[^>]*aria-selected="true"/);
 assert.match(settings,/id="game-menu-panel-settings"[^>]*><div class="game-menu-settings-fields"/);
 const rules=renderOverlay('pause',[],false,{tab:'rules'});
 assert.match(rules,/game-menu-tab-rules"[^>]*aria-selected="true"/);
 assert.match(rules,/id="game-menu-panel-rules"[^>]*><div class="game-menu-accordions"/);
 const app=text('public/app.js');assert.match(app,/actionName\.startsWith\('gameMenuTab:'\)/);
 assert.match(app,/gameMenuTab=actionName==='openGamePause'\?'log':'rules'/);
});
test('only the discard pile receives a visible outline, not its nested gesture button',()=>{
 const css=text('public/tabletop/card-system.css');
 assert.match(css,/\[data-tt-drop="discard"\] \.tt6-pile-inspect\.tt9-discard-gesture:is\(:hover,:focus,:focus-visible,\.tt3-target-ready,\.tt3-drop-hover\)\{outline:0!important/);
 assert.match(text('public/tabletop/phase7c.css'),/\.tt2-pile\[data-tt-drop\]:has\(\.tt9-discard-gesture\)/);
});
test('dock has its original full height, independent of active decisions',()=>{
 const css=text('public/tabletop/phase16.css');
 assert.match(css,/--tt6-dock-height:188px!important/);
 assert.match(css,/--tt6-dock-height:116px!important/);
 assert.match(text('public/tabletop/card-system.css'),/height:var\(--tt6-dock-height\)!important;max-height:var\(--tt6-dock-height\)!important/);
});
test('Parallel Planning keeps tabletop Goal selection and no longer repeats Door cards or shortage text in the dock',()=>{
 const s=newGame({seed:29,config:{expansions:['book']}}),g=viewFor(s,0);
 const html=renderSpellbook(g,{choice:'parallel'});
 assert.doesNotMatch(html,/data-action="goalPick:|tt24-spell-goals|more discarded cards needed/);
 assert.match(html,/Tap the two Doors in the Doors area/);
 assert.equal(spellEligibility(g,'parallel',[]).ready,false);
 const app=text('public/app.js');assert.match(app,/spellGoals=spellGoals\.includes\(i\)/);
});
