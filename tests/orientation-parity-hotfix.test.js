import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {arrangeGameplayHand} from '../public/tabletop/orientation.js';
import {tabletopShape,fitTabletop} from '../public/tabletop/fit.js';
import {newGame,viewFor} from '../engine/game.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';
import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';

const app=readFileSync('public/app.js','utf8');
const css=readFileSync('public/tabletop/orientation.css','utf8');
const interactions=readFileSync('public/tabletop/interactions.js','utf8');

test('phone portrait retains the original layout; tablet portrait selects its same composition',()=>{
 assert.equal(tabletopShape(390,844),'portrait');
 assert.equal(tabletopShape(768,1024),'medium');
 const makeTable=()=>({style:{setProperty(){},removeProperty(){}},dataset:{},querySelectorAll(){return []},querySelector(){return null},get scrollHeight(){return 0},getBoundingClientRect(){return {height:836}}});
 const tablet=fitTabletop({clientWidth:768,clientHeight:836},makeTable(),{mode:'solo'});
 assert.equal(tablet.layout,'portrait');
 const phone=fitTabletop({clientWidth:390,clientHeight:656},makeTable(),{mode:'solo'});
 assert.equal(phone.layout,'portrait');
 assert.match(css,/@media \(orientation:portrait\) and \(min-width:675px\)/);
 assert.doesNotMatch(css,/@media\s*\(orientation:portrait\) and \(max-width:/);
});

test('all landscape sizes reserve two equal hand/dock areas with board above',()=>{
 for(const size of [[844,390],[1024,768],[1440,900]]){
  const [width,height]=size;
  const table={style:{setProperty(){},removeProperty(){}},dataset:{},querySelectorAll(){return []},querySelector(){return null},get scrollHeight(){return 0},getBoundingClientRect(){return {height}}};
  assert.equal(fitTabletop({clientWidth:width,clientHeight:height},table).layout,height<560?'short':'wide');
 }
 assert.match(css,/\.tt6-hand-shelf\{display:flex!important/);
 assert.match(css,/width:50%;height:var\(--tt6-dock-height\)/);
 assert.match(css,/\.tt6-workspace\{inset:auto 0 0 50%!important;width:50%!important/);
 assert.match(css,/\.tt6-table-slot\{inset:0 0 var\(--tt6-dock-height\) 0!important/);
 assert.match(css,/:has\(\.tt9-exp-denizens\):not\(:has\(\.tt8-towers-slot\)\)/);
});

function element(){return {parentNode:null,parentElement:null,children:[],get firstElementChild(){return this.children.find(child=>!child.comment)||null;},appendChild(child){child.parentNode?.removeChild(child);this.children.push(child);child.parentNode=this;child.parentElement=this;child.isConnected=true;},insertBefore(child,next){child.parentNode?.removeChild(child);const i=this.children.indexOf(next);assert.ok(i>=0);this.children.splice(i,0,child);child.parentNode=this;child.parentElement=this;child.isConnected=true;},removeChild(child){this.children.splice(this.children.indexOf(child),1);child.parentNode=null;child.parentElement=null;child.isConnected=false;}};}
test('landscape moves the same hand node and returns it to its original seat and order on rotation',()=>{
 for(const mode of ['solo','coop']){
  const parent=element(),shelf=element(),hand=element(),before=element(),after=element(),board=element();
  parent.appendChild(before);parent.appendChild(hand);parent.appendChild(after);
  hand.className=mode==='solo'?'tt2-hand':'tt6-self';
  board.style={getPropertyValue(){return '66px'}};
  board.querySelector=selector=>selector.includes('tt2-hand')?parent.children.find(c=>c===hand)||null:null;
  shelf.style={setProperty(k,v){assert.equal(k,'--tt15-card');assert.equal(v,'66px');}};
  const shell={querySelector(selector){return selector==='.tt2-root'?board:selector==='.tt6-hand-shelf'?shelf:null;}};
  const root={querySelector(selector){return selector==='.game-viewport'?shell:null;}};
  const originalDocument=globalThis.document;
  globalThis.document={createComment(){const comment={comment:true,isConnected:false,remove(){this.parentNode?.removeChild(this);}};return comment;}};
  try{
   arrangeGameplayHand(root,true);
   assert.equal(shelf.firstElementChild,hand);
   assert.equal(parent.children[0],before);
   assert.equal(parent.children.at(-1),after);
   arrangeGameplayHand(root,true);
   assert.equal(parent.children.length,3,'repeated refit must not insert another anchor');
   arrangeGameplayHand(root,false);
   assert.equal(parent.children.length,3);
   assert.deepEqual(parent.children,[before,hand,after]);
   assert.equal(shelf.firstElementChild,null);
  }finally{globalThis.document=originalDocument;}
 }
});

test('solo and co-op boards retain real expansion equipment and exactly one private active hand',()=>{
 const combinations=[[],['towers','dreamcatchers','premonitions','mirrors','oniverse','book','glyphs','crossroads','sphinx'],['incubus']];
 for(const mode of ['solo','coop'])for(const expansions of combinations){
  const raw=newGame({mode,seed:3001,config:{expansions}}),g=viewFor(raw,0);
  const html=mode==='solo'?renderSoloTabletop(g):renderCooperativeTabletop(g,{seat:0});
  assert.equal((html.match(/class="tt2-zone tt2-hand"/g)||[]).length,mode==='solo'?1:0);
  if(mode==='coop'){
   assert.equal((html.match(/tt6-self tt17-your-hand/g)||[]).length,1);
   assert.equal((html.match(/tt6-opponent tt17-partner-hand/g)||[]).length,1);
  }
  if(expansions.includes('towers'))assert.match(html,/tt8-towers-slot/);
  if(expansions.includes('dreamcatchers'))assert.match(html,/tt5-catchers/);
  if(expansions.includes('premonitions'))assert.match(html,/tt5-premonitions/);
  if(expansions.includes('oniverse'))assert.match(html,/tt17-coop-denizens|tt9-exp-denizens/);
 }
 assert.match(app,/arrangeGameplayHand\(app,/);
 assert.match(interactions,/const playableCards=/);
 assert.match(interactions,/!inPlay\(c\)/);
 assert.match(interactions,/const cards=playableCards\(\)/);
});

test('rotation refits the transformed tabletop and restores normal pinch-zoom controls',()=>{
 assert.match(app,/meta\.content='width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, viewport-fit=cover'/);
 assert.match(app,/meta\.content=original;fitAfterViewportSettles\(\)/);
 assert.match(app,/\[80,200,400,750,1200\]/);
 assert.doesNotMatch(readFileSync('public/index.html','utf8'),/user-scalable=no|maximum-scale=1/);
});
