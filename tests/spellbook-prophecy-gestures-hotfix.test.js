import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,viewFor} from '../engine/game.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';
import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';
import {isBlankGameTap,isCancelledCardGesture} from '../public/tabletop/interactions.js';
const css=readFileSync('public/tabletop/card-system.css','utf8');
const app=readFileSync('public/app.js','utf8');
const interaction=readFileSync('public/tabletop/interactions.js','utf8');
test('Spells are represented as a closed book immediately after Discard in both pile rows',()=>{
 for(const mode of ['solo','coop']){
  const game=newGame({mode,seed:110,config:{expansions:['book']}});
  const html=mode==='solo'?renderSoloTabletop(viewFor(game,0)):renderCooperativeTabletop(viewFor(game,0),{seat:0});
  assert.match(html, /data-action="openSpells"[^>]*><span class="tt32-book-cover"/);
  assert.match(html, /tt32-book-count">0<\/span>/);
  assert.match(html, /tt32-book-label">Spells<\/span>/);
  assert.ok(html.indexOf('data-action="inspectPile:discard"')<html.indexOf('data-action="openSpells"'));
 }
 assert.match(css,/\.tt6-piles:has\(\.tt32-spell-book\)[\s\S]*?flex-wrap:nowrap!important/);
 assert.match(css,/\.tt32-book-cover\{/);
});
test('Draw counts are slightly larger but constrained inside their card',()=>{
 assert.match(css,/\.tt10-draw-count\{[\s\S]*?font-size:clamp\(8px,51cqw,23px\)/);
 assert.match(css,/\.tt10-draw-count\[data-count-digits="3"\]\{font-size:clamp\(7px,33cqw,17px\)/);
 assert.match(css,/\.tt10-draw-count\{[\s\S]*?max-width:100%;min-width:0;padding:0 2px/);
});
test('Displaced held touches, even those returning to origin, are not taps',()=>{
 assert.equal(isCancelledCardGesture(0,1000),false);
 assert.equal(isCancelledCardGesture(1.1,450),false);
 assert.equal(isCancelledCardGesture(3,200),true);
 assert.equal(isCancelledCardGesture(8,10),true);
 assert.equal(isCancelledCardGesture(3,50),false);
 assert.match(interaction,/pointer\.maxDistance=Math\.max\(pointer\.maxDistance/);
 assert.match(interaction,/if\(dragging\|\|cancelled\)onClearSelection\(\)/);
 assert.doesNotMatch(interaction,/suppressClick=false;\},0\)/);
});
test('Tapping inert tabletop, panel, or gap clears selection without consuming other actions',()=>{
 const blank={closest:()=>null};
 const control={closest:()=>({dataset:{action:'openSpells'}})};
 assert.equal(isBlankGameTap(blank),true);
 assert.equal(isBlankGameTap(control),false);
 assert.match(app,/selected!==null&&!gameOverlay&&!pileOpen&&isBlankGameTap\(e.target\)/);
});
test('Prophecy card size is based on the full reveal, not the remaining count',()=>{
 assert.match(app,/--tt7-per-card:\$\{\(100\/Math\.max\(1,cards\.length\+1\)\)/);
 assert.doesNotMatch(app,/--tt7-per-card:\$\{\(100\/Math\.max\(1,remaining\.length\+1\)\)/);
 assert.match(css,/\.tt7-prophecy-slot>\.card\{[\s\S]*?place-self:center!important/);
 assert.match(app,/--tt20-per-card:\$\{\(100\/Math\.max\(1,p\.cards\.length\)\)/);
});
