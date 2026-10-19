import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderCard} from '../public/tabletop/cards.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';
import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';
import {newGame,viewFor} from '../engine/game.js';

const css=readFileSync('public/tabletop/card-system.css','utf8');
const tower={id:'test-tower',kind:'tower',color:'blue',number:4,left:'sun',right:'moon'};
const location={id:'test-location',kind:'location',color:'blue',symbol:'sun'};

test('Both hand layouts size the slot first, with no Tower-specific dimensions',()=>{
 assert.match(css,/\.tt2-hand-row>\.tt2-hand-card,\s*\.game-viewport \.tt2-root \.tt6-hand-block:not\(\.tt6-shared-block\) \.tt6-hand-cards>\.tt6-card-wrap\{[\s\S]*?aspect-ratio:1 \/ 1\.42!important/);
 assert.match(css,/\.tt2-hand-row>\.tt2-hand-card>\.card,\s*\.game-viewport \.tt2-root \.tt6-hand-block:not\(\.tt6-shared-block\) \.tt6-hand-cards>\.tt6-card-wrap>\.card\{[\s\S]*?height:100%!important;[\s\S]*?max-height:100%!important/);
});
test('Tower and Location use identical selectable/nonselectable hand wrappers',()=>{
 const game=newGame({mode:'solo',seed:12});game.phase='action';game.players[0].hand=[tower,location];
 const solo=renderSoloTabletop(game,{canAct:true});
 assert.match(solo,/class="tt2-hand-card"><button class="card blue card-kind-tower"/);
 assert.match(solo,/class="tt2-hand-card"><button class="card blue card-kind-location"/);
 const inactive=renderCard(tower);
 assert.match(inactive,/^<div class="card blue card-kind-tower"/);
 const coop=newGame({mode:'coop',seed:13});coop.phase='action';coop.players[0].hand=[tower,location];
 const markup=renderCooperativeTabletop(viewFor(coop,0),{seat:0});
 assert.match(markup,/class="tt6-card-wrap"><button class="card blue card-kind-tower"/);
 assert.match(markup,/class="tt6-card-wrap"><button class="card blue card-kind-location"/);
});
