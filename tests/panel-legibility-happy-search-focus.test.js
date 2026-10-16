import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newGame,act,assertConserved} from '../engine/game.js';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/tabletop/card-system.css',import.meta.url),'utf8');
const escape=s=>String(s),card=c=>`<span class="card" data-preview="${c.id}"></span>`;
const start=app.indexOf("  if(p.type==='happyFetch'){"),end=app.indexOf("\n  if(p.type==='rally')",start);
const fetchRenderer=new Function('p','card','escape','happyFetchSelection',app.slice(start,end));

test('Happy Dream deck search shows every card in one scrollable lane, with one Select button disabled until a card is chosen',()=>{
 const p={type:'happyFetch',options:Array.from({length:25},(_,i)=>({id:`id-${i}`,kind:'location',color:'red'}))};
 const before=fetchRenderer(p,card,escape,null);
 assert.match(before,/tt26-fetch-strip/);assert.match(before,/scroll horizontally to see all cards/);
 assert.equal((before.match(/data-action="happyFetchPick:/g)||[]).length,25);
 assert.match(before,/data-action="happyFetchSelect" disabled/);
 assert.doesNotMatch(before,/choicePrev|choiceNext|freeOnSearch|<select/);
 const after=fetchRenderer(p,card,escape,'id-20');
 assert.match(after,/data-action="happyFetchPick:id-20" aria-pressed="true"/);
 assert.match(after,/tt26-fetch-confirm" data-action="happyFetchSelect" >/);
 assert.equal((after.match(/tt26-fetch-selected/g)||[]).length,1);
});

test('Search-based freeing has same Free/Pass selection flow as Door searches, with no Dreamcatcher dropdown anywhere',()=>{
 assert.match(app,/function beginSearchFree\(g,command\)/);
 assert.match(app,/function searchFreeWorkspace\(g\)/);
 assert.match(app,/Trigger a freeing\?/);
 assert.match(app,/data-action="happyFetchSelect"/);
 assert.match(app,/beginSearchFree\(g,\{type:'happyFetch',cardId:happyFetchSelection\}\)/);
 assert.match(app,/searchFree:free:/);assert.match(app,/searchFree:pass/);
 assert.match(app,/searchFreeIntent\.selected=index/);
 assert.doesNotMatch(app,/id="freeOnSearch"|function catcherSearchChoice/);
 assert.match(app,/type:'mirrorReward',ids,color/);
});

test('Happy Dream search chooses exactly one top card, and optional freeing returns the Catcher cards safely',()=>{
 for(const free of [false,true]){
  let s=newGame({seed:301,config:{expansions:['premonitions','dreamcatchers']},interactiveDraw:true});
  const i=s.deck.findIndex(c=>c.kind==='happyDream');assert(i>=0);
  const [dream]=s.deck.splice(i,1);s.phase='decision';s.pending={type:'happyDream',card:dream};
  s=act(s,{type:'happyDream',option:'fetch'});
  assert.equal(s.pending.type,'happyFetch');assert.equal(s.pending.options.length,s.deck.length);
  const id=s.deck.at(-1).id;
  let catcherId;
  if(free){const card=s.deck.shift();catcherId=card.id;s.moduleState.dreamcatchers.zones.catch0.push(card);assertConserved(s);}
  s=act(s,{type:'happyFetch',cardId:id,...(free?{freeId:0}:{})});
  assertConserved(s);
  assert.equal(s.moduleState.dreamcatchers.zones.catch0.length,0);
  if(free)assert(s.deck.concat(s.players.flatMap(p=>p.hand),s.discard,s.limbo).some(c=>c.id===catcherId));
  assert(s.log.some(m=>m.includes('shuffle')||m.includes('shuffl'))||s.shuffleSerial>0);
 }
});

test('card preview sizes are consistently readable and Happy Dream/Prophecy rows do not fill empty space',()=>{
 assert.match(css,/--tt26-panel-card:clamp\(46px/);
 assert.match(css,/\.tt23-peek-cards\{[^}]*flex:0 1 auto!important;[^}]*width:max-content!important/);
 assert.match(css,/\.tt7-prophecy \.tt26-prophecy-cards\{[^}]*width:max-content!important/);
 assert.match(css,/\.tt26-fetch-strip\{[^}]*overflow-x:auto/);
 assert.match(css,/\.tt24-reveal-list \.tt3-order-item,[\s\S]*?flex:0 0 var\(--tt26-panel-card\)!important/);
});

test('button focus is only re-established after keyboard interaction; dock reserves the iOS home indicator without reducing its 188px content budget',()=>{
 assert.match(app,/const focusKind=lastInputWasKeyboard\?/);
 assert.match(app,/app\.addEventListener\('pointerdown',\(\)=>\{lastInputWasKeyboard=false;/);
 assert.match(app,/if\(lastInputWasKeyboard&&focusKind/);
 assert.match(css,/@media \(hover:none\)/);
 assert.match(css,/--tt6-dock-height:calc\(188px \+ env\(safe-area-inset-bottom,0px\)\)!important/);
 assert.match(css,/padding-bottom:max\(4px,env\(safe-area-inset-bottom,0px\)\)!important/);
});
