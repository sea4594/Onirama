import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {icon} from '../public/icons.js';
import * as guest from '../public/guest-data.js';
const source=readFileSync('public/app.js','utf8').replace(/^import [^\n]+$/gm,'');
function lobby(){
 const writes=[],resolve=[];
 const app={innerHTML:'',addEventListener(){}},data=new Map();
 const ctx=vm.createContext({app,location:{origin:'http://localhost:8080',hostname:'localhost',pathname:'/',search:'',hash:'#/multiplayer'},
  localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},
  document:{documentElement:{dataset:{}},querySelector:q=>q==='#app'?app:null,addEventListener(){}},
  window:{},navigator:{},addEventListener(){},console,icon,...guest,
  firebase:{firebaseConfigured:()=>true,firebaseSetup:(code,config)=>{writes.push({code,config});return new Promise(done=>resolve.push(done));}}
 });
 vm.runInContext(source,ctx);
 vm.runInContext(`session={id:'ABCD',seat:0,transport:'firebase'};state={version:2,room:{code:'ABCD',seat:0,host:true,hostSeat:0,ready:[false,true],connected:[true,true],config:{expansions:[],difficulties:{}},started:false}};version=2;render()`,ctx);
 return {ctx,app,writes,resolve};
}
const flush=()=>new Promise(done=>setImmediate(done));
test('Host sees expansion changes immediately; queued writes coalesce and guest stays Ready',async()=>{
 const o=lobby();
 assert.match(o.app.innerHTML,/data-action="start"/);
 assert.doesNotMatch(o.app.innerHTML,/disabled>Start game/);
 vm.runInContext(`selectedExpansions.add('towers');queueLobbySetup()`,o.ctx);
 assert.equal(o.writes.length,1);
 assert.match(o.app.innerHTML,/data-expansion="towers"\s+checked/);
 assert.match(o.app.innerHTML,/disabled>Start game/);
 vm.runInContext(`selectedExpansions.add('premonitions');queueLobbySetup()`,o.ctx);
 vm.runInContext(`selectedDifficulties.premonitions='extreme';queueLobbySetup()`,o.ctx);
 assert.equal(o.writes.length,1,'Additional edits are not discarded or sent concurrently');
 assert.match(o.app.innerHTML,/data-expansion="premonitions"\s+checked/);
 assert.match(o.app.innerHTML,/value="extreme" selected/);
 assert.match(o.app.innerHTML,/Ready/);
 o.resolve[0]({version:3,room:{code:'ABCD',ready:[false,true],connected:[true,true],host:true,config:{expansions:['towers'],difficulties:{}},started:false}});
 await flush();
 assert.equal(o.writes.length,2,'Latest queued selection must be submitted');
 assert.deepEqual([...o.writes[1].config.expansions].sort(),['premonitions','towers']);
 assert.equal(o.writes[1].config.difficulties.premonitions,'extreme');
 assert.match(o.app.innerHTML,/data-expansion="premonitions"\s+checked/,'Server snapshots must not overwrite newer pending selections');
 o.resolve[1]({version:4,room:{code:'ABCD',ready:[false,true],connected:[true,true],host:true,config:o.writes[1].config,started:false}});
 await flush();
 assert.doesNotMatch(o.app.innerHTML,/disabled>Start game/);
 assert.match(o.app.innerHTML,/data-expansion="towers"\s+checked/);
 assert.match(o.app.innerHTML,/data-expansion="premonitions"\s+checked/);
});
test('A reconnecting host retains existing expansions when editing the lobby',()=>{
 const o=lobby();
 vm.runInContext(`state.room.config={expansions:['book'],difficulties:{book:'hard'}};render();`,o.ctx);
 vm.runInContext(`selectedExpansions.add('towers');queueLobbySetup()`,o.ctx);
 assert.deepEqual([...o.writes[0].config.expansions].sort(),['book','towers']);
 assert.equal(o.writes[0].config.difficulties.book,'hard');
});
