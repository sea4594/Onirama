import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,act,assertConserved,viewFor,legalActions} from '../engine/game.js';
import {createDeck,expectedCards} from '../engine/cards.js';
import {hasAlignment} from '../engine/modules.js';
const mk=(expansions=[],seed=4,mode='solo',difficulties={})=>newGame({mode,seed,config:{expansions,difficulties}});
const a=(s,c)=>{const result=act(s,c);assertConserved(result);return result;};
function choose(s){const p=s.pending;if(s.phase==='draft')return {type:'draft',id:s.draft[0].id};
 if(s.phase==='decision'){
  if(p.type==='doorSearch'){const target=s.deck.find(x=>x.kind==='door'&&x.color===p.color);return {type:'doorSearch',option:target?'claim':'skip',doorId:target?.id};}
  if(p.type==='door')return {type:'chooseDoor',keyId:'limbo'};
  if(p.type==='nightmare')return {type:'nightmare',option:'reveal'};
  if(p.type==='towerPenalty')return {type:'towerPenalty',option:'fake'};
  if(p.type==='prophecy')return {type:'prophecy',discardId:p.cards[0].id,order:p.cards.slice(1).map(x=>x.id)};
  if(p.type==='incantation'){const door=p.cards.find(c=>c.kind==='door');return {type:'incantation',doorId:door?.id,order:p.cards.filter(c=>c!==door).map(x=>x.id)};}
  if(p.type==='towerLook')return {type:'towerLook',order:p.cards.map(x=>x.id)};
  if(p.type==='catchChoose')return {type:'catchChoose',index:p.choices[0]};
  if(p.type==='catchOverload')return {type:'catchOverload',index:p.choices[0]};
  if(p.type==='spellPeek')return {type:'spellPeek',topId:p.cards[0].id,bottomOrder:p.cards.slice(1).map(x=>x.id)};
  throw Error('Uncovered pending '+p.type);
 }
 const player=s.players[s.active],c=[...player.hand,...(s.mode==='coop'?s.shared:[])][0];return {type:'discard',id:c.id};
}
test('exact expansion deck counts; all combinations and variants initialize without missing/duplicate cards',()=>{
 for(let mask=0;mask<16;mask++){const expansions=['book','glyphs','dreamcatchers','towers'].filter((_,i)=>mask&(1<<i));const deck=createDeck(expansions);assert.equal(deck.length,expectedCards(expansions));assert.equal(new Set(deck.map(c=>c.id)).size,deck.length);for(const mode of ['solo','coop']){const s=mk(expansions,92,mode);assertConserved(s);if(expansions.includes('glyphs'))assert.equal(s.deck.filter(c=>c.symbol==='glyph').length+s.players.flatMap(p=>p.hand).filter(c=>c.symbol==='glyph').length+s.draft.filter(c=>c.symbol==='glyph').length,8);}}
});
test('Book spells: goal order, Door loss reopens goal, hard costs, permanent payment and bottom manipulation',()=>{
 let s=mk(['book']);assert.equal(s.moduleState.book.goals.length,8);const color=s.moduleState.book.goals[0].color;
 let target=s.players[0].hand[0];s.players[0].streak=2;s.players[0].streakColor=target.color;
 s=a(s,{type:'play',id:target.id});if(s.pending?.type==='doorSearch'){const d=s.deck.find(c=>c.kind==='door'&&c.color===target.color);s=a(s,{type:'doorSearch',option:'claim',doorId:d.id});assert.equal(s.players[0].doors.length,target.color===color?1:0);}
 // Direct acquisition case where first Goal matches the played color.
 s=mk(['book']);const first=s.moduleState.book.goals[0].color;const location=s.players[0].hand.find(c=>c.color===first)||s.players[0].hand[0];s.moduleState.book.goals[0].color=location.color;s.players[0].streakColor=location.color;s.players[0].streak=2;
 s=a(s,{type:'play',id:location.id});if(s.pending?.type==='doorSearch'){s=a(s,{type:'doorSearch',option:'claim'});assert.equal(s.moduleState.book.goals[0].done,true);const d=s.players[0].doors[0];while(s.phase==='decision')s=a(s,choose(s));const n=s.deck.splice(s.deck.findIndex(c=>c.kind==='nightmare'),1)[0];s.pending={type:'nightmare',card:n};s.phase='decision';s=a(s,{type:'nightmare',option:'door',cardId:d.id});assert.equal(s.moduleState.book.goals[0].done,false);}
 s=mk(['book']);s.discard.push(...s.deck.splice(0,12));const pay=s.discard.slice(0,7).map(c=>c.id);s=a(s,{type:'cast',spell:'parallel',costIds:pay,first:0,second:1});assert.equal(s.moduleState.book.zones.removed.length,7);
 s.discard.push(...s.deck.splice(0,5));const before=s.deck.length;const ids=s.discard.slice(0,5).map(c=>c.id);s=a(s,{type:'cast',spell:'paradox',costIds:ids});assert.equal(s.pending.type,'spellPeek');assert.equal(s.deck.length,before-5);s=a(s,{type:'spellPeek',topId:s.pending.cards[0].id,bottomOrder:s.pending.cards.slice(1).map(c=>c.id)});assert.equal(s.phase,'action');assertConserved(s);
 const hard=mk(['book'],5,'solo',{book:'hard'});hard.discard.push(...hard.deck.splice(0,8));assert.throws(()=>act(hard,{type:'cast',spell:'parallel',first:0,second:1,costIds:hard.discard.slice(0,7).map(x=>x.id)}),/required number/);
});
test('Glyph discarded reveals five; claim one matching Goal or any Door; exact bottom ordering',()=>{
 let s=mk(['glyphs'],15),g=s.deck.find(c=>c.symbol==='glyph');const old=s.players[0].hand[0];s.players[0].hand[0]=g;s.deck[s.deck.indexOf(g)]=old;
 const door=s.deck.find(c=>c.kind==='door');s.deck.splice(s.deck.indexOf(door),1);s.deck.push(door);
 s=a(s,{type:'discard',id:g.id});assert.equal(s.pending.type,'incantation');const candidate=s.pending.cards.find(c=>c.id===door.id);assert.ok(candidate);
 assert.throws(()=>act(s,{type:'incantation',doorId:'not-present',order:s.pending.cards.map(c=>c.id)}));
 const ids=s.pending.cards.filter(c=>c.id!==candidate.id).map(x=>x.id);s=a(s,{type:'incantation',doorId:candidate.id,order:ids});assert.ok(s.players[0].doors.some(c=>c.id===candidate.id));
});
test('Dreamcatchers: group catches, free with Failsafe, overload discards only chosen stack',()=>{
 let s=mk(['dreamcatchers']);s.limbo.push(...s.deck.splice(0,2));const first=s.limbo.map(c=>c.id);
 s=a(s,{type:'discard',id:s.players[0].hand[0].id});while(s.phase==='decision'&&s.pending.type!=='catchChoose')s=a(s,choose(s));assert.equal(s.pending.type,'catchChoose');s=a(s,{type:'catchChoose',index:0});assert.deepEqual(s.moduleState.dreamcatchers.zones.catch0.map(c=>c.id),first); // additional limbo possible
 const old=s.moduleState.dreamcatchers.failsafes;s=a(s,{type:'freeCatcher',index:0});assert.equal(s.moduleState.dreamcatchers.failsafes,old-1);assert.equal(s.moduleState.dreamcatchers.zones.catch0.length,0);
 // Force all four occupied and the next Limbo group; overload one stack only.
 s=mk(['dreamcatchers']);for(let i=0;i<4;i++){s.moduleState.dreamcatchers.zones['catch'+i].push(s.deck.pop());}
 const keep=s.moduleState.dreamcatchers.zones.catch1[0].id;s.limbo.push(s.deck.pop());
 s=a(s,{type:'discard',id:s.players[0].hand[0].id});while(s.pending?.type==='nightmare'||s.pending?.type==='door'||s.pending?.type==='prophecy')s=a(s,choose(s));
 assert.equal(s.pending.type,'catchOverload');s=a(s,{type:'catchOverload',index:0});assert.equal(s.moduleState.dreamcatchers.active[0],false);assert.equal(s.moduleState.dreamcatchers.zones.catch1[0].id,keep);
});
test('Towers: one shared alignment, adjacency, discard insight, Nightmare consequence',()=>{
 let s=mk(['towers']);const t=s.deck.find(c=>c.kind==='tower');[s.players[0].hand[0],s.deck[s.deck.indexOf(t)]]=[t,s.players[0].hand[0]];
 s=a(s,{type:'playTower',id:t.id,side:'right'});assert.equal(s.moduleState.towers.zones.alignment.length,1);
 s=mk(['towers']);const card=s.deck.find(c=>c.kind==='tower');[s.players[0].hand[0],s.deck[s.deck.indexOf(card)]]=[card,s.players[0].hand[0]];
 s=a(s,{type:'discard',id:card.id});assert.equal(s.pending.type,'towerLook');assert.equal(s.pending.cards.length,card.number);s=a(s,{type:'towerLook',order:s.pending.cards.map(x=>x.id)});
 s=mk(['towers']);const x=s.deck.find(c=>c.kind==='tower');s.moduleState.towers.zones.alignment.push(s.deck.splice(s.deck.indexOf(x),1)[0]);const night=s.deck.find(c=>c.kind==='nightmare');s.deck.splice(s.deck.indexOf(night),1);s.pending={type:'nightmare',card:night};s.phase='decision';s=a(s,{type:'nightmare',option:'reveal'});assert.equal(s.pending.type,'towerPenalty');s=a(s,{type:'towerPenalty',option:'discard',towerId:x.id});assert.equal(s.moduleState.towers.zones.alignment.length,0);
 assert.ok(hasAlignment([{color:'red'},{color:'blue'},{color:'green'},{color:'brown'}]));assert.equal(hasAlignment([{color:'red'},{color:'blue'},{color:'blue'},{color:'green'},{color:'brown'}]),false);
});
test('all 16 Phase 4 combinations survive seeded solo and coop play with conservation',()=>{
 for(let mask=0;mask<16;mask++)for(const mode of ['solo','coop'])for(let seed=1;seed<=12;seed++){
   const expansions=['book','glyphs','dreamcatchers','towers'].filter((_,i)=>mask&(1<<i));let s=mk(expansions,seed,mode),steps=0;
   while(s.status==='active'&&steps++<650){const cmd=choose(s);assert.ok(legalActions(s).length,`Missing legal action ${s.phase}`);s=a(s,cmd);}
   assert.ok(s.status!=='active',`Stuck: ${mode} mask=${mask} seed=${seed} phase=${s.phase}`);
 }
});
test('view filtering does not expose hidden hands or internal expansion removed-card identities',()=>{
 let s=mk(['book','glyphs','dreamcatchers','towers'],30,'coop');for(let i=0;i<6;i++)s=a(s,{type:'draft',id:s.draft[0].id});const v=viewFor(s,1);assert.equal(v.deck,undefined);assert.equal(v.moduleState,undefined);assert.ok(v.players[0].hand.every(c=>c.kind==='hidden'));assert.equal(v.expansion.book.goals.length,12);
});

