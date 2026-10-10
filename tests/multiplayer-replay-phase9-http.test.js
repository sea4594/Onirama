import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('Node multiplayer streams replay through drafting, reconnection, and both player perspectives',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'onirama-phase9-')),port=42000+Math.floor(Math.random()*1000);
 const child=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port),ONIRAMA_DATA_DIR:directory},stdio:'ignore'});
 const base=`http://127.0.0.1:${port}`;
 const request=async(route,method='GET',body=null,token=null)=>{const response=await fetch(base+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json()};};
 try{
  let ready=false;for(let i=0;i<80;i++){try{if((await request('/api/health')).status===200){ready=true;break;}}catch{}await wait(40);}assert.ok(ready);
  const host=(await request('/api/rooms','POST',{name:'Host'})).data;
  const guest=(await request('/api/join','POST',{code:host.room.code,name:'Guest'})).data;
  const id=host.room.id,h=host.token,g=guest.token;
  for(const token of [h,g])assert.equal((await request(`/api/rooms/${id}/ready`,'POST',{ready:true},token)).status,200);
  assert.equal((await request(`/api/rooms/${id}/start`,'POST',{},h)).status,200);
  let state=(await request(`/api/rooms/${id}/state`,'GET',null,h)).data;assert.equal(state.replay.length,1);
  assert.equal((await request(`/api/rooms/${id}/action`,'POST',{expectedVersion:state.version,command:{type:'draft',id:state.game.draft[0].id}},h)).status,200);
  state=(await request(`/api/rooms/${id}/state`,'GET',null,g)).data;
  assert.equal(state.replay.length,2);assert.equal(state.replay[1].actor,0);
  assert.equal(state.replay[1].frame.players[0].hand[0].kind,'hidden');
  assert.equal(state.replay[1].frame.players[0].hand[0].id,undefined);
  assert.equal((await request(`/api/rooms/${id}/action`,'POST',{expectedVersion:state.version,command:{type:'draft',id:state.game.draft[0].id}},g)).status,200);
  const restored=(await request(`/api/rooms/${id}/state`,'GET',null,h)).data;
  assert.equal(restored.replay.length,3);
  assert.equal(restored.replay[2].actor,1);
  assert.equal(restored.room.paused,false);
 }finally{child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),wait(1500)]);rmSync(directory,{recursive:true,force:true});}
});
