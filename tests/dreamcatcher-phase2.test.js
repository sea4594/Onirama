import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,act,viewFor,legalActions,assertConserved} from '../engine/game.js';
import {actionDockPrompt,renderActionDock} from '../public/tabletop/action-dock.js';
import {planGameTransitions} from '../public/tabletop/animation.js';

const game=(mode='solo',hard=false)=>newGame({seed:2202026,mode,config:{expansions:['dreamcatchers'],difficulties:hard?{dreamcatchers:'hard'}:{}},manualTurnEnd:mode==='coop'});
function take(s,pred){const i=s.deck.findIndex(pred);assert(i>=0);return s.deck.splice(i,1)[0];}
function occupiedFixture(mode='solo'){
 const s=game(mode),d=s.moduleState.dreamcatchers;
 for(let i=0;i<4;i++)d.zones[`catch${i}`].push(take(s,c=>c.kind==='location'));
 s.limbo.push(take(s,c=>c.kind==='lostDream'));
 // Preserve an uninterrupted action turn even for cooperative setup.
 s.phase='action';s.pending=null;
 assertConserved(s);return s;
}
function reachOverload(s){
 // Keep replenishment deterministic: do not introduce unrelated special-card decisions.
 s.deck.sort((a,b)=>Number(a.kind==='location')-Number(b.kind==='location'));
 // Trigger an ordinary end-of-turn refill with a non-Key Location discard.
 const candidate=s.players[s.active].hand.find(c=>c.kind==='location'&&c.symbol!=='key'&&c.symbol!=='glyph');
 assert(candidate,'Expected a discardable Location');
 let next=act(s,{type:'discard',id:candidate.id});
 // Cooperative discards require a swap/pass decision.
 if(next.pending?.type==='coopSwap')next=act(next,{type:'coopSwap',option:'pass'});
 assert.equal(next.pending?.type,'catchOverload');assertConserved(next);return next;
}
test('Overload immediately empties every occupied catcher and Limbo, shuffling exactly once',()=>{
 const s=occupiedFixture(),stored=Object.values(s.moduleState.dreamcatchers.zones).flat().map(c=>c.id),limbo=s.limbo.map(c=>c.id),start=s.shuffleSerial||0;
 const next=reachOverload(s),d=next.moduleState.dreamcatchers;
 assert.deepEqual(next.pending,{type:'catchOverload',choices:[3],returned:true});
 assert.deepEqual(d.active,[true,true,true,true]);
 assert(Object.values(d.zones).every(stack=>stack.length===0));assert.equal(next.limbo.length,0);
 for(const id of [...stored,...limbo])assert(next.deck.some(c=>c.id===id),`Missing returned ${id}`);
 assert.equal(next.shuffleSerial,start+1);assertConserved(next);
 const plan=planGameTransitions(viewFor(s,0),viewFor(next,0));
 assert.equal(plan.overload,true);assert.equal(plan.catcherFreed.length,4);
 assert.equal(plan.catcherFreed.reduce((n,x)=>n+x.removed.length,0),stored.length);
 assert.equal(plan.overloadLimbo,limbo.length);assert.equal(plan.shuffle,true);
 const view=viewFor(next,0);assert.equal(actionDockPrompt(view,0).title,'Overload!');
 const dock=renderActionDock(view,0,{dialog:{type:'catchOverload',html:'<button data-action="catchOverload:remove">Remove Dreamcatcher</button>'}});
 assert.match(dock,/Overload!/);assert.match(dock,/Remove Dreamcatcher/);
});
test('Confirmation removes only the rightmost active catcher and never shuffles twice',()=>{
 const overloaded=reachOverload(occupiedFixture()),serial=overloaded.shuffleSerial;
 assert.throws(()=>act(overloaded,{type:'catchOverload',index:0}),/rightmost/);
 const next=act(overloaded,{type:'catchOverload'});assertConserved(next);
 assert.deepEqual(next.moduleState.dreamcatchers.active,[true,true,true,false]);
 assert.equal(next.shuffleSerial,serial);assert.notEqual(next.pending?.type,'catchOverload');
});
test('Previously removed catchers are skipped; removing the last remaining catcher loses the game',()=>{
 let s=occupiedFixture(),d=s.moduleState.dreamcatchers;
 d.active=[true,true,false,false];
 for(const i of [2,3])s.deck.push(...d.zones[`catch${i}`].splice(0));
 assertConserved(s);s=reachOverload(s);assert.deepEqual(s.pending.choices,[1]);s=act(s,{type:'catchOverload'});
 assert.deepEqual(s.moduleState.dreamcatchers.active,[true,false,false,false]);assertConserved(s);
 // Simulate a subsequent overload in the only remaining catcher, preserving conservation.
 d=s.moduleState.dreamcatchers;s.phase='action';s.pending=null;
 d.zones.catch0.push(take(s,c=>c.kind==='location'));s.limbo.push(take(s,c=>c.kind==='lostDream'));
 s=reachOverload(s);assert.deepEqual(s.pending.choices,[0]);s=act(s,{type:'catchOverload'});
 assert.equal(s.status,'lost');assert.equal(s.phase,'ended');assertConserved(s);
});
test('Failsafe can be selected only with an active occupied catcher and consumes one book',()=>{
 const s=game(),d=s.moduleState.dreamcatchers;
 assert.equal(actionDockPrompt(viewFor(s,0),0).title,'Play or discard');
 let dock=renderActionDock(viewFor(s,0),0);assert.match(dock,/Use Failsafe/);assert.match(dock,/data-action="failsafeStart"[^>]*disabled/);
 d.zones.catch1.push(take(s,c=>c.kind==='lostDream'));
 assert(legalActions(s).some(a=>a.type==='freeCatcher'&&a.choices.includes(1)));
 dock=renderActionDock(viewFor(s,0),0);assert.match(dock,/data-action="failsafeStart"/);assert.doesNotMatch(dock,/tt23-failsafe-urgent/);
 dock=renderActionDock(viewFor(s,0),0,{failsafeChoosing:true});assert.match(dock,/Choose a Dreamcatcher/);assert.match(dock,/Tap an outlined/);assert.match(dock,/failsafeCancel/);
 assert.throws(()=>act(s,{type:'freeCatcher',index:0}),/occupied/);
 const serial=s.shuffleSerial||0,n=act(s,{type:'freeCatcher',index:1});assertConserved(n);
 assert.equal(n.moduleState.dreamcatchers.failsafes,1);assert.equal(n.moduleState.dreamcatchers.zones.catch1.length,0);assert.equal(n.shuffleSerial,serial+1);
});
test('Urgent Failsafe is red only when every surviving catcher is full; hard mode offers no button',()=>{
 let s=occupiedFixture();let html=renderActionDock(viewFor(s,0),0);assert.match(html,/tt23-failsafe-urgent/);
 s.moduleState.dreamcatchers.active[3]=false;s.deck.push(...s.moduleState.dreamcatchers.zones.catch3.splice(0));
 html=renderActionDock(viewFor(s,0),0);assert.match(html,/tt23-failsafe-urgent/);
 s.moduleState.dreamcatchers.zones.catch0=[]; // UI-only shape fixture; state remains nonconserved here.
 html=renderActionDock(viewFor(s,0),0);assert.doesNotMatch(html,/tt23-failsafe-urgent/);
 html=renderActionDock(viewFor(game('solo',true),0),0);assert.doesNotMatch(html,/failsafeStart/);
});
test('Cooperative overload resumes to explicit turn-complete state; UI activation prevents use outside action',()=>{
 // Cooperators draw during draft; force the canonical active action state for the fixture.
 const s=occupiedFixture('coop');s.shared.push(...s.draft.splice(0,2));for(let i=0;i<2;i++)s.players[i].hand.push(...s.draft.splice(0,3));s.phase='action';s.active=0;
 // Complete the extra two draft cards only; fixture is conserved.
 assertConserved(s);
 const n=reachOverload(s);assert.equal(n.pending.type,'catchOverload');assert.equal(n.pending.returned,true);
 const end=act(n,{type:'catchOverload'});assert.equal(end.phase,'turnComplete');assert.equal(end.active,0);assertConserved(end);
 const nextTurn=act(end,{type:'endTurn'});assert.equal(nextTurn.active,1);assert.equal(nextTurn.phase,'action');assertConserved(nextTurn);
 const app=readFileSync('public/app.js','utf8');assert.match(app,/g\.phase==='action'&&state\.room\?\.seat===g\.active/);assert.match(app,/data-action="catchOverload:remove"/);
});

test('A saved returned overload is resumable without repeating the shuffle',()=>{
 const s=reachOverload(occupiedFixture()),serial=s.shuffleSerial;
 const restored=JSON.parse(JSON.stringify(s));assertConserved(restored);
 assert.equal(restored.pending.returned,true);
 const next=act(restored,{type:'catchOverload'});assertConserved(next);assert.equal(next.shuffleSerial,serial);
});
