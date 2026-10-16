import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {newGame,act,viewFor,assertConserved} from '../engine/game.js';

function fixture(expansions=['dreamcatchers'],color='blue'){
 const s=newGame({seed:8282,config:{expansions}});
 s.phase='decision';s.pending={type:'doorSearch',color};
 return s;
}
function move(s,match,zone){const i=s.deck.findIndex(match);assert(i>=0,'Expected fixture card in deck');return zone.push(...s.deck.splice(i,1)),zone.at(-1);}
function removeDeckColor(s,color){for(let i=s.deck.length-1;i>=0;i--)if(s.deck[i].kind==='door'&&s.deck[i].color===color)s.discard.push(...s.deck.splice(i,1));}
function chromatic(s){const rallied=s.moduleState.oniverse.zones.rallied;
 const i=s.deck.findIndex(c=>c.ability==='chromatic');assert(i>=0,'Fixture requires Chromatic Chaos');
 const [d]=s.deck.splice(i,1);d.owner=s.active;rallied.push(d);return d;
}
function interfaceFor(s){
 const code=readFileSync('public/app.js','utf8');const begin=code.indexOf('function searchableCatchers('),end=code.indexOf('function decision(g,canAct)',begin);
 const ctx=vm.createContext({COLOR:['red','blue','green','brown'],escape:x=>String(x),btn:(label,route)=>`<button data-action="${route}">${label}</button>`,card:c=>`<div class="card card-kind-${c.kind} card-oniverse-${c.color}"></div>`});
 vm.runInContext('let doorSearchIntent=null,doorSearchChromatic=false;'+code.slice(begin,end),ctx);
 const g=viewFor(s,s.active);ctx.fixture=g;
 return {ctx,render:()=>vm.runInContext('doorSearchDecision(fixture,fixture.pending)',ctx),setIntent:i=>{ctx.intentValue=i;vm.runInContext('doorSearchIntent=intentValue',ctx);},setChromatic:v=>{ctx.modeValue=v;vm.runInContext('doorSearchChromatic=modeValue',ctx);}};
}
function commands(html){return [...html.matchAll(/data-action="(doorSearch:[^"]+)"/g)].map(m=>m[1]);}

test('Base game offers exactly one colored search and Pass, even when its Door is exhausted',()=>{
 const s=fixture([]),ui=interfaceFor(s);assert.deepEqual(commands(ui.render()).map(x=>x.split(':')[1]),['choose','skip']);
 removeDeckColor(s,'blue');const exhausted=interfaceFor(s);assert.deepEqual(commands(exhausted.render()),['doorSearch:search:blue','doorSearch:skip']);
 const before=s.shuffleSerial||0,n=act(s,{type:'doorSearch',option:'search',doorColor:'blue'});assertConserved(n);assert.equal(n.shuffleSerial,before+1);
});
test('Oniverse presents colored and wild Door choices as distinct searches, even when the wild Door is absent',()=>{
 const s=fixture(['oniverse']),ui=interfaceFor(s);assert.deepEqual(commands(ui.render()).map(x=>x.split(':')[1]),['choose','choose','skip']);
 removeDeckColor(s,'wild');const absent=interfaceFor(s);assert(commands(absent.render()).includes('doorSearch:search:wild'));
 const n=act(s,{type:'doorSearch',option:'search',doorColor:'wild'});assertConserved(n);
});
test('Catcher and deck copies: only deck search and direct catch retrieval; never search then catch',()=>{
 const s=fixture(),held=move(s,c=>c.kind==='door'&&c.color==='blue',s.moduleState.dreamcatchers.zones.catch0),ui=interfaceFor(s);
 const actions=commands(ui.render());assert(actions.some(x=>x.startsWith('doorSearch:choose:')));assert(actions.includes(`doorSearch:direct:${held.id}`));
 assert(!actions.some(x=>x.startsWith('doorSearch:shuffle:')));
 assert.throws(()=>act(s,{type:'doorSearch',option:'claim',doorId:held.id,searchBeforeClaim:true}),/still in the deck/);
 assert.throws(()=>act(s,{type:'doorSearch',option:'claim',doorId:held.id,freeId:1}),/cannot trigger a freeing/);
 const n=act(s,{type:'doorSearch',option:'claim',doorId:held.id});assertConserved(n);assert(n.players[0].doors.some(x=>x.id===held.id));
});
test('Exhausted deck Door permits catcher direct or failed search, but cannot free the source catcher',()=>{
 const s=fixture(),a=move(s,c=>c.kind==='door'&&c.color==='blue',s.moduleState.dreamcatchers.zones.catch0),b=move(s,c=>c.kind==='nightmare',s.moduleState.dreamcatchers.zones.catch1);
 removeDeckColor(s,'blue');const ui=interfaceFor(s),cmds=commands(ui.render());
 assert(cmds.includes(`doorSearch:direct:${a.id}`));assert(cmds.includes(`doorSearch:shuffle:${a.id}`));assert(!cmds.some(x=>x.startsWith('doorSearch:choose:')));
 assert.throws(()=>act(s,{type:'doorSearch',option:'claim',doorId:a.id,searchBeforeClaim:true,freeId:0}),/Cannot free/);
 const serial=s.shuffleSerial||0,n=act(s,{type:'doorSearch',option:'claim',doorId:a.id,searchBeforeClaim:true,freeId:1});assertConserved(n);
 assert.equal(n.shuffleSerial,serial+1);assert(n.players[0].doors.some(x=>x.id===a.id));assert(n.deck.some(x=>x.id===b.id)||n.players[0].hand.some(x=>x.id===b.id));
 ui.setIntent({option:'claim',doorId:a.id,searchBeforeClaim:true,selected:null});assert.match(ui.render(),/Trigger a freeing\?/);
 ui.setIntent({option:'claim',doorId:a.id,searchBeforeClaim:true,selected:1});assert(commands(ui.render()).includes('doorSearch:free:1'));assert(!commands(ui.render()).includes('doorSearch:free:0'));
});
test('Deck search with no Door can free a different occupied catcher without claiming anything',()=>{
 const s=fixture(),b=move(s,c=>c.kind==='nightmare',s.moduleState.dreamcatchers.zones.catch0);
 removeDeckColor(s,'blue');const ui=interfaceFor(s);assert(commands(ui.render()).includes('doorSearch:search:blue'));
 const n=act(s,{type:'doorSearch',option:'search',doorColor:'blue',freeId:0});assertConserved(n);
 assert(!n.moduleState.dreamcatchers.zones.catch0.length);assert(n.deck.some(c=>c.id===b.id)||n.players[0].hand.some(c=>c.id===b.id));
});
test('Chromatic Chaos is isolated from normal choices, requires explicit activation, and is consumed only on a foreign Door',()=>{
 let s;for(let seed=1;seed<100;seed++){const candidate=newGame({seed,config:{expansions:['oniverse','dreamcatchers']}});if(candidate.deck.some(c=>c.ability==='chromatic')){s=candidate;break;}}
 assert(s);s.phase='decision';s.pending={type:'doorSearch',color:'blue'};const d=chromatic(s);assertConserved(s);
 const red=s.deck.find(c=>c.kind==='door'&&c.color==='red');assert(red);
 const ui=interfaceFor(s),normal=ui.render();assert(commands(normal).includes('doorSearch:chromatic'));assert(!commands(normal).some(x=>x.includes(red.id)));
 ui.setChromatic(true);const extra=ui.render();assert(commands(extra).includes(`doorSearch:choose:${red.id}:chromatic`));assert(!commands(extra).some(x=>x.includes('doorSearch:choose:')&&x.includes('blue')));assert(commands(extra).includes('doorSearch:normal'));
 assert.throws(()=>act(s,{type:'doorSearch',option:'claim',doorId:red.id}),/Chromatic Chaos/);
 const n=act(s,{type:'doorSearch',option:'claim',doorId:red.id,chromatic:true});assertConserved(n);assert(n.players[0].doors.some(c=>c.id===red.id));assert(n.discard.some(c=>c.id===d.id));
 const blue=s.deck.find(c=>c.kind==='door'&&c.color==='blue');assert.throws(()=>act(s,{type:'doorSearch',option:'claim',doorId:blue.id,chromatic:true}),/only for a different-color/);
});
test('Chromatic Chaos control remains available even with no foreign Door left, and offers only alternate colors',()=>{
 let s;for(let seed=1;seed<100;seed++){const candidate=newGame({seed,config:{expansions:['oniverse']}});if(candidate.deck.some(c=>c.ability==='chromatic')){s=candidate;break;}}
 assert(s);s.phase='decision';s.pending={type:'doorSearch',color:'blue'};chromatic(s);
 for(const color of ['red','green','brown'])removeDeckColor(s,color);
 const ui=interfaceFor(s);assert(commands(ui.render()).includes('doorSearch:chromatic'));
 ui.setChromatic(true);const alternate=commands(ui.render());
 for(const color of ['red','green','brown'])assert(alternate.includes(`doorSearch:search:${color}:chromatic`));
 assert(!alternate.some(x=>x.includes('doorSearch:choose:')||x.includes('doorSearch:search:blue')));
});
test('Chromatic Chaos only allows the failed-search path when the alternate Door is absent, spending the Denizen',()=>{
 let s;for(let seed=1;seed<100;seed++){const candidate=newGame({seed,config:{expansions:['oniverse']}});if(candidate.deck.some(c=>c.ability==='chromatic')){s=candidate;break;}}
 assert(s);s.phase='decision';s.pending={type:'doorSearch',color:'blue'};const d=chromatic(s);
 removeDeckColor(s,'red');assert.throws(()=>act(s,{type:'doorSearch',option:'search',doorColor:'red'}),/Chromatic Chaos/);
 const n=act(s,{type:'doorSearch',option:'search',doorColor:'red',chromatic:true});assertConserved(n);assert(n.discard.some(c=>c.id===d.id));
});
