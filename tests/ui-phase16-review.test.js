import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,viewFor} from '../engine/game.js';
import {premonitionProgress,renderExpansionTabletop} from '../public/tabletop/expansions.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';
import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';
const read=p=>readFileSync(p,'utf8');
test('Premonition counters use Door-color, set and aggregate objectives',()=>{
 const players=[{doors:[{kind:'door',color:'red'},{kind:'door',color:'red'},{kind:'door',color:'blue'}]}];
 assert.deepEqual(premonitionProgress('red2',players),{current:2,target:2,unit:'red Doors'});
 assert.deepEqual(premonitionProgress('pair2',players),{current:2,target:2,unit:'matching Doors'});
 assert.deepEqual(premonitionProgress('rainbow4',players),{current:2,target:4,unit:'Door colors'});
 assert.deepEqual(premonitionProgress('doors5',players),{current:3,target:5,unit:'Doors'});
 const g=viewFor(newGame({seed:5,config:{expansions:['premonitions']}}),0);
 assert.match(renderExpansionTabletop(g),/tt16-pm-progress/);
});
test('draw pile has no icon and spell count tracks available discards in both modes',()=>{
 for(const mode of ['solo','coop']){const g=viewFor(newGame({seed:3,mode,config:{expansions:['book']}}),0);
 const html=mode==='solo'?renderSoloTabletop(g):renderCooperativeTabletop(g);
 assert.match(html,/Spells · 0/);
 assert.doesNotMatch(html,/tt2-deck-back[^>]*>\s*<svg/);
 }
});
test('Incantation has explicit choice and bottom-order phases, spellbook has descriptive choices',()=>{
 const source=read('public/app.js');
 assert.match(source,/Incantation: Take a door/);
 assert.match(source,/Incantation: Rearrange and put on bottom/);
 assert.match(source,/spellSelect:/);
 assert.match(read('public/tabletop/spellbook.js'),/Look at up to five cards from the bottom of the deck/);
 assert.doesNotMatch(source,/<select id="spellChoice"/);
 assert.doesNotMatch(source,/>Out'</);
});
test('labyrinth scrolls horizontally without fitter overlap, dock is fixed and internally scrollable',()=>{
 const css=read('public/tabletop/phase16.css'),fit=read('public/tabletop/fit.js');
 assert.match(css,/overflow-x:auto!important;overflow-y:hidden!important/);
 assert.match(fit,/row\.matches\('\.tt2-labyrinth-row,\.tt6-labyrinth-cards'\)/);
 assert.match(css,/--tt6-dock-height:188px!important/);
 assert.match(css,/overflow-y:auto!important/);
 assert.match(css,/\.tt8-towers-slot \.tt5-tower-target/);
 const index=read('public/index.html');assert.ok(index.indexOf('adaptive.css')<index.indexOf('phase16.css'));
});
