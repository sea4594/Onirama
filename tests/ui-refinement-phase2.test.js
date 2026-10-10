import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BASE_RULES,EXPANSION_RULES,rulesSections,renderOverlay} from '../public/game-overlay.js';
import {newGame,viewFor} from '../engine/game.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';
import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';
import {renderGameDialog} from '../public/tabletop/dialogs.js';
const app=readFileSync('public/app.js','utf8');
const css=readFileSync('public/game-shell.css','utf8');
const html=readFileSync('public/index.html','utf8');
test('game navigation is fullscreen and cannot follow Rules link away from active game',()=>{
 for(const [mode,board] of [['solo',renderSoloTabletop],['coop',renderCooperativeTabletop]]){
  const view=viewFor(newGame({mode,seed:24}),0);
  const output=mode==='solo'?board(view):board(view,{seat:0});
  assert.match(output,/data-action="openGamePause"/);
  assert.match(output,/data-action="openGameRules"/);
  assert.doesNotMatch(output,/href="#\/rules"/);
 }
 assert.match(app,/\(inGame\?'':nav\(\)\)/);
 assert.match(app,/class="page\$\{inGame\?' game-viewport'/);
 assert.match(app,/gameOverlay=null;gameRulesFromPause=false/);
 assert.match(css,/#app>.page\.game-viewport/);
 assert.match(css,/html,body\{height:100%;width:100%;overflow:hidden/);
 assert.match(css,/\.shell-viewport-window\{[^}]*overflow-y:auto/);
 assert.match(css,/\.game-viewport>\.tt2-root\{[^}]*max-width:none/);
 assert.match(html,/game-shell\.css/);
});
test('in-game rules show all base sections and active expansions only',()=>{
 assert.equal(BASE_RULES.length,6);
 assert.equal(Object.keys(EXPANSION_RULES).length,10);
 const solo=rulesSections(['towers','book','towers','invalid'],false);
 assert.equal(solo.length,7);assert.equal(solo.at(-2)[0],'Towers');assert.equal(solo.at(-1)[0],'Book of Steps');
 const coop=rulesSections(['incubus'],true);assert.equal(coop.length,7);
 const output=renderOverlay('rules',['book','towers'],false);
 assert.match(output,/Book of Steps/);assert.match(output,/Towers/);
 assert.doesNotMatch(output,/data-guide-chapter="incubus"/);
 assert.doesNotMatch(output,/data-guide-chapter="coop"/);
 assert.match(renderOverlay('rules',[],true),/data-guide-chapter="coop"/);
 assert.match(output,/data-rule-index="/);
 assert.match(output,/data-game-menu-dismiss/);
 assert.match(output,/data-action="closeGameOverlay"/);
 assert.match(renderOverlay('rules',[],false,{fromPause:true}),/Back to pause/);
 assert.equal(renderOverlay(null,[]),'');
});
test('pause menu contains resume, rules, settings and safe return to home without gameplay commands',()=>{
 const pause=renderOverlay('pause',[],false,{motion:'reduced'});
 for(const action of ['closeGameOverlay','openGameRules','gameGoHome'])assert.match(pause,new RegExp(`data-action="${action}"`));
 assert.match(pause,/option value="reduced" selected/);
 for(const key of ['motion','cardSize','contrast','textSize'])assert.match(pause,new RegExp(`data-setting="${key}"`));
 assert.doesNotMatch(pause,/data-action="(play|discard|start|ready|endGame)"/);
 assert.match(app,/fitGameTabletop\(\)/);
 assert.match(app,/const overlayScroll=/);
 assert.match(app,/gameOverlay\&\&!target\.closest/);
 assert.match(app,/e\.key==='Escape'/);
 assert.match(app,/e\.key!=='Tab'/);
});
test('mandatory and optional decisions retain available in-game navigation',()=>{
 for(const mandatory of [false,true]){
  const popup=renderGameDialog({type:'nightmare',html:'<p>Decision</p>',mandatory});
  assert.match(popup,/data-action="openGamePause"/);
  assert.match(popup,/data-action="openGameRules"/);
  assert.equal(popup.includes('data-action="dialogClose"'),!mandatory);
 }
});
