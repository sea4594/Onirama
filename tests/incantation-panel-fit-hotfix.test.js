import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,act,assertConserved} from '../engine/game.js';
import {renderCard} from '../public/tabletop/cards.js';
import {renderActionDock} from '../public/tabletop/action-dock.js';
const app=readFileSync('public/app.js','utf8');
const css=readFileSync('public/tabletop/card-system.css','utf8');
const raw=app.slice(app.indexOf('function incantationDecision(p){'),app.indexOf('function happyPeekDecision(p){'));
const incantationDecision=new Function('card','escape','btn','effectOrder',`return (${raw.replace('function incantationDecision(p){','function(p){')})`)(renderCard,s=>String(s), (label,action,variant)=>`<button class="${variant||''}" data-action="${action}">${label}</button>`,[]);
const location=(id,color='red')=>({id,kind:'location',color,symbol:'sun'}),door=(id,color='blue')=>({id,kind:'door',color});
function dock(p){const game={status:'active',phase:'decision',active:0,players:[{name:'P1'}],pending:p};return renderActionDock(game,0,{dialog:{type:p.type,html:incantationDecision(p)}});}
test('five-card Incantation only makes revealed Doors selectable, with uniform card shells',()=>{
 const p={type:'incantation',cards:[location('l1'),door('d1'),location('l2','green'),door('d2','brown'),location('l3')]};
 const html=dock(p);
 assert.match(html,/Incantation: choose a Door/);
 assert.equal((html.match(/class="tt20-incantation-choice"/g)||[]).length,2);
 assert.equal((html.match(/class="tt20-incantation-reveal"/g)||[]).length,3);
 assert.equal((html.match(/data-tt-incantation-door/g)||[]).length,2);
 assert.equal((html.match(/data-action="incantationClaim:/g)||[]).length,2);
 assert.equal((html.match(/class="card /g)||[]).length,5);
 assert.match(html,/aria-label="Choose blue Door"/);
 assert.doesNotMatch(html,/data-action="effectConfirm"/);
});
test('claiming a Door immediately transitions to a reorder-only panel for all remaining cards',()=>{
 let s=newGame({seed:913,config:{expansions:['glyphs']}});const glyph=s.deck.find(c=>c.kind==='location'&&c.symbol==='glyph');assert(glyph);
 const replaced=s.players[0].hand[0];s.players[0].hand[0]=glyph;s.deck.splice(s.deck.indexOf(glyph),1);s.deck.push(replaced);
 const d=s.deck.find(c=>c.kind==='door'),others=s.deck.filter(c=>c.kind==='location').slice(0,4);
 for(const c of [d,...others])s.deck.splice(s.deck.indexOf(c),1);
 s.deck.push(d,...others);s=act(s,{type:'discard',id:glyph.id});assert.equal(s.pending.type,'incantation');
 const initial=dock(s.pending);assert.match(initial,/data-action="incantationClaim:/);
 s=act(s,{type:'incantationClaim',doorId:d.id});assertConserved(s);assert.equal(s.pending.type,'incantationOrder');
 assert(s.players[0].doors.some(c=>c.id===d.id));assert.equal(s.pending.cards.length,4);
 const next=dock(s.pending);assert.match(next,/Incantation: arrange remaining cards/);
 assert.equal((next.match(/data-tt-order-id=/g)||[]).length,4);
 assert(!next.includes(`data-tt-order-id="${d.id}"`));assert.match(next,/data-action="effectConfirm"/);
 s=act(s,{type:'incantationOrder',order:s.pending.cards.map(c=>c.id).reverse()});assertConserved(s);
 assert.notEqual(s.pending?.type,'incantationOrder');
});
test('Incantation with no Door immediately offers rearrangement of all five cards',()=>{
 const p={type:'incantation',cards:Array.from({length:5},(_,i)=>location(`l${i}`))};
 const html=dock(p);assert.match(html,/Incantation: arrange cards/);
 assert.equal((html.match(/data-tt-order-id=/g)||[]).length,5);assert.match(html,/data-action="effectConfirm"/);
 assert.doesNotMatch(html,/data-action="incantationClaim:/);
});
test('Incantation has one constrained shell size for Doors and Locations and no internal scroll',()=>{
 assert.match(css,/tt20-incantation-cards>:is\(\.tt20-incantation-choice,\.tt20-incantation-reveal,\.tt3-order-item\)/);
 assert.match(css,/flex:0 0 var\(--tt31-card-width\)!important/);
 assert.match(css,/\.tt20-incantation-cards :is\(\.card,\.tt3-order-handle,\.tt3-order-handle \.card\)/);
 assert.match(css,/overflow:hidden!important;touch-action:manipulation/);
 assert.match(css,/--tt31-reserve:100px/);
 assert.match(css,/outline:3px solid #ffdf88/);
});
