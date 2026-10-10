import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,act,viewFor,assertConserved,legalActions} from '../engine/game.js';
import {normalizeSave,RULESET_VERSION} from '../engine/config.js';
import {soloLegalTargets,cooperativeLegalTargets} from '../public/tabletop/interactions.js';
import {cardDescription,renderCard} from '../public/tabletop/cards.js';
const game=(expansions,seed=515,difficulties={},mode='solo')=>newGame({seed,config:{expansions,difficulties},mode});
function take(s,predicate,from=s.deck){const i=from.findIndex(predicate);assert.ok(i>=0,'Missing expected card');return from.splice(i,1)[0];}
function inHand(s,predicate){const p=s.players[s.active];let c=p.hand.find(predicate);if(c)return c;c=take(s,predicate);s.deck.push(p.hand.splice(0,1,c)[0]);return c;}
function startMirror(s,name){const stack=s.moduleState.mirrors.zones[name],match=c=>c.kind==='location'&&(c.color===name||c.symbol===name);stack.push(take(s,match),take(s,match));const p=s.players[0];for(let i=0;i<2;i++)if(!match(p.hand[i])){const wanted=take(s,match);s.deck.push(p.hand.splice(i,1,wanted)[0]);}return p.hand.slice(0,2).map(c=>c.id);}
test('Overload releases all four Dreamcatcher stacks, but sacrifices only the chosen catcher',()=>{
 let s=game(['dreamcatchers']);const stacks=s.moduleState.dreamcatchers.zones;
 for(let i=0;i<4;i++)stacks['catch'+i].push(take(s,c=>c.kind==='location'));
 const released=Object.values(stacks).flat().map(c=>c.id);s.limbo.push(take(s,c=>c.kind==='lostDream'));
 s.pending={type:'catchOverload',choices:[0,1,2,3]};s.phase='decision';assertConserved(s);
 s=act(s,{type:'catchOverload',index:2});assertConserved(s);
 assert.deepEqual(s.moduleState.dreamcatchers.active,[true,true,false,true]);assert.ok(Object.values(stacks).length===4);
 assert.ok(Object.values(s.moduleState.dreamcatchers.zones).every(a=>!a.length));
 assert.ok(released.every(id=>s.deck.some(c=>c.id===id)));
});
test('Blue Mirror cannot recover its four played cards before resolving reward; save survives round trip',()=>{
 let s=game(['mirrors']);const ids=startMirror(s,'blue');const allIds=[...s.moduleState.mirrors.zones.blue.map(c=>c.id),...ids];
 s=act(s,{type:'mirrorPair',mirror:'blue',ids});assertConserved(s);
 assert.equal(s.pending.type,'mirrorReward');assert.equal(s.moduleState.mirrors.resolving,'blue');
 assert.ok(allIds.every(id=>s.moduleState.mirrors.zones.blue.some(c=>c.id===id)));
 assert.ok(allIds.every(id=>!s.pending.options.some(c=>c.id===id)));
 assert.ok(allIds.every(id=>!s.discard.some(c=>c.id===id)));
 s=structuredClone(normalizeSave(JSON.parse(JSON.stringify(s))));assertConserved(s);
 const picks=s.pending.options.slice(0,Math.min(2,s.pending.options.length)).map(c=>c.id);
 s=act(s,{type:'mirrorReward',ids:picks});assertConserved(s);
 assert.ok(allIds.every(id=>s.discard.some(c=>c.id===id)));assert.equal(s.moduleState.mirrors.resolving,null);
});
test('Key Mirror keeps its Locations until deferred acquisition and Premonitions finish',()=>{
 let s=game(['mirrors','premonitions']);const ids=startMirror(s,'key'),four=[...s.moduleState.mirrors.zones.key.map(c=>c.id),...ids];
 const first=take(s,c=>c.kind==='door'&&c.color==='blue');s.players[0].doors.push(first);
 const second=take(s,c=>c.kind==='door'&&c.color==='green');s.players[0].doors.push(second);
 s.moduleState.premonitions.faceUp=['doors3'];s.moduleState.premonitions.reserve=[];
 s=act(s,{type:'mirrorPair',mirror:'key',ids});assertConserved(s);
 const red=s.pending.options.filter(c=>c.kind==='door'&&c.color==='red').slice(0,2).map(c=>c.id);assert.equal(red.length,2);
 s=act(s,{type:'mirrorReward',ids:red,color:'red'});assertConserved(s);
 assert.equal(s.pending.type,'premonitionPick');assert.equal(s.moduleState.mirrors.zones.key.length,4);
 s=act(s,{type:'premonitionPick',id:'doors3'});assertConserved(s);
 assert.ok(four.every(id=>s.discard.some(c=>c.id===id)));
 assert.equal(s.moduleState.mirrors.resolving,null);
});
test('Hard Crossroads cannot be first or third; legal action and both UIs agree',()=>{
 let s=game(['crossroads'],66,{crossroads:'hard'}),p=s.players[0];const wild=inHand(s,c=>c.kind==='location'&&c.color==='wild');
 assert.ok(!legalActions(s).some(a=>a.type==='play'&&a.id===wild.id));assert.ok(!soloLegalTargets(viewFor(s,0),wild.id).includes('play'));
 assert.throws(()=>act(s,{type:'play',id:wild.id}),/only second/);assertConserved(s);
 const first=take(s,c=>c.kind==='location'&&c.color==='blue'&&c.symbol!==wild.symbol);p.labyrinth.push(first);p.series=[{id:first.id,color:first.color}];
 assert.ok(legalActions(s).some(a=>a.type==='play'&&a.id===wild.id));assert.ok(soloLegalTargets(viewFor(s,0),wild.id).includes('play'));
 const next=act(s,{type:'play',id:wild.id});assertConserved(next);assert.ok(next.players[0].labyrinth.some(c=>c.id===wild.id));
 let t=game(['crossroads'],67,{crossroads:'hard'}),q=t.players[0],another=inHand(t,c=>c.kind==='location'&&c.color==='wild');
 for(const sym of ['sun','moon'])q.labyrinth.push(take(t,c=>c.kind==='location'&&c.color==='red'&&c.symbol===sym));
 q.series=q.labyrinth.map(c=>({id:c.id,color:c.color}));
 assert.ok(!legalActions(t).some(a=>a.type==='play'&&a.id===another.id));assert.throws(()=>act(t,{type:'play',id:another.id}),/only second/);
});
test('Incantation cannot pass a revealed Door, but may pass when none appears',()=>{
 let s=game(['glyphs']);const door=take(s,c=>c.kind==='door');s.pending={type:'incantation',cards:[door,...Array.from({length:4},()=>take(s,c=>c.kind==='location'))]};s.phase='decision';assertConserved(s);
 const order=s.pending.cards.slice(1).map(c=>c.id);assert.throws(()=>act(s,{type:'incantation',doorId:null,order:s.pending.cards.map(c=>c.id)}),/passing is allowed only/);
 s=act(s,{type:'incantation',doorId:door.id,order});assertConserved(s);assert.ok(s.players[0].doors.some(c=>c.id===door.id));
 let t=game(['glyphs'],508);t.pending={type:'incantation',cards:Array.from({length:3},()=>take(t,c=>c.kind==='location'))};t.phase='decision';
 t=act(t,{type:'incantation',doorId:null,order:t.pending.cards.map(c=>c.id)});assertConserved(t);
});
test('Sphinx recognizes a Crossroad as every named color',()=>{
 let s=game(['sphinx','crossroads']);const sphinx=take(s,c=>c.kind==='sphinx'),wild=take(s,c=>c.kind==='location'&&c.color==='wild');
 const cards=[wild,...Array.from({length:4},()=>take(s,c=>c.kind==='location'&&c.color==='blue'))];s.pending={type:'sphinxResolve',card:sphinx,cards,aspect:'red'};s.phase='decision';assertConserved(s);
 s=act(s,{type:'sphinxResolve',topId:wild.id,order:cards.map(c=>c.id)});assertConserved(s);
 assert.equal(s.deck.at(-1)?.id,wild.id);assert.ok(s.discard.some(c=>c.id===sphinx.id));
});
test('No-target Door search can still reshuffle and free a Dreamcatcher',()=>{
 let s=game(['dreamcatchers']);const target=take(s,c=>c.kind==='location');s.moduleState.dreamcatchers.zones.catch0.push(target);
 const held=take(s,c=>c.kind==='door'&&c.color==='red');s.discard.push(held);
 for(const d of [...s.deck].filter(c=>c.kind==='door'&&c.color==='red'))s.discard.push(take(s,c=>c.id===d.id));
 s.pending={type:'doorSearch',color:'red'};s.phase='decision';assertConserved(s);
 assert.deepEqual(viewFor(s,0).pending.targets,[]);
 const skipped=act(s,{type:'doorSearch',option:'skip'});assert.ok(skipped.moduleState.dreamcatchers.zones.catch0.length);
 const searched=act(s,{type:'doorSearch',option:'search',freeId:0});assertConserved(searched);
 assert.equal(searched.moduleState.dreamcatchers.zones.catch0.length,0);assert.ok(searched.deck.some(c=>c.id===target.id));
});
test('A real third red Location offers an optional search even after every red Door has left the deck',()=>{
 let s=game(['dreamcatchers'],902),p=s.players[0];
 const redKey=inHand(s,c=>c.kind==='location'&&c.color==='red'&&c.symbol==='key');
 const sun=take(s,c=>c.kind==='location'&&c.color==='red'&&c.symbol==='sun');
 const moon=take(s,c=>c.kind==='location'&&c.color==='red'&&c.symbol==='moon');
 p.labyrinth.push(sun,moon);p.series=[sun,moon].map(c=>({id:c.id,color:c.color}));
 for(const d of [...s.deck].filter(c=>c.kind==='door'&&c.color==='red'))s.discard.push(take(s,c=>c.id===d.id));
 assertConserved(s);s=act(s,{type:'play',id:redKey.id});assertConserved(s);
 assert.equal(s.pending?.type,'doorSearch');assert.deepEqual(viewFor(s,0).pending.targets,[]);
 s=act(s,{type:'doorSearch',option:'search'});assertConserved(s);
});
test('Caught Door remains selectable alongside deck copy and can be claimed directly or after Freeing',()=>{
 let s=game(['dreamcatchers']);const caught=take(s,c=>c.kind==='door'&&c.color==='blue');s.moduleState.dreamcatchers.zones.catch0.push(caught);
 const extra=take(s,c=>c.kind==='location');s.moduleState.dreamcatchers.zones.catch1.push(extra);
 s.pending={type:'doorSearch',color:'blue'};s.phase='decision';assertConserved(s);
 const view=viewFor(s,0);assert.ok(view.pending.targets.some(t=>t.source==='deck'));
 assert.ok(view.pending.targets.some(t=>t.source==='catch0'));
 let claimed=act(s,{type:'doorSearch',option:'claim',doorId:caught.id});assertConserved(claimed);
 assert.ok(claimed.players[0].doors.some(c=>c.id===caught.id));assert.equal(claimed.moduleState.dreamcatchers.zones.catch1.length,1);
 claimed=act(s,{type:'doorSearch',option:'claim',doorId:caught.id,freeId:1});assertConserved(claimed);
 assert.equal(claimed.moduleState.dreamcatchers.zones.catch1.length,0);
 assert.ok(claimed.players[0].doors.some(c=>c.id===caught.id));
});
test('Glyph Doors are mechanically and visually indistinguishable from base Doors of the same color',()=>{
 const s=game(['glyphs']);const d=s.deck.filter(c=>c.kind==='door'&&c.color==='red');assert.equal(d.length,3);
 assert.ok(d.every(c=>c.expansion===undefined));assert.ok(d.every(c=>cardDescription(c)==='red Door'));
 assert.ok(d.every(c=>!renderCard(c).includes('glyphs')));
 const legacy={...d[0],expansion:'glyphs'};assert.equal(cardDescription(legacy),cardDescription(d[1]));
 assert.ok(!renderCard(legacy).includes('glyphs'));
});
test('Earlier v0.21 saves keep in-progress Mirror decisions and gain the current rules tag',()=>{
 const s=game(['mirrors']);s.rulesVersion='phase10-audit1';s.moduleState.mirrors.zones.red=[];
 const n=normalizeSave(s);assert.equal(n.rulesVersion,RULESET_VERSION);assert.equal(n.moduleState.mirrors.resolving,null);assertConserved(n);
});
test('UI exposes the no-target search option and both caught Door sources',()=>{
 const ui=readFileSync('public/app.js','utf8');assert.match(ui,/choices\.map\(t=>btn/);
 assert.match(ui,/doorSearch:search/);assert.doesNotMatch(ui,/!deck\?catchers\.map/);
});
