import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {denizenCardWidth,fitDenizenCards,DENIZEN_MIN_WIDTH,DENIZEN_MAX_WIDTH} from '../public/tabletop/denizen-fit.js';
import {newGame,viewFor} from '../engine/game.js';
import {renderDenizenTabletop} from '../public/tabletop/expansions.js';

test('Denizen sizing is measured in pixels and always preserves a nonzero card width',()=>{
 assert.equal(DENIZEN_MIN_WIDTH,24);
 assert.equal(DENIZEN_MAX_WIDTH,44);
 for(const count of [1,2,3,4,6,8,12,20]){
  for(const lane of [0,40,90,160,280,600]){
   const width=denizenCardWidth(lane,count);
   assert(Number.isInteger(width));
   assert(width>=24&&width<=44,`lane ${lane}, count ${count}: ${width}`);
  }
 }
 assert.equal(denizenCardWidth(400,4),44);
 assert.equal(denizenCardWidth(160,4),37);
 assert.equal(denizenCardWidth(100,8),24); // overflow scrolls instead of crushing cards
 assert.equal(denizenCardWidth(0,7),44); // hidden lane has a safe first-paint width
});

test('Denizen fitting measures both solo and cooperative lanes, including Keeper reserves',()=>{
 const lanes=[];
 const lane=(width,count,kind)=>{
  const updates={};
  const child=i=>({classList:{contains:name=>name===(i===count-1&&kind==='reserve'?'tt17-denizen-reserve':'tt17-denizen-holder')}});
  const mock={clientWidth:width,children:Array.from({length:count},(_,i)=>child(i)),
   style:{setProperty:(key,value)=>updates[key]=value}};
  lanes.push(mock);return updates;
 };
 const solo=lane(170,4,'holder');
 const coop=lane(105,8,'reserve');
 assert.equal(fitDenizenCards({querySelectorAll:selector=>{
  assert.equal(selector,'.tt35-denizen-lane,.tt17-denizen-cards');return lanes;
 }}),2);
 assert.equal(solo['--tt35-measured-width'],'40px');
 assert.equal(coop['--tt35-measured-width'],'24px');
 assert.equal(fitDenizenCards(null),0);
});

test('Denizen cards and artwork have definite proportional dimensions even before JS can measure',()=>{
 const css=readFileSync('public/tabletop/phase34.css','utf8');
 const guard=css.slice(css.indexOf('/* Denizen collapse guard:'));
 assert(guard.startsWith('/* Denizen collapse guard:'));
 assert.match(guard,/--tt35-width:var\(--tt35-measured-width,44px\)/);
 assert.match(guard,/min-width:var\(--tt35-width\)!important/);
 assert.match(guard,/max-width:var\(--tt35-width\)!important/);
 assert.match(guard,/height:calc\(var\(--tt35-width\)\*1\.42\)!important/);
 assert.match(guard,/aspect-ratio:1\/1\.42!important/);
 assert.doesNotMatch(guard,/height:auto/);
 const app=readFileSync('public/app.js','utf8');
 const replay=readFileSync('public/multiplayer-replay.js','utf8');
 assert.match(app,/fitDenizenCards\(viewport\)/);
 assert.match(replay,/fitDenizenCards\(slot\)/);
});

test('Denizen row composition keeps each card and seat as a single physical card',()=>{
 for(const mode of ['solo','coop']){
  const g=newGame({seed:10048,mode,config:{expansions:['oniverse']},interactiveDraw:true});
  const denizens=g.moduleState.oniverse.zones;
  const available=[...denizens.unused,...g.deck.filter(c=>c.kind==='denizen')].slice(0,8);
  denizens.rallied=available.map((c,i)=>({...c,id:`q-denizen-${i}`,owner:i%2}));
  for(const seat of mode==='solo'?[0]:[0,1]){
   const html=renderDenizenTabletop(viewFor(g,seat),{owner:mode==='solo'?null:seat});
   assert.match(html,/tt17-denizen-holder/);
   assert.equal((html.match(/class="tt17-denizen-holder"/g)||[]).length,mode==='solo'?8:4);
   assert.match(html,/tt17-denizen-card/);
  }
 }
});
