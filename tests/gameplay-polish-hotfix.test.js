import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,act,viewFor} from '../engine/game.js';
import {pileInventory,inventoryCategory} from '../engine/pile-inventory.js';
import {renderPileInspector} from '../public/tabletop/action-dock.js';
import {renderDenizenTabletop} from '../public/tabletop/expansions.js';
import {soloLegalTargets,cooperativeLegalTargets} from '../public/tabletop/interactions.js';
import {captureLabyrinthScroll,restoreLabyrinthScroll} from '../public/tabletop/labyrinth-scroll.js';

const game = (expansions,mode='solo') => newGame({seed:20357,mode,config:{expansions},interactiveDraw:true});

test('Tower pile inventory retains the actual sun/moon edges in both draw and discard menus',()=>{
 const s=game(['towers']);
 const tower=s.deck.find(c=>c.kind==='tower'&&(c.left||c.right));assert(tower);
 const key=inventoryCategory(tower);assert.equal(key.split(':').length,8);
 const row=pileInventory(s).find(r=>r.key===key);assert(row);assert.equal(row.deck,1);
 const html=renderPileInspector(viewFor(s,0),'deck',0);
 for(const mark of [...String(tower.left||'').split('+'),...String(tower.right||'').split('+')].filter(Boolean))assert.match(html,new RegExp('data-tower-mark="'+mark+'"'));
 const moved=s.deck.splice(s.deck.findIndex(c=>c.id===tower.id),1)[0];s.discard.push(moved);
 const discarded=renderPileInspector(viewFor(s,0),'discard',0);
 assert.match(discarded,/card-kind-tower/);
 assert.match(discarded,/tt8-tower-marks/);
 assert.equal(pileInventory(s).find(r=>r.key===key).discard,1);
});

test('Keeper cards are targets only when the same hand play/discard actions are available',()=>{
 for(const mode of ['solo','coop']){
  const s=game(['oniverse'],mode),owner=0;
  const held=s.deck.find(c=>c.kind==='location');assert(held);
  s.deck.splice(s.deck.findIndex(c=>c.id===held.id),1);
  held.owner=owner;held.holderId='keeper-one';s.moduleState.oniverse.zones.treasure.push(held);
  const legal=id=>mode==='solo'?soloLegalTargets(viewFor(s,owner),id,owner):cooperativeLegalTargets(viewFor(s,owner),id,owner);
  s.active=owner;s.phase='decision';s.pending={type:'drawReady'};
  assert.deepEqual(legal(held.id),[]);
  assert.throws(()=>act(s,{type:'play',id:held.id}),/Draw the next card/);
  s.phase='turnComplete';s.pending=null;
  assert.deepEqual(legal(held.id),[]);
  s.phase='action';
  assert(legal(held.id).includes('discard'));
  if(mode==='coop')assert.deepEqual(cooperativeLegalTargets(viewFor(s,1),held.id,1),[]);
 }
});

test('Denizen collections shrink proportionally then scroll past a 24px minimum',()=>{
 const s=game(['oniverse'],'coop'),deck=s.moduleState.oniverse.zones;
 for(const [i,card] of [...s.deck.filter(c=>c.kind==='denizen'),...(deck.unused||[])].slice(0,8).entries()){
  card.owner=0;deck.rallied.push({...card,id:'rallied-'+i});
 }
 const html=renderDenizenTabletop(viewFor(s,0),{owner:0,canAct:true});
 assert.match(html,/--tt-denizen-unit:12\.50000%/);
 assert.equal((html.match(/class="tt17-denizen-holder"/g)||[]).length,8);
 const css=readFileSync('public/tabletop/phase34.css','utf8');
 assert.match(css,/clamp\(24px,calc\(var\(--tt-denizen-unit,100%\) - 9px\),44px\)/);
 assert.match(css,/overflow-x:auto!important/);
 assert.match(css,/aspect-ratio:1\/1\.42!important/);
});


test('Only the active multiplayer owner can select a stored Treasure Keeper card',()=>{
 const s=game(['oniverse'],'coop'),stored=s.deck.find(c=>c.kind==='location');
 const keeper=s.deck.find(c=>c.kind==='denizen');assert(stored&&keeper);
 s.moduleState.oniverse.zones.rallied.push({...keeper,id:'partner-keeper',owner:1});
 s.moduleState.oniverse.zones.treasure.push({...stored,id:'partner-treasure',owner:1,holderId:'partner-keeper'});
 s.phase='action';s.active=0;
 const partner=renderDenizenTabletop(viewFor(s,0),{owner:1,canAct:true});
 assert.doesNotMatch(partner,/data-pick="partner-treasure"/);
 s.active=1;
 const own=renderDenizenTabletop(viewFor(s,1),{owner:1,canAct:true});
 assert.match(own,/data-pick="partner-treasure"/);
});

function row(name,ids,scrollLeft=0,width=175){
 const lane={dataset:{tabletopScroll:name},scrollLeft,scrollWidth:width,
  querySelectorAll:()=>ids.map(id=>({getAttribute:()=>id}))};
 return lane;
}
const root=lanes=>({querySelectorAll:()=>lanes});

test('Labyrinth follows a new card all the way to the next slot but preserves manual position otherwise',()=>{
 const lanes=[row('labyrinth-0',['a','b'],23),row('labyrinth-1',['p'],7)];
 const before=captureLabyrinthScroll(root(lanes));
 lanes[0]=row('labyrinth-0',['a','b','c'],0,460);
 lanes[1]=row('labyrinth-1',['p'],0,250);
 restoreLabyrinthScroll(root(lanes),before);
 assert.equal(lanes[0].scrollLeft,460);
 assert.equal(lanes[1].scrollLeft,7);
 // Replacement at the same count still exposes the next slot.
 const again=captureLabyrinthScroll(root(lanes));
 lanes[0]=row('labyrinth-0',['a','b','d'],0,495);
 restoreLabyrinthScroll(root(lanes),again);
 assert.equal(lanes[0].scrollLeft,495);
});

test('Old Denizen interrupt powers are retained but stored cards cannot be used by interrupts',()=>{
 const source=readFileSync('engine/game.js','utf8');
 assert.match(source,/\['squirrel','harpoon','architect'\]\.includes\(d\.ability\)/);
 assert.match(source,/s\.phase==='action'\|\|x\.zone!=='treasure'/);
 const ui=readFileSync('public/tabletop/expansions.js','utf8');
 assert.match(ui,/const canPlayStored=canAct&&g\.phase==='action'/);
});
