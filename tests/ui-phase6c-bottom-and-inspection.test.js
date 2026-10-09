import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {newGame,viewFor} from '../engine/game.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';
import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';
import {cardHelp} from '../public/tabletop/card-inspection.js';
const app=readFileSync('public/app.js','utf8'),css=readFileSync('public/tabletop/action-dock.css','utf8'),fit=readFileSync('public/tabletop/fit.js','utf8'),inspector=readFileSync('public/tabletop/card-inspection.js','utf8');
test('fixed action workspace is at the bottom across orientations with right-bottom placement on wide screens',()=>{
 assert.match(css,/\.game-viewport>\.tt6-workspace\{position:absolute!important;inset:auto 0 0 0!important/);
 assert.match(css,/@media\(orientation:landscape\) and \(min-width:1000px\)/);
 assert.match(css,/--tt6-dock-height:152px/);assert.match(css,/--tt6-dock-height:158px/);
 assert.match(css,/--tt6-dock-height:114px/);assert.match(css,/width:min\(480px,45vw\)/);
 assert.match(css,/\.tt5-alignment \.tt5-contents\{justify-content:center/);
});
test('tabletop fitting preserves width and row wrapping rather than reflowing at CSS zoom',()=>{
 assert.match(fit,/table\.style\.transform=scale<1/);
 assert.match(fit,/table\.style\.width=`\$\{width\/scale\}px`/);
 assert.doesNotMatch(fit,/table\.style\.zoom=String\(middle\)/);
});
test('Premonitions are inspectable and can be selected before confirming Happy Dream',()=>{
 for(const mode of ['solo','coop']){
  const g=viewFor(newGame({mode,config:{expansions:['premonitions']},seed:83}),0);
  g.phase='decision';g.pending={type:'happyDream'};g.expansion.premonitions.faceUp=['red2','doors5'];
  const html=mode==='solo'?renderSoloTabletop(g,{selectedPremonition:'red2',premonitionChoiceMode:true}):renderCooperativeTabletop(g,{seat:0,selectedPremonition:'red2',premonitionChoiceMode:true});
  assert.match(html,/data-action="happyPremonitionSelect:red2"/);
  assert.match(html,/data-tt-card-info="[^"]*premonition/);
  assert.match(html,/tt7-premonition-selected/);
  assert.match(html,/aria-pressed="true"/);
 }
 assert.match(cardHelp({kind:'premonition',premonitionId:'red2'}).detail,/2 red Doors/);
 assert.match(app,/happyBanishConfirm/);assert.match(app,/happyPremonitionChoice\?'':'disabled'/);
 assert.match(app,/premonitionId:happyPremonitionChoice/);
});
test('right-click, touch hold and mouse hold open information without falling through to a click',()=>{
 assert.match(inspector,/root\.addEventListener\('contextmenu',context\)/);
 assert.match(inspector,/function down\(e\)\{if\(e\.button!==0\)return/);
 assert.match(inspector,/ignoreClick=true;open\(card,x,y\)/);
 assert.match(inspector,/e\.stopImmediatePropagation\(\)/);
});
