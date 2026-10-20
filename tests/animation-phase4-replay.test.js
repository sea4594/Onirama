import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {replayFrameDelay,createReplayPlaybackClock} from '../public/replay-playback.js';
import {CARD_MOTION} from '../public/tabletop/animation-timing.js';
import {planGameTransitions} from '../public/tabletop/animation.js';
import {publicFrame,opponentReplay} from '../engine/replay.js';
import {resetHotseatReplay,advanceHotseatReplay,readHotseatReplay} from '../engine/hotseat-replay.js';
import {newGame} from '../engine/game.js';

function fakeClock(){
 let time=0,id=0;const timers=new Map();
 const schedule=(cb,ms)=>{const key=++id;timers.set(key,{cb,at:time+ms});return key;};
 const cancel=key=>timers.delete(key);
 const tick=ms=>{const end=time+ms;while(true){
  const item=[...timers].sort((a,b)=>a[1].at-b[1].at).find(([,v])=>v.at<=end);
  if(!item)break;time=item[1].at;timers.delete(item[0]);item[1].cb();
 }time=end;};
 return {schedule,cancel,tick,get pending(){return timers.size;}};
}
const card=id=>({id,kind:'location',color:'red',symbol:'sun'});
const view=(o={})=>({mode:'coop',status:'active',phase:'action',turn:1,active:0,deckCount:25,discard:[],limbo:[],draft:[],shared:[],players:[{hand:[],labyrinth:[],doors:[]},{hand:[],labyrinth:[],doors:[]}],...o});

test('replay clock waits for complete reveals, staggered draws, and shuffle overlays',()=>{
 const previous=view(),oneDraw=view({deckCount:24,players:[{hand:[card('drawn')],labyrinth:[],doors:[]},{hand:[],labyrinth:[],doors:[]}]});
 assert(replayFrameDelay(previous,oneDraw)>=CARD_MOTION.reveal,'replay must wait for the current reveal');
 const bigDraw=view({deckCount:20,players:[{hand:Array.from({length:5},(_,i)=>card(`draw-${i}`)),labyrinth:[],doors:[]},{hand:[],labyrinth:[],doors:[]}]});
 assert(replayFrameDelay(previous,bigDraw)>replayFrameDelay(previous,oneDraw),'staggered multi-card reveal must finish');
 const shuffled=view({deckCount:27,shuffleSerial:1});
 assert(replayFrameDelay(previous,shuffled)>CARD_MOTION.shuffle,'shuffle overlays must finish');
 assert.equal(replayFrameDelay(previous,oneDraw,{reduced:true}),480);
});

test('autoplay owns one timer and advances only after each frame finishes',()=>{
 const clock=fakeClock(),visited=[];let index=0,completed=0;
 const delays=[400,1650,600];
 const playback=createReplayPlaybackClock({getIndex:()=>index,getLength:()=>3,delay:i=>delays[i],onStep:i=>{index=i;visited.push(i);},onComplete:()=>completed++,schedule:clock.schedule,cancel:clock.cancel});
 assert(playback.start());assert(!playback.start());assert.equal(clock.pending,1);
 clock.tick(399);assert.equal(index,0);
 clock.tick(1);assert.equal(index,1);
 clock.tick(1649);assert.equal(index,1);
 clock.tick(1);assert.equal(index,2);
 clock.tick(599);assert.equal(completed,0);
 clock.tick(1);assert.equal(completed,1);assert(!playback.playing);assert.equal(clock.pending,0);
 assert.deepEqual(visited,[1,2]);
});

test('manual pause and close prevent stale callbacks from moving a later replay',()=>{
 const clock=fakeClock(),visited=[];let index=0;
 const playback=createReplayPlaybackClock({getIndex:()=>index,getLength:()=>4,delay:()=>1500,onStep:i=>{index=i;visited.push(i);},schedule:clock.schedule,cancel:clock.cancel});
 playback.start();clock.tick(400);playback.pause();clock.tick(5000);
 assert.deepEqual(visited,[]);assert.equal(clock.pending,0);
 index=2;playback.start();clock.tick(1500);assert.deepEqual(visited,[3]);
 playback.reset();index=0;clock.tick(9999);assert.deepEqual(visited,[3]);assert.equal(clock.pending,0);
});

