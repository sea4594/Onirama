import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {networkMotionContinuity,createOrderedMotionQueue,createTabletopAnimator,planGameTransitions} from '../public/tabletop/animation.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const card=id=>({id,kind:'location',color:'red',symbol:'sun'});
const player=(hand=[],labyrinth=[])=>({hand,labyrinth,doors:[]});
const game=(o={})=>({mode:'coop',phase:'action',status:'active',active:0,turn:1,deckCount:45,players:[player([card('a'),card('b')]),player([{id:'old',kind:'hidden'}])],shared:[],draft:[],discard:[],limbo:[],...o});
function fakeClock(){
  let current=0,nextId=0;const timers=new Map();
  const schedule=(callback,duration)=>{const id=++nextId;timers.set(id,{callback,at:current+duration});return id;};
  const cancel=id=>timers.delete(id);
  const tick=(millis)=>{
    const end=current+millis;
    while(true){const ready=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!ready)break;
      const [id,v]=ready;current=v.at;timers.delete(id);v.callback();
    }
    current=end;
  };
  return {schedule,cancel,tick,get pending(){return timers.size;}};
}

test('Firestore versions: only consecutive observed updates can be animated',()=>{
  assert.equal(networkMotionContinuity(null,2),'baseline');
  assert.equal(networkMotionContinuity(12,13),'continuous');
  assert.equal(networkMotionContinuity(12,12),'duplicate');
  assert.equal(networkMotionContinuity(12,11),'duplicate');
  assert.equal(networkMotionContinuity(12,16),'resync');
  assert.equal(networkMotionContinuity(3,NaN),'baseline');
});

test('ordered online queue plays snapshots serially and never restarts an earlier flight',()=>{
  const clock=fakeClock(),calls=[];
  const timeline=createOrderedMotionQueue({schedule:clock.schedule,cancel:clock.cancel,onFinish:()=>calls.push('cleanup')});
  assert(timeline.enqueue(()=>calls.push('version-11'),100));
  assert(timeline.enqueue(()=>calls.push('version-12'),120));
  assert(timeline.enqueue(()=>calls.push('version-13'),140));
  assert.deepEqual(calls,['version-11']);
  assert.equal(timeline.length,3);
  clock.tick(100);assert.deepEqual(calls,['version-11','cleanup','version-12']);
  clock.tick(120);assert.deepEqual(calls,['version-11','cleanup','version-12','cleanup','version-13']);
  clock.tick(140);assert.equal(timeline.length,0);
  assert.equal(clock.pending,0);
});

test('too many rapid updates drop obsolete queued animation jobs and clean up',()=>{
  const clock=fakeClock(),calls=[];
  const timeline=createOrderedMotionQueue({schedule:clock.schedule,cancel:clock.cancel,onFinish:()=>calls.push('cleanup')});
  for(const name of ['v1','v2','v3'])assert(timeline.enqueue(()=>calls.push(name),1000));
  assert.equal(timeline.enqueue(()=>calls.push('stale-v4'),1000),false);
  clock.tick(5000);
  assert.deepEqual(calls,['v1','cleanup']);
  assert.equal(timeline.length,0);
  assert(timeline.enqueue(()=>calls.push('new-current'),5));
  clock.tick(5);
  assert.deepEqual(calls,['v1','cleanup','new-current','cleanup']);
  assert.equal(clock.pending,0);
});

test('a reconnection or room change cancels queued ghosts and their timers',()=>{
  const clock=fakeClock(),calls=[];
  const timeline=createOrderedMotionQueue({schedule:clock.schedule,cancel:clock.cancel,onFinish:()=>calls.push('removed')});
  timeline.enqueue(()=>calls.push('old-room-v1'),1400);
  timeline.enqueue(()=>calls.push('old-room-v2'),1400);
  timeline.clear();clock.tick(5000);
  assert.deepEqual(calls,['old-room-v1','removed']);
  assert.equal(timeline.length,0);
  assert.equal(clock.pending,0);
});

