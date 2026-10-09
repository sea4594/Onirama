import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moveOrderedCardToGap,gapAtX,createDecisionReorder} from '../public/tabletop/interactions.js';
import {cardHelp,createCardInspector} from '../public/tabletop/card-inspection.js';
import {renderCard} from '../public/tabletop/cards.js';
import {createDeck} from '../engine/cards.js';

const app=readFileSync('public/app.js','utf8'),css=readFileSync('public/tabletop/interactions.css','utf8');
test('insertion positions include start, all middle gaps, and end; source is immutable',()=>{
 const ids=['a','b','c','d'];
 assert.deepEqual(moveOrderedCardToGap(ids,'d',0),['d','a','b','c']);
 assert.deepEqual(moveOrderedCardToGap(ids,'a',2),['b','a','c','d']);
 assert.deepEqual(moveOrderedCardToGap(ids,'a',4),['b','c','d','a']);
 assert.deepEqual(moveOrderedCardToGap(ids,'c',3),ids);
 assert.deepEqual(moveOrderedCardToGap(ids,'c',2),ids);
 assert.deepEqual(moveOrderedCardToGap(ids,'x',2),ids);
 assert.deepEqual(moveOrderedCardToGap(ids,'a',-1),ids);
 assert.deepEqual(moveOrderedCardToGap(ids,'a',5),ids);
 assert.deepEqual(ids,['a','b','c','d']);
});
test('gap hit-testing uses midpoints and supports after-final insertion',()=>{
 const boxes=[[0,40],[40,85],[85,150]].map(([left,right])=>({getBoundingClientRect:()=>({left,width:right-left})}));
 const list={querySelectorAll:()=>boxes};
 for(const [x,result] of [[1,0],[21,1],[41,1],[70,2],[150,3]])assert.equal(gapAtX(list,x),result);
 assert.equal(gapAtX(null,30),null);
});
test('every decision ordering has drag/tap handles and an end gap; no up/down buttons remain',()=>{
 for(const kind of ['effect','prophecy']){
  assert.ok(app.includes(`data-tt-order-group="${kind}"`));
  assert.ok(app.includes(`data-tt-order-end="${kind}"`));
 }
 assert.match(app,/prophecyOrder=moveOrderedCardToGap/);assert.match(app,/effectOrder=moveOrderedCardToGap/);
 assert.match(app,/data-tt-order-handle/);assert.match(app,/role="button" tabindex="0"/);
 assert.doesNotMatch(app,/prophecyUp:|prophecyDown:|effectUp:|effectDown:/);
 assert.match(css,/tt5-insert-before::before/);assert.match(css,/tt5-insert-after::after/);
 assert.match(css,/tt5-order-selected/);
});
test('card information identifies base and expansion effects but never serializes secret state',()=>{
 const all=createDeck(['book','glyphs','dreamcatchers','towers','premonitions','crossroads','oniverse','sphinx']);
 for(const c of all){const info=cardHelp(c);assert.ok(info.title&&info.detail,JSON.stringify(c));
  const html=renderCard({...c,id:'secret-id',hiddenDeckPosition:42});
  assert.match(html,/data-tt-card-info="/);assert.doesNotMatch(html,/hiddenDeckPosition/);
  const data=JSON.parse(html.match(/data-tt-card-info="([^"]*)"/)[1].replaceAll('&quot;','"'));
  assert.equal(data.kind,c.kind);assert.equal(data.id,undefined);
 }
 assert.match(cardHelp({kind:'denizen',ability:'cyclobot'}).detail,/Exchange/);
 assert.match(cardHelp({kind:'tower',number:4,color:'red',left:'sun',right:'moon'}).detail,/left edge/);
 assert.match(cardHelp({kind:'hidden'}).detail,/hidden/i);
});
test('inspection is installed once and offered for both board cards and decision cards',()=>{
 assert.match(app,/cardInspector=createCardInspector\(\{root:app\}\)/);
 assert.match(app,/cardInspector\?\.close\(\)/);
 assert.match(css,/\.tt5-inspection/);
 assert.equal(typeof createCardInspector,'function');assert.equal(typeof createDecisionReorder,'function');
});
