import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {newGame,act,assertConserved,viewFor,legalActions} from '../engine/game.js';
import {validateConfig,normalizeSave,RULESET_VERSION} from '../engine/config.js';
import {enqueueEffects} from '../engine/effects.js';
import {hasAlignment} from '../engine/modules.js';
import * as guest from '../public/guest-data.js';
const make=(expansions=[],difficulties={},mode='solo',seed=212)=>newGame({mode,seed,config:{expansions,difficulties}});
function move(s,from,matcher,to){const a=from.findIndex(matcher);assert.ok(a>=0,'Expected card in source zone');const [c]=from.splice(a,1);to.push(c);return c;}
function mockUI(){const storage=new Map(),app={innerHTML:'',addEventListener(){}},document={documentElement:{dataset:{}},querySelector:x=>x==='#app'?app:null},localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};const location={origin:'http://localhost',hostname:'localhost',hash:'#/'};const ctx=vm.createContext({document,localStorage,location,addEventListener(){},navigator:{},confirm(){throw Error('Blocking confirm is not permitted')},prompt(){throw Error('Blocking prompt is not permitted')},console,...guest,firebase:{firebaseConfigured:()=>false}});vm.runInContext(readFileSync('public/app.js','utf8').replace(/^import .* from '\.\/guest-data\.js';\s*/,'').replace(/^import \* as firebase from '\.\/firebase-room\.js';\s*/m,''),ctx);return {ctx,app};}

test('Official difficult variants are accepted only when enabled; Incubus remains standalone',()=>{
 const cases=[['book','hard'],['dreamcatchers','hard'],['towers','hard'],['premonitions','hard'],['premonitions','extreme'],['crossroads','hard'],['mirrors','hard'],['incubus','easy'],['incubus','apprentice'],['incubus','true']];
 for(const [name,variant] of cases){const config=validateConfig({expansions:[name],difficulties:{[name]:variant}});assert.equal(config.difficulties[name],variant);assertConserved(make([name],{[name]:variant}));}
 for(const config of [{expansions:['incubus','glyphs']},{expansions:['towers'],difficulties:{book:'hard'}},{expansions:['book'],difficulties:{book:'extreme'}},{expansions:['mirrors'],difficulties:{mirrors:'extreme'}}])assert.throws(()=>validateConfig(config));
});

test('Phase 9 pending effects and stored resources migrate without losing cards',()=>{
 const s=make(['oniverse','mirrors','dreamcatchers']);s.rulesVersion='phase7-1';delete s.moduleState.mirrors.zones.queuedDoors;
 const migrated=normalizeSave(s);assert.equal(migrated.rulesVersion,RULESET_VERSION);assert.deepEqual(migrated.moduleState.mirrors.zones.queuedDoors,[]);assertConserved(migrated);
});

test('Search a caught Door while using the different-catcher freeing option; same catcher rejected',()=>{
 let s=make(['dreamcatchers']);const c0=s.moduleState.dreamcatchers.zones.catch0,c1=s.moduleState.dreamcatchers.zones.catch1;
 const stored=move(s,s.deck,c=>c.kind==='nightmare',c0),door=move(s,s.deck,c=>c.kind==='door'&&c.color==='blue',c1);
 s.phase='decision';s.pending={type:'doorSearch',color:'blue'};assertConserved(s);
 assert.throws(()=>act(s,{type:'doorSearch',option:'claim',doorId:door.id,freeId:1}),/Cannot free/);assertConserved(s);
 s=act(s,{type:'doorSearch',option:'claim',doorId:door.id,freeId:0});assertConserved(s);
 assert.equal(c0.length,1,'Original input remains unchanged');assert.equal(s.moduleState.dreamcatchers.zones.catch0.length,0);assert.equal(s.moduleState.dreamcatchers.zones.catch1.length,0);
 assert.ok(s.players[0].doors.some(c=>c.id===door.id));assert.ok(s.deck.some(c=>c.id===stored.id)||s.limbo.some(c=>c.id===stored.id)||s.players[0].hand.some(c=>c.id===stored.id));
});

