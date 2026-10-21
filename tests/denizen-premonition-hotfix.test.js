import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,act,legalActions,viewFor,assertConserved} from '../engine/game.js';
import {renderSoloTabletop} from '../public/tabletop/solo-board.js';
import {renderCooperativeTabletop} from '../public/tabletop/coop-board.js';
import {renderDenizenTabletop} from '../public/tabletop/expansions.js';
const game=(exps=['oniverse'],mode='solo')=>newGame({seed:23011,mode,config:{expansions:exps},interactiveDraw:true});
function pull(s,fn){const i=s.deck.findIndex(fn);assert(i>=0);return s.deck.splice(i,1)[0];}
function rally(s,a,owner=0){const fn=c=>c.kind==='denizen'&&c.ability===a;const found=s.deck.some(fn)?s.deck:s.moduleState.oniverse.zones.unused;const i=found.findIndex(fn);assert(i>=0);const [d]=found.splice(i,1);d.owner=owner;s.moduleState.oniverse.zones.rallied.push(d);return d;}
function pending(s){s.phase='decision';const c=pull(s,c=>c.kind==='nightmare');s.pending={type:'nightmare',card:c};return c;}

test('Keeper may store any eligible hand card during a mandatory decision; that decision remains pending',()=>{
 let s=game(),d=rally(s,'keeper'),n=pending(s),stored=s.players[0].hand[0];assert(legalActions(s).some(x=>x.type==='useDenizen'&&x.id===d.id));
 s=act(s,{type:'useDenizen',id:d.id,cardId:stored.id});assertConserved(s);
 assert.equal(s.phase,'decision');assert.equal(s.pending.type,'nightmare');assert.equal(s.pending.card.id,n.id);
 assert.equal(s.moduleState.oniverse.zones.treasure[0].holderId,d.id);
 assert.equal(s.players[0].hand.some(x=>x.id===stored.id),false);
 const html=renderSoloTabletop(viewFor(s,0));assert.match(html,/tt22-keeper-overlay/);
 assert.equal((html.match(new RegExp('data-tt-motion-id="'+stored.id+'"','g'))||[]).length,1);
 assert.match(html,/data-action="denizen:/);assert.doesNotMatch(html,/data-action="denizen:[^\"]+">Use/);
});
test('Keeper reserve remains card-shaped and playable from coop, not duplicated in the hand',()=>{
 let s=game(['oniverse'],'coop');s.phase='action';s.active=0;s.players[0].hand.push(pull(s,c=>c.kind==='location'));
 const d=rally(s,'keeper');const c=s.players[0].hand[0];s=act(s,{type:'useDenizen',id:d.id,cardId:c.id});assertConserved(s);
 const v=viewFor(s,0),html=renderCooperativeTabletop(v,{seat:0});assert.match(html,/tt22-keeper-overlay/);
 assert.doesNotMatch(html,new RegExp('data-pick="'+c.id+'"')); // no normal card play while resolving a decision
 s.phase='action';s.pending=null;const active=renderCooperativeTabletop(viewFor(s,0),{seat:0});
 assert.match(active,new RegExp('data-pick="'+c.id+'"')); // ordinary hand actions may use Keeper's card
});
test('Squirrel interrupted Peek resumes the previous decision and preserves deck cards',()=>{
 let s=game(),d=rally(s,'squirrel'),n=pending(s);s=act(s,{type:'useDenizen',id:d.id});assertConserved(s);
 assert.equal(s.pending.type,'denizenPeek');assert.equal(s.phase,'decision');
 s=act(s,{type:'denizenPeek',order:s.pending.cards.map(c=>c.id)});assertConserved(s);
 assert.equal(s.phase,'decision');assert.equal(s.pending.type,'nightmare');assert.equal(s.pending.card.id,n.id);
});
test('Architect may act while another decision waits, then restores it after nested Door search',()=>{
 let s=game(),d=rally(s,'architect'),n=pending(s);
 const last=pull(s,c=>c.kind==='location'&&c.color==='red'&&c.symbol==='moon');
 const first=pull(s,c=>c.kind==='location'&&c.color==='red'&&c.symbol==='sun');
 s.players[0].labyrinth.push(first,last);s.players[0].series=[{id:first.id,color:'red'},{id:last.id,color:'red'}];
 let next=s.players[0].hand.find(c=>c.kind==='location'&&c.color==='red'&&c.symbol==='moon');
 if(!next){next=pull(s,c=>c.kind==='location'&&c.color==='red'&&c.symbol==='moon');s.deck.push(s.players[0].hand.splice(0,1,next)[0]);}
 s=act(s,{type:'useDenizen',id:d.id,cardId:next.id});assertConserved(s);
 assert.equal(s.pending.type,'doorSearch');assert.equal(s.players[0].lastDoorSeriesEnd,next.id);
 s=act(s,{type:'doorSearch',option:'skip'});assertConserved(s);
 assert.equal(s.pending.type,'nightmare');assert.equal(s.pending.card.id,n.id);
 const board=renderSoloTabletop(viewFor(s,0));assert.match(board,/tt22-door-boundary/);assert.match(board,/tt22-next-slot/);
});
test('Hammer Bird keeps the Door divider at the last surviving completed group',()=>{
 let s=game(),hammer=rally(s,'hammer');const p=s.players[0];
 for(const color of ['red','blue'])for(const symbol of ['sun','moon','key'])p.labyrinth.push(pull(s,c=>c.kind==='location'&&c.color===color&&c.symbol===symbol));
 p.lastDoorSeriesEnd=p.labyrinth.at(-1).id;const earlier=p.labyrinth[2].id;
 s=act(s,{type:'useDenizen',id:hammer.id});assertConserved(s);
 assert.equal(s.players[0].lastDoorSeriesEnd,earlier);assert.match(renderSoloTabletop(viewFor(s,0)),/tt22-door-boundary/);
});
test('Blue two-Door premonition requires explicit selection of two different deck Keys',()=>{
 let s=game(['premonitions']);const pre=s.moduleState.premonitions;
 pre.faceUp=['blue2'];pre.reserve=[];const d1=pull(s,c=>c.kind==='door'&&c.color==='blue'),d2=pull(s,c=>c.kind==='door'&&c.color==='blue');s.players[0].doors.push(d1,d2);
 s.phase='decision';s.pending={type:'premonitionPick',options:['blue2'],after:'action'};assertConserved(s);
 s=act(s,{type:'premonitionPick',id:'blue2'});assertConserved(s);
 assert.equal(s.pending.type,'premonitionKeys');assert(s.pending.options.length>=2);
 const ids=s.pending.options.slice(-2).map(c=>c.id);
 assert.throws(()=>act(s,{type:'premonitionKeys',ids:[ids[0],ids[0]]}),/required Keys/);
 const rest=act(s,{type:'premonitionKeys',ids});assertConserved(rest);
 assert(ids.every(id=>rest.discard.some(c=>c.id===id)));assert.equal(rest.phase,'action');
});
test('Green two-Door premonition also permits choosing which discarded Nightmare returns',()=>{
 let s=game(['premonitions']);const pre=s.moduleState.premonitions;pre.faceUp=['green2'];pre.reserve=[];
 for(let i=0;i<2;i++)s.players[0].doors.push(pull(s,c=>c.kind==='door'&&c.color==='green'));
 const nightmares=[pull(s,c=>c.kind==='nightmare'),pull(s,c=>c.kind==='nightmare')];s.discard.push(...nightmares);
 s.phase='decision';s.pending={type:'premonitionPick',options:['green2'],after:'action'};
 s=act(s,{type:'premonitionPick',id:'green2'});assertConserved(s);assert.equal(s.pending.type,'premonitionNightmare');
 s=act(s,{type:'premonitionNightmare',id:nightmares[1].id});assertConserved(s);
 assert(s.limbo.some(c=>c.id===nightmares[1].id));assert(s.discard.some(c=>c.id===nightmares[0].id));
});
test('Denizen interaction, selected outlines, card-back centering, reserve corners and new labyrinth slot are styled',()=>{
 const app=readFileSync('public/app.js','utf8'),css=readFileSync('public/tabletop/card-system.css','utf8');
 for(const name of ['denizenUse','denizenCancel','denizenCard:','denizenDiscard:','denizenChromaticKey:','premonitionKeysConfirm','premonitionNightmare:'])assert(app.includes(name),name);
 for(const cls of ['tt22-keeper-overlay','tt22-next-slot','tt22-door-boundary','tt22-denizen-dialog','tt22-prem-key','.tt14-reserve','tt6-card-back'])assert(css.includes(cls),cls);
 const html=renderDenizenTabletop(viewFor(game(),0));assert.doesNotMatch(html,/data-action="denizen:[^\"]+">Use/);
});
