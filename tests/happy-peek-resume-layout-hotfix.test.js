import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,act,assertConserved,viewFor} from '../engine/game.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';
import {renderPileInspector} from '../public/tabletop/action-dock.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Happy Dream peek reveals all seven, accepts multiple discards and keeps physical inventory',()=>{
 let game=newGame({seed:31,config:{expansions:['premonitions']},interactiveDraw:true});
 // Create a valid seven-card peek from the real game engine (not a UI mock).
 const happy=game.deck.find(c=>c.kind==='happyDream');assert.ok(happy);
 const previous=game.deck.splice(game.deck.indexOf(happy),1)[0];game.deck.unshift(previous);
 game.phase='decision';game.pending={type:'happyDream',card:game.deck.shift()};
 // The engine's pending Happy Dream is normally established by drawing; its
 // action validates that the 7 peeked cards remain in the deck/limbo/discard.
 const peek=act(game,{type:'happyDream',option:'peek'});
 assert.equal(peek.pending.type,'happyPeek');assert.equal(peek.pending.cards.length,7);
 const ids=peek.pending.cards.map(c=>c.id),next=act(peek,{type:'happyPeek',discardIds:ids.slice(0,3),order:ids.slice(3).reverse()});
 assertConserved(next);assert.equal(next.discard.filter(c=>ids.slice(0,3).includes(c.id)).length,3);
});
test('peek UI displays seven cards and horizontally expanding discard area',()=>{
 const app=read('public/app.js'),gestures=read('public/tabletop/interactions.js'),css=read('public/tabletop/card-system.css');
 assert.match(app,/function happyPeekDecision\(p\)/);
 const peek=app.split('function happyPeekDecision(p)')[1].split('function effectReorder(p)')[0];
 assert.match(peek,/const kept=effectOrder\.filter/);
 assert.match(peek,/data-tt-happy-discard/);
 assert.match(peek,/tt23-discard-card/);assert.match(peek,/data-tt-happy-restore/);assert(peek.includes("Discard (${discarded.length})"));
 assert.doesNotMatch(peek,/orderSlice|effectDiscard:/);
 assert.match(gestures,/data-tt-happy-discard/);
 assert.match(css,/\.tt23-peek-cards/);assert.match(css,/position:static!important/);assert.doesNotMatch(css,/\.tt23-discard-card\{position:absolute/);
});
test('solo and hot-seat saves are independently recoverable after restart',()=>{
 const app=read('public/app.js');
 assert.match(app,/resumableLocalGame\(localStorage,'solo'\)/);
 assert.match(app,/resumableLocalGame\(localStorage,'coop'\)/);
 assert.match(app,/Cannot open this saved game/);
 assert.match(app,/await refresh\(\);if\(session\)return setRoute\('#\/game'\)/);
 const solo=newGame({mode:'solo',seed:12,interactiveDraw:true}),coop=newGame({mode:'coop',seed:23,interactiveDraw:true,manualTurnEnd:true,names:['One','Two']});
 for(const [raw,mode] of [[JSON.stringify(solo),'solo'],[JSON.stringify(coop),'coop']]){
  const parsed=JSON.parse(raw),seat=parsed.active;
  assert.equal(parsed.mode,mode);assert.equal(viewFor(parsed,seat).mode,mode);assertConserved(parsed);
 }
});
test('portrait Denizens have their own equipment row; inventory boxes have equal track widths',()=>{
 const g=newGame({mode:'solo',seed:4,config:{expansions:['oniverse','towers']}}),html=renderSoloTabletop(viewFor(g,0)),css=read('public/tabletop/card-system.css');
 assert.match(html,/tt9-exp-denizens/);assert.match(css,/piles denizens/);assert.match(css,/towers towers/);
 assert.match(css,/data-inventory-section="towers"/);
 assert.match(renderPileInspector(viewFor(g,0),'deck',0),/data-inventory-section="towers"/);
});
test('drawing a Door retains its original decision separately from searching a completed series',()=>{
 const app=read('public/app.js');assert.match(app,/if\(p\.type==='door'\)return `<section class="decision tt25-drawn-door-decision"/);assert.match(app,/tt25-drawn-door-preview/);assert.match(app,/if\(p\.type==='doorSearch'\)return doorSearchDecision\(g,p\)/);
});
