import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function boot(){
 const directory=mkdtempSync(join(tmpdir(),'onirama-p11-')),port=39000+Math.floor(Math.random()*4000);
 const server=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:String(port),ONIRAMA_DATA_DIR:directory,ONIRAMA_CORS_ORIGINS:'https://sea4594.github.io'},stdio:'ignore'});
 const origin=`http://127.0.0.1:${port}`;
 for(let i=0;i<100;i++){try{if((await fetch(origin+'/api/health')).ok)return {server,directory,origin};}catch{}await pause(45);}
 server.kill();throw Error('Server not ready');
}
async function stop({server,directory}){server.kill('SIGTERM');await Promise.race([new Promise(r=>server.once('exit',r)),pause(2000)]);rmSync(directory,{recursive:true,force:true});}
test('Deployed multiplayer acceptance script: create/join via code, Pages CORS, ready/start, privacy and stale action',async()=>{
 const instance=await boot();try{
  const output=execFileSync(process.execPath,['scripts/verify-backend.js',instance.origin],{encoding:'utf8',timeout:25000});
  assert.match(output,/PASS: health v0\.11\.0/);assert.match(output,/two seats/);
  const data=JSON.parse(readFileSync(join(instance.directory,'sessions.json'),'utf8'));assert.equal(Object.keys(data).length,1);
  assert.equal(Object.values(data)[0].game.phase,'draft');
 }finally{await stop(instance);}
});
test('Invalid invite code is rejected; server refuses room hijacking and start without two ready seats',async()=>{
 const instance=await boot(),base=instance.origin;
 try{
  const post=async(route,payload,token)=>{const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(payload)});return {status:r.status,data:await r.json()};};
  const bad=await post('/api/join',{code:'NOTACODE'});assert.notEqual(bad.status,200);
  const created=await post('/api/rooms',{name:'Host'});const {id,code}=created.data.room;
  assert.match(code,/^[A-F0-9]{8}$/);assert.notEqual((await post(`/api/rooms/${id}/start`,{},created.data.token)).status,200);
  const joined=await post('/api/join',{code:code.toLowerCase(),name:'Guest'});assert.equal(joined.status,200);
  assert.notEqual((await post('/api/join',{code,name:'Intruder'})).status,200);
  assert.notEqual((await post(`/api/rooms/${id}/ready`,{ready:true},'forged')).status,200);
  assert.notEqual((await post(`/api/rooms/${id}/start`,{},created.data.token)).status,200);
  const cors=await fetch(base+'/api/health',{headers:{Origin:'https://untrusted.example'}});assert.equal(cors.status,403);
 }finally{await stop(instance);}
});
test('Browser invitation routes contain only code, no bearer; UI has connection diagnostic and accessible mobile controls',()=>{
 const js=readFileSync('public/app.js','utf8'),html=readFileSync('public/index.html','utf8'),css=readFileSync('public/styles.css','utf8');
 assert.match(js,/join\\\?code=/);assert.match(js,/const inviteLink=code/);assert.match(js,/Copy invite link/);assert.match(js,/roomCodeFromHash\(\)/);
 assert.match(js,/cancelStream/);assert.match(js,/Test multiplayer connection/);assert.match(js,/Disconnected \/ reconnecting/);
 assert.ok(!/inviteLink.*token/.test(js));assert.match(html,/viewport/);assert.match(css,/@media\(max-width:600px\)/);
});
test('Live event stream is authenticated, seat-filtered, and emits room updates',async()=>{
 const instance=await boot(),base=instance.origin;
 try{
  const create=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'First'})}).then(r=>r.json());
  const id=create.room.id,host=create.token;
  const guest=await fetch(base+'/api/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:create.room.code,name:'Second'})}).then(r=>r.json());
  const forbidden=await fetch(`${base}/api/rooms/${id}/stream`);assert.equal(forbidden.status,401);
  const abort=new AbortController();
  const stream=await fetch(`${base}/api/rooms/${id}/stream`,{headers:{Authorization:`Bearer ${guest.token}`},signal:abort.signal});
  assert.equal(stream.status,200);assert.match(stream.headers.get('content-type')||'',/text\/event-stream/);
  const reader=stream.body.getReader(),decoder=new TextDecoder();let data='';
  const first=await reader.read();data+=decoder.decode(first.value);
  assert.match(data,/"room"/);assert.ok(!data.includes(host),'SSE exposes partner bearer token');
  const ready=await fetch(`${base}/api/rooms/${id}/ready`,{method:'POST',headers:{Authorization:`Bearer ${host}`,'Content-Type':'application/json'},body:JSON.stringify({ready:true})});assert.equal(ready.status,200);
  let notified='';for(let i=0;i<5;i++){const part=await Promise.race([reader.read(),pause(2500).then(()=>null)]);if(!part)break;notified+=decoder.decode(part.value);if(notified.includes('"ready":[true,false]'))break;}
  assert.match(notified,/"ready":\[true,false\]/,'SSE failed to broadcast room update');abort.abort();
 }finally{await stop(instance);}
});
