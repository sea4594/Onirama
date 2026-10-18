import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
const root=new URL('../public/',import.meta.url);
const css=path=>readFileSync(new URL(path,root),'utf8');
const card=css('tabletop/card-system.css');
function allCss(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(item=>item.isDirectory()?allCss(join(dir,item.name)):item.name.endsWith('.css')?[join(dir,item.name)]:[]);}
test('No shipped stylesheet uses a dashed outline or target border',()=>{
 for(const file of allCss(new URL('.',root).pathname))assert.doesNotMatch(readFileSync(file,'utf8'),/\bdashed\b/,file);
});
test('Selected ordinary and wild Location cards have matching, prominent outer rings',()=>{
 assert.match(card,/\.tt2-root \.card:is\(\.selected,\.tt7-eligible\)[^{]*\{[^}]*outline:3px solid #fff0b8!important;outline-offset:1px!important/);
 assert.match(card,/\.card\.wild\.card-kind-location:is\(\.selected,\.tt7-eligible\)\{\s*outline:3px solid #fff0b8!important;outline-offset:1px!important/);
 assert.match(card,/\.card\.tt7-eligible:not\(\.selected\)\{\s*outline:3px solid #f9d986!important;outline-offset:1px!important/);
 assert.doesNotMatch(card,/\.card\.tt7-eligible:not\(\.selected\)\{[^}]*outline-style:solid/);
});
test('Crowded Doors/Labyrinth/Towers stay inset without changing card color or size',()=>{
 assert.match(card,/\.tt2-door-stack,\.tt6-door-cards,\.tt2-labyrinth-row,\.tt6-labyrinth-cards,\.tt8-towers-slot,\.tt5-tower-cards/);
 assert.match(card,/\.tt8-goal-spot\.tt8-goal-chosen\{\s*outline-offset:-2px!important/);
 assert.match(card,/\.tt2-labyrinth-row,\.tt6-labyrinth-cards\) \.card\.wild\.card-kind-location:is\(\.selected,\.tt7-eligible\)\{outline-offset:-2px!important\}/);
 for(const body of card.matchAll(/\/\* Unified selection:[\s\S]*?(?=\.game-viewport \.tt6-workspace \.tt24-spell-goal)/g)){
  assert.doesNotMatch(body[0],/\b(?:background|padding|width|height|border-width)\s*:/);
 }
});
test('Search Freeing and Failsafe targets use matching solid gold, chosen catcher brighter',()=>{
 for(const name of ['tt-search-free-eligible','tt23-failsafe-target']){
  const sel=card.match(new RegExp(`\\.tt5-catcher\\.${name}\\{([^}]+)\\}`))?.[1];
  assert.ok(sel,name);assert.match(sel,/outline:3px solid #f9d986!important;outline-offset:-2px!important/);
  assert.match(sel,/filter:none!important/);
 }
 assert.match(card,/\.tt5-catcher\.tt-search-free-chosen\{outline:3px solid #fff5c5!important;outline-offset:-2px!important/);
});
