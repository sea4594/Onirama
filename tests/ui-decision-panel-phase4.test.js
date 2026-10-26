import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CARD_HEIGHT_RATIO} from '../public/tabletop/card-geometry.js';
import {decisionCardWidth,fitDecisionPanel} from '../public/tabletop/decision-fit-phase4.js';

const source = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const css = source('public/tabletop/decision-fit-phase4.css');

function el({width=0,height=0,items={},children={}}={}) {
 const styles=new Map();
 return {clientWidth:width,clientHeight:height,style:{setProperty:(key,value)=>styles.set(key,value),getPropertyValue:key=>styles.get(key)||''},
  dataset:{},querySelector:selector=>children[selector]||null,querySelectorAll:selector=>Array(items[selector]||0).fill({}),
  parentElement:null,offsetHeight:height};
}
function setup({width=844,height=390,dockWidth=422,dockHeight=158,kind='draft',count=8}={}) {
 const lane=el({items:{':scope > .card':count, ':scope > .tt3-order-item':count, ':scope > .tt4-card-option':count}});
 const decision=el({children:{'.tt7-prophecy':kind==='prophecy'?lane:null,'.tt23-happy-peek':kind==='happy'?lane:null,
  '.tt20-incantation':kind==='incantation'?lane:null,
  '.tt24-reveal-list, .tt3-order-list:not(.tt23-peek-cards):not(.tt26-prophecy-cards):not(.tt20-incantation-cards)':kind==='reorder'?lane:null,
  '.tt4-card-choices':kind==='options'?lane:null}});
 const scroll=el({width:dockWidth,height:dockHeight-40});
 const dock=el({width:dockWidth,height:dockHeight,children:{'.tt6-dock-scroll':scroll,'.tt6-dock-decision':kind==='draft'?null:decision,'.tt28-draft-cards':kind==='draft'?lane:null}});
 const viewport=el({width,height});
 const root=el({children:{'.game-viewport > .tt6-workspace':dock,'.game-viewport':viewport}});
 return {root,dock,lane,decision};
}

test('card widths respond to actual workspace dimensions and keep a legibility floor',()=>{
 for(const [w,h,count] of [[422,120,8],[350,112,7],[400,125,5],[640,260,5],[800,360,3]]){
  const size=decisionCardWidth({width:w,height:h,count});
  assert(size>=32 && size<=76);
  assert(size*CARD_HEIGHT_RATIO <= h || size===32);
 }
 assert(decisionCardWidth({width:600,height:220,count:5})>decisionCardWidth({width:160,height:75,count:5}));
 assert.equal(decisionCardWidth({width:0,height:0,count:8}),32);
 assert.equal(decisionCardWidth({width:310,height:110,count:12}),32);
});

test('draft uses the action panel, rather than viewport width, to fit eight cards',()=>{
 const {root,lane}=setup();
 const result=fitDecisionPanel(root);
 assert(result.draft>=32&&result.draft<=72);
 assert.equal(lane.style.getPropertyValue('--tt36-draft-card'),`${result.draft}px`);
 assert.equal(fitDecisionPanel(root).draft,result.draft);
});

test('phone portrait is a no-op, preserving existing decision geometry',()=>{
 const {root,lane}=setup({width:390,height:844,dockWidth:390,dockHeight:152});
 assert.equal(fitDecisionPanel(root),null);
 assert.equal(lane.style.getPropertyValue('--tt36-draft-card'),'');
});

test('reorder and option card lanes share the same aspect-aware dock fit',()=>{
 for(const kind of ['reorder','options']){
  const {root,decision}=setup({kind,count:5});
  const fit=fitDecisionPanel(root);
  assert(fit[kind]>=32);
  assert.equal(decision.style.getPropertyValue('--tt26-panel-card'),`${fit[kind]}px`);
  assert.equal(decision.dataset.tt36Fitted,'true');
 }
});

test('prophecy, Happy Dream and Incantation set sizes on their actual width-owning rows',()=>{
 const cases=[
  ['prophecy','.tt7-prophecy','.tt7-compact-row','--tt7-card-width','.tt26-prophecy-cards > .tt3-order-item'],
  ['happy','.tt23-happy-peek','.tt23-happy-row','--tt23-card-width','.tt23-peek-cards > .tt3-order-item, .tt23-discard-card'],
  ['incantation','.tt20-incantation','.tt20-incantation-cards','--tt31-card-width','.tt20-incantation-cards > :is(.tt20-incantation-choice,.tt20-incantation-reveal,.tt3-order-item)']
 ];
 for(const [family,selector,rowSelector,property,items] of cases){
  const row=el();
  const lane=el({items:{[items]:5},children:{[rowSelector]:row}});
  const decision=el({children:{[selector]:lane}});
  const scroll=el({width:422,height:110});
  const dock=el({width:422,height:158,children:{'.tt6-dock-scroll':scroll,'.tt6-dock-decision':decision}});
  const root=el({children:{'.game-viewport > .tt6-workspace':dock,'.game-viewport':el({width:844,height:390})}});
  const result=fitDecisionPanel(root);
  assert(result[family]>=32, family);
  assert.equal(row.style.getPropertyValue(property),`${result[family]}px`, family);
 }
});

test('decision panel scrollports and final actions cannot silently clip in landscape/tablet',()=>{
 assert.match(css,/@media \(orientation: landscape\), \(orientation: portrait\) and \(min-width: 600px\)/);
 assert.match(css,/\.tt6-dock-scroll\s*\{[^}]*overflow-y: auto !important/);
 assert.match(css,/\.tt26-prophecy-cards\s*\{[^}]*overflow-x: auto !important/);
 assert.match(css,/\.tt23-happy-row > \.tt23-peek-cards\s*\{[^}]*overflow-x: auto !important/);
 assert.match(css,/\.tt23-happy-row > \.tt23-happy-discard\s*\{[^}]*overflow-x: auto !important/);
 assert.match(css,/\.tt20-incantation-cards\s*\{[^}]*overflow-x: auto !important/);
 assert.match(css,/\.tt28-draft-cards\s*\{[^}]*overflow-x: auto !important/);
 assert.match(css,/\.tt7-prophecy > button\[data-action="prophecyConfirm"\]\s*\{[^}]*flex: 0 0 auto/);
 assert.match(css,/\.tt23-happy-controls\s*\{[^}]*flex: 0 0 auto !important/);
 const html=source('public/index.html');
 assert.equal((html.match(/decision-fit-phase4\.css/g)||[]).length,1);
 assert(html.indexOf('decision-fit-phase4.css')<html.indexOf('card-geometry.css')); // canonical card art remains last
 const app=source('public/app.js');
 assert.match(app,/fitDecisionPanel\(app\)/);
 assert.match(app,/decision-fit-phase4\.js/);
});
