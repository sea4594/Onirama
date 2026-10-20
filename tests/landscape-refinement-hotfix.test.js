import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {landscapeCardWidth,fitLandscapeDock} from '../public/tabletop/orientation.js';
import {fitTabletop} from '../public/tabletop/fit.js';
import {newGame,viewFor} from '../engine/game.js';
import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';

const css=readFileSync('public/tabletop/orientation.css','utf8');
const app=readFileSync('public/app.js','utf8');

// Cards shrink to fit either dimension, never to a changing aspect ratio.
test('landscape hand card sizing is bounded by both available width and height',()=>{
 for(const [width,height] of [[422,168],[720,290],[310,150],[500,190]])for(const n of [1,2,3,4,5,6,7,8]){
  const card=landscapeCardWidth(width,height,n);
  assert.ok(card>0,`${width}x${height}, ${n} cards`);
  assert.ok(card*n+3*(n-1)+10<=width,`horizontal fit: ${width}x${height}, ${n}`);
  assert.ok(card*1.42+17+10<=height,`vertical fit: ${width}x${height}, ${n}`);
 }
 assert.equal(landscapeCardWidth(100,100,0),0);
 assert.equal(landscapeCardWidth(0,100,2),0);
 assert.match(css,/aspect-ratio:1\/1\.42!important/);
 assert.match(css,/\.tt17-coop-hands \.tt6-card-back|\.tt17-coop-hands \.tt6-hand-cards \.tt6-card-back/);
});

test('only action dock draws a horizontal divider, with left-side highlight if required',()=>{
 assert.match(css,/\.tt6-hand-shelf\{[\s\S]*?border:0!important/);
 assert.match(css,/\.tt6-workspace\.tt8-required\{[\s\S]*?border-left:2px solid var\(--table-gold\)!important/);
 assert.match(css,/border-top:2px solid var\(--table-gold\)!important/);
 assert.match(css,/max\(0px,env\(safe-area-inset-left/);
 assert.match(css,/max\(8px,env\(safe-area-inset-right/);
 assert.match(css,/--tt6-dock-height:clamp\(150px,43dvh,290px\)/);
 assert.match(css,/overflow-y:auto!important/);
});

test('rotation does not mutate viewport meta and refits from neutral board geometry',()=>{
 assert.doesNotMatch(app,/meta\.content\s*=/);
 assert.match(app,/window\.visualViewport\?\.addEventListener\?\.\('resize',fitAfterViewportSettles\)/);
 assert.match(app,/window\.addEventListener\?\.\('orientationchange',fitAfterViewportSettles\)/);
 assert.match(app,/table\.style\.transform=''/);
 assert.match(app,/sizeLandscapeHands\(app\.querySelector\('\.tt6-hand-shelf'\)\)/);
});

test('a second landscape scaling measurement cannot leave unused right-hand space',()=>{
 const style={width:'',height:'',transform:'',zoom:'',left:'',transformOrigin:'',setProperty(){},removeProperty(){}};
 const table={style,dataset:{},querySelectorAll(){return []},querySelector(){return null},
  get scrollHeight(){return parseFloat(style.width)>900?900:800;},
  getBoundingClientRect(){return {height:parseFloat(style.transform.match(/[\d.]+/)?.[0]||1)*this.scrollHeight};}};
 const result=fitTabletop({clientWidth:844,clientHeight:220},table,{mode:'coop'});
 assert.ok(result.zoom<1);
 assert.ok(Math.abs(parseFloat(style.width)*result.zoom-844)<.05,`actual width ${parseFloat(style.width)*result.zoom}`);
 assert.ok(table.scrollHeight*result.zoom<=220);
});

test('solo and both multiplayer seats keep their existing physical hand groups in expansion combinations',()=>{
 const combos=[[],['towers'],['premonitions','dreamcatchers'],['mirrors','oniverse'],['towers','dreamcatchers','premonitions','mirrors','oniverse','book','glyphs','crossroads','sphinx'],['incubus']];
 for(const mode of ['solo','coop'])for(const expansions of combos){
  const raw=newGame({mode,seed:20261020,config:{expansions}});
  if(mode==='coop'){
   raw.phase='action';raw.players[0].hand=raw.draft.slice(0,3);raw.players[1].hand=raw.draft.slice(3,6);raw.shared=raw.draft.slice(6,8);raw.draft=[];
  }
  for(const seat of mode==='coop'?[0,1]:[0]){
   const g=viewFor(raw,seat),html=mode==='coop'?renderCooperativeTabletop(g,{seat}):renderSoloTabletop(g);
   if(mode==='coop'){
    const hand=html.match(/<div class="tt17-coop-hands">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/);
    assert.ok(hand,`co-op hand container ${expansions}`);
    assert.match(html,/tt17-your-hand/);assert.match(html,/tt17-partner-hand/);
    assert.match(html,/tt6-shared-block/);
    assert.ok(html.indexOf('tt17-coop-hands')<html.lastIndexOf('tt6-shared-block'));
   }else assert.match(html,/class="tt2-zone tt2-hand"/);
  }
 }
 assert.match(readFileSync('public/tabletop/orientation.js','utf8'),/board\.querySelector\('\.tt17-coop-hands,\.tt2-hand'\)/);
});

test('dock grows for real decision overflow but restores portrait styling',()=>{
 const vars=new Map();
 const style={setProperty(k,v,p){assert.equal(p,'important');vars.set(k,v)},removeProperty(k){vars.delete(k)}};
 const scroller={scrollHeight:265,clientHeight:110};
 const shell={clientHeight:390,style,querySelector(){return {querySelector(){return scroller}}}};
 const dock=fitLandscapeDock(shell,true);
 assert.ok(dock>170 && dock<=226.2,`dock height ${dock}`);
 assert.equal(vars.get('--tt6-dock-height'),`${dock}px`);
 assert.equal(fitLandscapeDock(shell,false),0);
 assert.equal(vars.has('--tt6-dock-height'),false);
});
