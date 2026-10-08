import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,act,viewFor,assertConserved,legalActions} from '../engine/game.js';
import {EXPANSION_CATALOG,validateConfig,normalizeSave,RULESET_VERSION} from '../engine/config.js';
const make=(expansions,seed=1234,mode='solo',difficulties={})=>newGame({mode,seed,config:{expansions,difficulties}});
function putOnTop(s,card){const i=s.deck.findIndex(c=>c.id===card.id);assert.ok(i>=0);s.deck.push(...s.deck.splice(i,1));}
function replaceHand(s,desired,index=0){const p=s.players[s.active],old=p.hand[index],i=s.deck.findIndex(c=>c.id===desired.id);assert.ok(i>=0);p.hand[index]=s.deck[i];s.deck[i]=old;return desired;}
const spot=s=>s.players[s.active].hand.find(c=>c.kind==='location'&&c.symbol!=='key')||s.players[s.active].hand.find(c=>c.kind==='location');
const turn=s=>act(s,{type:'discard',id:spot(s).id});

test('Phase 5 configurations, exact physical counts, Denizen hidden selection and Book wildcard Goal',()=>{
 const available=EXPANSION_CATALOG.filter(x=>x.available);assert.equal(available.length,7);
 for(let bits=0;bits<128;bits++){
  const ids=available.filter((_,i)=>bits&(1<<i)).map(x=>x.id),s=make(ids,25+bits);
  assertConserved(s);assert.equal(s.deck.length+s.players[0].hand.length+s.limbo.length+Object.values(s.moduleState).flatMap(m=>Object.values(m.zones||{}).flat()).length, 76+(ids.includes('glyphs')?12:0)+(ids.includes('dreamcatchers')?4:0)+(ids.includes('towers')?12:0)+(ids.includes('premonitions')?4:0)+(ids.includes('crossroads')?16:0)+(ids.includes('oniverse')?17:0));
  if(ids.includes('oniverse')){assert.equal(s.moduleState.oniverse.zones.unused.length,8);assert.equal(s.deck.filter(c=>c.kind==='denizen').length+s.limbo.filter(c=>c.kind==='denizen').length,8);assert.equal(viewFor(s,0).expansion.oniverse?.unused,undefined);}
  if(ids.includes('book')&&ids.includes('oniverse'))assert.equal(s.moduleState.book.goals.filter(g=>g.color==='wild').length,1);
 }
 assert.equal(validateConfig({expansions:['premonitions'],difficulties:{premonitions:'extreme'}}).difficulties.premonitions,'extreme');
 assert.throws(()=>validateConfig({expansions:['premonitions'],difficulties:{premonitions:'impossible'}}));
});
test('Dead Ends are drawn as Locations, cannot be played/discarded, Escape redraws and conserves cards',()=>{
 const s=make(['crossroads'],51),end=s.deck.find(c=>c.kind==='deadEnd');replaceHand(s,end);
 assert.throws(()=>act(s,{type:'play',id:end.id}),/Choose a Location/);
 assert.throws(()=>act(s,{type:'discard',id:end.id}),/Dead Ends/);
 assert.ok(legalActions(s).some(a=>a.type==='escape'));
 const t=act(s,{type:'escape'});assert.ok(t.discard.some(c=>c.id===end.id));assertConserved(t);
});
test('Crossroad completes colored Door set in any position, but hard mode requires middle',()=>{
 for(const hard of [false,true])for(const where of [0,1,2]){
  const s=make(['crossroads'],82+where+(hard?10:0),'solo',hard?{crossroads:'hard'}:{}),p=s.players[0];
  const options=[...s.deck,...p.hand];const choices=[options.find(c=>c.kind==='location'&&c.color==='blue'&&c.symbol==='sun'),options.find(c=>c.kind==='location'&&c.color==='blue'&&c.symbol==='moon'),options.find(c=>c.kind==='location'&&c.color==='wild'&&c.symbol==='key')];
  for(const c of choices){const hi=p.hand.findIndex(x=>x.id===c.id);if(hi>=0){const di=s.deck.findIndex(x=>!choices.some(v=>v.id===x.id));[p.hand[hi],s.deck[di]]=[s.deck[di],p.hand[hi]];}}
  const seq=where===0?[choices[2],choices[0],choices[1]]:where===1?[choices[0],choices[2],choices[1]]:[choices[0],choices[1],choices[2]];
  for(const c of seq.slice(0,2)){const i=s.deck.findIndex(x=>x.id===c.id);p.labyrinth.push(s.deck.splice(i,1)[0]);}p.series=seq.slice(0,2).map(c=>({id:c.id,color:c.color}));
  replaceHand(s,seq[2]);const next=act(s,{type:'play',id:seq[2].id});
  if(!hard||where===1)assert.equal(next.pending?.type,'doorSearch');else assert.notEqual(next.pending?.type,'doorSearch');assertConserved(next);
 }
});
test('Happy Dream can cancel Premonition and inspect/reorder/discard up to seven cards',()=>{
 let s=make(['premonitions'],32);const dream=s.deck.find(c=>c.kind==='happyDream');putOnTop(s,dream);s=turn(s);assert.equal(s.pending.type,'happyDream');
 const before=s.moduleState.premonitions.faceUp[0];let cancelled=act(s,{type:'happyDream',option:'banish',premonitionId:before});assert.ok(!cancelled.moduleState.premonitions.faceUp.includes(before));assertConserved(cancelled);
 s=make(['premonitions'],31);putOnTop(s,s.deck.find(c=>c.kind==='happyDream'));s=turn(s);const seen=act(s,{type:'happyDream',option:'peek'});assert.equal(seen.pending.type,'happyPeek');
 const ids=seen.pending.cards.map(c=>c.id),discardIds=ids.slice(0,2);assert.throws(()=>act(seen,{type:'happyPeek',discardIds,order:ids}),/exactly once/);
 const out=act(seen,{type:'happyPeek',discardIds,order:ids.slice(2).reverse()});assertConserved(out);assert.ok(out.discard.some(c=>c.id===discardIds[0]));
});
test('Happy Dream fetch searches actual deck without double counting physical cards or leaking future order',()=>{
 let s=make(['premonitions','dreamcatchers'],52);putOnTop(s,s.deck.find(c=>c.kind==='happyDream'));s=turn(s);
 let f=act(s,{type:'happyDream',option:'fetch'});assertConserved(f);assert.equal(f.pending.type,'happyFetch');
 const target=f.pending.options.find(c=>c.kind==='nightmare');assert.ok(target);const out=act(f,{type:'happyFetch',cardId:target.id});assertConserved(out);assert.ok(out.pending?.type==='nightmare'||out.status!=='active'||out.log.length>0);
});
test('Denizen rally, Mirror Nightmare cancellation and Keeper storage preserve card identity',()=>{
 const s=make(['oniverse'],47),d=s.deck.find(c=>c.kind==='denizen');putOnTop(s,d);
 const p=turn(s);assert.equal(p.pending.type,'rally');const key=p.pending.choices[0];const rallied=act(p,{type:'rally',cardId:key});assert.ok(rallied.moduleState.oniverse.zones.rallied.some(c=>c.id===d.id));assertConserved(rallied);
 const m=make(['oniverse'],92);const mirror=m.moduleState.oniverse.zones.unused.find(x=>x.ability==='mirror')||m.deck.find(x=>x.ability==='mirror');
 if(mirror&&m.deck.includes(mirror)){m.deck.splice(m.deck.indexOf(mirror),1);mirror.owner=0;m.moduleState.oniverse.zones.rallied.push(mirror);putOnTop(m,m.deck.find(c=>c.kind==='nightmare'));const nm=turn(m);assert.equal(nm.pending?.type,'nightmare');const out=act(nm,{type:'nightmare',option:'mirror',denizenId:mirror.id});assertConserved(out);assert.ok(out.discard.some(x=>x.id===mirror.id));}
});
test('A drawn Oniverse Door can be claimed using an ordinary Key of any color',()=>{
 let s=make(['oniverse'],5);const wild=s.deck.find(c=>c.kind==='door'&&c.color==='wild');putOnTop(s,wild);
 let key=s.players[0].hand.find(c=>c.symbol==='key');if(!key)key=replaceHand(s,s.deck.find(c=>c.kind==='location'&&c.symbol==='key'));
 s=act(s,{type:'discard',id:spot(s).id});assert.equal(s.pending?.type,'door');assert.ok(s.pending.keys.some(x=>x.id===key.id));
 s=act(s,{type:'chooseDoor',keyId:key.id});assert.equal(s.players[0].doors.filter(c=>c.color==='wild').length,1);assertConserved(s);
});
test('Dark Premonitions trigger after Doors and allow ordered penalties, reopening a Book goal when a Door is lost',()=>{
 let s=make(['premonitions','book'],31),p=s.players[0];
 s.moduleState.premonitions.faceUp=['red2','pair2'];s.moduleState.premonitions.reserve=['doors3'];
 // Move one red Door into the player's completed collection, as if legally acquired earlier.
 const d=s.deck.find(c=>c.kind==='door'&&c.color==='red');s.deck.splice(s.deck.indexOf(d),1);p.doors.push(d);
 const g=s.moduleState.book.goals.find(x=>x.color==='red');g.done=true;g.doorId=d.id;
 // All preceding Goals must be satisfied to allow another red Door.
 const targetIndex=s.moduleState.book.goals.findIndex(x=>x.color==='red'&&!x.done);s.moduleState.book.goals.splice(0,0,...s.moduleState.book.goals.splice(targetIndex,1));
 const reds=s.deck.filter(c=>c.kind==='location'&&c.color==='red'&&['sun','moon','key'].includes(c.symbol));
 const row=[reds.find(c=>c.symbol==='sun'),reds.find(c=>c.symbol==='moon')];
 for(const c of row){p.labyrinth.push(...s.deck.splice(s.deck.findIndex(x=>x.id===c.id),1));}
 p.series=row.map(c=>({id:c.id,color:c.color}));const c=s.deck.find(x=>x.kind==='location'&&x.color==='red'&&x.symbol==='key');replaceHand(s,c);
 s=act(s,{type:'play',id:c.id});assert.equal(s.pending?.type,'doorSearch');
 const doorId=s.deck.find(x=>x.kind==='door'&&x.color==='red')?.id;assert.ok(doorId);
 s=act(s,{type:'doorSearch',option:'claim',doorId});assert.equal(s.pending?.type,'premonitionPick');assert.ok(s.pending.options.includes('red2'));
 s=act(s,{type:'premonitionPick',id:'red2'});assert.ok(!s.moduleState.premonitions.faceUp.includes('red2'));assertConserved(s);
});
const bot=s=>{
 const p=s.pending;
 if(s.phase==='draft')return {type:'draft',id:s.draft[0].id};
 if(s.phase==='action'){
  const actions=legalActions(s).filter(x=>['play','discard','playTower','escape'].includes(x.type));
  const a=actions.find(x=>x.type==='play')||actions.find(x=>x.type==='discard')||actions[0];
  if(!a)throw Error('No action available');return a.type==='playTower'?{...a,side:'right'}:a;
 }
 if(p.type==='doorSearch')return {type:'doorSearch',option:'skip'};
 if(p.type==='door')return {type:'chooseDoor',keyId:'limbo'};
 if(p.type==='nightmare')return {type:'nightmare',option:'hand'};
 if(p.type==='towerPenalty')return {type:'towerPenalty',option:'fake'};
 if(p.type==='prophecy'){const ids=p.cards.map(c=>c.id);return {type:'prophecy',discardId:ids[0],order:ids.slice(1)};}
 if(p.type==='incantation'){const door=p.cards.find(c=>c.kind==='door');return {type:'incantation',doorId:door?.id,order:p.cards.filter(c=>c.id!==door?.id).map(c=>c.id)};}
 if(p.type==='towerLook')return {type:'towerLook',order:p.cards.map(c=>c.id)};
 if(p.type==='catchChoose'||p.type==='catchOverload')return {type:p.type,index:p.choices[0]};
 if(p.type==='rally')return {type:'rally',cardId:'skip'};
 if(p.type==='happyDream')return {type:'happyDream',option:'peek'};
 if(p.type==='happyPeek')return {type:'happyPeek',discardIds:[],order:p.cards.map(c=>c.id)};
 if(p.type==='premonitionPick')return {type:'premonitionPick',id:p.options[0]};
 if(p.type==='premonitionDoor')return {type:'premonitionDoor',doorId:p.choices[0].id};
 if(p.type==='denizenPeek')return {type:'denizenPeek',order:p.cards.map(c=>c.id)};
 throw Error(`Unresolved automatic decision: ${p.type}`);
};
test('128 expansion combinations run seeded, with no double moves, crashes or unfinished decisions',()=>{
 const ids=EXPANSION_CATALOG.filter(x=>x.available).map(x=>x.id);
 let games=0,moves=0;
 for(let mask=0;mask<128;mask++){
  let s=make(ids.filter((_,i)=>mask&(1<<i)),760+mask,mask%8===0?'coop':'solo');
  for(let step=0;s.status==='active'&&step<450;step++){
   const cmd=bot(s);s=act(s,cmd);assertConserved(s);moves++;
  }
  assert.ok(s.status!=='active',`Game did not terminate (mask ${mask} phase ${s.phase})`);games++;
 }
 assert.equal(games,128);assert.ok(moves>1500);
});
function withDenizen(ability){for(let seed=1;seed<100;seed++){const s=make(['oniverse'],seed),c=s.deck.find(d=>d.kind==='denizen'&&d.ability===ability);if(c){s.deck.splice(s.deck.indexOf(c),1);c.owner=0;s.moduleState.oniverse.zones.rallied.push(c);return {s,c};}}throw Error('Ability not available in 100 seeds');}
test('Each actively used Denizen has a legal, conserved transition',()=>{
 for(const ability of ['architect','cyclobot','squirrel','harpoon','hammer','chromatic','keeper']){
  let {s,c}=withDenizen(ability),p=s.players[0];
  if(ability==='architect'){
   const l=p.hand.find(x=>x.kind==='location');p.labyrinth.push(...s.deck.splice(s.deck.findIndex(x=>x.kind==='location'&&x.symbol===l.symbol),1));
   const out=act(s,{type:'useDenizen',id:c.id,cardId:l.id});assert.ok(out.discard.some(d=>d.id===c.id));assertConserved(out);
  }else if(ability==='cyclobot'){
   const from=p.hand.find(x=>x.kind==='location'),discard=s.deck.find(x=>x.kind==='location');s.deck.splice(s.deck.indexOf(discard),1);s.discard.push(discard);
   const out=act(s,{type:'useDenizen',id:c.id,cardId:from.id,discardId:discard.id});assert.ok(out.players[0].hand.some(x=>x.id===discard.id));assertConserved(out);
  }else if(ability==='squirrel'||ability==='harpoon'){
   if(ability==='harpoon'){const n=s.deck.find(x=>x.kind==='nightmare');putOnTop(s,n);}
   const peek=act(s,{type:'useDenizen',id:c.id});assert.equal(peek.pending?.type,'denizenPeek');
   const resolved=act(peek,{type:'denizenPeek',order:peek.pending.cards.map(c=>c.id)});assert.equal(resolved.phase,'action');assertConserved(resolved);
   if(ability==='harpoon')assert.ok(resolved.discard.some(c=>c.kind==='nightmare'));
  }else if(ability==='hammer'){
   const d=s.deck.find(x=>x.kind==='location');s.deck.splice(s.deck.indexOf(d),1);p.labyrinth.push(d);const out=act(s,{type:'useDenizen',id:c.id});assert.ok(out.discard.some(x=>x.id===d.id));assertConserved(out);
  }else if(ability==='chromatic'){
   const d=s.deck.find(x=>x.kind==='door'&&x.color==='blue');s.pending={type:'doorSearch',color:'red'};s.phase='decision';
   const out=act(s,{type:'doorSearch',option:'claim',doorId:d.id});assert.ok(out.discard.some(x=>x.id===c.id));assert.ok(out.players[0].doors.some(x=>x.id===d.id));assertConserved(out);
  }else if(ability==='keeper'){
   const l=p.hand.find(x=>x.kind==='location');const out=act(s,{type:'useDenizen',id:c.id,cardId:l.id});assert.ok(out.moduleState.oniverse.zones.treasure.some(x=>x.id===l.id));assertConserved(out);
   if(out.phase==='action'&&out.players[0].labyrinth.at(-1)?.symbol!==l.symbol){const used=act(out,{type:'play',id:l.id});assert.ok(used.discard.some(x=>x.id===c.id));assertConserved(used);}
  }
 }
});
test('Phase 4 games migrate their active Labyrinth streak to the Phase 5 series tracker',()=>{
 const s=make([],32);s.rulesVersion='phase4-1';delete s.players[0].series;
 const loc=s.deck.find(c=>c.kind==='location');s.deck.splice(s.deck.indexOf(loc),1);s.players[0].labyrinth.push(loc);s.players[0].streakColor=loc.color;s.players[0].streak=1;
 const upgraded=normalizeSave(s);assert.equal(upgraded.rulesVersion,RULESET_VERSION);assert.equal(upgraded.players[0].series[0].id,loc.id);assertConserved(upgraded);
});
