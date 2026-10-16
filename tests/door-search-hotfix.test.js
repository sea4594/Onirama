import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,act,assertConserved,viewFor} from '../engine/game.js';
import {planGameTransitions} from '../public/tabletop/animation.js';
import {renderPileInspector} from '../public/tabletop/action-dock.js';
import {renderExpansionTabletop} from '../public/tabletop/expansions.js';

function fixture({noDeckDoor=false}={}){
 const s=newGame({seed:24242,config:{expansions:['dreamcatchers']}});
 const deck=s.deck,stacks=s.moduleState.dreamcatchers.zones;
 const door=deck.splice(deck.findIndex(c=>c.kind==='door'&&c.color==='blue'),1)[0];
 stacks.catch0.push(door);
 const extra=deck.splice(deck.findIndex(c=>c.kind==='nightmare'),1)[0];
 stacks.catch1.push(extra);
 if(noDeckDoor)for(let i=deck.length-1;i>=0;i--)if(deck[i].kind==='door'&&deck[i].color==='blue')s.discard.push(...deck.splice(i,1));
 s.phase='decision';s.pending={type:'doorSearch',color:'blue'};
 assertConserved(s);
 return {s,door,extra};
}
test('Taking a Door directly from a Dreamcatcher does not shuffle or free cards',()=>{
 const {s,door}=fixture();const serial=s.shuffleSerial||0;
 const next=act(s,{type:'doorSearch',option:'claim',doorId:door.id});assertConserved(next);
 assert.equal(next.shuffleSerial||0,serial);assert.equal(next.moduleState.dreamcatchers.zones.catch1.length,1);
 assert(next.players[0].doors.some(c=>c.id===door.id));
});
test('Searching first can shuffle an empty-of-color deck and take its Door from a Dreamcatcher',()=>{
 const {s,door}=fixture({noDeckDoor:true}),serial=s.shuffleSerial||0;
 assert(viewFor(s,0).pending.targets.every(t=>t.source!=='deck'));
 const next=act(s,{type:'doorSearch',option:'claim',doorId:door.id,searchBeforeClaim:true});
 assertConserved(next);assert.equal(next.shuffleSerial,serial+1);
 assert(next.players[0].doors.some(c=>c.id===door.id));assert.equal(next.moduleState.dreamcatchers.zones.catch1.length,1);
});
test('Searching first may free another occupied catcher, but never the Door source',()=>{
 const {s,door,extra}=fixture({noDeckDoor:true}),serial=s.shuffleSerial||0;
 assert.throws(()=>act(s,{type:'doorSearch',option:'claim',doorId:door.id,searchBeforeClaim:true,freeId:0}),/Cannot free/);
 const next=act(s,{type:'doorSearch',option:'claim',doorId:door.id,searchBeforeClaim:true,freeId:1});
 assertConserved(next);assert.equal(next.shuffleSerial,serial+1);
 assert.equal(next.moduleState.dreamcatchers.zones.catch1.length,0);
 assert(next.players[0].doors.some(c=>c.id===door.id));
 assert(next.deck.some(c=>c.id===extra.id)||next.players[0].hand.some(c=>c.id===extra.id)||next.shared?.some(c=>c.id===extra.id));
});
test('Dreamcatcher cards remain inspectable while the pile inventories retain color-row grouping',()=>{
 const {s}=fixture();const v=viewFor(s,0);
 const html=renderExpansionTabletop(v);assert.match(html,/data-action="inspectCatcher:0"/);
 assert.match(html,/tt14-held-card/);assert.match(html,/data-tt-card-info=/);
 const pile=renderPileInspector(v,'deck');assert.match(pile,/data-inventory-section="base"/);
 const css=readFileSync('public/tabletop/card-system.css','utf8');
 assert.match(css,/data-inventory-section="base"\]\{grid-template-columns:repeat\(4/);
 assert.match(css,/data-inventory-section="towers"\]\{grid-template-columns:repeat\(3/);
});
test('Freeing animates catcher-to-deck even if same action draws cards and net deck size does not increase',()=>{
 const {s}=fixture();const before=viewFor(s,0);
 // Freeing removes the visible card from a catcher, then a refill can consume enough cards
 // that the deck count stays unchanged or decreases.
 const after=structuredClone(before);after.expansion.dreamcatchers.stacks[1]=[];after.deckCount=before.deckCount;
 after.shuffleSerial=(before.shuffleSerial||0)+1;
 const p=planGameTransitions(before,after);
 assert.equal(p.catcherFreed.length,1);assert.equal(p.catcherFreed[0].index,1);
 assert.equal(p.catcherFreed[0].removed.length,1);assert(p.shuffle);
});
test('Door search interface offers source-specific choices and a separate optional freeing stage',()=>{
 const source=readFileSync('public/app.js','utf8');
 for(const route of ['doorSearch:choose:', 'doorSearch:direct:', 'doorSearch:shuffle:', 'doorSearch:free:', 'doorSearch:passFree', 'doorSearch:skip'])assert(source.includes(route),route);
 assert.match(source,/Free a dreamcatcher\?/);assert.match(source,/searchBeforeClaim:true/);
 assert.match(source,/searchableCatchers\(state.game,doorSearchIntent\)/);
});