test('opponent draws are detected by actual new hidden IDs, not net hand-size changes',()=>{
  const before=game({players:[player([]),player([{id:'old',kind:'hidden'}])]});
  const next=game({deckCount:44,players:[player([]),player([{id:'fresh',kind:'hidden'}], [card('old')])]});
  const plan=planGameTransitions(before,next);
  assert.equal(plan.hiddenDraw,1,'new hidden card arrives even as another is played');
  assert.deepEqual(plan.fromHidden,['old']);
  assert.deepEqual(plan.toHidden,[]);
  assert.deepEqual(plan.drawn,[],'hidden faces must not be exposed as a public draw');
});

test('public draft -> private opponent hand is one face-down transfer, never a duplicate',()=>{
  const before=game({draft:[card('drafted')],players:[player([]),player([])]});
  const next=game({draft:[],players:[player([]),player([{id:'drafted',kind:'hidden'}])]});
  const plan=planGameTransitions(before,next);
  assert.deepEqual(plan.toHidden,['drafted']);
  assert.equal(plan.hiddenDraw-plan.toHidden.length,0,'never add a second generic card-back flight');
  assert(!plan.drawn.includes('drafted'));
  const motion=read('public/tabletop/animation.js');
  assert.match(motion,/queue\(id,newBack\.template/);
  assert.doesNotMatch(motion,/renderCard\(.*hiddenAfter/);
});

test('online app requires authoritative committed snapshots and resets animations on stream recovery',()=>{
  const firebase=read('public/firebase-room.js'),app=read('public/app.js');
  assert.match(firebase,/includeMetadataChanges:true/);
  assert.match(firebase,/if\(snap\.metadata\?\.hasPendingWrites\)return/);
  assert.match(app,/tabletopAnimator\?\.resync\?\.\(\)/);
  assert.match(app,/online:!IS_LOCAL_GAME\(\)&&state\?\.room\?\.mode==='coop',version:state\?\.version/);
  assert.match(app,/online=!snapshotMeta\?\.fromCache/);
  assert.match(app,/if\(snapshotMeta\?\.fromCache\|\|!verifiedSnapshot\)tabletopAnimator\?\.resync/);
  assert.match(app,/data\.version>=version/);
});

// The real animator is also exercised here, not only the pure queue helper.
// No cards are rendered, so a missed version must never construct a stage.
test('live animator suppresses skipped-version flights and resumes on next observed transition',()=>{
  const savedDocument=globalThis.document,savedMatchMedia=globalThis.matchMedia;
  let stages=0;
  const node=()=>({className:'',classList:{add(){}},setAttribute(){},appendChild(){},remove(){},attributes:[]});
  globalThis.document={hidden:false,documentElement:{dataset:{motion:'normal'}},body:{appendChild(){stages++;}},createElement:node};
  globalThis.matchMedia=()=>({matches:false});
  const root={querySelectorAll(){return [];},querySelector(){return null;}};
  const animator=createTabletopAnimator({root});
  try{
    const a=game(),b=game({players:[player([card('b')],[card('a')]),player([])]});
    animator.before(a,'ROOM','#/game',{online:true,version:10});animator.after(a,'ROOM','#/game',{online:true,version:10});
    animator.before(b,'ROOM','#/game',{online:true,version:14});animator.after(b,'ROOM','#/game',{online:true,version:14});
    assert.equal(stages,0,'skipped updates must not generate flights');
    const c=game({players:[player([]),player([])],discard:[card('a'),card('b')]});
    animator.before(c,'ROOM','#/game',{online:true,version:15});animator.after(c,'ROOM','#/game',{online:true,version:15});
    assert.equal(stages,1,'the next consecutive update can animate normally');
    animator.resync();
  }finally{
    animator.reset();
    if(savedDocument===undefined)delete globalThis.document;else globalThis.document=savedDocument;
    if(savedMatchMedia===undefined)delete globalThis.matchMedia;else globalThis.matchMedia=savedMatchMedia;
  }
});
