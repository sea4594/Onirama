import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,act,assertConserved} from '../engine/game.js';
import {moveOrderedCardToGap,restoreDiscardedCardToGap} from '../public/tabletop/interactions.js';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/tabletop/card-system.css',import.meta.url),'utf8');
const gestures=readFileSync(new URL('../public/tabletop/interactions.js',import.meta.url),'utf8');
const escape=x=>String(x),card=c=>`<span class="card" data-preview="${c.id}"></span>`,btn=(label,action)=>`<button data-action="${action}">${label}</button>`;
const ids=n=>Array.from({length:n},(_,i)=>`peek-${i}`);
const cards=n=>ids(n).map(id=>({id,kind:'location',color:'red',symbol:'moon'}));
const happyFactory=new Function('card','escape','btn','effectOrder','effectDiscards',
 source.slice(source.indexOf('function happyPeekDecision(p){'),source.indexOf('function effectReorder(p)'))+';return happyPeekDecision');
const generalFactory=new Function('card','escape','btn','effectOrder','effectPick','effectDiscards','happyPeekDecision','incantationDecision',
 source.slice(source.indexOf('function effectReorder(p){'),source.indexOf('function towerEdgeConflict('))+';return effectReorder');

function putRallied(s,ability){const zones=[s.deck,s.moduleState.oniverse.zones.unused];for(const zone of zones){const i=zone.findIndex(c=>c.ability===ability);if(i>=0){const [d]=zone.splice(i,1);d.owner=s.active;s.moduleState.oniverse.zones.rallied.push(d);return d;}}assert.fail(`Missing ${ability}`);}
function swapIntoHand(s,predicate){const i=s.deck.findIndex(predicate);assert(i>=0);[s.players[0].hand[0],s.deck[i]]=[s.deck[i],s.players[0].hand[0]];return s.players[0].hand[0];}

test('Squirrel Spies shows exactly five top cards and preserves their reordered identities',()=>{
 let s=newGame({seed:12,config:{expansions:['oniverse']},interactiveDraw:true});const d=putRallied(s,'squirrel');
 const original=s.deck.slice(-5).map(c=>c.id).reverse();s=act(s,{type:'useDenizen',id:d.id});
 assert.equal(s.pending.type,'denizenPeek');assert.equal(s.pending.cards.length,5);
 assert.deepEqual(s.pending.cards.map(c=>c.id),original);assertConserved(s);
 s=act(s,{type:'denizenPeek',order:[...original].reverse()});assertConserved(s);
 assert.deepEqual(s.deck.slice(-5).map(c=>c.id),original);
});

test('Harpoon Hunter inspects five cards, discards Nightmares, and orders other cards below deck',()=>{
 let s=newGame({seed:18,config:{expansions:['oniverse']},interactiveDraw:true});const d=putRallied(s,'harpoon');
 const i=s.deck.findIndex(c=>c.kind==='nightmare');assert(i>=0);
 [s.deck[i],s.deck[s.deck.length-1]]=[s.deck[s.deck.length-1],s.deck[i]];
 const examined=new Set(s.deck.slice(-5).map(c=>c.id)),beforeDiscard=new Set(s.discard.map(c=>c.id));
 s=act(s,{type:'useDenizen',id:d.id});assert.equal(s.pending.type,'denizenPeek');
 const discarded=s.discard.filter(c=>!beforeDiscard.has(c.id)&&examined.has(c.id));
 assert.equal(s.pending.cards.length+discarded.length,5);
 assert(discarded.length>0);assert(discarded.every(c=>c.kind==='nightmare'));assertConserved(s);
 s=act(s,{type:'denizenPeek',order:s.pending.cards.map(c=>c.id)});assertConserved(s);
});

test('Key Prophecy and Glyph Incantation each inspect five cards, with exact deck ownership',()=>{
 for(const [expansions,symbol,type] of [[[], 'key','prophecy'],[['glyphs'],'glyph','incantation']]){
  let s=newGame({seed:39,config:{expansions},interactiveDraw:true});const c=swapIntoHand(s,x=>x.kind==='location'&&x.symbol===symbol);
  s=act(s,{type:'discard',id:c.id});assert.equal(s.pending.type,type);assert.equal(s.pending.cards.length,5);assertConserved(s);
 }
});

