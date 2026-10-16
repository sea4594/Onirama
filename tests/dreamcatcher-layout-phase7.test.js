import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {expansionTabletopZones} from '../public/tabletop/expansions.js';
import {renderPileInspector} from '../public/tabletop/action-dock.js';
import {cardHelp} from '../public/tabletop/card-inspection.js';

const file=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const cards=n=>Array.from({length:n},(_,i)=>({id:`c${n}-${i}`,kind:'location',color:['red','blue','green','brown'][i%4],symbol:['sun','moon','key','glyph'][i%4]}));
const game={phase:'action',active:0,players:[{doors:[]}],expansion:{dreamcatchers:{stacks:[cards(0),cards(1),cards(3),cards(5)],active:[true,true,true,true],failsafes:2}}};

test('four Dreamcatchers remain full-width compartments, with card faces positioned across the full available slot',()=>{
 const html=expansionTabletopZones(game).find(z=>z.includes('data-tt-zone="catchers"'));
 assert.equal((html.match(/data-action="inspectCatcher:/g)||[]).length,4);
 assert.equal((html.match(/class="tt14-held-card"/g)||[]).length,9);
 assert.match(html,/--tt14-held:5/);
 assert.match(html,/--tt14-position:0(?:\.0000)?;/);
 assert.match(html,/--tt14-position:0\.5(?:000)?;/);
 assert.match(html,/--tt14-position:1(?:\.0000)?;/);
 const base=file('public/tabletop/phase14.css');
 assert.match(base,/\.tt5-catchers \.tt14-catcher-face\{display:contents!important\}/);
 assert.match(base,/\.tt5-catchers \.tt5-catcher\{\s*container-type:size;/);
 assert.match(base,/repeating-linear-gradient\(135deg,#233d35/);
 assert.match(base,/--tt14-card-w:min\(calc\(\(100cqh - 6px\)\*\.705\),calc\(100cqw - 4px\)\)/);
 assert.match(base,/aspect-ratio:1\/1\.42!important/);
});

test('opened Dreamcatchers expose every visible card to long-press and keyboard inspection',()=>{
 const html=renderPileInspector(game,'catcher:2',0);
 assert.match(html,/data-pile-inspector/);
 assert.equal((html.match(/data-tt-card-info=/g)||[]).length,3);
 assert.equal((html.match(/tabindex="0"/g)||[]).length,3);
 assert.doesNotMatch(html,/data-action="inspectCard:/);
 assert.match(file('public/tabletop/card-system.css'),/\.tt6-pile-inspector \.tt9-stack-details \.card\.tiny\[data-tt-card-info\]\{\s*pointer-events:auto;/);
 const inspector=file('public/tabletop/card-inspection.js');
 assert.match(inspector,/root\.addEventListener\('pointerdown',down\)/);
 assert.match(inspector,/setTimeout\(\(\)=>\{/);
 assert.match(inspector,/ignoreClick=true;open\(card,x,y\)/);
 assert.match(inspector,/root\.addEventListener\('contextmenu',context\)/);
 assert.match(inspector,/e\.key\.toLowerCase\(\)==='i'/);
 assert.match(cardHelp({kind:'location',color:'red',symbol:'sun'}).detail,/Play in your Labyrinth/);
});

test('empty and removed Dreamcatchers retain complete compartments and inspector does not invent card data',()=>{
 const empty=renderPileInspector(game,'catcher:0',0);
 assert.match(empty,/>Empty</);
 assert.doesNotMatch(empty,/data-tt-card-info/);
 const html=renderPileInspector({...game,phase:'decision'},'catcher:2',0);
 assert.equal((html.match(/data-tt-card-info=/g)||[]).length,3);
 assert.doesNotMatch(html,/data-action="freeCatcher:/);
 assert.equal(renderPileInspector(game,'catcher:6',0),'');
});
