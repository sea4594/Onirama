import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {renderCard} from '../public/tabletop/cards.js';
import {cardSymbol} from '../public/icons.js';
import {renderInventoryTrack,renderPileInspector} from '../public/tabletop/action-dock.js';
import {planGameTransitions} from '../public/tabletop/animation.js';
import {catcherTransferCounts,CARD_MOTION} from '../public/tabletop/animation-timing.js';
import {newGame,viewFor} from '../engine/game.js';
const source=path=>readFileSync(path,'utf8');
test('obsolete pre-tab multiplayer and Incantation UI controllers are gone',()=>{
 const app=source('public/app.js'),handlers=source('public/tabletop/interactions.js');
 for(const pattern of [/function lobby\(/,/function joinPage\(/,/createIncantationClaim/])assert.doesNotMatch(app,pattern);
 assert.doesNotMatch(handlers,/createIncantationClaim/);
 assert.match(app,/shell-online-rooms/);
});
test('compact illustrations keep base icons and simplify detailed cards',()=>{
 for(const kind of ['sun','moon','key'])assert.equal(cardSymbol(kind,{compact:true}),cardSymbol(kind));
 for(const kind of ['nightmare','sphinx','diver','confusion','squirrel-art','hammer-art','keeper-art']){
  const compact=cardSymbol(kind,{compact:true}),large=cardSymbol(kind);
  assert.notEqual(compact,large,kind);assert.match(compact,/viewBox="0 0 24 24"/);
 }
 for(const card of [{kind:'nightmare'},{kind:'denizen',ability:'architect'},{kind:'door',color:'red'}]){
  const tiny=renderCard(card,{tiny:true});assert.match(tiny,/data-tt-card-info/);assert.match(tiny,/ui-icon/);
 }
});
test('pile inventory segments are capped, counts remain exact for accessibility',()=>{
 assert.equal((renderInventoryTrack(800,1000).match(/<i aria-hidden/g)||[]).length,48);
 assert.match(renderInventoryTrack(800,1000),/800 of 1000 remaining/);
 assert.equal((renderInventoryTrack(2,4).match(/<i aria-hidden/g)||[]).length,4);
});
test('removed cards are not counted as usable discards',()=>{
 const view=viewFor(newGame({seed:24,config:{expansions:['book']}}),0);
 view.expansion.book.removed=[{id:'old',kind:'location',color:'red',symbol:'sun'}];
 const html=renderPileInspector(view,'discard');
 assert.match(html,/Removed from the game · 1/);
 assert.match(html,/<span>0 cards<\/span>/);
});
test('only actually moved Limbo cards receive catcher movement cues',()=>{
 const c={id:'m1',kind:'lostDream'},n={id:'n1',kind:'nightmare'};
 const before={mode:'solo',status:'active',phase:'decision',turn:2,active:0,limbo:[c],players:[{hand:[],doors:[],labyrinth:[]}],expansion:{dreamcatchers:{stacks:[[],[],[],[]]}}};
 const after={...before,limbo:[],expansion:{dreamcatchers:{stacks:[[c],[],[],[]]}}};
 assert.deepEqual(catcherTransferCounts(before,after),[{index:0,ids:['m1'],count:1}]);
 assert.deepEqual(planGameTransitions(before,after).catcherCaptured,[{index:0,ids:['m1'],count:1}]);
 assert.deepEqual(catcherTransferCounts(before,{...after,limbo:[c],expansion:{dreamcatchers:{stacks:[[n],[],[],[]]}}}),[]);
});
test('motion timing has a consistent, readable tempo and reduced-motion override',()=>{
 assert(CARD_MOTION.move>=800&&CARD_MOTION.reveal>CARD_MOTION.move);
 assert.match(source('public/tabletop/animation.js'),/CARD_MOTION\.move/);
 assert.match(source('public/tabletop/animation.js'),/tt5-catcher\[data-action=/);
 assert.match(source('public/tabletop/animation.css'),/prefers-reduced-motion:reduce/);
});
test('production CSS bundle retains source order and replaces dozens of links',()=>{
 const dir=mkdtempSync(join(tmpdir(),'onirama-css-'));
 try{
  execFileSync(process.execPath,['scripts/build-pages.js',dir],{stdio:'pipe'});
  const html=readFileSync(join(dir,'index.html'),'utf8'),css=readFileSync(join(dir,'onirama-styles.css'),'utf8');
  assert.equal((html.match(/rel="stylesheet"/g)||[]).length,1);
  assert.match(html,/onirama-styles\.css/);
  assert(css.indexOf('/* tabletop/tokens.css */')<css.indexOf('/* tabletop/phase20.css */'));
  assert(css.indexOf('/* tabletop/phase20.css */')<css.indexOf('/* tabletop/card-system.css */'));
  assert(css.length>100000);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('standalone gallery fixtures generate without a browser dependency',()=>{
 const dir=mkdtempSync(join(tmpdir(),'onirama-vis-'));
 try{
  execFileSync(process.execPath,['scripts/visual-fixture.mjs',dir],{stdio:'pipe'});
  assert.deepEqual(readdirSync(dir).sort(),['cards.html','coop-all.html','coop-base.html','solo-all.html','solo-base.html']);
  assert.match(readFileSync(join(dir,'cards.html'),'utf8'),/kind-denizen/);
  assert.match(readFileSync(join(dir,'coop-all.html'),'utf8'),/tt17-coop-hands/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('face-up cards have one perimeter, with no inset decorative outline',()=>{
 const css=source('public/tabletop/phase18.css');
 assert.doesNotMatch(css,/\.card:not\(\.hidden\)::before/);
 assert.doesNotMatch(css,/\.card[^{}]*::before\s*\{[^}]*\binset:/);
 // Keep the actual card-edge styling and any selected-card outline.
 assert.match(css,/\.card\.red\{border-color:var\(--red\)/);
 assert.match(source('public/styles.css'),/\.card\{[^}]*border:2px solid/);
 assert.match(source('public/tabletop/static-tabletop.css'),/\.card\.selected/);
});
