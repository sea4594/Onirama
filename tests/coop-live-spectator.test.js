import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,viewFor,assertConserved} from '../engine/game.js';
import {coopSpectatorDecision,coopPublicChoice} from '../engine/coop-visibility.js';
import {makeRoom,joinRoom,playRoom,roomView} from '../engine/firebase-protocol.js';
import {visibleReplay} from '../engine/replay.js';
import {renderActionDock} from '../public/tabletop/action-dock.js';
import {planGameTransitions} from '../public/tabletop/animation.js';
const c=(id,kind='location',extra={})=>({id,kind,color:'blue',symbol:'moon',...extra});
function coop(pending,config={expansions:[]}){
 const game=newGame({mode:'coop',config,seed:31,interactiveDraw:true,manualTurnEnd:true});
 game.phase='decision';game.pending=pending;game.status='active';
 return game;
}
test('Public Nightmare and drawn Door share their visible cards and choices, but never become spectator actions',()=>{
 for(const [type,card] of [['nightmare',c('night', 'nightmare')],['door',c('door','door')],['happyDream',c('happy','happyDream')]]){
  const game=coop({type,card,keys:[{id:'private-key'}]});const view=viewFor(game,1-game.active);
  assert.equal(view.pending.type,'private-decision');assert.equal(view.spectatorDecision.type,type);
  assert.equal(view.spectatorDecision.card.kind,type==='door'?'door':type);
  const html=renderActionDock(view,1-game.active);assert.match(html,/data-spectator-decision/);
  assert.match(html,/tt30-spectator-preview/);assert.match(html,/tt30-spectator-choice/);
  assert.doesNotMatch(html,/data-action="(useKey|nightChoose|nightReveal|nightHand|happyPeek)/);
  assert.doesNotMatch(JSON.stringify(view.spectatorDecision),/private-key/);
 }
});
test('Every private lookup, reorder or reveal decision exposes a descriptive heading but no inspected cards',()=>{
 for(const type of ['prophecy','incantation','incantationOrder','happyPeek','happyFetch','denizenPeek','towerLook','spellPeek','sphinxResolve','diver','mirrorReward','premonitionKeys','confusion']){
  const secret='secret-'+type,game=coop({type,cards:[c(secret)],options:[c(secret)],card:c('public-sphinx','sphinx')});
  const view=viewFor(game,1-game.active);assert.equal(view.spectatorDecision.type,type);
  assert.equal(view.spectatorDecision.visibility,'private',type);
  assert.equal(typeof view.spectatorDecision.title,'string');assert.notEqual(view.spectatorDecision.title,'Waiting for partner');
  assert(!JSON.stringify(view.spectatorDecision).includes(secret),type);
  const html=renderActionDock(view,1-game.active);
  assert.match(html,/data-visibility="private"/);assert(!html.includes(secret));
 }
});
test('Specific public decision families use descriptive labels and public-only selection options',()=>{
 const samples=[
  {type:'nightmare',card:c('n','nightmare'),expected:'5 from deck'},
  {type:'towerPenalty',expected:'False destruction'},
  {type:'catchOverload',expected:'Remove Dreamcatcher'},
  {type:'coopSwap',expected:'Swap'},
  {type:'sphinxName',card:c('s','sphinx'),expected:'moon'},
  {type:'premonitionPick',options:['red2','blue2'],expected:'red2'},
  {type:'doorSearch',color:'green',expected:'Search & shuffle (green)'}
 ];
 for(const {expected,...pending} of samples){
  const game=coop(pending),view=viewFor(game,1-game.active);
  assert.equal(view.spectatorDecision.visibility,'public',pending.type);
  assert(view.spectatorDecision.buttons.some(b=>b.label===expected),pending.type);
  const html=renderActionDock(view,1-game.active);
  assert(html.includes(expected.replaceAll('&','&amp;')));assert.doesNotMatch(html,/data-action="nightChoose/);
 }
});
test('Card peeks become public only when cards actually enter Discard, with a visible reveal transition',()=>{
 const before=viewFor(coop({type:'prophecy',cards:[c('concealed-inspected-card')]}),1);
 const after=structuredClone(before);after.discard.push(c('concealed-inspected-card'));after.deckCount--;
 const plan=planGameTransitions(before,after);
 assert(plan.drawn.includes('concealed-inspected-card'));
 assert(!JSON.stringify(before.spectatorDecision).includes('concealed-inspected-card'));
 const source=readFileSync('public/tabletop/animation.js','utf8');
 assert.match(source,/previous\?\.spectatorDecision\?\.visibility==='private'/);
 assert.match(source,/revealGhost\(c,deck,discard/);
});
test('Committed public choices and intermediate Nightmare preview expose only a human-readable choice, never IDs',()=>{
 const game=coop({type:'nightmare',card:c('n','nightmare')});
 const preview=coopPublicChoice(game,{type:'previewChoice',choice:'door'});
 assert.equal(preview.choice,'Remove door');assert.equal(preview.type,'nightmare');
 assert(!JSON.stringify(preview).includes('private-key'));
 assert.equal(coopPublicChoice(game,{type:'nightmare',option:'hand'}).choice,'Discard hand');
 const privateGame=coop({type:'prophecy',cards:[c('secret')]});
 const resolved=coopPublicChoice(privateGame,{type:'prophecy',discardId:'secret',order:['secret']});
 assert.equal(resolved.title,'Prophecy');assert.equal(resolved.choice,null);assert(!JSON.stringify(resolved).includes('secret'));
});
test('Room rejects non-active preview messages, does not mutate game on a valid preview, and tracks its version',()=>{
 let room=makeRoom('LIVE','a','Alice',{expansions:[]});room=joinRoom(room,'b','Bob');
 // A public decision is constructed without exposing any card from the deck.
 room.game=coop({type:'nightmare'});
 const nightIndex=room.game.deck.findIndex(card=>card.kind==='nightmare');
 assert(nightIndex>=0);room.game.pending.card=room.game.deck.splice(nightIndex,1)[0];assertConserved(room.game);
 const activeUid=room.game.active===0?'a':'b',inactiveUid=activeUid==='a'?'b':'a';
 assert.throws(()=>playRoom(room,inactiveUid,room.version,{type:'previewChoice',choice:'door'}),/not your turn/i);
 assert.throws(()=>playRoom(room,activeUid,room.version,{type:'previewChoice',choice:'peek'}),/public decision choice/);
 const before=JSON.stringify(room.game);const next=playRoom(room,activeUid,room.version,{type:'previewChoice',choice:'door'});
 assert.equal(next.version,room.version+1);assert.equal(JSON.stringify(next.game),before);
 assert.equal(roomView(next,inactiveUid).spectatorEvent.choice,'Remove door');
 assert.equal(roomView(next,activeUid).spectatorEvent,null);
});
test('Live spectator UI uses one shared panel and serializes choice preview before the real command',()=>{
 const source=readFileSync('public/app.js','utf8');
 assert.match(source,/doorSearchChromatic,spectatorFlash,spectatorLive/);
 assert.match(source,/if\(previewInFlight\)await previewInFlight/);
 assert.match(source,/captureSpectatorChoice\(data\)/);
 assert.match(source,/captureSpectatorChoice\(fresh\)/);
});

test('Intermediate choice previews remain live but do not clutter recorded turn replay',()=>{
 let room=makeRoom('LIVR','a','Alice',{expansions:[]});room=joinRoom(room,'b','Bob');room.game=coop({type:'nightmare'});
 const uid=room.game.active===0?'a':'b';room=playRoom(room,uid,room.version,{type:'previewChoice',choice:'door'});
 assert.equal(room.replay.at(-1).action,'previewChoice');
 assert.equal(visibleReplay(room.replay).length,0);
 assert.equal(roomView(room,uid==='a'?'b':'a').spectatorLive.choice,'Remove door');
});
