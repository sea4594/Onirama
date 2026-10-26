import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CARD_HEIGHT_RATIO,CARD_WIDTH_RATIO,cardHeight,fitCardRect} from '../public/tabletop/card-geometry.js';
import {denizenCardWidth,fitDenizenCards} from '../public/tabletop/denizen-fit.js';
import {cardFlightRects} from '../public/tabletop/animation.js';
import {landscapeCardWidth} from '../public/tabletop/orientation.js';
import {renderCard} from '../public/tabletop/cards.js';

const text=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const css=text('public/tabletop/card-geometry.css');

test('card rectangles always preserve physical aspect across all representative sizes',()=>{
 assert.equal(CARD_HEIGHT_RATIO,1.42);
 assert.equal(CARD_WIDTH_RATIO,1/1.42);
 for(const width of [24,28,35,44,62,100,150]){
  assert.equal(cardHeight(width),width*1.42);
  for(const [aw,ah] of [[width,300],[width*3,width*.85],[width*2,width*2],[width*.8,width*3]]){
   const fitted=fitCardRect({left:8,top:14,width:aw,height:ah});
   assert(fitted.width>0&&fitted.height>0);
   assert(Math.abs(fitted.height/fitted.width-1.42)<1e-10);
   assert(fitted.left>=8-1e-10&&fitted.top>=14-1e-10);
   assert(fitted.left+fitted.width<=8+aw+1e-10);
   assert(fitted.top+fitted.height<=14+ah+1e-10);
  }
 }
 assert.equal(fitCardRect({left:0,top:0,width:0,height:3}),null);
 assert.equal(fitCardRect({left:0,top:0,width:NaN,height:3}),null);
});

test('animations, Denizen fitting and landscape shelf use one shared card shape',()=>{
 for(const width of [24,40,62,100]){
  const r={left:0,top:0,width,height:width*1.42};
  assert.deepEqual(cardFlightRects(r,r),{from:r,to:r});
 }
 for(const available of [65,90,160,500]){
  const width=denizenCardWidth(available,8);
  assert(width>=24&&width<=44);
  assert.equal(cardHeight(width),width*1.42);
 }
 assert(landscapeCardWidth(400,125,5)>0);
 assert.match(text('public/tabletop/denizen-fit.js'),/import \{CARD_HEIGHT_RATIO,cardHeight\}/);
 assert.match(text('public/tabletop/animation.js'),/import \{fitCardRect,cardHeight\}/);
});

test('card artwork geometry depends on its card box and not on viewport or parent panel',()=>{
 assert.match(css,/container-type:\s*inline-size/);
 assert.match(css,/--tt-card-height-ratio:\s*1\.42/);
 assert.match(css,/aspect-ratio:\s*1\s*\/\s*var\(--tt-card-height-ratio\)/);
 assert.match(css,/\.tt6-draft-cards/);
 assert.match(css,/\.tt6-hand-shelf/);
 assert.match(css,/\.tt3-order-handle/);
 assert.match(css,/\.tt8-flying-card\.card/);
 assert.match(css,/\.tt10-reveal-front > \.card/);
 assert.match(css,/\.card-kind-denizen > \.symbol/);
 assert.match(css,/\.card-kind-tower > \.tt5-tower-face/);
 assert.match(css,/\.tt8-tower-mark > \.ui-icon/);
 assert.match(css,/width: 100% !important;/);
 // Internal images may use percentages of the card or container query units,
 // not independent screen-size clamps that crush a miniature illustration.
 assert.doesNotMatch(css,/\d+(?:\.\d+)?(?:vw|vh|vmin|vmax)\b/);
});

test('all card kinds use the same face markup in solo, drafting and inspection',()=>{
 const cards=[
  {kind:'location',id:'loc',color:'red',symbol:'sun'},
  {kind:'tower',id:'tower',color:'green',number:10,left:'sun',right:'moon'},
  {kind:'door',id:'door',color:'blue'},
  {kind:'denizen',id:'denizen',color:'brown',ability:'keeper'},
  {kind:'nightmare',id:'nightmare'}
 ];
 for(const card of cards){
  for(const opts of [{},{tiny:true},{select:true},{select:true,tiny:true}]){
   const markup=renderCard(card,opts);
   assert.match(markup,/class="card /);
   assert.match(markup,new RegExp(`card-kind-${card.kind}`));
   assert.match(markup,card.kind==='tower'?/tt5-tower-face/:/class="symbol"/);
  }
 }
});

test('the canonical geometry layer ships LAST in both local app and Pages stylesheet bundle',()=>{
 const index=text('public/index.html');
 const links=[...index.matchAll(/<link rel="stylesheet" href="\.\/([^"?#]+\.css)">/g)].map(m=>m[1]);
 assert.equal(links.at(-1),'tabletop/card-geometry.css');
 assert(links.includes('tabletop/card-system.css'));
 assert(links.indexOf('tabletop/card-system.css')<links.length-1);
 assert(links.indexOf('tabletop/phase34.css')<links.length-1);
 assert.match(text('scripts/build-pages.js'),/const cssPaths=/);
});
