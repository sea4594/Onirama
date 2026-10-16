import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderCard} from '../public/tabletop/cards.js';
const source=name=>readFileSync(new URL(`../public/${name}`,import.meta.url),'utf8');

test('draw flips, moving cards and shuffle backs use the original tabletop card styling context',()=>{
 const js=source('tabletop/animation.js');
 assert.match(js,/stage\.className='game-viewport tt8-motion-stage'/);
 assert.match(js,/scope\.className=tabletop\?\.className/);
 assert.match(js,/attribute\.name\.startsWith\('data-'\)/);
 assert.match(js,/scope\.appendChild\(ghost\)/);
 assert.match(js,/\(scope\|\|document\.body\)\.appendChild\(overlay\)/);
 assert.match(js,/flightScope=activeStage\.scope/);
 assert.doesNotMatch(js,/getComputedStyle\(/,'flight must not freeze symbol positions at fixed pixel sizes');
 assert.match(source('tabletop/animation.css'),/\.tt8-motion-stage>\.tt8-motion-scope/);
});

test('Tower reveals preserve full-width art scaling instead of compact mark/number clamps',()=>{
 const css=source('tabletop/card-system.css');
 assert.match(css,/\.tt8-motion-stage :is\(\.tt8-flying-card\.card-kind-tower,\.tt10-reveal-front>\.card-kind-tower\)\{container-type:inline-size\}/);
 assert.match(css,/\.tt11-tower-number\{font-size:clamp\(9px,29cqw,40px\)!important/);
 assert.match(css,/\.tt8-tower-mark\{font-size:clamp\(8px,25cqw,35px\)!important/);
 const card=renderCard({id:'test-tower',kind:'tower',color:'blue',number:3,left:'sun',right:'moon'},{tiny:true});
 for(const cls of ['tt5-tower-face','tt8-tower-marks','tt8-tower-mark','tt11-tower-emblem','tt11-tower-number'])assert.ok(card.includes(cls));
});

test('bottom navigation and pinned setup actions use the bottom edge, not an empty safe-area strip',()=>{
 const nav=source('styles.css');const setup=source('tabletop/phase14.css');const shell=source('game-shell.css');
 assert.match(nav,/\.bottom-nav\{[^}]*padding-bottom:0;/);
 assert.doesNotMatch(setup,/calc\(10px \+ env\(safe-area-inset-bottom/);
 assert.match(setup,/\.shell-pinned-action\{[^}]*padding:10px/);
 assert.match(shell,/#app\{height:100vh;height:100dvh/);
 assert.match(shell,/#app \.bottom-nav\{position:relative;flex:0 0 auto/);
});
