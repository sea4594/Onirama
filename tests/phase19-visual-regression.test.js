import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderCard} from '../public/tabletop/cards.js';
import {premonitionFace} from '../public/tabletop/expansions.js';
import {icon} from '../public/icons.js';
const css=readFileSync('public/tabletop/phase18.css','utf8');
test('co-op hands override legacy grid areas with explicit independent columns',()=>{
 assert.match(css,/\.tt17-coop-hands\{[\s\S]*?grid-template-columns:minmax\(0,1fr\) minmax\(0,\.68fr\) minmax\(0,1fr\)/);
 assert.match(css,/\.tt17-coop-hands>:nth-child\(1\)\{grid-column:1!important/);
 assert.match(css,/\.tt17-coop-hands>:nth-child\(2\)\{grid-column:2!important/);
 assert.match(css,/\.tt17-coop-hands>:nth-child\(3\)\{grid-column:3!important/);
 assert.match(css,/\.tt17-coop-hands>\.tt6-opponent\{[\s\S]*?grid-area:auto!important/);
});
test('miniature Denizens retain clear art and accessible full names',()=>{
 assert.match(css,/@container \(max-width:54px\)/);
 assert.match(css,/\.card\.card-kind-denizen \.card-label\{display:none!important\}/);
 const keeper=renderCard({id:'k',kind:'denizen',ability:'keeper'},{tiny:true,select:true});
 assert.match(keeper,/aria-label="Repentant Treasure Keeper"/);
 assert.match(keeper,/class="card-label">Treasure Keeper<\/span>/);
 const squirrel=renderCard({kind:'denizen',ability:'squirrel'},{tiny:true});
 assert.match(squirrel,/class="card-label">Squirrel Spies<\/span>/);
});
test('Premonitions show effect-specific outcomes without reusing the same art',()=>{
 const ids=['red2','green2','blue2','brown2','pair2','doors5','rainbow4','doors3'];
 assert.equal(new Set(ids.map(premonitionFace)).size,8);
 for(const name of ['return-nightmare-art','broken-key-art','broken-door-art','double-door-loss-art','redraw-hand-art','ban-dream-art'])assert.match(icon(name),/<svg[^>]*>[\s\S]*<\/svg>/);
 assert.match(premonitionFace('pair2'),/M3 21V8/);
 assert.match(premonitionFace('doors3'),/M18 7a6/);
});
