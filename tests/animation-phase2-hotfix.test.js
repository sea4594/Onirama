import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  planGameTransitions,transferDestinationZone,transferTargetRect,stackMotionCounts
} from '../public/tabletop/animation.js';
import {animateReorderCommit,moveOrderedCardToGap} from '../public/tabletop/interactions.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const motion=read('public/tabletop/animation.js');
const app=read('public/app.js');
const interactions=read('public/tabletop/interactions.js');
const card=id=>({id,kind:'location',color:'red',symbol:'sun'});
const p=(hand=[],labyrinth=[])=>({hand,labyrinth,doors:[]});
const game=(o={})=>({mode:'solo',phase:'action',status:'active',turn:0,active:0,deckCount:45,players:[p([card('a'),card('b')])],discard:[],limbo:[],...o});
const R=(x,y=10)=>({left:x,top:y,width:40,height:58});

test('play, discard and Limbo actions select physical destination, not a visible fan card',()=>{
  const before=game();
  const inLab=game({players:[p([card('b')],[card('a')])]});
  const inDiscard=game({players:[p([card('b')])],discard:[card('a')]});
  const inLimbo=game({players:[p([card('b')])],limbo:[card('a')]});
  assert.equal(transferDestinationZone('a',before,inLab),'player:0:labyrinth');
  assert.equal(transferDestinationZone('a',before,inDiscard),'discard');
  assert.equal(transferDestinationZone('a',before,inLimbo),'limbo');
  assert.equal(transferDestinationZone('b',before,inDiscard),null);
  const rendered=R(400),anchors={discard:R(90),limbo:R(240),catchers:{1:R(310)}};
  assert.equal(transferTargetRect('player:0:labyrinth',rendered,anchors),rendered);
  assert.equal(transferTargetRect('discard',rendered,anchors),anchors.discard);
  assert.equal(transferTargetRect('limbo',rendered,anchors),anchors.limbo);
  assert.equal(transferTargetRect('catcher:1',rendered,anchors),anchors.catchers[1]);
  assert.equal(transferTargetRect('catcher:3',rendered,anchors),null);
  assert.equal(transferTargetRect('discard',rendered,{}),null,'never fly to wrong fallback');
  assert.match(motion,/const dest=transferTargetRect\(zone,b\?\.r,anchors\)/);
});

test('draw reveal and discard animations share pile anchors, with no invented secondary event',()=>{
  const before=game({deckCount:32});
  const next=game({deckCount:31,players:[p([card('a'),card('b'),card('new')])]});
  const plan=planGameTransitions(before,next);
  assert.equal(plan.draw,1);
  assert.deepEqual(plan.drawn,['new']);
  assert.match(motion,/const destination=transferTargetRect\(zone,target\?\.r,anchors\)/);
  assert.match(motion,/scheduled\.add\(id\);\s*revealGhost\(/);
  assert.doesNotMatch(motion,/if\(!released&&\(plan\.draw/);
});

test('a drag changes the moved card origin, but never filters out other actual transfers',()=>{
  assert.match(motion,/const origin=released\?\.id===id\?released\.from:a\.r/);
  assert.match(motion,/flies\.slice\(0,9\)\.forEach/);
  assert.doesNotMatch(motion,/released\?flies\.filter/);
  assert.match(app,/onDrop:\(id,rect\)=>tabletopAnimator\?\.dragRelease\?\.\(id,rect\)/);
  assert.match(interactions,/const released=dragging&&ghost\?\.getBoundingClientRect/);
});

test('deck return animations reflect actual counts, with one labeled stack above three cards',()=>{
  assert.deepEqual(stackMotionCounts(0),[]);
  assert.deepEqual(stackMotionCounts(1),[1]);
  assert.deepEqual(stackMotionCounts(3),[1,1,1]);
  assert.deepEqual(stackMotionCounts(4),[4]);
  assert.deepEqual(stackMotionCounts(13),[13]);
  const old=game({limbo:[card('a'),card('b'),card('c'),card('d')],players:[p([])]});
  const returned=game({limbo:[],players:[p([])],shuffleSerial:1});
  assert.deepEqual(planGameTransitions(old,returned).returnedLimbo,['a','b','c','d']);
  const caught=game({limbo:[],players:[p([])],expansion:{dreamcatchers:{stacks:[[card('a')]]}},shuffleSerial:1});
  assert.deepEqual(planGameTransitions(old,caught).returnedLimbo,['b','c','d'],
    'a card now captured by Dreamcatcher was not also shuffled');
  assert.match(motion,/for\(const \[i,count\] of stackMotionCounts\(plan\.returnedLimbo\.length\)/);
  assert.match(read('public/tabletop/animation.css'),/\.tt8-motion-stage \.tt8-stack-count/);
});

function mockList(ids){
  const calls=[];
  const items=ids.map((id,index)=>({dataset:{ttOrderId:id},getBoundingClientRect(){return R(index*55);},animate(frames,opts){calls.push({id,frames,opts});}}));
  return {calls,dataset:{ttOrderGroup:'effect'},querySelectorAll(){return items;}};
}
test('insertion-marker reorder animates moved card and only necessary neighbor slides',()=>{
  const before=mockList(['a','b','c','d']);let after=before;
  const root={querySelectorAll(){return [after];}};
  const original=globalThis.document;
  globalThis.document={documentElement:{dataset:{motion:'normal'}}};
  try{
    const result=animateReorderCommit(root,'effect','a',()=>{
      const order=moveOrderedCardToGap(['a','b','c','d'],'a',4);
      after=mockList(order);return order;
    });
    assert.deepEqual(result,['b','c','d','a']);
    assert.deepEqual(new Set(after.calls.map(c=>c.id)),new Set(['a','b','c','d']));
    assert.equal(after.calls.find(c=>c.id==='a').opts.duration,260);
    assert(after.calls.filter(c=>c.id!=='a').every(c=>c.opts.duration===170));
    assert(after.calls.every(c=>c.frames.every(f=>!String(f.transform).includes('scale('))));
  }finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
});

test('reduced-motion reorder commits its actual game edit without animations',()=>{
  const root={querySelectorAll:()=>[mockList(['a','b'])]};
  let committed=0;
  animateReorderCommit(root,'effect','a',()=>{committed++;},{reduced:true});
  assert.equal(committed,1);
});

test('prophecy, Happy Peek and keyboard/mouse/marker reordering use the same visual commit',()=>{
  assert.match(app,/return animateReorderCommit\(app,kind,from,\(\)=>\{/);
  assert.match(app,/return animateReorderCommit\(app,'effect',id,\(\)=>\{/);
  assert.match(interactions,/onReorder\(target\.list\.dataset\.ttOrderGroup,id,target\.index,\{releasedRect\}\)/);
  assert.match(interactions,/onReorder\(kind,id,gap\)/);
  assert.match(interactions,/onReorder\(kind,item\.dataset\.ttOrderId,gap\)/);
});
