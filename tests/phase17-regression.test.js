import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,act,viewFor,assertConserved} from '../engine/game.js';
import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';
import {renderActionDock} from '../public/tabletop/action-dock.js';
import {renderExpansionTabletop} from '../public/tabletop/expansions.js';
import {cardDescription} from '../public/tabletop/cards.js';
import {makeRoom,joinRoom,setReady,startRoom,restartRoom} from '../engine/firebase-protocol.js';
const putOnTop=(s,card)=>{const i=s.deck.findIndex(c=>c.id===card.id);assert.ok(i>=0);s.deck.push(...s.deck.splice(i,1));};
const intoHand=(s,card)=>{const p=s.players[s.active],i=s.deck.findIndex(c=>c.id===card.id);assert.ok(i>=0);[p.hand[0],s.deck[i]]=[s.deck[i],p.hand[0]];};
function drawDoor(s,door){putOnTop(s,door);const discard=s.players[0].hand.find(c=>c.kind==='location'&&c.symbol!=='key');assert.ok(discard);return act(s,{type:'discard',id:discard.id});}
test('ordinary red Door never accepts blue Key without an explicit wild or Chromatic exception',()=>{
 const s=newGame({seed:319,config:{expansions:['crossroads','oniverse']}}),red=s.deck.find(c=>c.kind==='door'&&c.color==='red');
 const blue=s.deck.find(c=>c.kind==='location'&&c.color==='blue'&&c.symbol==='key');intoHand(s,blue);const redKey=s.deck.find(c=>c.kind==='location'&&c.color==='red'&&c.symbol==='key');if(!s.players[0].hand.some(c=>c.id===redKey?.id)&&redKey){const slot=1,deckIndex=s.deck.findIndex(c=>c.id===redKey.id);[s.players[0].hand[slot],s.deck[deckIndex]]=[s.deck[deckIndex],s.players[0].hand[slot]];}
 let g=drawDoor(s,red);assert.equal(g.pending?.type,'door','the legitimate other Key, if present, offers a decision');
 assert.ok(!g.pending.keys.some(k=>k.id===blue.id));
 assert.throws(()=>act(g,{type:'chooseDoor',keyId:blue.id}),/does not match/);
 assertConserved(g);
});
test('Crossroad Key unlocks an ordinary-color Door without spending Chromatic Chaos',()=>{
 const s=newGame({seed:221,config:{expansions:['crossroads','oniverse']}}),wild=s.deck.find(c=>c.kind==='location'&&c.color==='wild'&&c.symbol==='key'),red=s.deck.find(c=>c.kind==='door'&&c.color==='red');
 intoHand(s,wild);const g=drawDoor(s,red);assert.equal(g.pending?.type,'door');assert.ok(g.pending.keys.some(x=>x.id===wild.id));
 const next=act(g,{type:'chooseDoor',keyId:wild.id});assert.ok(next.players[0].doors.some(x=>x.id===red.id));assert.ok(next.discard.some(x=>x.id===wild.id));assertConserved(next);
});
test('co-op physical order: doors split, Labyrinth then owner-specific Denizens, both hands around Shared',()=>{
 let s=newGame({mode:'coop',seed:114,config:{expansions:['oniverse','towers','crossroads']}});while(s.phase==='draft')s=act(s,{type:'draft',id:s.draft[0].id});
 // Source both rallied Denizens from the physical zones without duplicating cards.
 const d=s.deck.find(c=>c.kind==='denizen')||s.moduleState.oniverse.zones.unused.find(c=>c.kind==='denizen');assert.ok(d);
 const from=s.deck.includes(d)?s.deck:s.moduleState.oniverse.zones.unused;from.splice(from.findIndex(c=>c.id===d.id),1);d.owner=1;s.moduleState.oniverse.zones.rallied.push(d);
 for(const seat of [0,1]){
  const g=viewFor(s,seat),html=renderCooperativeTabletop(g,{seat});
  const doors=html.indexOf('tt17-coop-doors'),lab=html.indexOf('tt17-coop-labyrinths'),den=html.indexOf('tt17-coop-denizens'),hands=html.indexOf('tt17-coop-hands');
  assert.ok(doors>=0&&doors<lab&&lab<den&&den<hands);
  assert.equal((html.match(/class="tt17-player-doors/g)||[]).length,1);assert.equal((html.match(/tt20-door-tracker/g)||[]).length,2);
  assert.equal((html.match(/class="tt17-player-labyrinth/g)||[]).length,2);
  const middle=html.slice(hands);const sharedIndex=middle.indexOf('tt6-shared-block');assert.ok(sharedIndex>middle.indexOf('tt17-')&&sharedIndex<middle.lastIndexOf('tt17-'));
  assert.ok(html.includes('data-tt-zone="denizens"'));assert.ok(html.includes(`data-tt6-player="1"`));
  assert.equal((html.match(/class="tt6-card-back"/g)||[]).length,3);
  assert.ok(!html.includes(`data-tt-card="${s.players[1-seat].hand[0].id}"`));
 }
 assertConserved(s);
});
test('Denizens have printed names, do not live inside decorative tiles, and retain inspection',()=>{
 const s=newGame({seed:128,config:{expansions:['oniverse']}});const c=s.deck.find(c=>c.kind==='denizen')||s.moduleState.oniverse.zones.unused[0];
 assert.ok(!cardDescription(c).startsWith('Denizen'));const html=renderExpansionTabletop(viewFor(s,0));
 assert.match(html,/data-tt-zone="denizens"/);assert.doesNotMatch(html,/class="tt5-tile tt5-denizen/);
});
test('finished games have a dock victory message, Exit and replay, not an inline win strip',()=>{
 const game=viewFor(newGame({seed:89}),0);game.status='won';game.phase='ended';const dock=renderActionDock(game,0);
 assert.match(dock,/You escaped the dream!/);assert.match(dock,/data-action="exitFinished"/);assert.match(dock,/data-action="playAgain"/);
 const source=readFileSync('public/tabletop/solo-board.js','utf8');assert.doesNotMatch(source,/class="tt2-finish"/);
});
test('online replay preserves exact setup and player names in an already finished occupied room',()=>{
 let r=makeRoom('ABCD','host','Alice',{expansions:['crossroads','oniverse'],difficulties:{crossroads:'hard'}});r=joinRoom(r,'guest','Bob');r=setReady(r,'guest',true);r=startRoom(r,'host');
 assert.throws(()=>restartRoom(r,'guest'),/previous game finished/);
 r.game.status='won';r.game.phase='ended';const again=restartRoom(r,'guest');
 assert.equal(again.version,r.version+1);assert.equal(again.game.status,'active');assert.deepEqual(again.game.config,r.game.config);assert.deepEqual(again.game.players.map(p=>p.name),['Alice','Bob']);assertConserved(again.game);
});
test('transition animation never deliberately shows newly drawn hand card before the reveal ends',()=>{
 const source=readFileSync('public/tabletop/animation.js','utf8');assert.match(source,/target\.style\.visibility='hidden'/);assert.match(source,/motion\.finished\.catch\(\(\)=>\{\}\)\.then\(cleanup\)/);assert.match(source,/duration:CARD_MOTION.reveal/);assert.match(readFileSync('public/tabletop/animation-timing.js','utf8'),/reveal:1180/);
 assert.match(readFileSync('public/index.html','utf8'),/tabletop\/phase17.css/);
});
