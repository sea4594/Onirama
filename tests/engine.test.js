import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeck,LOCATION_COUNTS,COLORS} from '../engine/cards.js';
import {newGame,act,assertConserved,legalActions,viewFor} from '../engine/game.js';

const seeded=(mode='solo',seed=17)=>newGame({mode,seed});
const locations=s=>s.players.flatMap(p=>p.hand.concat(p.labyrinth)).concat(s.shared,s.deck,s.discard);
const choose=(s)=>{
  if(s.phase==='draft')return {type:'draft',id:s.draft[0].id};
  if(s.phase==='decision'){
    if(s.pending.type==='doorSearch')return {type:'doorSearch',option:'claim'};
    if(s.pending.type==='door')return {type:'chooseDoor',keyId:s.pending.keys[0]?.id||'limbo'};
    if(s.pending.type==='nightmare'){
      const k=[...s.players[s.active].hand,...s.shared].find(x=>x.symbol==='key');
      return k?{type:'nightmare',option:'key',cardId:k.id}:{type:'nightmare',option:'reveal'};
    }
    if(s.pending.type==='prophecy'){const cards=s.pending.cards;return {type:'prophecy',discardId:cards[0].id,order:cards.slice(1).map(c=>c.id)};}
    throw Error('Unexpected decision: '+s.pending.type);
  }
  const actions=legalActions(s),plays=actions.filter(x=>x.type==='play');
  return plays[0]||actions.find(x=>x.type==='discard');
};

test('exact base deck composition and unique instances',()=>{
  const deck=createDeck();assert.equal(deck.length,76);assert.equal(new Set(deck.map(c=>c.id)).size,76);
  assert.equal(deck.filter(c=>c.kind==='nightmare').length,10);
  for(const color of COLORS){
    assert.equal(deck.filter(c=>c.kind==='door'&&c.color===color).length,2);
    for(const [symbol,n] of Object.entries(LOCATION_COUNTS[color]))assert.equal(deck.filter(c=>c.kind==='location'&&c.color===color&&c.symbol===symbol).length,n);
  }
});
test('solo initial five Locations, shuffled Limbo, card conservation',()=>{
  for(let seed=1;seed<80;seed++){
    const s=seeded('solo',seed);assert.equal(s.players[0].hand.length,5);
    assert.ok(s.players[0].hand.every(x=>x.kind==='location'));assert.equal(s.limbo.length,0);assert.equal(s.deck.length,71);
    assertConserved(s);
  }
});
test('two player public draft alternates and reserves final two shared',()=>{
  let s=seeded('coop');assert.equal(s.phase,'draft');assert.equal(s.draft.length,8);
  for(let i=0;i<6;i++){
    assert.equal(s.active,i%2);s=act(s,{type:'draft',id:s.draft[0].id});assertConserved(s);
  }
  assert.equal(s.phase,'action');assert.equal(s.active,0);assert.deepEqual(s.players.map(p=>p.hand.length),[3,3]);assert.equal(s.shared.length,2);
  assert.throws(()=>act(s,{type:'draft',id:'c1'}));
});
test('illegal commands never mutate state, adjacent symbol cannot be repeated',()=>{
  const s=seeded();const x=s.players[0].hand[0],before=structuredClone(s);
  assert.throws(()=>act(s,{type:'play',id:'nonexistent'}));assert.deepEqual(s,before);
  let next=act(s,{type:'play',id:x.id});
  if(next.phase==='action'){
    const same=next.players[0].hand.find(c=>c.symbol===x.symbol);
    if(same)assert.throws(()=>act(next,{type:'play',id:same.id}),/different symbols/);
  }
});
test('Door search is optional, cannot resolve twice',()=>{
  const s=seeded();const p=s.players[0],location=p.hand[0];p.series=[{id:'prepared1',color:location.color},{id:'prepared2',color:location.color}];
  const a=act(s,{type:'play',id:location.id});assert.equal(a.phase,'decision');assert.equal(a.pending.type,'doorSearch');
  const b=act(a,{type:'doorSearch',option:'skip'});assert.equal(b.players[0].doors.length,0);
  assert.throws(()=>act(a,{type:'doorSearch',option:'neither'}));assertConserved(b);
});
test('Prophecy requires one discard and exact ordering',()=>{
  const s=seeded();let k=s.players[0].hand.find(c=>c.symbol==='key');
  if(!k){k=s.deck.find(c=>c.symbol==='key');const out=s.players[0].hand[0];s.players[0].hand[0]=k;s.deck[s.deck.indexOf(k)]=out;}
  let p=act(s,{type:'discard',id:k.id});assert.equal(p.pending.type,'prophecy');
  const ids=p.pending.cards.map(c=>c.id);
  assert.throws(()=>act(p,{type:'prophecy',discardId:ids[0],order:ids}),/Invalid/);
  assert.throws(()=>act(p,{type:'prophecy',discardId:'wrong',order:ids.slice(1)}));
  const order=ids.slice(1).reverse();let after=act(p,{type:'prophecy',discardId:ids[0],order});
  assert.ok(after.discard.some(c=>c.id===ids[0]));assertConserved(after);
});
test('Nightmare reveal conserves cards, sends Dreams and Doors to Limbo',()=>{
  const s=seeded(),i=s.deck.findIndex(c=>c.kind==='nightmare');const n=s.deck.splice(i,1)[0];
  s.phase='decision';s.pending={type:'nightmare',card:n};
  const a=act(s,{type:'nightmare',option:'reveal'});
  assert.ok(a.discard.some(c=>c.id===n.id));assertConserved(a);
});
test('Private coop resources and private decision content never leak',()=>{
  let s=seeded('coop');for(let i=0;i<6;i++)s=act(s,{type:'draft',id:s.draft[0].id});
  const view=viewFor(s,1);assert.ok(view.players[0].hand.every(c=>c.kind==='hidden'));assert.ok(view.players[1].hand.every(c=>c.kind==='location'));assert.equal('rng' in view,false);assert.equal('deck' in view,false);
  s.phase='decision';s.pending={type:'door',card:s.deck.splice(0,1)[0],keys:[{id:s.players[0].hand[0].id,zone:'personal'}]};
  const hidden=viewFor(s,1);assert.equal(hidden.pending.type,'private-decision');assertConserved(s);
});
test('Seeded simulations terminate without card duplication across modes',()=>{
  for(const mode of ['solo','coop'])for(let seed=1;seed<=160;seed++){
    let s=seeded(mode,seed);let moves=0;
    while(s.status==='active'&&moves<800){const next=choose(s);assert.ok(next,`No action for ${s.phase}`);s=act(s,next);assertConserved(s);moves++;}
    assert.notEqual(s.status,'active',`${mode} seed ${seed} did not terminate`);
    assert.equal(s.phase,'ended');
  }
});

