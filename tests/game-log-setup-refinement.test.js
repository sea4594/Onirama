import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {renderActionHistory,renderOverlay} from '../public/game-overlay.js';
import {icon} from '../public/icons.js';
import * as guest from '../public/guest-data.js';

const appSource=readFileSync('public/app.js','utf8');
const css=readFileSync('public/game-shell.css','utf8');

test('multiplayer log separates turns with named, color-coded headings but omits turn narration',()=>{
 const log=[
  'Draft three personal Locations each.',
  'Ada drafted a card.', 'Ben drafted a card.',
  'Ada played red sun.', 'Ada unlocked a blue Door (search).',
  'Ready to end turn.', "Ben's turn.",
  'Ben discarded green key.', 'Limbo shuffled into deck.',
  'Ready to end turn.'
 ];
 const html=renderActionHistory(log,{players:['Ada','Ben'],coop:true});
 assert.match(html,/Draft · Ada/);
 assert.match(html,/Draft · Ben/);
 assert.match(html,/Turn 1 · Ada/);
 assert.match(html,/Turn 2 · Ben/);
 assert.ok(html.indexOf('Turn 2 · Ben')<html.indexOf('Turn 1 · Ada'),'most recent turn goes first');
 assert.match(html,/tt9-log-player-0/);assert.match(html,/tt9-log-player-1/);
 assert.match(html,/tt9-log-card/);assert.match(html,/card-kind-door/);
 assert.doesNotMatch(html,/Ready to end turn|Ben&#39;s turn|Draft three personal/);
 assert.match(css,/\.tt9-log-player-0/);assert.match(css,/\.tt9-log-player-1/);
});

test('action log is compact and safe, with no source-history mutation',()=>{
 const history=['A new dream begins.','You played red moon.','Drew a card.','No Location remains to complete the hand.','<bad>'];
 const preserved=[...history];
 const html=renderActionHistory(history,{players:['You']});
 assert.deepEqual(history,preserved);
 assert.match(html,/Turn 1/);assert.match(html,/card-kind-location/);
 assert.doesNotMatch(html,/Drew a card|A new dream begins/);
 assert.match(html,/&lt;bad&gt;/);assert.doesNotMatch(html,/<bad>/);
 assert.match(renderOverlay('pause',[],false,{log:history,players:['You'],coop:false}),/tt9-action-log/);
});

test('all setup surfaces use selection-sized difficulty dropdowns, not option-list width',()=>{
 const shell=readFileSync('public/shell.css','utf8');
 assert.match(shell,/\.shell \.shell-difficulty\{[^}]*width:86px/);
 for(const width of ['extreme','easy','apprentice','true'])assert.match(shell,new RegExp(`data-current-level="${width}"`));
 assert.match(appSource,/data-current-level="\$\{levels\[id\]/);
 assert.match(appSource,/data-difficulty="\$\{id\}"/);
});

test('host edits use incremental DOM sync rather than replacing the whole lobby',async()=>{
 const source=appSource.replace(/^import [^\n]+$/gm,'');
 const choices=new Map();
 const select={value:'normal',dataset:{},remove(){this.removed=true}};
 const entry={querySelector:(q)=>q==='[data-difficulty]'?select:null};
 const checkbox={checked:false,closest:()=>entry};
 const section={querySelector(q){if(q==='.shell-count')return count;if(q==='[data-expansion="towers"]')return checkbox;return null;}};
 const count={textContent:''};
 let renders=0,writes=[];const callbacks=[];
 const app={set innerHTML(value){renders++;this.value=value},get innerHTML(){return this.value||''},addEventListener(){},querySelector:q=>q==='.shell-expansion-setup'?section:null};
 const data=new Map();
 const ctx=vm.createContext({app,location:{origin:'http://localhost',hostname:'localhost',pathname:'/',search:'',hash:'#/multiplayer'},
  document:{documentElement:{dataset:{}},querySelector:q=>q==='#app'?app:null,addEventListener(){}},
  localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},
  window:{},navigator:{},addEventListener(){},console,icon,...guest,
  firebase:{firebaseConfigured:()=>true,firebaseSetup:(code,config)=>{writes.push(config);return new Promise(done=>callbacks.push(done));}}
 });
 vm.runInContext(source,ctx);
 vm.runInContext("session={id:'ABCD',transport:'firebase'};state={room:{code:'ABCD',seat:0,host:true,hostSeat:0,connected:[true,true],started:false,ready:[false,true],config:{expansions:['towers'],difficulties:{}}},version:2};selectedExpansions.add('towers')",ctx);
 renders=0;
 vm.runInContext('queueLobbySetup(true)',ctx);
 assert.equal(renders,0,'no full rerender while adjusting existing control');
 assert.equal(checkbox.checked,true);assert.equal(count.textContent,'1 selected');
 assert.equal(writes.length,1);assert.deepEqual([...writes[0].expansions],['towers']);
 callbacks[0]({room:{code:'ABCD',host:true,hostSeat:0,connected:[true,true],config:writes[0],ready:[false,true]},version:3});
 await new Promise(done=>setImmediate(done));
});
