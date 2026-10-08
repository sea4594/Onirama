import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,act,assertConserved,viewFor} from '../engine/game.js';
import {normalizeSave,RULESET_VERSION} from '../engine/config.js';
const make=(expansions,seed=87,mode='solo')=>newGame({seed,mode,config:{expansions,difficulties:{}}});
function moveDeckTo(s,predicate,target){const i=s.deck.findIndex(predicate);assert.ok(i>=0,'Expected physical card in deck');const [c]=s.deck.splice(i,1);target.push(c);return c;}
function mirrorWithFourKeys(s){const stack=s.moduleState.mirrors.zones.key;for(let i=0;i<2;i++)moveDeckTo(s,c=>c.kind==='location'&&c.symbol==='key',stack);for(let i=0;i<2;i++){const j=s.deck.findIndex(c=>c.kind==='location'&&c.symbol==='key');assert.ok(j>=0);[s.players[0].hand[i],s.deck[j]]=[s.deck[j],s.players[0].hand[i]];}return s.players[0].hand.slice(0,2).map(c=>c.id);}
test('Key Mirror awards Doors one by one, interrupts for a Dark Premonition, then resumes its Door queue',()=>{
 let s=make(['mirrors','premonitions']);const a=moveDeckTo(s,c=>c.kind==='door'&&c.color==='blue',s.players[0].doors),b=moveDeckTo(s,c=>c.kind==='door'&&c.color==='green',s.players[0].doors);
 s.moduleState.premonitions.faceUp=['doors3'];s.moduleState.premonitions.reserve=[];
 const ids=mirrorWithFourKeys(s);const doors=s.deck.filter(c=>c.kind==='door'&&c.color==='red').map(c=>c.id);assert.equal(doors.length,2);assertConserved(s);
 s=act(s,{type:'mirrorPair',mirror:'key',ids});assert.equal(s.pending?.type,'mirrorReward');
 s=act(s,{type:'mirrorReward',ids:doors,color:'red'});assertConserved(s);assert.equal(s.pending?.type,'premonitionPick');
 assert.equal(s.players[0].doors.length,3,'Only the first Door can be gained before its Premonition');
 assert.equal(s.moduleState.mirrors.zones.queuedDoors.length,1,'Second Door is held in a physical, resumable zone');
 const secondId=s.moduleState.mirrors.zones.queuedDoors[0].id;
 s=act(s,{type:'premonitionPick',id:'doors3'});assertConserved(s);
 assert.equal(s.moduleState.mirrors.zones.queuedDoors.length,0);assert.ok(s.players[0].doors.some(c=>c.id===secondId),'Second Door is awarded after the trigger resolves');
 assert.ok(s.moduleState.premonitions.resolved.includes('doors3'));assert.ok([a.id,b.id].every(id=>s.players[0].doors.some(c=>c.id===id)));
});
test('Glyph Mirror three-Door queue survives Book Goal failure with card conservation',()=>{
 let s=make(['mirrors','glyphs','book']);let stack=s.moduleState.mirrors.zones.glyph;
 for(let i=0;i<2;i++)moveDeckTo(s,c=>c.kind==='location'&&c.symbol==='glyph',stack);
 for(let i=0;i<2;i++){const j=s.deck.findIndex(c=>c.kind==='location'&&c.symbol==='glyph');[s.players[0].hand[i],s.deck[j]]=[s.deck[j],s.players[0].hand[i]];}
 s=act(s,{type:'mirrorPair',mirror:'glyph',ids:s.players[0].hand.slice(0,2).map(c=>c.id)});
 const ids=s.pending.options.filter(c=>c.kind==='door').slice(0,3).map(c=>c.id);
 assert.equal(ids.length,3);s=act(s,{type:'mirrorReward',ids});assertConserved(s);
 assert.equal(s.moduleState.mirrors.zones.queuedDoors.length,0);
 assert.equal(s.players[0].doors.filter(c=>ids.includes(c.id)).length+s.limbo.filter(c=>ids.includes(c.id)).length+s.deck.filter(c=>ids.includes(c.id)).length,3);
});
test('Hammer Bird restores a partial Labyrinth sequence from previously played cards',()=>{
 let s;let hammer;for(let seed=1;seed<=50;seed++){s=make(['oniverse'],seed);hammer=s.deck.find(c=>c.ability==='hammer');if(hammer)break;}
 assert.ok(hammer);s.deck.splice(s.deck.indexOf(hammer),1);hammer.owner=0;s.moduleState.oniverse.zones.rallied.push(hammer);
 const p=s.players[0];for(const [color,symbol] of [['red','sun'],['red','moon'],['blue','sun'],['blue','moon']])moveDeckTo(s,c=>c.kind==='location'&&c.color===color&&c.symbol===symbol,p.labyrinth);
 p.series=p.labyrinth.slice(-2).map(c=>({id:c.id,color:c.color}));assertConserved(s);
 s=act(s,{type:'useDenizen',id:hammer.id});assert.deepEqual(s.players[0].series.map(c=>c.color),['red','red']);
 const next=s.deck.find(c=>c.kind==='location'&&c.color==='red'&&c.symbol==='key');assert.ok(next);const i=s.deck.indexOf(next);[s.players[0].hand[0],s.deck[i]]=[next,s.players[0].hand[0]];
 s=act(s,{type:'play',id:next.id});assertConserved(s);assert.equal(s.pending?.type,'doorSearch');
});
test('Old Phase 6 Mirror saves migrate with an empty queue and retain all cards',()=>{
 const s=make(['mirrors']);s.rulesVersion='phase6-1';delete s.moduleState.mirrors.zones.queuedDoors;
 const migrated=normalizeSave(s);assert.equal(migrated.rulesVersion,RULESET_VERSION);assert.deepEqual(migrated.moduleState.mirrors.zones.queuedDoors,[]);assertConserved(migrated);
});
test('Queuing Mirror Doors never leaks hidden deck or another player hand',()=>{
 let s=make(['mirrors','premonitions'],34,'coop');for(let i=0;i<6;i++)s=act(s,{type:'draft',id:s.draft[0].id});
 const other=viewFor(s,1);assert.equal(other.deck,undefined);assert.equal(other.moduleState,undefined);assert.ok(other.players[0].hand.every(c=>c.kind==='hidden'));
 assert.equal(other.expansion.mirrors.stacks.queuedDoors,undefined);
});
function botCommand(s){const p=s.pending;
 if(s.phase==='draft')return {type:'draft',id:s.draft[0].id};
 if(s.phase==='action'){
  const legal=(()=>{const spots=[...s.players[s.active].hand,...(s.mode==='coop'?s.shared:[])];const lab=s.players[s.active].labyrinth;return spots.filter(c=>c.kind==='location'&&c.symbol!==lab.at(-1)?.symbol);})();
  if(legal.length)return {type:'play',id:legal[0].id};
  const card=[...s.players[s.active].hand,...(s.mode==='coop'?s.shared:[])].find(c=>c.kind!=='deadEnd');
  return card?{type:'discard',id:card.id}:{type:'escape'};
 }
 if(p.type==='door')return {type:'chooseDoor',keyId:'limbo'};
 if(p.type==='doorSearch')return {type:'doorSearch',option:'skip'};
 if(p.type==='nightmare')return {type:'nightmare',option:'hand'};
 if(p.type==='towerPenalty')return {type:'towerPenalty',option:'fake'};
 if(p.type==='prophecy')return {type:'prophecy',discardId:p.cards[0].id,order:p.cards.slice(1).map(c=>c.id)};
 if(p.type==='towerLook'||p.type==='denizenPeek')return {type:p.type,order:p.cards.map(c=>c.id)};
 if(p.type==='incantation'){const d=p.cards.find(c=>c.kind==='door');return {type:'incantation',doorId:d?.id,order:p.cards.filter(c=>c.id!==d?.id).map(c=>c.id)};}
 if(p.type==='catchChoose'||p.type==='catchOverload')return {type:p.type,index:p.choices[0]};
 if(p.type==='rally')return {type:'rally',cardId:'skip'};
 if(p.type==='happyDream')return {type:'happyDream',option:'peek'};
 if(p.type==='happyPeek')return {type:'happyPeek',discardIds:[],order:p.cards.map(c=>c.id)};
 if(p.type==='premonitionPick')return {type:'premonitionPick',id:p.options[0]};
 if(p.type==='premonitionDoor')return {type:'premonitionDoor',doorId:p.choices[0].id};
 if(p.type==='sphinxName')return {type:'sphinxName',aspect:'moon'};
 if(p.type==='sphinxResolve'){const match=p.cards.some(c=>c.symbol==='moon');return {type:'sphinxResolve',topId:match?p.cards[0].id:undefined,order:p.cards.map(c=>c.id)};}
 if(p.type==='diver'){const hit=p.cards.at(-1)?.kind==='nightmare';return {type:'diver',option:hit?'nightmare':'stop',order:(hit?p.cards:p.cards.slice(0,-1)).map(c=>c.id)};}
 if(p.type==='confusion')return {type:'confusion',order:[...s.players[s.active].hand,...(s.mode==='coop'?s.shared:[])].map(c=>c.id)};
 throw Error(`Unhandled ${p?.type} at ${s.phase}`);
}
test('All 512 nine-expansion configurations complete seeded solo and cooperative games',()=>{
 const ids=['book','glyphs','dreamcatchers','towers','premonitions','crossroads','oniverse','mirrors','sphinx'];let games=0;
 for(let mask=0;mask<512;mask++)for(const mode of ['solo','coop']){
  let s=make(ids.filter((_,i)=>mask&(1<<i)),7000+mask,mode),moves=0;
  while(s.status==='active'&&moves++<800){s=act(s,botCommand(s));assertConserved(s);}
  assert.notEqual(s.status,'active',`Stuck at mask=${mask}, mode=${mode}, phase=${s.phase}, pending=${s.pending?.type}`);games++;
 }
 assert.equal(games,1024);
});
test('Dreamcatcher may be freed on Green Mirror search, without spending Failsafe',()=>{
 let s=make(['mirrors','dreamcatchers'],215);const stack=s.moduleState.mirrors.zones.green;
 for(let i=0;i<2;i++)moveDeckTo(s,c=>c.kind==='location'&&c.color==='green',stack);
 for(let i=0;i<2;i++){const j=s.deck.findIndex(c=>c.kind==='location'&&c.color==='green');[s.players[0].hand[i],s.deck[j]]=[s.deck[j],s.players[0].hand[i]];}
 const catcher=s.moduleState.dreamcatchers.zones.catch0;
 moveDeckTo(s,c=>c.kind==='location',catcher);const fails=s.moduleState.dreamcatchers.failsafes;
 s=act(s,{type:'mirrorPair',mirror:'green',ids:s.players[0].hand.slice(0,2).map(c=>c.id),freeId:0});
 assertConserved(s);assert.equal(s.moduleState.dreamcatchers.zones.catch0.length,0);assert.equal(s.moduleState.dreamcatchers.failsafes,fails);
});
test('Dreamcatcher may be freed during Red Mirror search with cards held out of deck',()=>{
 let s=make(['mirrors','dreamcatchers'],225);const stack=s.moduleState.mirrors.zones.red;
 for(let i=0;i<2;i++)moveDeckTo(s,c=>c.kind==='location'&&c.color==='red',stack);
 for(let i=0;i<2;i++){const j=s.deck.findIndex(c=>c.kind==='location'&&c.color==='red');[s.players[0].hand[i],s.deck[j]]=[s.deck[j],s.players[0].hand[i]];}
 const held=moveDeckTo(s,c=>c.kind==='location',s.moduleState.dreamcatchers.zones.catch0);
 s=act(s,{type:'mirrorPair',mirror:'red',ids:s.players[0].hand.slice(0,2).map(c=>c.id)});
 const ids=s.pending.options.slice(0,2).map(c=>c.id);
 s=act(s,{type:'mirrorReward',ids,freeId:0});assertConserved(s);
 assert.equal(s.moduleState.dreamcatchers.zones.catch0.length,0);
 assert.ok(s.deck.some(c=>c.id===held.id)||s.players[0].hand.some(c=>c.id===held.id));
});