test('Book Powerful Punishment cancels a Nightmare without a Tower penalty, including hard cost',()=>{
 for(const difficulty of ['normal','hard']){
  let s=mk(['book','towers'],4,'solo',{book:difficulty});const amount=difficulty==='hard'?12:10;
  s.discard.push(...s.deck.splice(0,amount));const costIds=s.discard.map(c=>c.id);
  const tower=s.deck.find(c=>c.kind==='tower');s.moduleState.towers.zones.alignment.push(s.deck.splice(s.deck.indexOf(tower),1)[0]);
  const nightmare=s.deck.find(c=>c.kind==='nightmare');s.deck.splice(s.deck.indexOf(nightmare),1);
  s.pending={type:'nightmare',card:nightmare};s.phase='decision';
  assert.ok(legalActions(s).find(a=>a.type==='cast')?.spells.includes('punishment'));
  s=a(s,{type:'cast',spell:'punishment',costIds});
  assert.equal(s.moduleState.book.zones.removed.length,amount);
  assert.ok(s.discard.some(c=>c.id===nightmare.id));
  assert.equal(s.moduleState.towers.zones.alignment.length,1);
  assert.notEqual(s.pending?.type,'towerPenalty');
 }
});
test('tower edges only conflict if BOTH adjacent sides bear the same symbol',()=>{
 const s0=mk(['towers']);const towerCard=s0.deck.find(c=>c.kind==='tower');
 // A blank edge is not equal to a printed edge and cannot conflict.
 towerCard.left=null;towerCard.right='sun';
 const s=structuredClone(s0);s.moduleState.towers.zones.alignment.push(s.deck.splice(s.deck.indexOf(towerCard),1)[0]);
 const t=s.deck.find(c=>c.kind==='tower'&&c.id!==towerCard.id);t.left=null;t.right=null;
 const old=s.players[0].hand[0];s.players[0].hand[0]=t;s.deck[s.deck.indexOf(t)]=old;
 const next=a(s,{type:'playTower',id:t.id,side:'right'});assert.equal(next.moduleState.towers.zones.alignment.length,2);
});
test('coop expansion views keep Goals, Tower Alignment and catcher stacks public without leaking secrets',()=>{
 let s=mk(['book','glyphs','dreamcatchers','towers'],44,'coop');for(let i=0;i<6;i++)s=a(s,{type:'draft',id:s.draft[0].id});
 const v0=viewFor(s,0),v1=viewFor(s,1);for(const v of [v0,v1]){
  assert.equal(v.expansion.book.goals.length,12);assert.equal(v.expansion.towers.alignment.length,0);
  assert.equal(v.expansion.dreamcatchers.stacks.length,4);assert.equal(v.moduleState,undefined);
  assert.equal(v.deck,undefined);assert.equal(v.rng,undefined);
 }
 assert.ok(v0.players[1].hand.every(c=>c.kind==='hidden'));
 assert.ok(v1.players[0].hand.every(c=>c.kind==='hidden'));
});