test('Tower symbols compare any overlapping adjacent mark, including future verified dual-symbol edges',()=>{
 const four=['red','blue','green','brown'].map((color,i)=>({color,left:i?'moon':'sun',right:'sun'}));
 assert.equal(hasAlignment(four),true);assert.equal(hasAlignment(four.slice(1)),false);
 let s=make(['towers']);const tower=move(s,s.deck,c=>c.kind==='tower',s.moduleState.towers.zones.alignment);
 const second=move(s,s.deck,c=>c.kind==='tower'&&c.color!==tower.color,s.players[0].hand);
 second.left=['sun','moon']; // Artificial dual-symbol configuration to verify edge comparisons.
 const handId=second.id;assertConserved(s);
 if(tower.right==='sun'||tower.right==='moon')assert.throws(()=>act(s,{type:'playTower',id:handId,side:'right'}),/Tower edge symbols/);
});

test('Nightmare Tower false destruction retains Tower, sends the resolved Nightmare to Limbo',()=>{
 let s=make(['towers'],{towers:'hard'}),tower=move(s,s.deck,c=>c.kind==='tower',s.moduleState.towers.zones.alignment),nightmare=move(s,s.deck,c=>c.kind==='nightmare',[]);
 s.phase='decision';s.pending={type:'nightmare',card:nightmare};assertConserved(s);
 s=act(s,{type:'nightmare',option:'reveal'});assert.equal(s.pending?.type,'towerPenalty');assertConserved(s);
 s=act(s,{type:'towerPenalty',option:'fake'});assertConserved(s);assert.ok(s.limbo.some(c=>c.id===nightmare.id)||s.deck.some(c=>c.id===nightmare.id));assert.ok(s.moduleState.towers.zones.alignment.some(c=>c.id===tower.id));
});

test('Queued module decision can be resolved from a UI command, then resumes remaining effects',()=>{
 let s=make();enqueueEffects(s,[{type:'decision',id:'test-choice',actorId:0,options:['alpha','beta']},{type:'log',message:'Resumed'}]);
 assert.equal(s.pending?.type,'moduleDecision');assertConserved(s);
 s=act(s,{type:'moduleDecision',decisionId:'test-choice',choice:'beta'});assertConserved(s);assert.ok(s.log.includes('Resumed'));assert.equal(s.pending,null);
});

test('Book Goal acquisition uses physical Door color, not the active player search request',()=>{
 let s=make(['book']);let first=s.moduleState.book.goals[0];const other=['red','blue','green','brown'].find(c=>c!==first.color);
 const door=s.deck.find(c=>c.kind==='door'&&c.color===other);s.phase='decision';s.pending={type:'doorSearch',color:other};
 s=act(s,{type:'doorSearch',option:'claim',doorId:door.id});assertConserved(s);
 assert.ok(!s.players[0].doors.some(c=>c.id===door.id));assert.ok(s.limbo.some(c=>c.id===door.id)||s.deck.some(c=>c.id===door.id));assert.ok(!s.moduleState.book.goals.some(g=>g.done));
});

test('Cooperative hidden state masks partner hands and their effect decisions at all points',()=>{
 let s=make(['book','glyphs','dreamcatchers','towers','premonitions','crossroads','oniverse','mirrors','sphinx'],{},'coop');
 while(s.phase==='draft')s=act(s,{type:'draft',id:s.draft[0].id});
 for(const seat of [0,1]){const v=viewFor(s,seat);assert.equal(v.deck,undefined);assert.ok(v.players[1-seat].hand.every(c=>c.kind==='hidden'));assert.equal(v.moduleState,undefined);assert.equal(v.rng,undefined);assert.equal(v.expansion.premonitions.reserve,undefined);}
 s.pending={type:'happyFetch',options:s.deck.map(c=>({...c}))};s.phase='decision';const other=viewFor(s,1);assert.equal(other.pending.type,'private-decision');assert.ok(!JSON.stringify(other).includes(s.deck[0]?.id||'not-in-deck'));
});

