import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,act,assertConserved} from '../engine/game.js';
import {renderCard} from '../public/tabletop/cards.js';
import {renderExpansionTabletop} from '../public/tabletop/expansions.js';
const source=p=>readFileSync(p,'utf8');
function incantation(doorCount){
 const s=newGame({seed:73,config:{expansions:['glyphs']}});
 let glyph=s.players[0].hand.find(c=>c.kind==='location'&&c.symbol==='glyph');
 if(!glyph){const i=s.deck.findIndex(c=>c.kind==='location'&&c.symbol==='glyph');assert(i>=0);const old=s.players[0].hand[0];glyph=s.deck.splice(i,1)[0];s.players[0].hand[0]=glyph;s.deck.push(old);}
 const top=[];for(let i=0;i<5;i++){const j=s.deck.findIndex(c=>c.kind===(i<doorCount?'door':'location'));assert(j>=0);top.push(s.deck.splice(j,1)[0]);}
 s.deck.push(...top);const next=act(s,{type:'discard',id:glyph.id});assert.equal(next.pending.type,'incantation');assert.equal(next.pending.cards.length,5);return next;
}
test('Incantation reveals five, optional Door when none available never traps resolution',()=>{
 let g=incantation(0);assert.equal(g.pending.cards.filter(x=>x.kind==='door').length,0);
 g=act(g,{type:'incantation',order:g.pending.cards.map(x=>x.id)});assertConserved(g);assert.notEqual(g.pending?.type,'incantation');
});
test('Incantation claims one Door and returns all other revealed cards in order',()=>{
 let g=incantation(2);const revealed=g.pending.cards;const chosen=revealed.find(c=>c.kind==='door');
 assert.throws(()=>act(g,{type:'incantation',doorId:'not-revealed',order:revealed.map(x=>x.id)}),/Choose a revealed Door/);
 g=act(g,{type:'incantation',doorId:chosen.id,order:revealed.filter(c=>c.id!==chosen.id).map(c=>c.id)});
 assert(g.players[0].doors.some(c=>c.id===chosen.id));assertConserved(g);
});
test('Incantation UI requires choosing a revealed Door before reordering',()=>{
 const app=source('public/app.js');
 assert.match(app,/incantationStage==='claim'/);assert.doesNotMatch(app,/incantationPass/);
 assert.match(app,/incantationClaim/);assert.match(app,/Select a Door → Doors/);assert.match(app,/Submit/);
 assert.match(source('public/tabletop/phase10c.css'),/nth-child\(5\)/);
});
test('Tower icon and number are separate fixed positions',()=>{
 const html=renderCard({id:'tower-1',kind:'tower',color:'red',number:5,left:'sun',right:'moon'},{tiny:true});
 assert.match(html,/tt11-tower-emblem/);assert.match(html,/tt11-tower-number/);
 const css=source('public/tabletop/phase10c.css');assert.match(css,/\.tt11-tower-number\{position:absolute;bottom:/);
});
test('Dreamcatcher compartments render each stored face without overlapping',()=>{
 const g={phase:'action',active:0,expansion:{dreamcatchers:{stacks:[[ {id:'l1',kind:'location',color:'red',symbol:'sun'}, {id:'l2',kind:'location',color:'blue',symbol:'key'} ],[],[],[]],active:[true,true,true,true],failsafes:2}}};
 const html=renderExpansionTabletop(g);
 assert.match(html,/tt11-catcher-content/);assert.match(html,/--tt11-cards:2/);assert.match(html,/data-tt-motion-id="l1"/);assert.match(html,/data-tt-motion-id="l2"/);
});
test('Orientation, touch and animation destination-visibility protections are installed',()=>{
 const app=source('public/app.js'),css=source('public/tabletop/phase10c.css'),animation=source('public/tabletop/animation.js');
 assert.match(app,/orientationchange/);assert.match(app,/visualViewport/);
 assert.match(css,/touch-action:manipulation/);assert.match(css,/-webkit-user-select:none/);
 assert.match(animation,/if\(target\)target\.style\.visibility='hidden'/);
 assert.match(animation,/if\(target\)target\.style\.removeProperty\('visibility'\)/);
});
