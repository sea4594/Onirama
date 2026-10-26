import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {captureLabyrinthScroll,restoreLabyrinthScroll} from '../public/tabletop/labyrinth-scroll.js';

const lane = (key, cardIds, {width=500, clientWidth=200, left=0}={}) => ({
  dataset:{tabletopScroll:key},scrollWidth:width,clientWidth,scrollLeft:left,
  querySelectorAll(selector){
    assert.equal(selector,'.card.tiny');
    return cardIds.map(id=>({getAttribute(attribute){
      assert.equal(attribute,'data-tt-motion-id');
      return id;
    }}));
  }
});
const root = (...lanes) => ({querySelectorAll(selector){
  assert.equal(selector,'[data-tabletop-scroll]');
  return lanes;
}});

test('drawing preserves the Labyrinth active-end position even after card size changes',()=>{
 const original=lane('labyrinth-0',['a','b','c'],{left:300});
 const prior=captureLabyrinthScroll(root(original));
 assert.equal(prior.get('labyrinth-0').followEnd,true);
 // A draw doesn't change Labyrinth cards; responsive fitting can change its width.
 const afterDraw=lane('labyrinth-0',['a','b','c'],{width:610});
 restoreLabyrinthScroll(root(afterDraw),prior);
 assert.equal(afterDraw.scrollLeft,410);
});

test('an intentional scroll away from the active end is preserved across draws',()=>{
 const original=lane('labyrinth-0',['a','b','c'],{left:105});
 const prior=captureLabyrinthScroll(root(original));
 assert.equal(prior.get('labyrinth-0').followEnd,false);
 const afterDraw=lane('labyrinth-0',['a','b','c'],{width:590});
 restoreLabyrinthScroll(root(afterDraw),prior);
 assert.equal(afterDraw.scrollLeft,105);
});

test('newly played Labyrinth card reveals the next slot even when earlier cards were being inspected',()=>{
 const prior=captureLabyrinthScroll(root(lane('labyrinth-0',['a','b'],{left:60})));
 const after=lane('labyrinth-0',['a','b','c'],{width:720});
 restoreLabyrinthScroll(root(after),prior);
 assert.equal(after.scrollLeft,520);
});

test('both cooperative Labyrinths maintain independent scroll anchors',()=>{
 const prior=captureLabyrinthScroll(root(
  lane('labyrinth-0',['a','b','c'],{left:300}),
  lane('labyrinth-1',['x','y'],{left:55})
 ));
 const first=lane('labyrinth-0',['a','b','c'],{width:560});
 const second=lane('labyrinth-1',['x','y'],{width:560});
 restoreLabyrinthScroll(root(first,second),prior);
 assert.equal(first.scrollLeft,360);
 assert.equal(second.scrollLeft,55);
});

test('non-scrolling Labyrinth becomes end-anchored if it later overflows',()=>{
 const previous=captureLabyrinthScroll(root(lane('labyrinth',['a','b'],{width:170,left:0})));
 const fitted=lane('labyrinth',['a','b'],{width:420});
 restoreLabyrinthScroll(root(fitted),previous);
 assert.equal(fitted.scrollLeft,220);
});

test('tabletop fitting does not force-scroll Labyrinths and viewport refits restore them',()=>{
 const fit=readFileSync(new URL('../public/tabletop/fit.js',import.meta.url),'utf8');
 const labyrinthBranch=fit.match(/if\(row\.matches\('\.tt2-labyrinth-row,\.tt6-labyrinth-cards'\)\)\{([\s\S]*?)continue;/)?.[1];
 assert.ok(labyrinthBranch,'fitter has an explicit Labyrinth branch');
 assert.doesNotMatch(labyrinthBranch,/scrollLeft\s*=/);
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const resizing=app.split('function resizeGameplay(){')[1]?.split('let viewportRefits=')[0];
 assert.match(resizing,/captureLabyrinthScroll\(app\)/);
 assert.match(resizing,/restoreLabyrinthScroll\(app,labyrinthScroll\)/);
});
