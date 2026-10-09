import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const PAGES='https://sea4594.github.io';
function launch(dir,port){return spawn(process.execPath,['server/index.js'],{cwd:process.cwd(),env:{...process.env,ONIRAMA_DATA_DIR:dir,ONIRAMA_CORS_ORIGINS:PAGES,PORT:String(port)},stdio:'ignore'});}
async function ready(port){for(let i=0;i<100;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/health`);if(r.ok)return;}catch{}await sleep(30);}throw Error('Server did not start');}
async function stop(child){if(child.exitCode!==null)return;const closed=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await Promise.race([closed,sleep(2000)]);}
async function request(base,path,method='GET',data=null,token=null,origin=null){
 const res=await fetch(base+path,{method,headers:{...(data!==null?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{}) ,...(origin?{Origin:origin}:{})},body:data===null?undefined:JSON.stringify(data)});
 return {status:res.status,data:await res.json(),headers:res.headers};
}
test('Pages build embeds only an HTTPS backend origin and still contains offline solo engine',()=>{
 const dir=mkdtempSync(join(tmpdir(),'onirama-pages-'));
 try{
  execFileSync(process.execPath,['scripts/build-pages.js',dir],{env:{...process.env,ONIRAMA_API_ORIGIN:'https://onirama.example.com'}});
  assert.match(readFileSync(join(dir,'runtime-config.js'),'utf8'),/https:\/\/onirama.example.com/);
  assert.ok(existsSync(join(dir,'engine/game.js')));
  assert.match(readFileSync(join(dir,'index.html'),'utf8'),/runtime-config.js/);
  assert.throws(()=>execFileSync(process.execPath,['scripts/build-pages.js',dir],{env:{...process.env,ONIRAMA_API_ORIGIN:'http://untrusted.example.com'},stdio:'pipe'}));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('Production API: CORS preflight, forbidden origins, authentication, stale actions, restart persistence, rate limits',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'onirama-production-'));
 const port=42000+Math.floor(Math.random()*2000),base=`http://127.0.0.1:${port}`;
 let child=launch(dir,port);
 try{
  await ready(port);
  const opt=await fetch(base+'/api/join',{method:'OPTIONS',headers:{Origin:PAGES,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}});
  assert.equal(opt.status,204);assert.equal(opt.headers.get('access-control-allow-origin'),PAGES);
  const forbidden=await request(base,'/api/catalog','GET',null,null,'https://evil.example');assert.equal(forbidden.status,403);
  const health=await request(base,'/api/health');assert.deepEqual(health.data,{ok:true,version:'0.10.0'});
  const room=await request(base,'/api/rooms','POST',{name:'Host'},null,PAGES);
  assert.equal(room.status,201);assert.equal(room.headers.get('access-control-allow-origin'),PAGES);
  const id=room.data.room.id,key=room.data.token;
  assert.equal((await request(base,`/api/rooms/${id}/state`)).status,401);
  assert.equal((await request(base,`/api/rooms/${id}/state`,'GET',null,key)).status,200);
  await stop(child);child=launch(dir,port);await ready(port);
  const restored=await request(base,`/api/rooms/${id}/state`,'GET',null,key);assert.equal(restored.status,200);assert.equal(restored.data.room.id,id);
  const joined=await request(base,'/api/join','POST',{name:'Partner',code:room.data.room.code});assert.equal(joined.status,200);
  assert.equal((await request(base,`/api/rooms/${id}/ready`,'POST',{ready:true},key)).status,200);
  assert.equal((await request(base,`/api/rooms/${id}/ready`,'POST',{ready:true},joined.data.token)).status,200);
  const started=await request(base,`/api/rooms/${id}/start`,'POST',{},key);assert.equal(started.status,200);
  const s=await request(base,`/api/rooms/${id}/state`,'GET',null,key);
  const selected=s.data.game.draft[0].id;
  assert.equal((await request(base,`/api/rooms/${id}/action`,'POST',{expectedVersion:s.data.version,command:{type:'draft',id:selected}},key)).status,200);
  assert.equal((await request(base,`/api/rooms/${id}/action`,'POST',{expectedVersion:s.data.version,command:{type:'draft',id:selected}},key)).status,400);
  const other=await request(base,`/api/rooms/${id}/state`,'GET',null,joined.data.token);
  assert.equal(other.data.game.players[0].hand[0].kind,'hidden');
  assert.equal(other.data.game.deck,undefined);
  const snapshot=JSON.parse(readFileSync(join(dir,'sessions.json'),'utf8'));
  assert.ok(snapshot[id]);assert.equal(snapshot[id].version,5);
  // Per-client room creation limit: first room consumed one creation, so 15 more are allowed.
  for(let i=0;i<15;i++)assert.equal((await request(base,'/api/rooms','POST',{name:'Guest'+i})).status,201);
  const limited=await request(base,'/api/rooms','POST',{name:'Too many'});assert.equal(limited.status,429);
  assert.equal(limited.headers.get('retry-after'),'60');
 }finally{await stop(child);rmSync(dir,{force:true,recursive:true});}
});
test('Source security invariants: save-before-commit, no plaintext frontend token, and privacy-safe events',()=>{
 const server=readFileSync('server/index.js','utf8'),web=readFileSync('public/app.js','utf8');
 assert.match(server,/persist\(next\);sessions=next;sendEvents\(x\)/);
 assert.match(server,/renameSync\(temp,path\)/);
 assert.match(server,/viewFor\(x.game,record.seat\)/);
 assert.match(web,/fetch\(`\$\{base\}\/api\/rooms\/\$\{session.id\}\/stream`/);
 assert.ok(!web.includes('token=${session.token}'));
});
