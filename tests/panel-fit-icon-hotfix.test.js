import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {icon} from '../public/icons.js';
const src=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
test('solo and multiplayer use matching outlined people, and the settings hub is centered',()=>{
 const solo=icon('single'),multi=icon('users'),settings=icon('settings');
 assert.match(solo,/<circle cx="12" cy="7" r="4"\/>/);
 assert.match(solo,/<path d="M20 21v-2/);
 assert.match(multi,/<circle cx="9" cy="7" r="4"\/>/);
 assert.doesNotMatch(solo,/<rect/);
 assert.match(settings,/<circle cx="12" cy="12" r="3\.3"\/>/);
 assert.doesNotMatch(settings,/<circle cx="13"/);
});
test('bottom dock returns to the fixed full 188/116px heights',()=>{
 const css=src('public/tabletop/phase16.css');
 assert.match(css,/--tt6-dock-height:188px!important/);
 assert.match(css,/--tt6-dock-height:116px!important/);
 assert.doesNotMatch(css,/--tt6-dock-height:(?:169|104)px!important/);
});
test('Happy Dream scales seven cards jointly, with independent side-by-side zones and no scrolling',()=>{
 const app=src('public/app.js'),css=src('public/tabletop/card-system.css');
 assert.match(app,/tt23-happy-peek" style="--tt23-per-card:\$\{/);
 assert.match(css,/\.tt23-happy-peek\{container-type:inline-size\}/);
 assert.match(css,/--tt23-card-width:min\(var\(--tt26-panel-card\),calc\(var\(--tt23-per-card\) - 15px\)\)/);
 assert.match(css,/\.tt23-peek-cards\{[\s\S]*?overflow:hidden!important/);
 assert.match(css,/\.tt23-discard-stack\{[\s\S]*?overflow:hidden!important/);
 assert.match(css,/\.tt23-happy-row\{[\s\S]*?flex-wrap:nowrap!important/);
});
test('reorder, prophecy, incantation, premonition and cooperative draft also fit their actual counts',()=>{
 const app=src('public/app.js'),css=src('public/tabletop/card-system.css'),dock=src('public/tabletop/action-dock.js');
 for(const marker of ['--tt24-per-card:','--tt7-per-card:','--tt20-per-card:','--tt22-per-card:','--tt21-per-card:'])assert.ok(app.includes(marker),marker);
 assert.ok(dock.includes('--tt28-per-card:'));
 for(const marker of ['tt3-order-list.tt24-reveal-list','tt26-prophecy-cards','tt20-incantation-cards','tt22-prem-options','tt28-draft-cards'])assert.ok(css.includes(marker),marker);
 assert.match(css,/\.tt6-dock-decision \.tt3-order-list\.tt24-reveal-list>\.tt3-order-item\{[\s\S]*?flex:0 0 min/);
 assert.match(css,/\.tt28-draft-cards\{container-type:inline-size;justify-content:center!important;overflow:hidden!important/);
 assert.match(css,/\.tt26-fetch-strip\{[^}]*overflow-x:auto/); // Exception: whole-deck search
});
