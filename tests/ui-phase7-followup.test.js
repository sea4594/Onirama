import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,act,viewFor,legalActions,assertConserved} from '../engine/game.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';
import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';
import {renderActionDock} from '../public/tabletop/action-dock.js';
import {renderCard} from '../public/tabletop/cards.js';
import {cardHelp} from '../public/tabletop/card-inspection.js';
const all=['book','glyphs','dreamcatchers','towers','premonitions','crossroads','oniverse','mirrors','sphinx'];
function simpleDiscard(s){const c=s.players[s.active].hand.find(c=>c.kind==='location'&&!['key','glyph'].includes(c.symbol));assert.ok(c);return act(s,{type:'discard',id:c.id});}
function moveTop(s,kind){const i=s.deck.findIndex(c=>c.kind===kind);assert.ok(i>=0,`No ${kind}`);const [card]=s.deck.splice(i,1);s.deck.push(card);return card;}
test('new interactive solo games require an explicit draw and confirmation, conserving cards',()=>{
 let s=newGame({seed:32,interactiveDraw:true});const chosen=moveTop(s,'location');
 s=simpleDiscard(s);assert.equal(s.pending.type,'drawReady');assert.ok(legalActions(s).some(c=>c.type==='draw'));assertConserved(s);
 let v=viewFor(s,0);assert.match(renderActionDock(v,0),/data-action="draw"/);
 const count=s.deck.length;s=act(s,{type:'draw'});assert.equal(s.pending.type,'drawn');assert.equal(s.pending.card.id,chosen.id);assert.equal(s.pending.destination,'hand');assert.equal(s.deck.length,count-1);assertConserved(s);
 v=viewFor(s,0);const html=renderActionDock(v,0);assert.match(html,/tt8-drawn-card/);assert.match(html,/Add to hand/);
 assert.throws(()=>act(s,{type:'discard',id:s.players[0].hand[0].id}));
 s=act(s,{type:'confirmDraw'});assert.equal(s.phase,'action');assert.equal(s.players[0].hand.length,5);assertConserved(s);
});
test('drawn cards destined for Limbo wait for explicit confirmation',()=>{
 let s=newGame({seed:38,interactiveDraw:true});moveTop(s,'door');s=simpleDiscard(s);s=act(s,{type:'draw'});
 assert.equal(s.pending.type,'drawn');assert.equal(s.pending.destination,'limbo');
 const before=s.limbo.length;assert.match(renderActionDock(viewFor(s,0),0),/Send to Limbo/);
 s=act(s,{type:'confirmDraw'});assert.equal(s.limbo.length,before+1);assertConserved(s);
});
test('drawn Nightmare is explained and must be resolved before another draw',()=>{
 let s=newGame({seed:44,interactiveDraw:true});moveTop(s,'nightmare');s=simpleDiscard(s);s=act(s,{type:'draw'});
 assert.equal(s.pending.type,'nightmare');assert.equal(s.pending.card.kind,'nightmare');assertConserved(s);
 const panel=renderActionDock(viewFor(s,0),0,{dialog:{type:'nightmare',html:'<button>Penalty</button>'}});
 assert.match(panel,/tt8-drawn-card/);assert.match(panel,/tt8-required/);
 assert.throws(()=>act(s,{type:'draw'}));
});
test('cooperative drafting and refills retain seat privacy and manual prompts',()=>{
 let s=newGame({mode:'coop',seed:48,interactiveDraw:true});while(s.phase==='draft')s=act(s,{type:'draft',id:s.draft[0].id});
 moveTop(s,'location');s=simpleDiscard(s);assert.equal(s.pending.type,'drawReady');
 let other=viewFor(s,1-s.active);assert.equal(other.pending.type,'private-decision');
 s=act(s,{type:'draw'});assert.equal(s.pending.type,'drawn');assertConserved(s);
 other=viewFor(s,1-s.active);assert.equal(other.pending.type,'private-decision');
 assert.ok(!JSON.stringify(other).includes(s.pending.card.id));
 s=act(s,{type:'confirmDraw'});assertConserved(s);
});
test('legacy saves and engine calls retain backward compatible auto-refill',()=>{
 let s=newGame({seed:49});s=simpleDiscard(s);assert.notEqual(s.pending?.type,'drawReady');assertConserved(s);
});
test('Doors replace Steps as goal UI, Towers are directly below Doors, and piles retain inspection only',()=>{
 const s=newGame({seed:51,config:{expansions:all}}),g=viewFor(s,0);const html=renderSoloTabletop(g);
 assert.ok(html.indexOf('class="tt2-doors-row tt8-doors-row"')<html.indexOf('class="tt8-towers-slot"'));
 assert.ok(html.indexOf('class="tt8-towers-slot"')<html.indexOf('class="tt2-zone tt2-labyrinth'));
 assert.equal((html.match(/data-tt-zone="goals"/g)||[]).length,0);
 assert.match(html,/data-action="openSpells"/);
 for(const name of ['limbo','deck','discard'])assert.match(html,new RegExp(`data-action="inspectPile:${name}"`));
 const names=['inspectPile:limbo','inspectPile:deck','inspectPile:discard','openSpells'].map(n=>html.indexOf(`data-action="${n}"`));
 assert.ok(names.every(n=>n>0));assert.deepEqual([...names].sort((a,b)=>a-b),names);
 assert.match(html,/tt8-door-empty red/);assert.match(html,/tt8-door-empty blue/);assert.doesNotMatch(html,/tt2-color-name/);
 const coop=viewFor(newGame({mode:'coop',seed:55,config:{expansions:['book','towers']}}),0);
 assert.match(renderCooperativeTabletop(coop,{seat:0}),/data-action="openSpells"/);
});
test('tower marks have fixed vertical positions and highlights never translate cards or change fill',()=>{
 const html=renderCard({kind:'tower',id:'t',color:'red',number:4,left:'sun+moon',right:'moon'});
 assert.match(html,/data-tower-mark="sun"/);assert.match(html,/data-tower-mark="moon"/);
 const css=readFileSync('public/tabletop/static-tabletop.css','utf8');assert.match(css,/data-tower-mark="sun"\]\{top:64%/);
 assert.match(css,/data-tower-mark="moon"\]\{top:28%/);assert.match(css,/transform:none!important/);
 assert.match(css,/\.card\.selected/);assert.match(css,/tt8-current-goal/);assert.doesNotMatch(css,/background-color:inherit/);
});
test('Nightmare penalty buttons have hold information available without issuing actions',()=>{
 assert.match(cardHelp({kind:'nightmarePenalty',option:'Reveal 5'}).detail,/five/);
 assert.match(readFileSync('public/app.js','utf8'),/data-tt-card-info=.*nightmarePenalty/);
 assert.match(readFileSync('public/tabletop/action-dock.js','utf8'),/tt8-required/);
});

test('draw animations treat a revealed pending card as visible in the action dock',()=>{
 const code=readFileSync('public/tabletop/animation.js','utf8');
 assert.match(code,/pending\?\.card\s*\?\s*\[game\.pending\.card\]/);
});