test('All currently modeled pending decision types render an actionable dialog; private decision is masked',()=>{
 const u=mockUI();const s=make(['book','glyphs','dreamcatchers','towers','premonitions','crossroads','oniverse','mirrors','sphinx']);const v=viewFor(s,0),sample=s.players[0].hand[0];
 const types=['doorSearch','door','nightmare','prophecy','incantation','towerLook','towerPenalty','catchChoose','catchOverload','spellPeek','moduleDecision','happyDream','happyPeek','happyFetch','rally','premonitionPick','premonitionDoor','denizenPeek','sphinxName','sphinxResolve','diver','confusion','mirrorReward'];
 for(const type of types){const g=structuredClone(v);g.phase='decision';g.pending={type,id:'test-choice',options:type==='moduleDecision'?['alpha','beta']:[],cards:[sample],card:sample,keys:[{id:sample.id,zone:'personal'}],choices:[0],mirror:'red',aspect:'moon',targets:[],color:'blue'};
  if(type==='doorSearch')g.pending.targets=[{id:'d1',source:'deck'}];
  if(type==='happyFetch')g.pending.options=[sample];
  if(type==='premonitionDoor')g.pending.choices=[{id:'d1',color:'blue',owner:0}];
  if(type==='premonitionPick')g.pending.options=['doors3'];
  if(type==='rally')g.pending.choices=[sample.id];
  if(type==='nightmare')g.pending.card={kind:'nightmare',id:'n'};
  const output=vm.runInContext('decision(g,true)',Object.assign(u.ctx,{g}));assert.match(output,/class="decision/,type);assert.match(output,/data-action/,type);
 }
 const hidden=vm.runInContext('decision(g,false)',Object.assign(u.ctx,{g:{phase:'decision',pending:{type:'nightmare'}}}));assert.match(hidden,/partner is resolving/i);
});

test('Mirror pair, Cyclobot, Confusion and cooperative swap have inline UI controls, not blocking prompts',()=>{
 const source=readFileSync('public/app.js','utf8');
 assert.match(source,/data-mirror-pair/);assert.match(source,/mirrorConfirm/);assert.match(source,/cyclobotSwap:/);assert.match(source,/swapPersonal/);assert.match(source,/swapShared/);assert.match(source,/discardConfirm/);assert.match(source,/Confusion — reorder your hand/);
 assert.doesNotMatch(source,/prompt\(/,'all prompt-based gameplay actions should be replaced');
});

test('Invalid forced actions do not mutate the input, even for restrictive difficulty variants',()=>{
 const s=make(['crossroads','towers','mirrors'],{crossroads:'hard',towers:'hard',mirrors:'hard'}),original=JSON.stringify(s);
 assert.throws(()=>act(s,{type:'mirrorPair',mirror:'red',ids:['bogus','fake']}));assert.throws(()=>act(s,{type:'playTower',id:'bogus',side:'left'}));
 assert.throws(()=>act(s,{type:'doorSearch',option:'claim'}));assert.equal(JSON.stringify(s),original);assertConserved(s);
});

test('Powerful Punishment cannot use an anticipatory penalty without an actual Nightmare card',()=>{
 let s=make(['book']);for(let i=0;i<10;i++)move(s,s.deck,c=>c.kind==='location',s.discard);
 const before=JSON.stringify(s);s.phase='decision';s.pending={type:'nightmare',card:null,incubus:true};const previous=JSON.stringify(s);
 const ids=s.discard.slice(0,10).map(c=>c.id);assert.throws(()=>act(s,{type:'cast',spell:'punishment',costIds:ids}),/Incubus anticipation/);
 assert.equal(JSON.stringify(s),previous);assertConserved(s);
});

test('UI and engine use matching multi-symbol Tower removal restrictions',()=>{
 const source=readFileSync('public/app.js','utf8');assert.match(source,/function towerEdgeConflict\(/);assert.match(source,/!towerEdgeConflict\(a\[i-1\]\.right,a\[i\+1\]\.left\)/);
});

test('The server blocks an illegal catcher free and the UI gives a matching explanation',()=>{
 const source=readFileSync('public/app.js','utf8');assert.match(source,/You cannot free the same Dreamcatcher holding the selected Door/);
 const s=make(['dreamcatchers']);const d=move(s,s.deck,c=>c.kind==='door',s.moduleState.dreamcatchers.zones.catch0);
 s.pending={type:'doorSearch',color:d.color};s.phase='decision';assertConserved(s);
 assert.throws(()=>act(s,{type:'doorSearch',option:'claim',doorId:d.id,freeId:0}),/Cannot free/);
});
