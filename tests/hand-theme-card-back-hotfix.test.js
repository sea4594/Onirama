import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderCard} from '../public/tabletop/cards.js';
import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';
import {newGame,viewFor} from '../engine/game.js';
const app=readFileSync('public/app.js','utf8');
const css=readFileSync('public/tabletop/card-system.css','utf8');
test('Moonlit appears first in theme selection and remains the new-install default',()=>{
 assert.match(app,/THEME_PRESETS=\[\{id:'moonlit',name:'Moonlit'\},\{id:'forest',name:'Forest'\}/);
 assert.match(app,/THEME_PRESETS\.map\(t=>\[t\.id,t\.name\]\)/);
 assert.match(app,/raw\.theme:'moonlit'/);
 assert.match(app,/THEME_PRESETS\.some\(p=>p\.id===raw\.theme\)\?raw\.theme/);
});
test('Tower and Location hand cards use exactly the same outer card sizing rule',()=>{
 const tower=renderCard({id:'tower-test',kind:'tower',color:'blue',number:4,left:'sun',right:'moon'},{select:true});
 const location=renderCard({id:'location-test',kind:'location',color:'blue',symbol:'sun'},{select:true});
 assert.match(tower,/class="card blue card-kind-tower"/);
 assert.match(location,/class="card blue card-kind-location"/);
 assert.match(css,/\.tt2-hand-card>\.card,\s*\.game-viewport \.tt2-root\[data-tt15-layout\] \.tt6-card-wrap>\.card\{/);
 assert.match(css,/max-width:100%!important;height:auto!important;min-height:0!important;\s*aspect-ratio:1 \/ 1\.42!important;padding:2px!important/);
});
test('Opponent card-back diamond is vertically centered within the entire card',()=>{
 const game=newGame({mode:'coop',seed:51});game.phase='action';game.players[1].hand.push(game.deck.pop());
 const html=renderCooperativeTabletop(viewFor(game,0),{seat:0});
 assert.match(html,/tt6-card-back/);
 assert.match(css,/\.tt6-card-back>span\{\s*max-height:none!important;aspect-ratio:auto!important;\s*inset:0!important;width:100%!important;height:100%!important/);
 assert.match(css,/\.tt6-card-back>span>\.ui-icon\{\s*width:52%!important;height:auto!important;aspect-ratio:1 \/ 1!important/);
});
