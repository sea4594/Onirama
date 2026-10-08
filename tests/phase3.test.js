import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,act,assertConserved,viewFor} from '../engine/game.js';
import {validateConfig,EXPANSION_CATALOG,normalizeSave,RULESET_VERSION} from '../engine/config.js';
import {enqueueEffects,resolveEffectDecision} from '../engine/effects.js';
import {findCard,zoneArray,assertCardsUnique} from '../engine/zones.js';
import {objectives} from '../engine/modules.js';

test('Configuration enables Phase 4 and rejects unavailable expansion or malformed settings',()=>{
  assert.deepEqual(validateConfig(),{ruleset:'official',expansions:[],difficulties:{}});
  assert.equal(EXPANSION_CATALOG.length,10);
  for(const e of EXPANSION_CATALOG){assert.equal(e.available,e.phase===4);if(e.available)assertConserved(newGame({config:{expansions:[e.id]}}));else assert.throws(()=>newGame({config:{expansions:[e.id]}}),/not yet playable/);}
  for(const config of [{expansions:['unknown']},{expansions:['glyphs','glyphs']},{expansions:'glyphs'},{difficulties:{book:'hard'}},{ruleset:'custom'}])assert.throws(()=>validateConfig(config));
});
test('Phase 3 schema migration preserves old save and cards',()=>{
  const old=newGame({seed:92});old.schema=1;delete old.config;delete old.rulesVersion;delete old.moduleState;delete old.effects;delete old.continuations;delete old.events;
  const upgraded=normalizeSave(old);assert.equal(upgraded.schema,3);assert.equal(upgraded.rulesVersion,'base-2');assert.equal(old.schema,1);assertConserved(upgraded);
  const after=act(old,{type:'discard',id:old.players[0].hand.find(x=>x.symbol!=='key')?.id||old.players[0].hand[0].id});assert.equal(after.schema,3);assertConserved(after);
});
test('Effect interpreter serializes decisions and resumes queued card movements exactly once',()=>{
  const s=newGame({seed:41});const id=s.deck.at(-1).id;const before=s.deck.length;
  enqueueEffects(s,[{type:'decision',id:'pick-color',actorId:0,options:['red','green']},{type:'move',from:'deck',to:'discard',cardId:id},{type:'log',message:'Effect finished'}]);
  assert.equal(s.phase,'decision');assert.equal(s.pending.id,'pick-color');assert.equal(s.deck.length,before);assert.equal(s.effects.length,2);assert.equal(s.continuations.length,1);
  assert.throws(()=>resolveEffectDecision(s,{decisionId:'pick-color',choice:'red'},1),/unauthorized/);
  assert.throws(()=>resolveEffectDecision(s,{decisionId:'pick-color',choice:'blue'},0),/unauthorized/);
  assert.equal(s.deck.length,before);
  // The same decision is resolvable through the public engine command.
  const a=act(s,{type:'moduleDecision',decisionId:'pick-color',choice:'green'});
  assert.equal(a.deck.length,before-1);assert.ok(a.discard.some(c=>c.id===id));assert.equal(a.phase,'action');assert.equal(a.effects.length,0);assertConserved(a);
  assert.throws(()=>act(a,{type:'moduleDecision',decisionId:'pick-color',choice:'green'}));
});
test('Central zones handle stable physical IDs and reject illegal destinations',()=>{
  const s=newGame({seed:111});const c=s.players[0].hand[0];assert.equal(findCard(s,c.id).zone,'player:0:hand');assert.equal(zoneArray(s,'player:0:doors'),s.players[0].doors);
  assert.throws(()=>zoneArray(s,'player:5:hand'));
  assert.throws(()=>enqueueEffects(s,[{type:'move',from:'deck',to:'discard',cardId:c.id}]),/Source card/);
  assertCardsUnique(s);const cloned=structuredClone(s);cloned.discard.push(cloned.players[0].hand[0]);assert.throws(()=>assertCardsUnique(cloned),/count|Duplicate/);
});
test('Module objective list and private view do not disclose effect queue',()=>{
  const s=newGame({mode:'coop',seed:111});assert.equal(objectives(s)[0].required,8);
  s.effects.push({type:'log',message:'SECRET'});s.continuations.push({resumePhase:'action',decisionId:'x'});s.moduleState.base.zones.secret=[{id:'made-up',kind:'location'}];
  const view=viewFor(s,1);for(const k of ['effects','continuations','events','moduleState','rng','deck'])assert.equal(Object.hasOwn(view,k),false);
});
