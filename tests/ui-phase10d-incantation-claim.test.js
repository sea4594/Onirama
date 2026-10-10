import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,act,assertConserved,viewFor} from '../engine/game.js';
import {renderDoorSlots} from '../public/tabletop/door-slots.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';
import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';
const src=p=>readFileSync(p,'utf8');
function setIncantation({book=false,coop=false,match=true}={}){
 let s=newGame({mode:coop?'coop':'solo',seed:73,config:{expansions:book?['glyphs','book']:['glyphs']}});
 if(coop)while(s.phase==='draft')s=act(s,{type:'draft',id:s.draft[0].id});
 const goal=book?s.moduleState.book.goals.find(g=>!g.done).color:null;
 const me=s.players[s.active],glyph=s.deck.find(c=>c.kind==='location'&&c.symbol==='glyph')||me.hand.find(c=>c.kind==='location'&&c.symbol==='glyph');
 assert(glyph,'a Glyph must be present');
 if(!me.hand.includes(glyph)){const old=me.hand[0];me.hand[0]=glyph;s.deck.splice(s.deck.indexOf(glyph),1);s.deck.push(old);}
 const desiredColor=book?(match?goal:['red','blue','green','brown'].find(c=>c!==goal)):null;
 const i=s.deck.findIndex(c=>c.kind==='door'&&(!desiredColor||c.color===desiredColor));assert(i>=0);
 const door=s.deck.splice(i,1)[0];const extra=[];
 for(let k=0;k<4;k++){const j=s.deck.findIndex(c=>c.kind==='location');assert(j>=0);extra.push(s.deck.splice(j,1)[0]);}
 s.deck.push(door,...extra);
 s=act(s,{type:'discard',id:glyph.id});assert.equal(s.pending.type,'incantation');assert.equal(s.pending.cards.length,5);
 return {s,door,goal};
}
test('Claimed Incantation Door moves to Doors, never Limbo, when no Steps restriction applies',()=>{
 const {s,door}=setIncantation();const rest=s.pending.cards.filter(c=>c.id!==door.id).map(c=>c.id);
 const final=act(s,{type:'incantation',doorId:door.id,order:rest});
 assert(final.players[final.active].doors.some(c=>c.id===door.id));assert(!final.limbo.some(c=>c.id===door.id));assertConserved(final);
});
test('Pass is rejected with revealed Doors, preserving state and physical inventory',()=>{
 const {s}=setIncantation();const ids=s.pending.cards.map(c=>c.id);
 assert.throws(()=>act(s,{type:'incantation',doorId:null,order:ids}),/passing is allowed only/);assertConserved(s);
});
test('Book of Steps claims matching Goal but routes wrong-color Door to Limbo',()=>{
 for(const match of [true,false]){
  const {s,door,goal}=setIncantation({book:true,match});const rest=s.pending.cards.filter(c=>c.id!==door.id).map(c=>c.id);
  const final=act(s,{type:'incantation',doorId:door.id,order:rest});
  assert.equal(final.players[final.active].doors.some(c=>c.id===door.id),match);
  assert.equal(final.limbo.some(c=>c.id===door.id)||final.deck.some(c=>c.id===door.id),!match); // Limbo may already be reshuffled at turn end
  assert.equal(final.moduleState.book.goals.some(g=>g.doorId===door.id),match);assertConserved(final);
 }
});
test('Cooperative claim affects active player seat without changing partner Doors',()=>{
 const {s,door}=setIncantation({coop:true});const active=s.active;const rest=s.pending.cards.filter(c=>c.id!==door.id).map(c=>c.id);
 const final=act(s,{type:'incantation',doorId:door.id,order:rest});
 assert(final.players[active].doors.some(c=>c.id===door.id));assert(!final.players[1-active].doors.some(c=>c.id===door.id));assertConserved(final);
});
test('Only active-player Doors are a highlighted Incantation drop target, with provisional preview',()=>{
 const {s,door}=setIncantation({coop:true});const game=viewFor(s,s.active);
 const active=renderCooperativeTabletop(game,{seat:s.active,incantationClaim:true});assert.equal((active.match(/data-tt-incantation-drop="doors"/g)||[]).length,1);
 const waiting=renderCooperativeTabletop(game,{seat:1-s.active,incantationClaim:false});assert(!waiting.includes('data-tt-incantation-drop="doors"'));
 const solo=setIncantation().s;const soloHTML=renderSoloTabletop(viewFor(solo,0),{incantationClaim:true});assert(soloHTML.includes('data-tt-incantation-drop="doors"'));
 const rendered=renderDoorSlots([],{expansions:['glyphs']},{incantationPreview:door});assert(rendered.includes('tt12-door-preview'));
 assert.equal((rendered.match(/tt12-door-preview/g)||[]).length,1);
});
test('UI action stage disallows ordering before claim/pass; mouse/touch drop only accepts revealed Door',()=>{
 const app=src('public/app.js'),gestures=src('public/tabletop/interactions.js'),styles=src('public/tabletop/phase10d.css');
 assert.match(app,/incantationStage!=='order'/);assert.doesNotMatch(app,/incantationPass/);assert.match(app,/incantationBack/);assert.match(app,/incantationSelect:/);
 assert.match(gestures,/createIncantationClaim/);assert.match(gestures,/data-tt-incantation-card/);assert.match(gestures,/data-tt-incantation-drop/);
 assert.match(styles,/\.tt12-claim-zone/);assert.match(styles,/outline-offset:-3px/);
});
