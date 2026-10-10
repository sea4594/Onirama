import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,viewFor,assertConserved} from '../engine/game.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';
import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';
import {renderPileInspector,renderActionDock} from '../public/tabletop/action-dock.js';
import {renderOverlay} from '../public/game-overlay.js';
const text=f=>readFileSync(f,'utf8');
const all=['book','glyphs','dreamcatchers','towers','premonitions','crossroads','oniverse','mirrors','sphinx'];
const game=()=>viewFor(newGame({seed:90,interactiveDraw:true,config:{expansions:all}}),0);
test('portrait zone order prioritizes Doors, Towers, primary and secondary expansions, piles, then Hand',()=>{
 const css=text('public/tabletop/phase7c.css');
 assert.match(css,/grid-template-areas:'doors doors' 'towers towers' 'exp-primary exp-primary' 'exp-secondary exp-secondary' 'labyrinth labyrinth' 'piles piles' 'hand hand'/);
 const html=renderSoloTabletop(game());
 for(const section of ['Doors','Towers','Dreamcatchers','Premonitions','Denizens','Mirrors','Piles','Hand'])assert.match(html,new RegExp(section));
 assert.ok(html.includes('tt9-exp-primary'));assert.ok(html.includes('tt9-exp-secondary'));
});
test('card-selected targets replace redundant Play and Discard buttons',()=>{
 let s=game();const c=s.players[0].hand.find(x=>x.kind==='location');assert.ok(c);
 const h=renderSoloTabletop(s,{selectedId:c.id});
 assert.match(h,/data-tt-drop="play"/);assert.match(h,/tt9-discard-gesture/);assert.match(h,/data-action="inspectPile:discard"/);
 assert.doesNotMatch(renderActionDock(s,0,{selectedId:c.id}),/data-action="(?:play|discard)"/);
 const coop=viewFor(newGame({mode:'coop',seed:91,config:{expansions:['towers']}}),0);
 assert.doesNotMatch(renderCooperativeTabletop(coop,{seat:0}),/class="tt6-context"/);
});
test('drawn card is left justified and action controls use remaining width',()=>{
 const css=text('public/tabletop/phase7c.css');assert.match(css,/\.tt9-drawn-layout\{display:grid!important;grid-template-columns:84px minmax\(0,1fr\)/);
 assert.match(css,/\.tt9-drawn-actions\{[^}]*justify-content:center/);
 const s=game();s.phase='decision';s.pending={type:'drawn',destination:'hand',card:s.players[0].hand[0]};
 assert.match(renderActionDock(s,0),/tt9-drawn-layout/);
 assert.match(renderActionDock(s,0),/tt9-drawn-actions/);
});
test('zero-count pile cards are muted, their remaining count enlarged, and visible limbo contents inspectable',()=>{
 const s=game();s.limbo=[{id:'limbo-x',kind:'location',color:'blue',symbol:'moon'}];
 s.pileInventory=[{section:'base',key:'base:location:red:sun',label:'red sun',deck:0,discard:0,limbo:0,total:7},
 {section:'base',key:'base:location:blue:moon',label:'blue moon',deck:1,discard:0,limbo:1,total:7}];
 const markup=renderPileInspector(s,'limbo');assert.match(markup,/tt9-stack-details/);
 assert.doesNotMatch(markup,/tt10-count-track/);assert.match(markup,/Cards in Limbo/);
 assert.match(markup,/Blue|blue/);assert.match(text('public/tabletop/phase7c.css'),/filter:grayscale\(1\)/);
});
test('Dreamcatcher inspection shows all captured cards, not only their count',()=>{
 const s=game();s.expansion.dreamcatchers.stacks[0]=[
 {kind:'location',color:'blue',symbol:'sun',id:'catch-blue'},
 {kind:'location',color:'green',symbol:'moon',id:'catch-green'}];
 const html=renderPileInspector(s,'catcher:0');
 assert.match(html,/Dreamcatcher 1 contents/);assert.equal((html.match(/data-tt-motion-id="catch-(?:blue|green)"/g)||[]).length,2);
 assert.match(renderSoloTabletop(s),/data-action="inspectCatcher:0"/);
});
test('Happy Dream first offers Remove Premonition; only selected real tabletop Premonitions can be submitted',()=>{
 const source=text('public/app.js');
 assert.match(source,/btn\('Remove Premonition','happyBanishStart'/);
 assert.match(source,/happyBanishMode\?\x60\$\{btn\('Cancel','happyBanishCancel'\)\}/);
 assert.match(source,/data-action="happyBanishConfirm" \$\{happyPremonitionChoice\?'':'disabled'\}/);
 assert.match(source,/faceUp\?\.includes\(id\)/);
 const s=game();s.phase='decision';s.pending={type:'happyDream'};s.expansion.premonitions.faceUp=['red2','doors5'];
 const h=renderSoloTabletop(s,{selectedPremonition:'red2',premonitionChoiceMode:true});
 assert.match(h,/data-action="happyPremonitionSelect:red2"/);
 assert.match(h,/data-tt-card-info="[^\"]*premonition/);
});
test('pause menu presents a fully scrollable, safely escaped action history with inline card pictures',()=>{
 const log=['Started','A player discarded red sun.','<untrusted>'];
 const html=renderOverlay('pause',[],false,{log});
 assert.match(html,/game-menu-history/);assert.match(html,/tt9-action-log/);
 assert.match(html,/tt9-log-card/);assert.match(html,/&lt;untrusted&gt;/);assert.doesNotMatch(html,/<untrusted>/);
 const many=Array.from({length:200},(_,i)=>`Action ${i+1}`);
 const long=renderOverlay('pause',[],false,{log:many});
 assert.match(long,/Action 1</);assert.match(long,/Action 200</);
 assert.match(text('public/tabletop/phase7c.css'),/overflow-y:auto/);
});
test('drag/selection highlight styling uses paint-only outlines; no extra padding on discard target',()=>{
 const css=text('public/tabletop/phase7c.css');assert.match(css,/\.tt6-pile-inspect\.tt9-discard-gesture\.tt3-target-ready/);
 assert.match(css,/\.tt6-pile-inspect\.tt9-discard-gesture\.tt3-drop-hover\{padding:0!important;border:0!important;outline:2px/);
 assert.match(css,/\.card\.selected/);assert.match(css,/filter:none!important/);
 assert.match(css,/transform:none!important/);
 assert.match(css,/\.tt2-hand-row\{min-height:calc\(var\(--tt2-card\)/);
 assert.match(css,/\.tt6-hand-cards\{min-height:calc\(var\(--tt6-card\)/);
 assert.doesNotMatch(css,/\.tt3-drag-source\{[^}]*padding/);
 assertConserved(newGame({seed:44,config:{expansions:['dreamcatchers','premonitions']}}));
});
