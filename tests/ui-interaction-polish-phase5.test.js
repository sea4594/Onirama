import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reorderEdgeScrollDelta,animateReorderCommit,moveOrderedCardToGap} from '../public/tabletop/interactions.js';

const read = name => readFileSync(new URL('../'+name,import.meta.url),'utf8');
const source = read('public/tabletop/interactions.js');
const app = read('public/app.js');
const css = read('public/tabletop/interactions.css');

test('drag auto-scroll runs toward either edge, never in the central safe area',()=>{
  assert.equal(reorderEdgeScrollDelta(150,0,300),0);
  assert(reorderEdgeScrollDelta(8,0,300)<0);
  assert(reorderEdgeScrollDelta(292,0,300)>0);
  assert.equal(reorderEdgeScrollDelta(-100,0,300),-14); // bounded offscreen release
  assert.equal(reorderEdgeScrollDelta(400,0,300),14);
  assert.equal(reorderEdgeScrollDelta(5,10,10),0); // unmeasurable
  assert.equal(reorderEdgeScrollDelta(NaN,10,60),0);
});

test('a card can be moved between distant gaps without altering order or identity',()=>{
  const ids=['one','two','three','four','five','six'];
  assert.deepEqual(moveOrderedCardToGap(ids,'one',6),['two','three','four','five','six','one']);
  assert.deepEqual(ids,['one','two','three','four','five','six']);
  assert.deepEqual(moveOrderedCardToGap(ids,'six',0),['six','one','two','three','four','five']);
});

test('a keyboard reorder restores focus to the same card after the panel rerenders',()=>{
  const oldDocument=globalThis.document;
  const oldMatchMedia=globalThis.matchMedia;
  let restored=false;
  const active={dataset:{ttOrderHandle:'b'},closest:q=>q==='[data-tt-order-handle]'?active:null};
  const replacement={dataset:{ttOrderHandle:'b'},focus:options=>{restored=options?.preventScroll===true;}};
  const root={contains:el=>el===active,querySelectorAll:q=>q==='[data-tt-order-handle]'?[replacement]:[]};
  try {
    globalThis.document={activeElement:active,documentElement:{dataset:{motion:'reduced'}}};
    globalThis.matchMedia=()=>({matches:true});
    let called=0;
    assert.equal(animateReorderCommit(root,'effect','b',()=>{called++;return 'changed';}), 'changed');
    assert.equal(called,1);assert.equal(restored,true);
  } finally {
    if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;
    if(oldMatchMedia===undefined)delete globalThis.matchMedia;else globalThis.matchMedia=oldMatchMedia;
  }
});

test('insertion markers are recomputed when a fitted lane changes geometry',()=>{
  assert.match(source,/function syncGeometry\(\)/);
  assert.match(source,/showGaps\(list,tap\.id,tap\.kind\)/);
  assert.match(source,/list\.querySelectorAll\('\[data-tt-order-gap\]'\)\.forEach\(marker=>marker\.remove\(\)\)/);
  assert.match(source,/root\.addEventListener\('scroll',onScroll,true\)/);
  assert.match(source,/window\.addEventListener\('resize',syncGeometry\)/);
  assert.match(app,/decisionReorderController\?\.syncGeometry\?\.\(\)/);
  assert.match(app,/decisionReorderController=createDecisionReorder/);
});

test('stationary touch at the scroll edge remains scrollable, and pointerup geometry is final',()=>{
  assert.match(source,/function edgeTick\(\)/);
  assert.match(source,/if\(advanced&&scrollPointer&&press\?\.dragging\)scrollFrame=raf\(edgeTick\)/);
  assert.match(source,/function stopEdgeScroll\(\)/);
  assert.match(source,/function clear\(\)\{stopEdgeScroll\(\)/);
  assert.match(source,/ghost\.style\.left=`\$\{e\.clientX-press\.offsetX\}px`/);
  assert.match(source,/ghost\.style\.top=`\$\{e\.clientY-press\.offsetY\}px`/);
});

test('dragged cards retain their physical face and shape instead of tilting or zooming',()=>{
  assert.match(css,/\.tt3-ghost\{[^}]*transform:none!important/);
  assert.match(css,/\.tt3-order-ghost\{[^}]*transform:none/);
  assert(css.lastIndexOf('.tt3-ghost{transform:none!important}')>css.indexOf('rotate(-3deg)'));
  assert(css.lastIndexOf('.tt3-order-ghost{transform:none}')>css.indexOf('rotate(-4deg)'));
});
