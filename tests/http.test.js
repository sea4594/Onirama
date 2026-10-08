import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

test('HTTP solo and cooperative authorization, game start, privacy, stale actions',async()=>{
  const dataDir=mkdtempSync(join(tmpdir(),'onirama-test-'));
  const port=32131+Math.floor(Math.random()*1000);const host=`http://127.0.0.1:${port}`;
  const child=spawn(process.execPath,['server/index.js'],{cwd:process.cwd(),env:{...process.env,ONIRAMA_DATA_DIR:dataDir,PORT:String(port)},stdio:'ignore'});
  async function request(route,method='GET',body=null,token=null){
    const r=await fetch(host+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});
    return {status:r.status,data:await r.json()};
  }
  try{
    let ready=false;for(let i=0;i<60;i++){try{const r=await fetch(host+'/');if(r.ok){ready=true;break;}}catch{}await sleep(40);}assert.ok(ready,'Server did not start');
    const catalog=await request('/api/catalog');assert.equal(catalog.status,200);assert.equal(catalog.data.expansions.length,10);
    const blocked=await request('/api/solo','POST',{name:'Unverified',config:{expansions:['mirrors']}});assert.equal(blocked.status,400);assert.match(blocked.data.error,/not yet playable/);
    const expanded=await request('/api/solo','POST',{name:'Expansions',config:{expansions:['book','glyphs','dreamcatchers','towers'],difficulties:{book:'normal',dreamcatchers:'normal',towers:'hard'}}});
    assert.equal(expanded.status,201);const all=await request(`/api/rooms/${expanded.data.room.id}/state`,'GET',null,expanded.data.token);
    assert.equal(all.status,200);assert.equal(all.data.game.config.expansions.length,4);assert.equal(all.data.game.expansion.book.goals.length,12);
    assert.equal(all.data.game.expansion.dreamcatchers.stacks.length,4);assert.equal(all.data.game.expansion.towers.alignment.length,0);
    const expanded5=await request('/api/solo','POST',{name:'Phase5',config:{expansions:['premonitions','crossroads','oniverse'],difficulties:{premonitions:'extreme',crossroads:'hard'}}});
    assert.equal(expanded5.status,201);
    const p5=await request(`/api/rooms/${expanded5.data.room.id}/state`,'GET',null,expanded5.data.token);
    assert.equal(p5.status,200);assert.equal(p5.data.game.expansion.premonitions.faceUp.length,6);
    assert.equal(p5.data.game.expansion.premonitions.reserveCount,2);
    assert.equal(p5.data.game.expansion.crossroads.hard,true);
    assert.equal(p5.data.game.expansion.oniverse.rallied.length,0);
    assert.equal(p5.data.game.deck,undefined);assert.equal(p5.data.game.moduleState,undefined);
    const solo=await request('/api/solo','POST',{name:'Solo'});assert.equal(solo.status,201);const id=solo.data.room.id;
    const unauthorized=await request(`/api/rooms/${id}/state`);assert.equal(unauthorized.status,401);
    const initial=await request(`/api/rooms/${id}/state`,'GET',null,solo.data.token);assert.equal(initial.status,200);
    assert.equal(initial.data.game.deck,undefined);assert.equal(initial.data.game.rng,undefined);
    const chosen=initial.data.game.players[0].hand[0];const version=initial.data.version;
    const action=await request(`/api/rooms/${id}/action`,'POST',{expectedVersion:version,command:{type:'discard',id:chosen.id}},solo.data.token);
    assert.equal(action.status,200);
    const replay=await request(`/api/rooms/${id}/action`,'POST',{expectedVersion:version,command:{type:'discard',id:chosen.id}},solo.data.token);
    assert.equal(replay.status,400); // stale state cannot be used twice
    const coop=await request('/api/rooms','POST',{name:'One'});const rid=coop.data.room.id;
    const joined=await request('/api/join','POST',{code:coop.data.room.code,name:'Two'});assert.equal(joined.status,200);
    await request(`/api/rooms/${rid}/ready`,'POST',{ready:true},coop.data.token);
    await request(`/api/rooms/${rid}/ready`,'POST',{ready:true},joined.data.token);
    const begin=await request(`/api/rooms/${rid}/start`,'POST',{},coop.data.token);assert.equal(begin.status,200);
    let active=await request(`/api/rooms/${rid}/state`,'GET',null,coop.data.token);assert.equal(active.data.game.phase,'draft');
    const draft=await request(`/api/rooms/${rid}/action`,'POST',{expectedVersion:active.data.version,command:{type:'draft',id:active.data.game.draft[0].id}},coop.data.token);assert.equal(draft.status,200);
    active=await request(`/api/rooms/${rid}/state`,'GET',null,joined.data.token);
    assert.equal(active.data.game.players[0].hand[0].kind,'hidden');assert.equal(active.data.game.deck,undefined);
    const wrong=await request(`/api/rooms/${rid}/action`,'POST',{expectedVersion:active.data.version,command:{type:'draft',id:active.data.game.draft[0].id}},coop.data.token);
    assert.equal(wrong.status,400);
  }finally{child.kill('SIGTERM');rmSync(dataDir,{force:true,recursive:true});}
});