test('replay public draft travels into anonymous face-down hand exactly once',()=>{
 const prior=view({phase:'draft',draft:[card('public-a'),card('public-b')]});
 const later=view({phase:'draft',draft:[card('public-b')],players:[{hand:[],labyrinth:[],doors:[]},{hand:[{kind:'hidden'}],labyrinth:[],doors:[]}]});
 const plan=planGameTransitions(prior,later);
 assert.deepEqual(plan.anonymousDraftToHand,['public-a']);
 assert.deepEqual(plan.toHidden,[]);
 assert.deepEqual(plan.fromHidden,[]);
 assert(replayFrameDelay(prior,later)>CARD_MOTION.move);
 assert.equal(plan.anonymousDraftToHand.filter(id=>id==='public-a').length,1);
});

test('an anonymous replay hand can gain a face-down deck card without learning its ID',()=>{
 const previous=view({deckCount:30});
 const next=view({deckCount:29,players:[{hand:[],labyrinth:[],doors:[]},{hand:[{kind:'hidden'}],labyrinth:[],doors:[]}]});
 const plan=planGameTransitions(previous,next);
 assert.equal(plan.anonymousDraw,1);
 assert.deepEqual(plan.anonymousDraftToHand,[]);
 assert.equal(plan.drawn.length,0);
 assert(replayFrameDelay(previous,next)>CARD_MOTION.move);
});

test('a live identified draft does not also schedule anonymous replay flight',()=>{
 const prior=view({phase:'draft',draft:[card('public-a')]});
 const later=view({phase:'draft',players:[{hand:[],labyrinth:[],doors:[]},{hand:[{id:'public-a',kind:'hidden'}],labyrinth:[],doors:[]}]});
 const plan=planGameTransitions(prior,later);
 assert.deepEqual(plan.toHidden,['public-a']);
 assert.deepEqual(plan.anonymousDraftToHand,[]);
});

test('replay frames do not expose hidden hand identities, even for the active seat',()=>{
 const g=newGame({mode:'coop',seed:414});
 const frame=publicFrame(g);
 for(const player of frame.players){for(const card of player.hand){
  assert.deepEqual(card,{kind:'hidden'});assert(!('id' in card));
 }}
 const original=JSON.stringify(g);publicFrame(g);assert.equal(JSON.stringify(g),original);
});

test('hotseat replay stays bounded, reload-safe and uses public frames',()=>{
 const data=new Map(),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
 const game=newGame({mode:'coop',seed:45});
 const start=resetHotseatReplay(storage,game);
 assert.equal(start.length,1);
 const loaded=readHotseatReplay(storage,game);
 assert.equal(loaded.length,1);
 assert(!JSON.stringify(loaded).includes('"deck":'));
 for(const player of loaded[0].frame.players)for(const c of player.hand)assert.deepEqual(c,{kind:'hidden'});
 const oldTurn={...game,turn:game.turn+1};
 assert.deepEqual(readHotseatReplay(storage,oldTurn),[]);
});

test('replay UI exposes restart and step controls without engine commands',()=>{
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../public/multiplayer-replay.js',import.meta.url),'utf8');
 assert.match(app,/createReplayPlaybackClock/);
 assert.doesNotMatch(app,/scheduleReplay\(\)/);
 assert.match(app,/replayClock\.pause\(\)/);
 assert.match(app,/replayClock\.reset\(\)/);
 assert.match(app,/fitReplay\(layer,entry\);\s*replayAnimator\?\.after/);
 assert.match(ui,/data-action="replayRestart"/);
 assert.match(ui,/aria-pressed/);
 assert.match(ui,/renderCooperativeTabletop\(entry\.frame/);
 assert(!ui.includes('applyCommand('));
});
