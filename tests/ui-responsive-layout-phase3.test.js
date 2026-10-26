import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {landscapeCardWidth} from '../public/tabletop/orientation.js';
import {tabletopDimensions} from '../public/tabletop/fit.js';
const source=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const css=source('public/tabletop/responsive-fit-phase3.css');

test('crowded landscape hands have a legibility floor and retain the canonical ratio',()=>{
 for(const [w,h] of [[844,390],[1024,768],[1440,900],[1920,1080]]){
  const shelfWidth=w*.5 - 12;
  for(const count of [1,5,10,18]){
   const size=landscapeCardWidth(shelfWidth,h*.43-12,count);
   assert(size>=24,`width ${w} count ${count}`);
   assert(size*1.42<=h*.43-12-17-10+1);
  }
 }
 assert.equal(landscapeCardWidth(42,130,12),24);
 assert.equal(landscapeCardWidth(350,20,4),0);
});

test('landscape panel card lanes and hand shelf are scrollable rather than cropped',()=>{
 assert.match(css,/@media \(orientation: landscape\)/);
 assert.match(css,/\.tt6-dock-scroll\s*\{[^}]*overflow-y: auto !important/);
 assert.match(css,/\.tt3-order-list, \.tt4-card-choices, \.cards/);
 assert.match(css,/\.tt6-dock-decision :is\([^)]*\)\s*\{[^}]*overflow-x: auto !important/);
 assert.match(css,/\.tt2-hand-row, \.tt6-hand-cards/);
 assert.match(css,/\.tt6-hand-shelf :is\([^)]*\)\s*\{[^}]*overflow-x: auto !important/);
 assert.match(css,/\.tt5-zone\[data-tt-responsive-overflow="true"\]/);
});

test('oversized equipment uses scroll rather than scaling artwork below readability',()=>{
 const fit=source('public/tabletop/fit.js');
 assert.match(fit,/const overflows=needed<\.28&&table\.dataset\.tt15Layout!=='portrait'/);
 assert.match(fit,/zone\.dataset\.ttResponsiveOverflow='true'/);
 assert.match(fit,/delete zone\.dataset\.ttResponsiveOverflow/);
 assert.match(fit,/const scale=clamp\(needed,\.28,1\)/);
 assert.match(fit,/inner\.style\.left=overflows\?'4px'/);
 for(const [w,h] of [[844,390],[1024,768],[1440,900],[390,844],[768,1024]]){
  const plan=tabletopDimensions(w,h,'coop',8);
  assert(plan.card>0&&plan.mini>0);
 }
});

test('portrait and canonical card artwork styles remain last and unchanged',()=>{
 assert.match(css,/@media \(orientation: portrait\) and \(min-width: 600px\)/);
 assert.doesNotMatch(css,/@media \(orientation: portrait\) and \(max-width:/);
 assert.doesNotMatch(css,/\.card-kind-(?:tower|denizen)/);
 const html=source('public/index.html');
 assert(html.indexOf('/responsive-fit-phase3.css')>0);
 assert(html.indexOf('/responsive-fit-phase3.css')<html.indexOf('/card-geometry.css'));
 assert.equal((html.match(/responsive-fit-phase3\.css/g)||[]).length,1);
});
