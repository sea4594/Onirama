import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fitPortraitSoloRows} from '../public/tabletop/fit.js';
import {renderDoorSlots} from '../public/tabletop/door-slots.js';

function gridFor(selectors){
 const vars=new Map();
 const grid={querySelector:s=>selectors.includes(s)?{}:null,style:{setProperty:(name,value)=>vars.set(name,value),removeProperty:name=>vars.delete(name)}};
 return {table:{querySelector:s=>s===':scope > .tt2-grid'?grid:null},vars};
}
test('Portrait solo allocates only real board sections, with no empty expansion rows',()=>{
 const base=gridFor([]);
 assert.deepEqual(fitPortraitSoloRows(base.table,true),[['doors','doors'],['piles','piles'],['labyrinth','labyrinth'],['hand','hand']]);
 assert.equal(base.vars.get('grid-template-rows'),'repeat(4,auto)');
 assert.equal(base.vars.get('grid-template-areas'),"'doors doors' 'piles piles' 'labyrinth labyrinth' 'hand hand'");
 const full=gridFor(['.tt5-premonitions','.tt8-towers-slot','.tt5-catchers','.tt9-exp-secondary','.tt9-exp-denizens']);
 assert.deepEqual(fitPortraitSoloRows(full.table,true),[
  ['doors','doors'],['premonitions','premonitions'],['towers','towers'],['catchers','catchers'],
  ['secondary','secondary'],['piles','denizens'],['labyrinth','labyrinth'],['hand','hand']
 ]);
 assert.equal(full.vars.get('grid-template-rows'),'repeat(8,auto)');
 assert.deepEqual(fitPortraitSoloRows(full.table,false),[]);
 assert.equal(full.vars.has('grid-template-areas'),false);
 assert.equal(full.vars.has('grid-template-rows'),false);
});
test('Portrait solo supports partial expansion combinations without blank rows or misordered zones',()=>{
 const cases=[
  [['.tt5-premonitions'],['doors','premonitions','piles','labyrinth','hand']],
  [['.tt8-towers-slot'],['doors','towers','piles','labyrinth','hand']],
  [['.tt5-catchers','.tt9-exp-denizens'],['doors','catchers','piles','labyrinth','hand']],
  [['.tt9-exp-secondary','.tt9-exp-denizens'],['doors','secondary','piles','labyrinth','hand']]
 ];
 for(const [selectors,expected] of cases){
  const {table}=gridFor(selectors);
  assert.deepEqual(fitPortraitSoloRows(table,true).map(row=>row[0]),expected);
 }
});
test('Unclaimed Oniverse goal stays a subdued empty slot; collected door gets the full-color styling',()=>{
 const none=renderDoorSlots([],{expansions:['oniverse']});
 assert.match(none,/class="tt8-door-slot wild /);
 assert.match(none,/class="tt8-door-empty wild"/);
 assert.doesNotMatch(none,/tt8-door-complete[^\"]*" aria-label="wild Door/);
 const won=renderDoorSlots([{id:'wild-1',kind:'door',color:'wild',expansion:'oniverse'}],{expansions:['oniverse']});
 assert.match(won,/tt8-door-slot wild tt8-door-complete/);
 assert.match(won,/card-oniverse/);
 const css=readFileSync(new URL('../public/tabletop/card-system.css',import.meta.url),'utf8');
 assert.match(css,/\.tt8-door-slot\.wild:not\(\.tt8-door-complete\)\{background:none;padding:0;box-shadow:none\}/);
 assert.match(css,/\.tt8-door-slot\.wild:not\(\.tt8-door-complete\) \.tt8-door-empty\{/);
 assert.match(css,/\.tt8-door-slot\.wild\.tt8-door-complete\{background:conic-gradient/);
 assert.match(css,/data-tt15-layout="portrait"\]\[data-tabletop-solo\] \.tt2-labyrinth\{\s*margin-top:0!important/);
});
