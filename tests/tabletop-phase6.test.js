import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,viewFor,act,assertConserved} from '../engine/game.js';
import {EXPANSIONS} from '../engine/cards.js';
import {renderCooperativeTabletop,cooperativeTabletopModel} from '../public/tabletop/coop-board.js';
import {cooperativeLegalTargets,tabletopLegalTargets} from '../public/tabletop/interactions.js';
const expansions=EXPANSIONS.filter(e=>e.id!=='incubus').map(e=>e.id);
function drafted(config={expansions:[]},seed=11){let g=newGame({mode:'coop',seed,config});for(let n=0;g.phase==='draft'&&n<10;n++){g=act(g,{type:'draft',id:g.draft[0].id});assertConserved(g);}assert.notEqual(g.phase,'draft');return g;}

test('draft renders eight public cards, shows the two separate player areas and never enables partner cards',()=>{
  const game=newGame({mode:'coop',seed:9,config:{expansions:[]}});
  for(const seat of [0,1]){const g=viewFor(game,seat),html=renderCooperativeTabletop(g,{seat});
    assert.match(html,/data-tabletop-coop="true"/);assert.match(html,/data-tt6-player="0"/);assert.match(html,/data-tt6-player="1"/);
    assert.match(html,/tt6-draft-cards/);assert.equal((html.match(/data-pick=/g)||[]).length,seat===0?8:0);
    assert.equal(g.draft.length,8);assert.match(html,/aria-label="Card piles"/);
  }
});
test('privacy: opponent faces and action IDs never render, while both Labyrinths and Door areas render',()=>{
  let game=drafted();let g0=viewFor(game,0),g1=viewFor(game,1);
  assert.equal(g0.shared.length,2);assert.equal(g0.players[0].hand.length,3);assert.equal(g0.players[1].hand.length,3);
  for(const seat of [0,1]){const g=seat===0?g0:g1,html=renderCooperativeTabletop(g,{seat});
    assert.equal((html.match(/class="tt6-card-back"/g)||[]).length,3);
    assert.equal((html.match(/data-tt6-player=/g)||[]).length,2);
    assert.equal((html.match(/tt6-player-doors/g)||[]).length,2);
    assert.equal((html.match(/tt6-player-labyrinth/g)||[]).length,2);
    for(const c of game.players[1-seat].hand){assert.ok(!html.includes(`data-pick="${c.id}"`));assert.ok(!html.includes(`data-tt-card="${c.id}"`));}
    for(const c of g.shared)assert.ok(html.includes(`${c.color} ${c.symbol}`),'public shared resource face visible');
  }
});
test('only the active player can select personal or shared Locations; illegal adjacent symbol and Dead End excluded',()=>{
  const g=viewFor(drafted(),0);const hand=g.players[0].hand,other=g.players[1].hand,shared=g.shared;
  assert.deepEqual(cooperativeLegalTargets(g,hand[0].id,1),[]);
  assert.deepEqual(cooperativeLegalTargets(g,other[0].id,0),[]);
  assert.ok(cooperativeLegalTargets(g,shared[0].id,0).includes('discard'));
  const legal=cooperativeLegalTargets(g,hand[0].id,0);assert.ok(legal.includes('discard'));
  const html=renderCooperativeTabletop(g,{seat:0,selectedId:hand[0].id});assert.match(html,/data-tt-drop="discard"/);
  g.players[0].labyrinth=[{kind:'location',symbol:hand[0].symbol,color:'red',id:'last'}];
  assert.ok(!cooperativeLegalTargets(g,hand[0].id,0).includes('play'));
  g.players[0].hand.push({id:'dead6',kind:'deadEnd'});assert.deepEqual(cooperativeLegalTargets(g,'dead6',0),[]);
  assert.deepEqual(tabletopLegalTargets(g,'dead6',0),[]);
});
test('shared Tower alignment checks exact edge symbols independently for both players',()=>{
  const g=viewFor(drafted({expansions:['towers']}),0);
  const tower={kind:'tower',id:'newTower',color:'red',left:'sun',right:'moon',number:4};g.shared=[tower,...g.shared.slice(1)];
  g.expansion.towers.alignment=[{kind:'tower',id:'t',left:'sun',right:'moon'}];
  assert.deepEqual(cooperativeLegalTargets(g,tower.id,0),['towerLeft','towerRight','discard']);
  g.expansion.towers.alignment[0].left='sun';g.expansion.towers.alignment[0].right='sun+moon';
  assert.deepEqual(cooperativeLegalTargets(g,tower.id,0),['towerLeft','discard']);
  assert.match(renderCooperativeTabletop(g,{seat:0}),/data-tt-zone="alignment"/);
});
test('all 512 expansion combinations show essential areas and matching shared expansion components',()=>{
  for(let mask=0;mask<1<<expansions.length;mask++){
    const enabled=expansions.filter((_,i)=>mask&(1<<i));const g=viewFor(newGame({mode:'coop',seed:mask+7,config:{expansions:enabled}}),0);
    const html=renderCooperativeTabletop(g,{seat:0});
    for(const component of ['tt6-opponent','tt6-self','tt6-center','tt6-piles','tt6-shared-block','tt6-player-labyrinth','tt8-door-slot','tt6-draft'])assert.ok(html.includes(component),`${mask}: ${component}`);
    if(enabled.includes('book')){assert.match(html,/data-action="openSpells"/);assert.doesNotMatch(html,/data-tt-zone="goals"/);}
    for(const [id,zone] of [['dreamcatchers','catchers'],['towers','alignment'],['premonitions','premonitions'],['oniverse','denizens'],['mirrors','mirrors']])if(enabled.includes(id))assert.match(html,new RegExp(`data-tt-zone="${zone}"`));
  }
});
test('both co-op seats can complete drafts, play actions, and conserve all card instances',()=>{
  for(let seed=1;seed<=28;seed++){
    let s=drafted({expansions:seed%2?['book','glyphs','towers','crossroads']:[]},seed);
    const seat=s.active,g=viewFor(s,seat);const cards=[...g.players[seat].hand,...g.shared];
    const usable=cards.map(c=>({c,actions:cooperativeLegalTargets(g,c.id,seat)})).find(x=>x.actions.includes('discard'));
    if(usable){s=act(s,{type:'discard',id:usable.c.id});assertConserved(s);}
  }
});
test('Firebase source, existing command dispatcher, dialog route and coop CSS remain part of build',()=>{
  const app=readFileSync('public/app.js','utf8');assert.match(app,/renderCooperativeTabletop/);assert.match(app,/cooperativeLegalTargets/);assert.match(app,/firebase\.firebaseAction/);
  assert.match(app,/swapDraft=\{cardId:id\}/);assert.match(app,/gameWorkspace\(state\.game,state\.room\)/);
  assert.match(readFileSync('public/index.html','utf8'),/tabletop\/coop\.css/);
  assert.match(readFileSync('public/tabletop/coop.css','utf8'),/orientation:landscape/);
});