test('Tower, Sphinx and Paradox spell inspect their prescribed number of cards',()=>{
 let t=newGame({seed:61,config:{expansions:['towers']},interactiveDraw:true});
 const tower=swapIntoHand(t,c=>c.kind==='tower'&&c.number===5);
 t=act(t,{type:'discard',id:tower.id});assert.equal(t.pending.type,'towerLook');assert.equal(t.pending.cards.length,5);assertConserved(t);
 let sphinx=newGame({seed:62,config:{expansions:['sphinx']},interactiveDraw:true});
 const index=sphinx.deck.findIndex(c=>c.kind==='sphinx');assert(index>=0);
 const [sphinxCard]=sphinx.deck.splice(index,1);sphinx.phase='decision';sphinx.pending={type:'sphinxName',card:sphinxCard};
 sphinx=act(sphinx,{type:'sphinxName',aspect:'red'});assert.equal(sphinx.pending.type,'sphinxResolve');assert.equal(sphinx.pending.cards.length,5);assertConserved(sphinx);
 let spell=newGame({seed:63,config:{expansions:['book']},interactiveDraw:true});
 spell.discard.push(...spell.deck.splice(0,5));
 spell=act(spell,{type:'cast',spell:'paradox'});assert.equal(spell.pending.type,'spellPeek');assert.equal(spell.pending.cards.length,5);assertConserved(spell);
});

test('Happy Dream examines seven, or every remaining card if fewer than seven',()=>{
 for(const available of [0,1,4,7,10]){
  let s=newGame({seed:51,config:{expansions:['premonitions']},interactiveDraw:true});
  const i=s.deck.findIndex(c=>c.kind==='happyDream');assert(i>=0);
  const [dream]=s.deck.splice(i,1);s.phase='decision';s.pending={type:'happyDream',card:dream};
  while(s.deck.length>available)s.discard.push(s.deck.shift());
  s=act(s,{type:'happyDream',option:'peek'});assert.equal(s.pending.cards.length,Math.min(available,7));assertConserved(s);
  const seen=s.pending.cards.map(c=>c.id);
  const discardIds=seen.slice(0,Math.ceil(seen.length/2)),order=seen.slice(discardIds.length).reverse();
  s=act(s,{type:'happyPeek',discardIds,order});assertConserved(s);
  assert(discardIds.every(id=>s.discard.some(c=>c.id===id)));
 }
});

test('every visible reorder decision displays all inspected cards, without four-card paging',()=>{
 for(const type of ['denizenPeek','towerLook','spellPeek','sphinxResolve','diver']){
  const effectOrder=[],effectDiscards=new Set();
  const happy=happyFactory(card,escape,btn,[],new Set());
  const render=generalFactory(card,escape,btn,effectOrder,null,effectDiscards,happy,()=>''),html=render({type,cards:cards(5),remaining:5});
  assert.equal((html.match(/data-tt-order-id=/g)||[]).length,5,`${type} must show all five`);
  assert.match(html,/tt24-reveal-list/);assert.doesNotMatch(html,/choiceNext|choicePrev/);
 }
 assert.match(css,/\.tt24-reveal-list\{[^}]*overflow-x:auto!important/);
 assert.match(css,/\.tt24-reveal-list \.tt3-order-item\{[^}]*flex:0 0 auto!important/);
});

test('Happy Dream discard area grows one card at a time and every card remains individually visible/restorable',()=>{
 for(let count=0;count<=7;count++){
  const discardSet=new Set(ids(7).slice(0,count));
  const html=happyFactory(card,escape,btn,ids(7),discardSet)({type:'happyPeek',cards:cards(7)});
  assert(html.includes(`Discard (${count})`));
  assert.equal((html.match(/data-tt-order-id=/g)||[]).length,7-count);
  assert.equal((html.match(/data-tt-happy-restore=/g)||[]).length,count);
  for(const id of ids(7))assert.equal((html.match(new RegExp(`data-preview="${id}"`,'g'))||[]).length,1);
 }
 assert.match(css,/\.tt23-happy-discard\{[^}]*width:max-content!important/);
 assert.match(css,/\.tt23-discard-stack\{[^}]*display:flex;flex-direction:row/);
 assert.match(css,/\.tt23-discard-card\{[^}]*position:static!important/);
 assert.doesNotMatch(css,/\.tt23-discard-card\{[^}]*position:absolute/);
 assert.match(gestures,/onRestore\(id,target.index\)/);
 assert.match(source,/data-action="effectRestore:/);
});

test('restoring Happy Dream discarded cards into a precise gap keeps all seven ordered exactly once',()=>{
 const all=ids(7),discarded=new Set([all[1],all[4],all[6]]);
 const restored=restoreDiscardedCardToGap(all,discarded,all[4],2);
 assert.deepEqual(restored.slice(0,5),[all[0],all[2],all[4],all[3],all[5]]);
 discarded.delete(all[4]);assert.equal(new Set(restored).size,7);
 assert.deepEqual(moveOrderedCardToGap(restored.filter(id=>!discarded.has(id)),all[4],0).slice(0,2),[all[4],all[0]]);
 assert.strictEqual(restoreDiscardedCardToGap(all,discarded,all[4],1),all,'Cannot restore an undiscarded card');
});
