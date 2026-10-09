import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,viewFor,act,assertConserved} from '../engine/game.js';
import {EXPANSION_CATALOG,validateConfig} from '../engine/config.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';
import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';
import {tabletopLegalTargets} from '../public/tabletop/interactions.js';
import {renderGameDialog,PENDING_DECISIONS,CONTEXT_DIALOGS} from '../public/tabletop/dialogs.js';
const all=EXPANSION_CATALOG.map(x=>x.id).filter(x=>x!=='incubus');
const variantConfigs=[{expansions:all,difficulties:{book:'hard',dreamcatchers:'hard',towers:'hard',premonitions:'extreme',crossroads:'hard',mirrors:'hard'}},{expansions:['incubus'],difficulties:{incubus:'easy'}},{expansions:['incubus'],difficulties:{incubus:'apprentice'}},{expansions:['incubus'],difficulties:{incubus:'true'}}];
const draft=state=>{let g=state;for(let n=0;n<12&&g.phase==='draft';n++)g=act(g,{type:'draft',id:g.draft[0].id});return g;};

test('all 512 expansion combinations render for both modes/seats with each relevant physical zone',()=>{
 for(let mask=0;mask<512;mask++){
  const expansions=all.filter((_,i)=>mask&(1<<i));const config=validateConfig({expansions});
  for(const mode of ['solo','coop']){
   const game=mode==='coop'?draft(newGame({mode,seed:mask+21,config})):newGame({mode,seed:mask+21,config});
   for(const seat of mode==='solo'?[0]:[0,1]){
    const view=viewFor(game,seat),markup=mode==='solo'?renderSoloTabletop(view):renderCooperativeTabletop(view,{seat});
    assert.match(markup,/data-tt-drop="discard"/);
    if(mode==='solo'||seat===view.active)assert.match(markup,/data-tt-drop="play"/);
    const match=new Set([...markup.matchAll(/data-tt-zone="([^"]+)"/g)].map(m=>m[1]));
    for(const [exp,zone] of [['towers','alignment'],['dreamcatchers','catchers'],['premonitions','premonitions'],['oniverse','denizens'],['mirrors','mirrors']])
      assert.equal(match.has(zone),expansions.includes(exp),`${mask}/${mode}/${seat}/${zone}`);
    if(expansions.includes('book')){assert.match(markup,/data-action="openSpells"/);assert.doesNotMatch(markup,/data-tt-zone="goals"/);}
    if(mode==='coop'){
      assert.match(markup,/tt6-opponent/);assert.match(markup,/tt6-shared-block/);
      for(const card of game.players[1-seat].hand){assert.ok(!markup.includes(`data-tt-card="${card.id}"`));assert.ok(!markup.includes(`data-pick="${card.id}"`));}
    }
   }
  }
 }
});
test('every difficult variant remains accepted and renders without missing its objectives',()=>{
 for(const [i,config] of variantConfigs.entries()){
  const normalized=validateConfig(config);
  for(const mode of ['solo','coop']){
   const g=newGame({mode,seed:620+i,config:normalized});assertConserved(g);
   const v=viewFor(g,0),out=mode==='solo'?renderSoloTabletop(v):renderCooperativeTabletop(v,{seat:0});
   assert.ok(out.length>1000);assert.match(out,/tt2-root/);
   if(config.expansions.includes('mirrors'))assert.match(out,/rainbow Mirror/);
   if(config.expansions.includes('incubus'))assert.match(out,/data-tt-zone="incubus"/);
  }
 }
});
test('all mandatory and optional effect surfaces remain dialog-based with accessibility semantics',()=>{
 assert.equal(PENDING_DECISIONS.length,23);assert.equal(CONTEXT_DIALOGS.length,4);
 for(const type of [...PENDING_DECISIONS,...CONTEXT_DIALOGS]){
  const required=PENDING_DECISIONS.includes(type);
  const markup=renderGameDialog({type,key:`qa:${type}`,html:'<button>Option</button>',mandatory:required});
  assert.match(markup,/role="dialog" aria-modal="true"/);assert.match(markup,/data-tt4-dialog/);
  assert.equal(markup.includes('data-action="dialogClose"'),!required,type);
 }
});
test('shared/other-player cards remain non-playable, and decision states block gameplay targets',()=>{
 let g=draft(newGame({mode:'coop',seed:85,config:{expansions:['crossroads','towers','oniverse']}}));
 for(const seat of [0,1]){
  let v=viewFor(g,seat),other=1-seat;
  for(const c of v.players[other].hand)assert.deepEqual(tabletopLegalTargets(v,c.id,seat),[]);
  if(seat!==v.active){for(const c of [...v.players[seat].hand,...v.shared])assert.deepEqual(tabletopLegalTargets(v,c.id,seat),[]);}
  v.phase='decision';for(const c of [...v.players[seat].hand,...v.shared])assert.deepEqual(tabletopLegalTargets(v,c.id,seat),[]);
 }
});
test('Phase 8 narrow-pile responsive rules prevent card piles from inheriting fixed 53px min width',()=>{
 const css=readFileSync('public/tabletop/solo.css','utf8');assert.match(css,/\.tt2-pile-row \.tt2-pile\{min-width:0;flex:1 1 0/);
 assert.match(css,/\.tt2-pile-row \.tt2-pile-face/);assert.match(css,/\.tt2-door-stack > \.tt2-door-empty/);
 assert.match(readFileSync('public/tabletop/dialogs.css','utf8'),/max-height:calc\(100dvh - 10px\)/);
});
test('visual audits are reproducible; no browser-only dependencies added to standard release gate',()=>{
 const fixture=readFileSync('scripts/ui-phase8-fixtures.js','utf8');assert.match(fixture,/renderSoloTabletop/);assert.match(fixture,/renderCooperativeTabletop/);
 assert.match(readFileSync('scripts/visual-phase8.py','utf8'),/nestedOverflow/);
 assert.match(readFileSync('scripts/interaction-phase8.py','utf8'),/pointer/);
 const pkg=JSON.parse(readFileSync('package.json','utf8'));assert.match(pkg.scripts['release:gate'],/npm run check/);
});
