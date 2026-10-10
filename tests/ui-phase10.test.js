import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';
import {renderActionDock} from '../public/tabletop/action-dock.js';
import {renderCard} from '../public/tabletop/cards.js';
import {cardHelp} from '../public/tabletop/card-inspection.js';
import {newGame,viewFor} from '../engine/game.js';

const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const all=['book','glyphs','dreamcatchers','towers','premonitions','crossroads','oniverse','mirrors','sphinx'];

test('final stylesheet loads last and compact portrait uses two expansion columns without moving game zones',()=>{
 const index=read('../public/index.html'),css=read('../public/tabletop/phase10.css');
 assert.ok(index.indexOf('phase9.css')<index.indexOf('phase10.css'));
 assert.match(css,/max-width:359px/);assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/\.tt2-pile-row>\.tt2-pile/);assert.match(css,/\.tt8-door-slot/);
 assert.doesNotMatch(css,/display:\s*none|position:\s*fixed|translate\(/);
});

test('full expansion game keeps every permanent zone and the dock; no redundant play/discard actions',()=>{
 const g=viewFor(newGame({mode:'solo',config:{expansions:all},seed:5}),0);
 const html=renderSoloTabletop(g);const dock=renderActionDock(g,0);
 for(const zone of ['alignment','catchers','premonitions','denizens','mirrors'])assert.ok(html.includes(`data-tt-zone="${zone}"`),zone);
 for(const role of ['tt2-doors','tt2-piles','tt2-labyrinth','tt2-hand'])assert.ok(html.includes(role),role);
 assert.match(dock,/data-action-dock/);
 assert.doesNotMatch(dock,/data-action="(?:play|discard)"/);
});

test('custom expansion controls support Enter and Space without changing the engine',()=>{
 const js=read('../public/app.js');
 assert.match(js,/\.tt5-tile\[role="button"\]\[data-action\]/);
 assert.match(js,/e\.key==='Enter'\|\|e\.key===' '/);
 assert.match(js,/handle\(e\.target\.dataset\.action\)/);
});

test('replay dialog traps focus and restores the launch control after closing',()=>{
 const js=read('../public/app.js');
 assert.match(js,/\[data-replay-layer\] \.tt9-replay-dialog/);
 assert.match(js,/if\(replayFrames\.length\)\s*\{/);
 assert.match(js,/if\(e\.key==='Tab'\)/);
 assert.match(js,/\[data-action="replayOpen"\]/);
 assert.match(js,/replayFocused/);
});

test('card inspector clamps vertical placement to viewport and remains useful on hidden cards',()=>{
 const js=read('../public/tabletop/card-inspection.js');
 assert.match(js,/window\.innerHeight-size\.height-pad/);
 assert.match(js,/document\.addEventListener\('keydown',popupKey,true\)/);
 assert.match(js,/document\.removeEventListener\('keydown',popupKey,true\)/);
 assert.match(js,/Math\.min\(Math\.max\(pad,window\.innerHeight-size\.height-pad\),desired\)/);
 assert.match(cardHelp({kind:'hidden'}).detail,/hidden/i);
 const card=renderCard({id:'c1',kind:'location',color:'red',symbol:'sun'},{select:true});
 assert.match(card,/data-tt-card-info/);
 assert.match(card,/data-pick="c1"/);
});
