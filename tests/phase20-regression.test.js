import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,act,viewFor,assertConserved,legalActions} from '../engine/game.js';
import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';
import {renderActionDock} from '../public/tabletop/action-dock.js';
import {renderCard} from '../public/tabletop/cards.js';

const src=path=>readFileSync(path,'utf8');
function drafted(config={}){let s=newGame({mode:'coop',seed:812,config,interactiveDraw:true});while(s.phase==='draft')s=act(s,{type:'draft',id:s.draft[0].id});return s;}
function discard(s,source='personal'){
 const cards=source==='personal'?s.players[s.active].hand:s.shared,c=cards.find(c=>c.kind==='location'&&c.symbol!=='key'&&c.symbol!=='glyph')||cards.find(c=>c.kind!=='deadEnd');
 assert(c);const before=structuredClone(s),out=act(s,{type:'discard',id:c.id});assert.equal(out.pending?.type,'coopSwap');assert.equal(out.phase,'decision');
 assert(out.discard.some(x=>x.id===c.id));assert(!out.players[out.active].hand.some(x=>x.id===c.id));assert(!out.shared.some(x=>x.id===c.id));
 assert.equal(JSON.stringify(s),JSON.stringify(before));assertConserved(out);return {out,c};
}
test('cooperative discard happens immediately; invalid swaps cannot involve discarded or partner cards',()=>{
 const initial=drafted(),{out,c}=discard(initial);const personal=out.players[out.active].hand[0],shared=out.shared[0],partner=out.players[1-out.active].hand[0];
 assert(legalActions(out).some(x=>x.type==='coopSwap'));
 assert.throws(()=>act(out,{type:'coopSwap',option:'swap',personal:c.id,shared:shared.id}),/Swap one remaining private/);
 assert.throws(()=>act(out,{type:'coopSwap',option:'swap',personal:partner.id,shared:shared.id}),/Swap one remaining private/);
 assert.throws(()=>act(out,{type:'play',id:personal.id}),/Swap cards or Pass/);
 assertConserved(out);
 const swapped=act(out,{type:'coopSwap',option:'swap',personal:personal.id,shared:shared.id});
 assert(swapped.players[swapped.active].hand.some(x=>x.id===shared.id));assert(swapped.shared.some(x=>x.id===personal.id));
 assert(!swapped.shared.some(x=>x.id===c.id));assert(!swapped.players[swapped.active].hand.some(x=>x.id===c.id));assertConserved(swapped);
});
test('cooperative discard from shared, followed by Pass, advances normally',()=>{
 const {out,c}=discard(drafted(), 'shared');assert(!out.shared.some(x=>x.id===c.id));
 assert.match(renderActionDock(viewFor(out,out.active),out.active),/Swap cards/);assert.match(renderActionDock(viewFor(out,out.active),out.active),/data-action="swapPass"/);
 const next=act(out,{type:'coopSwap',option:'pass'});assert.notEqual(next.pending?.type,'coopSwap');assertConserved(next);
});
test('swap board exposes active private and shared resources but never partner IDs or normal drop highlights',()=>{
 const {out}=discard(drafted());const seat=out.active,g=viewFor(out,seat);const html=renderCooperativeTabletop(g,{seat,decisionTargets:new Set([...g.players[seat].hand,...g.shared].map(c=>c.id))});
 for(const c of g.players[seat].hand)assert.match(html,new RegExp(`data-tt-card="${c.id}"`));
 for(const c of g.shared)assert.match(html,new RegExp(`data-tt-card="${c.id}"`));
 assert(!html.includes(`data-tt-card="${out.players[1-seat].hand[0].id}"`));
 assert(!html.includes('tt6-active-labyrinth'));assert(!html.includes('tt9-discard-gesture'));assert(!html.includes('data-tt-drop="play"'));
 assertConserved(out);
});
test('combined Doors display both seat progress trackers, with earned and missing color states',()=>{
 const game=drafted();const found=game.deck.find(c=>c.kind==='door'&&c.color==='red');assert(found);
 game.deck.splice(game.deck.indexOf(found),1);game.players[0].doors.push(found);const html=renderCooperativeTabletop(viewFor(game,0),{seat:0});
 assert.equal((html.match(/class="tt20-door-tracker"/g)||[]).length,2);
 assert.match(html,/data-tt6-player="0"/);assert.match(html,/data-tt6-player="1"/);
 assert.match(html,/tt20-door-color red tt20-earned/);assert.match(html,/tt20-door-color red tt20-missing/);
 assert.match(html,/tt20-team-door-list/);assertConserved(game);
});
test('Incantation claims immediately, then orders four remaining cards without retaining the Door',()=>{
 let game=newGame({seed:913,config:{expansions:['glyphs']}});const glyph=game.deck.find(c=>c.kind==='location'&&c.symbol==='glyph');assert(glyph);const old=game.players[0].hand[0];game.players[0].hand[0]=glyph;game.deck.splice(game.deck.indexOf(glyph),1);game.deck.push(old);
 const door=game.deck.find(c=>c.kind==='door'),extra=game.deck.filter(c=>c.kind==='location').slice(0,4);for(const c of [door,...extra])game.deck.splice(game.deck.indexOf(c),1);
 game.deck.push(door,...extra);game=act(game,{type:'discard',id:glyph.id});assert.equal(game.pending.type,'incantation');
 const claimed=act(game,{type:'incantationClaim',doorId:door.id});assert.equal(claimed.pending.type,'incantationOrder');
 assert(claimed.players[0].doors.some(c=>c.id===door.id));assert(!claimed.pending.cards.some(c=>c.id===door.id));assertConserved(claimed);
 assert.throws(()=>act(claimed,{type:'incantationOrder',order:[door.id,...claimed.pending.cards.slice(1).map(c=>c.id)]}));
 const done=act(claimed,{type:'incantationOrder',order:claimed.pending.cards.map(c=>c.id)});assertConserved(done);
});
test('card and decision UI maintains scale, long-hold inspect metadata, cost order and simple Door controls',()=>{
 const app=src('public/app.js'),css=src('public/tabletop/phase20.css'),interactions=src('public/tabletop/interactions.js'),inspection=src('public/tabletop/card-inspection.js');
 assert.match(src('public/tabletop/spellbook.js'),/\.sort\(\(\[a\],\[b\]\)=>book\.costs\[a\]-book\.costs\[b\]\)/);
 assert.doesNotMatch(app,/discardConfirm|discardCancel|coopDiscard/);assert.match(app,/Incantation: Take a door/);assert.match(app,/Incantation: Rearrange and put on bottom/);
 assert.match(app,/tt25-drawn-door-preview/);assert.match(app,/tt25-drawn-door-actions/);assert.match(app,/useKey:gain/);assert.match(app,/useKey:limbo/);assert.match(app,/swapPass/);
 assert.match(interactions,/onSwap\(/);assert.match(interactions,/swapZone\(/);assert.match(inspection,/setTimeout\(\(\)=>/);
 assert.match(css,/\.tt20-incantation-cards \.card/);assert.match(css,/aspect-ratio:1\/1\.42/);
 assert.match(renderCard({kind:'door',id:'d',color:'red'}),/data-tt-card-info=/);
});
