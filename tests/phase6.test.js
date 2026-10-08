import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {newGame,act,viewFor,assertConserved,legalActions} from '../engine/game.js';
import {validateConfig,EXPANSION_CATALOG} from '../engine/config.js';
import {createDeck,expectedCards} from '../engine/cards.js';
const game=(ids=[],seed=177,difficulties={},mode='solo')=>newGame({seed,mode,config:{expansions:ids,difficulties}});
const discard=(s)=>act(s,{type:'discard',id:s.players[s.active].hand.find(c=>c.kind==='location'&&c.symbol!=='key')?.id??s.players[s.active].hand.find(c=>c.kind==='location')?.id});
function putDraw(s,kind){const i=s.deck.findIndex(c=>c.kind===kind);assert.ok(i>=0,kind);s.deck.push(...s.deck.splice(i,1));}
function injectHand(s,colorOrSymbol,quantity=2){const p=s.players[s.active];for(let i=0;i<quantity;i++){if(p.hand[i].color===colorOrSymbol||p.hand[i].symbol===colorOrSymbol)continue;const j=s.deck.findIndex(c=>c.kind==='location'&&(c.color===colorOrSymbol||c.symbol===colorOrSymbol));assert.ok(j>=0,`No ${colorOrSymbol} Location`);[p.hand[i],s.deck[j]]=[s.deck[j],p.hand[i]];}}
function preloadMirror(s,name){const a=s.moduleState.mirrors.zones[name];for(let n=0;n<2;n++){const i=s.deck.findIndex(c=>c.kind==='location'&&(c.color===name||c.symbol===name));assert.ok(i>=0);a.push(...s.deck.splice(i,1));}injectHand(s,name);}

