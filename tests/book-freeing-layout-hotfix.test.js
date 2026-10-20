import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {newGame,viewFor} from '../engine/game.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('public/app.js'),css=read('public/tabletop/card-system.css');
const ctx=vm.createContext({COLOR:['red','blue','green','brown'],escape:String,btn:(label,route,cl='')=>`<button class="${cl}" data-action="${route}">${label}</button>`,card:c=>`<span class="card" data-card-id="${c.id}"></span>`});
const start=app.indexOf('function searchFreeCatchers(g){'),end=app.indexOf('function decision(g,canAct)',start);
assert(start>0&&end>start);
vm.runInContext('let searchFreeIntent=null,doorSearchIntent=null,doorSearchChromatic=false;'+app.slice(start,end),ctx);
function makeGame(){const s=newGame({seed:9501,config:{expansions:['dreamcatchers']}}),d=s.moduleState.dreamcatchers.zones;for(let i=0;i<5;i++)d.catch1.push(s.deck.shift());d.catch0.push(s.deck.shift());return viewFor(s,s.active);}
function renderSearch(game,selected){ctx.game=game;ctx.selected=selected;return vm.runInContext('searchFreeIntent={command:{type:"happyFetch"},selected};searchFreeWorkspace(game)',ctx);}
function renderDoor(game,selected){ctx.game=game;ctx.selected=selected;return vm.runInContext('doorSearchIntent={option:"search",selected};doorSearchDecision(game,game.pending)',ctx);}
function checkPane(html,selected,freeAction,passAction,cardCount){
 assert.match(html,/class="tt21-free-detail"/);assert.match(html,/class="tt33-free-preview"/);assert.match(html,/class="tt21-free-buttons"/);
 assert(html.indexOf('tt33-free-preview')<html.indexOf('tt21-free-buttons'));
 assert.match(html,new RegExp('data-action="'+passAction+'"'));
 const cards=[...html.matchAll(/data-card-id="[^"]+"/g)];assert.equal(cards.length,cardCount);
 if(selected){assert.match(html,new RegExp('data-action="'+freeAction+'"'));assert.match(html,/aria-label="Dreamcatcher \d cards"/);}else{assert.match(html,/class="primary" disabled>Free/);assert(!html.includes('data-action="'+freeAction+'"'));}
}
test('all search-based Freeing panels reveal every chosen card and keep Free/Pass in the same column',()=>{
 const game=makeGame();
 checkPane(renderSearch(game,null),false,'searchFree:free:1','searchFree:pass',0);
 checkPane(renderSearch(game,1),true,'searchFree:free:1','searchFree:pass',5);
 checkPane(renderSearch(game,0),true,'searchFree:free:0','searchFree:pass',1);
 game.phase='decision';game.pending={type:'doorSearch',color:'red',targets:[]};
 checkPane(renderDoor(game,null),false,'doorSearch:free:1','doorSearch:passFree',0);
 checkPane(renderDoor(game,1),true,'doorSearch:free:1','doorSearch:passFree',5);
 checkPane(renderDoor(game,0),true,'doorSearch:free:0','doorSearch:passFree',1);
});
test('the Freeing layout reserves a fixed button column instead of positioning buttons by card count',()=>{
 assert.match(css,/\.tt33-free-step \.tt21-free-detail\{[\s\S]*?grid-template-columns:minmax\(0,1fr\) clamp\(67px,22%,92px\)!important/);
 assert.match(css,/\.tt33-free-step \.tt21-free-cards\{[\s\S]*?max-width:100%!important/);
 assert.match(css,/\.tt33-free-step \.tt21-free-buttons\{[\s\S]*?width:100%!important/);
 assert.match(css,/\.tt33-free-step \.tt21-free-buttons button\{[\s\S]*?width:100%!important/);
});
test('Spells controls resemble physical bound books rather than flat card buttons in solo and cooperative',()=>{
 for(const file of ['public/tabletop/solo-board.js','public/tabletop/coop-board.js']){
  const src=read(file);assert.match(src,/data-action="openSpells"[^>]*><span class="tt32-book-cover"/);
  assert.match(src,/class="tt33-book-ornament"/);assert.match(src,/class="tt32-book-count"/);assert.match(src,/class="tt32-book-label">Spells/);
 }
 assert.match(css,/\.tt32-spell-book \.tt32-book-cover\{[\s\S]*?border-left:7px solid/);
 assert.match(css,/\.tt32-spell-book \.tt32-book-cover::after\{\s*content:none!important;display:none!important/);
 assert.match(css,/\.tt32-spell-book \.tt32-book-cover::before\{[\s\S]*?repeating-linear-gradient\(to bottom,#9b8552/);
});
