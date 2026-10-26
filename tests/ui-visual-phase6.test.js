import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderCard} from '../public/tabletop/cards.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const runner=read('scripts/ui-visual-gate.js');
const css=read('public/tabletop/card-geometry.css');

test('the full release gate includes real-browser geometry validation and builds afterwards',()=>{
 const pkg=JSON.parse(read('package.json'));
 assert.match(pkg.scripts['release:gate'],/npm run check && npm run ui:visual && npm run build:pages/);
 assert.match(pkg.scripts['ui:visual'],/scripts\/ui-visual-gate\.js/);
 const ci=read('.github/workflows/ci.yml');
 assert.match(ci,/browser-actions\/setup-chrome@v2/);
 assert.match(ci,/ONIRAMA_REQUIRE_BROWSER: '1'/);
});

test('visual regression browser evaluates rendered game cards, never CSS source alone',()=>{
 assert.match(runner,/renderSoloTabletop\(game\)/);
 assert.match(runner,/renderCooperativeTabletop\(game,\{seat\}\)/);
 assert.match(runner,/renderActionDock\(game,seat\)/);
 assert.match(runner,/Page\.setDocumentContent/);
 assert.match(runner,/Emulation\.setDeviceMetricsOverride/);
 assert.match(runner,/getBoundingClientRect\(\)/);
 assert.match(runner,/window\.__fitTabletop/);
 assert.match(runner,/window\.__fitDenizenCards/);
 assert.match(runner,/replay.*pause|Replay and Pause overlap/s);
 assert.match(runner,/scrollWidth>lane\.clientWidth/);
 assert.match(runner,/collapsed Denizen/);
 assert.match(runner,/Tower edge symbol/);
 assert.match(runner,/intentionally|deliberately collapsed card/);
});

test('geometry matrix covers phone/tablet/desktop orientations and both coop perspectives',()=>{
 for(const dims of ['390,844','844,390','768,1024','1024,768','1440,900','1920,1080'])assert(runner.includes('['+dims+']'));
 for(const key of ['solo-heavy-0','coop-heavy-0','coop-heavy-1'])assert(runner.includes(key));
 assert.match(runner,/expansions=\['towers','dreamcatchers','premonitions','mirrors','book','oniverse'\]/);
 assert.match(runner,/if\(!bin\)/);
 assert.match(runner,/UI VISUAL GATE SKIPPED/);
 assert.match(runner,/UI VISUAL GATE FAILED/);
});

test('Tower face cannot resolve to zero-width grid tracks in small cards',()=>{
 assert.match(css,/Phase 6: an inline-size container can have a 0px intrinsic grid track/);
 assert.match(css,/\.card-kind-tower > \.tt5-tower-face\s*\{\s*position: absolute !important;/);
 assert.match(css,/inset: 2px !important;/);
 assert.match(css,/width: auto !important;/);
 const tower=renderCard({kind:'tower',id:'tower',color:'red',number:5,left:'sun',right:'moon'},{select:true,tiny:true});
 assert.match(tower,/tt5-tower-face/);
 assert.equal((tower.match(/class="tt8-tower-mark"/g)||[]).length,2);
});

test('portrait composition is preserved, with shared geometry stylesheet still last',()=>{
 const index=read('public/index.html');
 assert(index.indexOf('tabletop/card-geometry.css')>index.indexOf('tabletop/decision-fit-phase4.css'));
 assert(!runner.includes("window.location.href="));
 assert(!runner.includes('Page.navigate'));
});
