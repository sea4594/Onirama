#!/usr/bin/env node
// Creates a disposable two-seat room on the target backend (the room remains in storage).
// Does not require accounts, third-party packages, or access to your personal credentials.
const apiOrigin=process.argv[2]?.replace(/\/$/,'');
const pagesOrigin=process.argv[3]||'https://sea4594.github.io';
if(!apiOrigin||!/^https:\/\/[^/]+$/.test(apiOrigin)&&!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(apiOrigin)){
  console.error('Usage: node scripts/verify-backend.js https://YOUR-HOST.onrender.com [https://sea4594.github.io]');process.exit(2);
}
const assert=(condition,message)=>{if(!condition)throw Error(message);};
async function call(path,method='GET',payload,token,origin=pagesOrigin){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
  try{const response=await fetch(`${apiOrigin}${path}`,{method,headers:{Origin:origin,...(payload?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},body:payload?JSON.stringify(payload):undefined,signal:controller.signal,cache:'no-store'});
    let data;try{data=await response.json();}catch{data={};}return {status:response.status,data,headers:response.headers};
  }finally{clearTimeout(timeout);}
}
try{
  const health=await call('/api/health');assert(health.status===200&&health.data.ok===true,'Health endpoint unavailable');
  assert(health.headers.get('access-control-allow-origin')===pagesOrigin,'Pages origin is not in ONIRAMA_CORS_ORIGINS');
  const preflight=await fetch(`${apiOrigin}/api/rooms`,{method:'OPTIONS',headers:{Origin:pagesOrigin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}});
  assert(preflight.status===204,'CORS preflight rejected');
  const host=await call('/api/rooms','POST',{name:'Launch verification host'});assert(host.status===201,'Room creation failed');
  const {id,code}=host.data.room;assert( /^[A-Z]{4}$/.test(code),'Expected four-letter room code');
  assert((await call(`/api/rooms/${id}/state`)).status===401,'Unauthenticated user could see the room');
  const guest=await call('/api/join','POST',{name:'Launch verification guest',code:code.toLowerCase()});assert(guest.status===200,'Room-code join failed');
  assert(guest.data.token!==host.data.token,'Seats share a credential');
  assert((await call(`/api/rooms/${id}/ready`,'POST',{ready:true},host.data.token)).status===200,'Host could not ready');
  assert((await call(`/api/rooms/${id}/ready`,'POST',{ready:true},guest.data.token)).status===200,'Guest could not ready');
  assert((await call(`/api/rooms/${id}/start`,'POST',{},guest.data.token)).status!==200,'Guest illegally started room');
  assert((await call(`/api/rooms/${id}/start`,'POST',{},host.data.token)).status===200,'Host could not start room');
  const s=await call(`/api/rooms/${id}/state`,'GET',null,host.data.token);
  assert(s.status===200&&s.data.game?.phase==='draft','Draft not available');
  const first=s.data.game.draft[0].id;
  assert((await call(`/api/rooms/${id}/action`,'POST',{expectedVersion:s.data.version,command:{type:'draft',id:first}},host.data.token)).status===200,'First draft failed');
  assert((await call(`/api/rooms/${id}/action`,'POST',{expectedVersion:s.data.version,command:{type:'draft',id:first}},host.data.token)).status!==200,'Duplicate action accepted');
  const other=await call(`/api/rooms/${id}/state`,'GET',null,guest.data.token);
  assert(other.status===200&&other.data.game.players[0].hand[0].kind==='hidden','Private hand leaked');
  assert(!('deck' in other.data.game)&&!('rng' in other.data.game),'Hidden deck or random seed leaked');
  assert(!JSON.stringify(other.data).includes(host.data.token),'Host credential leaked');
  console.log(`PASS: health v${health.data.version}, Pages CORS, room code, two seats, ready/start, draft, privacy, stale-action rejection.`);
  console.log('Test room created on backend; it remains in session storage. No real player sessions were touched.');
}catch(e){console.error('FAIL:',e.message);process.exitCode=1;}
