import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,viewFor,act,assertConserved} from '../engine/game.js';
import {EXPANSIONS} from '../engine/cards.js';
import {soloLegalTargets} from '../public/tabletop/interactions.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';
import {expansionTabletopZones,EXPANSION_TABLETOP_ZONE_IDS} from '../public/tabletop/expansions.js';
const expansions=EXPANSIONS.filter(x=>x.id!=='incubus').map(x=>x.id);
const model=(ids,seed=4,difficulties={})=>viewFor(newGame({mode:'solo',seed,config:{expansions:ids,difficulties}}),0);
test('every expansion component appears on the solo tabletop rather than legacy expansion panels',()=>{
 for(const id of expansions){const g=model([id]);const html=renderSoloTabletop(g);assert.match(html,/tt5-has-expansions/,id);
   for(const zone of expansionTabletopZones(g)){assert.ok(html.includes(zone),id);}assert.doesNotMatch(html,/class="panel stack"/);}
 const g=model(['incubus'],5,{incubus:'apprentice'});assert.match(renderSoloTabletop(g),/data-tt-zone="incubus"/);
});
test('all nine combinable expansion sets render and preserve unhidden physical tabletop zones',()=>{
 for(let mask=0;mask<(1<<expansions.length);mask++){
  const selected=expansions.filter((_,i)=>mask&(1<<i)),g=model(selected,17+mask);const html=renderSoloTabletop(g);
  for(const essential of ['tt2-doors','tt2-labyrinth','tt2-piles','tt2-hand'])assert.ok(html.includes(essential),essential);
  if(selected.includes('book'))assert.match(html,/data-tt-zone="goals"/);
  if(selected.includes('dreamcatchers'))assert.match(html,/data-tt-zone="catchers"/);
  if(selected.includes('towers'))assert.match(html,/data-tt-zone="alignment"/);
  if(selected.includes('premonitions'))assert.match(html,/data-tt-zone="premonitions"/);
  if(selected.includes('oniverse'))assert.match(html,/data-tt-zone="denizens"/);
  if(selected.includes('mirrors'))assert.match(html,/data-tt-zone="mirrors"/);
  assert.equal((html.match(/data-tt-zone="goals"/g)||[]).length,selected.includes('book')?1:0);
 }
});
test('collected Door slots reflect Glyphs and Oniverse without inventing Door cards',()=>{
 const basic=renderSoloTabletop(model([])),glyphs=renderSoloTabletop(model(['glyphs'])),special=renderSoloTabletop(model(['glyphs','oniverse']));
 assert.match(basic,/0\/8/);assert.match(glyphs,/0\/12/);assert.match(special,/0\/13/);
 assert.match(special,/Missing Door to the Oniverse/);assert.match(special,/Oniverse/);
});
test('tower side legality uses its printed marks and never sends an illegal side',()=>{
 const g=model(['towers']);const card={kind:'tower',id:'t1',color:'red',left:'sun',right:'moon',number:4};
 g.players[0].hand=[card,...g.players[0].hand.filter(c=>c.id!==card.id)];
 assert.deepEqual(soloLegalTargets(g,card.id),['towerLeft','towerRight','discard']);
 g.expansion.towers.alignment=[{kind:'tower',id:'existing',left:'moon',right:'moon'}];
 assert.deepEqual(soloLegalTargets(g,card.id),['towerRight','discard']);
 assert.match(renderSoloTabletop(g,{selectedId:card.id}),/data-tt-drop="towerLeft"/);
 assert.match(renderSoloTabletop(g,{selectedId:card.id}),/data-tt-drop="towerRight"/);
 assert.match(renderSoloTabletop(g,{selectedId:card.id}),/data-action="towerRight"/);
});
test('keeper stored cards remain selectable, and Dead Ends are never made discardable',()=>{
 const g=model(['oniverse','crossroads']);const keeper={id:'stored-1',kind:'location',symbol:'moon',color:'red',owner:0};g.expansion.oniverse.treasure=[keeper];
 assert.deepEqual(soloLegalTargets(g,keeper.id),['play','discard']);
 assert.match(renderSoloTabletop(g,{selectedId:keeper.id}),/data-tt-card="stored-1"/);
 g.players[0].hand.push({id:'dead',kind:'deadEnd'});assert.deepEqual(soloLegalTargets(g,'dead'),[]);
 assert.match(renderSoloTabletop(g),/data-action="escape"/);
});
test('all persistent physical sections provide their existing action entry points',()=>{
 const g=model(['book','towers','dreamcatchers','oniverse','mirrors','premonitions']);const html=renderSoloTabletop(g);
 assert.match(html,/data-action="openSpells"/);assert.match(html,/data-tt-drop="towerLeft"/);
 assert.match(html,/data-tt-drop="towerRight"/);assert.match(html,/data-action="mirrorPlay:/);
 assert.match(html,/data-tt-zone="catchers"/);assert.match(html,/data-tt-zone="premonitions"/);
 for(const zone of EXPANSION_TABLETOP_ZONE_IDS)assert.equal(typeof zone,'string');
});
test('the complete tabletop is presentation-only: action, saves and Firebase remain in the existing implementation',()=>{
 const src=readFileSync('public/app.js','utf8');assert.match(src,/if\(g.mode==='solo'\)/);
 assert.match(src,/firebase\.firebaseAction/);assert.match(src,/localEngine\.act/);
 const e=readFileSync('public/tabletop/expansions.js','utf8');assert.doesNotMatch(e,/\.splice\(|firebaseAction\(|localStorage\./);
 const css=readFileSync('public/tabletop/expansions.css','utf8');assert.match(css,/orientation:landscape/);
 assert.match(readFileSync('public/index.html','utf8'),/tabletop\/expansions\.css/);
});
test('seeded expansion move still conserves cards with new UI legal targets',()=>{
 for(let seed=1;seed<=40;seed++){
  const s=newGame({mode:'solo',seed,config:{expansions:expansions,difficulties:{}}}),g=viewFor(s,0),picked=g.players[0].hand.map(c=>({c,targets:soloLegalTargets(g,c.id)})).find(x=>x.targets.length);
  if(!picked)continue;const type=picked.targets.find(t=>t==='discard')||picked.targets[0];const next=act(s,{type,id:picked.c.id});assertConserved(next);
 }
});

test('hard variants change physical component availability and status',()=>{
 const basic=model(['mirrors']);const hard=model(['mirrors'],3,{mirrors:'hard'});
 assert.doesNotMatch(renderSoloTabletop(basic),/title="rainbow Mirror:/);
 assert.match(renderSoloTabletop(hard),/rainbow Mirror:/);
 const tower=model(['towers'],7,{towers:'hard'});assert.doesNotMatch(renderSoloTabletop(tower),/Alignment protected/);
 const inc=model(['incubus'],9,{incubus:'true'});assert.match(renderSoloTabletop(inc),/Anticipate Nightmare/);
});
test('Tower face visually contains printed inspection value and both edge symbols',()=>{
 const g=model(['towers']);g.players[0].hand.unshift({id:'face3',kind:'tower',color:'red',number:3,left:'sun+moon',right:'moon'});
 const html=renderSoloTabletop(g);assert.match(html,/tt5-tower-face/);assert.match(html,/tt5-tower-edge/);assert.match(html,/sun\+moon/);
});
