import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderCard} from '../public/tabletop/cards.js';
const css=file=>readFileSync(new URL(`../public/${file}`,import.meta.url),'utf8');
const faces=css('tabletop/card-system.css'),interaction=css('tabletop/interactions.css'),global=css('styles.css');
const card=(color,id)=>renderCard({id,kind:'location',color,symbol:'key'},{select:true,selectedId:id});
test('Phase 5: selecting any Location does not add a color-changing overlay',()=>{
 for(const color of ['red','blue','green','brown','wild']){
  assert.match(card(color,color),new RegExp(`class="card ${color} card-kind-location selected"`));
  assert.match(faces,/\.card:is\(\.selected,\.tt7-eligible\)\{filter:none!important;opacity:1!important;transform:none!important;box-shadow:none!important;outline:/);
 }
 assert.equal((global.match(/button:not\(\.card\):hover:not\(:disabled\)/g)||[]).length,2,'both generic button-hover rules must exempt card faces');
 assert.doesNotMatch(global,/(^|\n)button:hover:not\(:disabled\)/,'no unscoped button-hover fill may recolor cards');
 assert.match(interaction,/\[data-tt-card\]:hover:not\(:disabled\)\{outline:/,'hover outlines cards without repainting faces');
});
test('Phase 5: Crossroads have four-color faces in selected, moving, and reveal states',()=>{
 assert.match(faces,/:is\(\.game-viewport \.card, \.tt8-flying-card\.card, \.tt10-reveal-front>\.card\)\.wild\.card-kind-location/);
 assert.match(faces,/conic-gradient\(from 35deg at 50% 52%/,'rainbow treatment fills the interior');
 assert.match(faces,/\.wild\.card-kind-location:is\(\.selected,\.tt7-eligible\)\{outline:/);
});
test('Phase 5: flight/reveal clones retain the same card icon geometry as their static cards',()=>{
 assert.match(faces,/:is\(\.game-viewport \.card,\.tt8-flying-card\.card,\.tt10-reveal-front>\.card\):not\(\.card-kind-tower\)>\.symbol/);
 assert.match(faces,/\.tt8-flying-card:is\(\.tt2-empty-pile,\.tt14-empty-pile,\.tt6-card-back\) \.ui-icon/);
 assert.match(faces,/\.card-kind-denizen>\.symbol\{top:45%!important;width:64%!important\}/);
 assert.match(readFileSync(new URL('../public/tabletop/animation.js',import.meta.url),'utf8'),/template:motionTemplate\(el\)/,'Tower motion clones keep their measured icon geometry');
});