test('All nine combinable expansions initialize with conserved cards in 512 configurations and both modes',()=>{
 const ids=EXPANSION_CATALOG.filter(x=>x.id!=='incubus').map(x=>x.id);assert.equal(ids.length,9);
 for(let bits=0;bits<512;bits++){const selected=ids.filter((_,i)=>bits&(1<<i));for(const mode of ['solo','coop']){const s=game(selected,2000+bits,{},mode);assertConserved(s);assert.equal(createDeck(selected).length,expectedCards(selected));assert.ok(s.moduleState.base);}}
});
test('Sphinx, Diver and Confusion include twelve promo Dreams and two extra Nightmares',()=>{const a=createDeck(['sphinx']);assert.equal(a.length,90);for(const kind of ['sphinx','diver','confusion'])assert.equal(a.filter(x=>x.kind===kind).length,4);assert.equal(a.filter(x=>x.kind==='nightmare').length,12);});
test('Sphinx named aspect and reveal, including no-match redraw, preserve cards',()=>{
 for(let seed=50;seed<54;seed++){const s=game(['sphinx'],seed);putDraw(s,'sphinx');const t=discard(s);assert.equal(t.pending.type,'sphinxName');assertConserved(t);const u=act(t,{type:'sphinxName',aspect:'red'});assert.equal(u.pending.type,'sphinxResolve');const p=u.pending;const match=p.cards.some(c=>c.color==='red'||c.symbol==='red');const v=act(u,{type:'sphinxResolve',topId:match?p.cards[0].id:undefined,order:p.cards.map(c=>c.id)});assertConserved(v);assert.notEqual(v.pending?.type,'sphinxResolve');}
});
test('Sphinx rejects the Sun aspect, and does not allow Glyph aspect without Glyphs',()=>{
 const s=game(['sphinx']);putDraw(s,'sphinx');const t=discard(s);assert.throws(()=>act(t,{type:'sphinxName',aspect:'sun'}));assert.throws(()=>act(t,{type:'sphinxName',aspect:'glyph'}));assertConserved(t);
});
test('Diver can continue from bottom, stop with last card on top, and resolve a Nightmare',()=>{
 let s=game(['sphinx'],44);putDraw(s,'diver');const i=s.deck.findIndex(c=>c.kind==='location');s.deck.unshift(...s.deck.splice(i,1));s=discard(s);assert.equal(s.pending.type,'diver');assertConserved(s);s=act(s,{type:'diver',option:'continue'});assertConserved(s);let p=s.pending;let hit=p.cards.at(-1)?.kind==='nightmare';let r=act(s,{type:'diver',option:hit?'nightmare':'stop',order:hit?p.cards.map(c=>c.id):p.cards.slice(0,-1).map(c=>c.id)});assertConserved(r);if(hit){assert.equal(r.pending.type,'nightmare');r=act(r,{type:'nightmare',option:'hand'});assertConserved(r);}else assert.notEqual(r.pending?.type,'diver');
});
test('Confusion returns the hand to the bottom instead of discarding it',()=>{
 let s=game(['sphinx'],88);putDraw(s,'confusion');s=discard(s);assert.equal(s.pending.type,'confusion');const ids=s.players[0].hand.map(c=>c.id);const t=act(s,{type:'confusion',order:ids});assertConserved(t);for(const id of ids)assert.ok(t.deck.some(c=>c.id===id)||t.players[0].hand.some(c=>c.id===id));assert.ok(t.discard.some(c=>c.kind==='confusion'));
});
test('Mirror pair fills stacks, explores Sun without a reward, and forbids extra pairs',()=>{
 let s=game(['mirrors'],101);preloadMirror(s,'sun');assertConserved(s);s=act(s,{type:'mirrorPair',mirror:'sun',ids:s.players[0].hand.slice(0,2).map(c=>c.id)});assertConserved(s);assert.ok(s.moduleState.mirrors.completed.includes('sun'));assert.equal(s.moduleState.mirrors.zones.sun.length,0);assert.throws(()=>act(s,{type:'mirrorPair',mirror:'sun',ids:s.players[0].hand.slice(0,2).map(c=>c.id)}));
});
test('Red Mirror searches and places two selected cards on the top in order',()=>{
 let s=game(['mirrors'],102);preloadMirror(s,'red');s=act(s,{type:'mirrorPair',mirror:'red',ids:s.players[0].hand.slice(0,2).map(c=>c.id)});assert.equal(s.pending.type,'mirrorReward');const picks=s.pending.options.slice(0,2).map(c=>c.id);s=act(s,{type:'mirrorReward',ids:picks});assertConserved(s);assert.equal(s.discard.filter(c=>c.kind==='location'&&c.color==='red').length>=4,true);
});
test('Brown Mirror awards a chosen Door through the ordinary Door acquisition path',()=>{
 let s=game(['mirrors'],103);preloadMirror(s,'brown');s=act(s,{type:'mirrorPair',mirror:'brown',ids:s.players[0].hand.slice(0,2).map(c=>c.id)});const door=s.pending.options.find(c=>c.kind==='door');assert.ok(door);s=act(s,{type:'mirrorReward',ids:[door.id]});assertConserved(s);assert.equal(s.players[0].doors.length,1);
});
test('Hard Mirrors includes Rainbow requirement and excludes Glyph Mirror without Glyphs',()=>{
 const s=game(['mirrors'],110,{mirrors:'hard'});const view=viewFor(s,0);assert.equal(view.objectives.find(x=>x.id==='mirrors').required,3);assert.ok(view.expansion.mirrors.stacks.rainbow);assert.equal(view.expansion.mirrors.stacks.glyph,undefined);assert.throws(()=>act(s,{type:'mirrorPair',mirror:'glyph',ids:s.players[0].hand.slice(0,2).map(c=>c.id)}));
});
test('Little Incubus is incompatible with other expansions, and easy level cancels once',()=>{
 assert.throws(()=>validateConfig({expansions:['incubus','mirrors']}),/cannot be combined/);
 let s=game(['incubus'],120,{incubus:'easy'});putDraw(s,'nightmare');s=discard(s);assert.equal(s.pending.type,'nightmare');s=act(s,{type:'incubusCancel'});assertConserved(s);assert.equal(s.moduleState.incubus.used,true);
});
test('Apprentice and True Incubus charge the right number of Locations and require a Nightmare payment',()=>{
 for(const [level,n] of [['apprentice',1],['true',2]]){let s=game(['incubus'],130,{incubus:level});s=act(s,{type:'incubusActivate'});assertConserved(s);assert.equal(s.moduleState.incubus.zones.stored.length,n);assert.equal(s.pending.type,'nightmare');assert.equal(s.pending.card,null);s=act(s,{type:'nightmare',option:'reveal'});assertConserved(s);assert.ok(['action','decision','ended'].includes(s.phase));}
});
test('Viewer does not reveal deck or effect choices to nonactive cooperative player',()=>{
 const s=game(['mirrors','sphinx'],152,{},'coop');const other=viewFor(s,1);assert.equal(other.deck,undefined);assert.equal(other.moduleState,undefined);assert.ok(other.players[0].hand.length===0||other.players[0].hand.every(c=>c.kind==='hidden'));
});
test('GitHub Pages workflow publishes a static entry point and the client-side engine',()=>{
 const wf=readFileSync('.github/workflows/pages.yml','utf8');assert.match(wf,/npm run release:gate/);assert.match(wf,/npm run build:pages/);assert.match(readFileSync('scripts/build-pages.js','utf8'),/cpSync\('public'/);assert.match(readFileSync('scripts/build-pages.js','utf8'),/cpSync\('engine'/);assert.ok(existsSync('public/index.html'));const html=readFileSync('public/index.html','utf8');assert.match(html,/href="\.\/styles\.css"/);assert.match(html,/src="\.\/app\.js"/);
});

test('Diver as final deck card loses cleanly without adding an undefined card',()=>{
 let s=game(['sphinx'],212);const i=s.deck.findIndex(c=>c.kind==='diver');const [d]=s.deck.splice(i,1);s.discard.push(...s.deck.splice(0));s.deck.push(d);s=discard(s);assertConserved(s);assert.equal(s.status,'lost');assert.equal(s.phase,'ended');assert.ok(s.discard.some(c=>c.id===d.id));
});