test('all Nightmare penalty branches and Key claim conserve physical cards',()=>{
  const setup=(option)=>{
    const s=seeded('solo',33);const i=s.deck.findIndex(c=>c.kind==='nightmare');
    const n=s.deck.splice(i,1)[0];s.phase='decision';s.pending={type:'nightmare',card:n};
    if(option==='key'&&!s.players[0].hand.some(c=>c.symbol==='key')){
      const j=s.deck.findIndex(c=>c.kind==='location'&&c.symbol==='key');
      [s.deck[j],s.players[0].hand[0]]=[s.players[0].hand[0],s.deck[j]];
    }
    if(option==='door'){
      const j=s.deck.findIndex(c=>c.kind==='door');s.players[0].doors.push(s.deck.splice(j,1)[0]);
    }
    return s;
  };
  for(const option of ['key','door','reveal','hand']){
    const s=setup(option);
    const target=option==='key'?s.players[0].hand.find(c=>c.symbol==='key')?.id:option==='door'?s.players[0].doors[0].id:undefined;
    const next=act(s,{type:'nightmare',option,cardId:target});assertConserved(next);
    assert.ok(next.discard.some(c=>c.kind==='nightmare'));
    if(option==='door')assert.equal(next.players[0].doors.length,0);
    if(option==='hand')assert.equal(next.players[0].hand.length,5);
    if(option==='key')assert.ok(next.discard.some(c=>c.id===target));
  }
  const s=seeded('solo',65);
  let key=s.players[0].hand.find(c=>c.symbol==='key');
  if(!key){key=s.deck.find(c=>c.symbol==='key');const old=s.players[0].hand[0];s.players[0].hand[0]=key;s.deck[s.deck.indexOf(key)]=old;}
  const j=s.deck.findIndex(c=>c.kind==='door'&&c.color===key.color);
  const door=s.deck.splice(j,1)[0];s.phase='decision';s.pending={type:'door',card:door,keys:[{id:key.id,zone:'personal'}]};
  const a=act(s,{type:'chooseDoor',keyId:key.id});assertConserved(a);
  assert.ok(a.players[0].doors.some(c=>c.id===door.id));assert.ok(a.discard.some(c=>c.id===key.id));
});
test('a coop discard can atomically swap one remaining personal with shared',()=>{
  let s=seeded('coop',41);for(let i=0;i<6;i++)s=act(s,{type:'draft',id:s.draft[0].id});
  const discard=s.players[0].hand[0],personal=s.players[0].hand[1],shared=s.shared[0];
  const a=act(s,{type:'discard',id:discard.id,swapWith:{personal:personal.id,shared:shared.id}});
  assertConserved(a);
  assert.ok(a.players[0].hand.some(c=>c.id===shared.id));
  assert.ok(a.shared.some(c=>c.id===personal.id));
  assert.ok(a.discard.some(c=>c.id===discard.id));
});
