import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {tabletopDimensions,tabletopShape,fitTabletop} from '../public/tabletop/fit.js';
const css=readFileSync('public/tabletop/adaptive.css','utf8');
const index=readFileSync('public/index.html','utf8');
test('adaptive layout is last in the production stylesheet order and retains physical card proportions',()=>{
 assert.ok(index.indexOf('phase14.css')<index.indexOf('adaptive.css'));
 assert.match(css,/aspect-ratio:1\s*\/\s*1\.42/);
 assert.match(css,/\.tt5-catchers \.tt14-catcher-face\{width:auto!important/);
 assert.match(css,/\.tt5-expansions:empty\{display:none!important/);
});
test('distinct solo and co-op compositions use board geometry rather than entire-screen font zoom',()=>{
 for(const layout of ['portrait','short','tablet','wide']){
  assert.ok(css.includes(`data-tt15-layout="${layout}"`),layout);
  assert.ok(css.includes(`data-tt15-layout="${layout}"][data-tabletop-coop]`),layout);
  assert.ok(css.includes(`data-tt15-layout="${layout}"][data-tabletop-solo]`),layout);
 }
 assert.equal(tabletopShape(390,844),'portrait');assert.equal(tabletopShape(768,1024),'medium');
 assert.equal(tabletopShape(844,390),'short');assert.equal(tabletopShape(1440,900),'wide');
 assert.ok(tabletopDimensions(390,844,'solo',0).card>tabletopDimensions(390,844,'coop',9).mini);
});
test('measurement fitter preserves normal card scale until all internal densities are attempted',()=>{
 const source=readFileSync('public/tabletop/fit.js','utf8');
 assert.ok(source.indexOf('for(const tier of')<source.indexOf('let zoom=1'));
 assert.match(source,/fitTiles\(table\)/);
 assert.match(source,/overlapRows\(table\)/);
 assert.match(source,/table\.style\.height=`\$\{height\}px`/);
 assert.equal(fitTabletop(null,null),null);
});
test('landscape phones trade side rails for full-width action strip; wide equipment uses one row',()=>{
 assert.match(css,/\.game-viewport>\.tt6-table-slot\{left:0!important;right:0!important/);
 assert.match(css,/\.tt5-expansions\{display:flex!important;flex-flow:row nowrap!important/);
 assert.match(css,/grid-column:span 7!important/);
 assert.match(css,/grid-column:span 5!important/);
});
test('portrait phones reserve a compact fixed action footprint without sacrificing decision scrolling',()=>{
 assert.match(css,/#app>\.page\.game-viewport\{--tt6-dock-height:112px\}/);
 assert.match(css,/\.tt6-dock-scroll\{overflow-y:auto!important/);
});
