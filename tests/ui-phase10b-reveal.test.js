import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,viewFor,act,assertConserved} from '../engine/game.js';
import {renderPileInspector,renderInventoryTrack,renderActionDock} from '../public/tabletop/action-dock.js';
import {renderCard} from '../public/tabletop/cards.js';
import {renderOverlay} from '../public/game-overlay.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';
import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';
import {planGameTransitions} from '../public/tabletop/animation.js';
const read=p=>readFileSync(p,'utf8');
const setup=(kind='location',mode='solo')=>{
 let s=newGame({seed:777,mode,interactiveDraw:true});
 if(mode==='coop')while(s.phase==='draft')s=act(s,{type:'draft',id:s.draft[0].id});
 const i=s.deck.findIndex(c=>c.kind===kind);assert(i>=0);const [c]=s.deck.splice(i,1);s.deck.push(c);
 const discard=s.players[s.active].hand.find(x=>x.kind==='location'&&x.symbol!=='key');assert(discard);
 s=act(s,{type:'discard',id:discard.id});assert.equal(s.pending.type,'drawReady');return {s,c};
};
test('ordinary draw and non-action Door/Lost Dream move automatically without confirmation',()=>{
 for(const kind of ['location','door']){
  let {s,c}=setup(kind),p=viewFor(s,0);assert.match(renderActionDock(p,0),/data-action="draw"/);
  s=act(s,{type:'draw'});assertConserved(s);assert.notEqual(s.pending?.type,'drawn');
  if(kind==='location')assert(s.players[0].hand.some(x=>x.id===c.id));
  else assert(s.limbo.some(x=>x.id===c.id));
  assert.doesNotMatch(renderActionDock(viewFor(s,0),0),/Add to hand|Send to Limbo/);
 }
});
test('Nightmare remains a decision and animated revealed face stays public only for active seat',()=>{
 let {s,c}=setup('nightmare','coop');const before=viewFor(s,s.active);
 s=act(s,{type:'draw'});assert.equal(s.pending.type,'nightmare');
 const next=viewFor(s,s.active),other=viewFor(s,1-s.active);
 const plan=planGameTransitions(before,next);assert(plan.drawn.includes(c.id));assert.equal(plan.draw,1);
 assert.equal(other.pending.type,'private-decision');assert(!JSON.stringify(other).includes('"kind":"nightmare"'));
 assert.match(renderActionDock(next,s.active),/tt8-drawn-card/);assertConserved(s);
});
test('five-card Nightmare penalty reveals only public cards, with sequential visual candidates',()=>{
 let {s}=setup('nightmare');s=act(s,{type:'draw'});const before=viewFor(s,0);
 s=act(s,{type:'nightmare',option:'reveal'});const after=viewFor(s,0),plan=planGameTransitions(before,after);
 assert.equal(plan.draw,5);assert(plan.drawn.length>=5);assertConserved(s);
});
test('new Premonitions and actual shuffles are publicly detectable without deck identities',()=>{
 const game=newGame({seed:21,config:{expansions:['premonitions']}}),before=viewFor(game,0);
 const missing=['doors5','red2','green2','blue2','brown2','pair2','rainbow4','doors3'].find(id=>!before.expansion.premonitions.faceUp.includes(id));const after=structuredClone(before);after.expansion.premonitions.faceUp.push(missing);after.shuffleSerial=(before.shuffleSerial||0)+1;
 const plan=planGameTransitions(before,after);
 assert.deepEqual(plan.premRevealed,[missing]);assert(plan.shuffle);
 assert.equal(after.deck,undefined);
});
test('count tracks divide width into one rectangle per original card and limbo is face-only',()=>{
 const row=renderInventoryTrack(2,5);
 assert.equal((row.match(/<i /g)||[]).length,5);assert.equal((row.match(/tt10-count-filled/g)||[]).length,2);
 assert.match(row,/--tt10-slots:5/);
 const s=viewFor(newGame({seed:44}),0);
 assert.match(renderPileInspector(s,'deck'),/tt10-count-track/);
 assert.doesNotMatch(renderPileInspector(s,'limbo'),/tt10-count-track/);
});
test('Nightmare labels, Tower faces, pause Exit and Draw stack geometry are compact',()=>{
 const app=read('public/app.js');for(const label of ['Discard key','Remove door','5 from deck','Discard hand'])assert(app.includes(label));
 assert.doesNotMatch(renderCard({kind:'tower',id:'t',color:'red',number:2,left:'sun',right:'moon'}),/class="card-label"/);
 const pause=renderOverlay('pause',[],false,{});
 assert.match(pause,/data-action="gameGoHome"[^>]*>Exit game/);
 assert.doesNotMatch(pause,/Resume game|Return to home/);
 const s=viewFor(newGame({seed:77}),0);
 for(const html of [renderSoloTabletop(s),renderCooperativeTabletop(viewFor(newGame({mode:'coop',seed:77}),0),{seat:0})]){
  assert.match(html,/>Draw</);assert.match(html,/tt10-draw-count/);
 }
 const css=read('public/tabletop/phase10b.css');assert.match(css,/tt7-night-options/);assert.match(css,/tt10-reveal-flight/);assert.match(css,/tt10-shuffle-overlay/);
});
