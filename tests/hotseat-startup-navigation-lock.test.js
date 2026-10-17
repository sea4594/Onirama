import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
function bindHandler(type,nextType,context){
 const start=source.indexOf(`app.addEventListener('${type}',e=>{`,source.indexOf("app.addEventListener('paste'"));
 const end=source.indexOf(`app.addEventListener('${nextType}',e=>{`,start+1);
 assert.ok(start>=0&&end>start,`Could not locate ${type} listener`);
 let listener;
 const app={addEventListener:(_type,fn)=>{listener=fn;},querySelector:()=>null};
 vm.runInNewContext(source.slice(start,end),{...context,app});
 assert.equal(typeof listener,'function');
 return listener;
}
function clickScenario({page,action,hotseat=true,passDevice=true}){
 const actions=[];
 const context={page,IS_HOTSEAT:()=>hotseat,passDevice,replayFrames:[],gameOverlay:null,pileOpen:null,handle:name=>actions.push(name)};
 const listener=bindHandler('click','keydown',context);
 const target={dataset:{action},closest:selector=>{
  if(selector==='[data-action],[data-pick]')return target;
  if(selector==='[data-action="passReady"]')return action==='passReady'?target:null;
  return null;
 },getAttribute:()=>null};
 listener({target,preventDefault(){throw Error('Unexpected preventDefault');}});
 return actions;
}

test('restored hot-seat handoff cannot block single-player and multiplayer navigation',()=>{
 for(const [page,action] of [['#/','setup'],['#/setup','soloStart'],['#/multiplayer','multiplayerTab:hotseat'],['#/multiplayer','resumeLocalHotseat'],['#/multiplayer','hotseatNewGame'],['#/settings','rules']]){
  assert.deepEqual(clickScenario({page,action}),[action],`${page}: ${action} should work despite a saved hot-seat handoff`);
 }
});

test('hot-seat privacy lock only blocks game actions until player acknowledges the handoff',()=>{
 assert.deepEqual(clickScenario({page:'#/game',action:'openGamePause'}),[]);
 assert.deepEqual(clickScenario({page:'#/game',action:'passReady'}),['passReady']);
 assert.deepEqual(clickScenario({page:'#/game',action:'openGamePause',passDevice:false}),['openGamePause']);
 assert.deepEqual(clickScenario({page:'#/game',action:'openGamePause',hotseat:false}),['openGamePause']);
});

test('hot-seat handoff cannot consume Escape outside the game',()=>{
 const start=source.indexOf("app.addEventListener('keydown',e=>{",source.indexOf("app.addEventListener('click',e=>{"));
 const end=source.indexOf("addEventListener('hashchange'",start);
 assert.ok(start>=0&&end>start);
 for(const page of ['#/','#/multiplayer','#/game']){
  let listener,prevented=false;
  const app={addEventListener:(_type,fn)=>{listener=fn;},querySelector:()=>null};
  vm.runInNewContext(source.slice(start,end),{app,page,IS_HOTSEAT:()=>true,passDevice:true,error:'',replayFrames:[],pileOpen:null});
  listener({key:'Escape',target:{dataset:{}},preventDefault(){prevented=true;}});
  assert.equal(prevented,page==='#/game',`${page} Escape`);
 }
});
