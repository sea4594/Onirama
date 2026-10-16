import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderActionDock} from '../public/tabletop/action-dock.js';
const file=name=>readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=file('public/app.js'),css=file('public/tabletop/card-system.css');
const dock=(pending)=>renderActionDock({phase:'decision',status:'active',active:0,players:[{hand:[]}],pending},0,{dialog:{type:'decision',html:'<section class="decision"><button>Confirm</button></section>'}});

test('Phase 8: drawn-Door/Key choice keeps its own large left-side preview, without altering three-Location search',()=>{
 assert.match(app,/if\(p\.type==='door'\)return `<section class="decision tt25-drawn-door-decision">/);
 assert.match(app,/class="tt25-drawn-door-preview" data-action="useKey:gain"/);
 assert.match(app,/class="tt25-drawn-door-actions">\$\{btn\('Use Key','useKey:gain','primary'\)\}\$\{btn\('Pass','useKey:limbo'\)\}/);
 assert.match(app,/if\(p\.type==='doorSearch'\)return doorSearchDecision\(g,p\)/);
 assert.match(css,/\.tt25-drawn-door-decision\{display:grid!important;grid-template-columns:minmax\(0,clamp\(70px,22vw,92px\)\) minmax\(0,1fr\)/);
 assert.match(css,/\.tt25-drawn-door-preview>\.card\{width:100%!important/);
 assert.match(dock({type:'door',card:{kind:'door',color:'red'},keys:[]}),/data-dock-decision="decision"/);
});

test('Phase 8: bottom-panel header is outside the scrollport, with safe centering for oversized decisions',()=>{
 const html=dock({type:'prophecy'});
 assert.ok(html.indexOf('tt6-dock-status')<html.indexOf('tt6-dock-scroll'));
 assert.match(css,/\.tt6-dock-status\{position:relative;z-index:1;flex:0 0 auto!important/);
 assert.match(css,/\.tt6-dock-scroll\{box-sizing:border-box;flex:1 1 0!important;min-height:0!important;/);
 assert.match(css,/align-items:safe center!important/);
 assert.match(css,/overflow-y:auto!important;overflow-x:hidden!important/);
 assert.match(css,/\.tt6-dock-decision\{flex:0 0 auto!important;min-height:0!important;height:auto!important/);
 assert.match(css,/padding-bottom:max\(5px,calc\(env\(safe-area-inset-bottom,0px\) \/ 2\)\)!important/);
});

test('Phase 8: Premonition zone and card reserve do not inherit curved clipping from a parent',()=>{
 assert.match(css,/\.tt5-expansions>\.tt5-zone\.tt5-premonitions\{overflow:visible!important\}/);
 assert.match(css,/\.tt5-premonitions>\.tt5-contents\{overflow:visible!important\}/);
 assert.match(css,/\.tt5-premonitions \.tt14-reserve\{[\s\S]*?overflow:visible!important;clip-path:none!important/);
});
