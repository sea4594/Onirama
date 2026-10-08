import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {join,extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {newGame,act,viewFor,assertConserved} from '../engine/game.js';

const root=resolve(fileURLToPath(new URL('../public/',import.meta.url)));
const store=resolve(process.env.ONIRAMA_DATA_DIR||'server-data');mkdirSync(store,{recursive:true});
const path=join(store,'sessions.json');
let sessions=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{};
const listeners=new Map();
const token=()=>randomBytes(24).toString('base64url');
const code=()=>randomBytes(4).toString('hex').toUpperCase();
const save=()=>writeFileSync(path,JSON.stringify(sessions));
const json=(res,status,data)=>{
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(JSON.stringify(data));
};
const headers={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; object-src 'none'"};
const asError=(e)=>({error:e instanceof Error?e.message:'Request rejected'});
const roomSummary=(x,seat)=>({id:x.id,code:x.code,mode:x.mode,seat,host:seat===0,ready:x.ready,connected:x.seats.map(Boolean),started:!!x.game,phase:x.game?.phase,status:x.game?.status});
function credentials(x,request){
  const bearer=request.headers.authorization||'';
  const credential=bearer.startsWith('Bearer ')?bearer.slice(7):null;
  const seat=x.seats.findIndex(s=>s?.token===credential);
  if(seat<0)throw Error('Not authorized for this game. Rejoin using your saved seat.');
  return seat;
}
function sendEvents(x){
  for(const [res,seat] of listeners.get(x.id)||[])try{
    res.write(`data: ${JSON.stringify({room:roomSummary(x,seat),game:x.game?viewFor(x.game,seat):null})}\n\n`);
  }catch{}
}
function create(mode,name){
  const id=token().slice(0,12),key=token();
  const x={id,code:code(),mode,ready:[false,false],seats:[{name:String(name||'Dreamwalker').slice(0,40),token:key},null],game:null,version:0,createdAt:Date.now()};
  sessions[id]=x;save();return {room:roomSummary(x,0),token:key};
}
async function body(req){
  const chunks=[];let size=0;
  for await(const c of req){size+=c.length;if(size>8192)throw Error('Request too large');chunks.push(c);}
  return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');
}
function endpoint(req,res,url,data){
  const segments=url.pathname.split('/').filter(Boolean);
  if(req.method==='POST'&&url.pathname==='/api/solo'){
    const o=create('solo',data.name);
    sessions[o.room.id].game=newGame({mode:'solo'});save();return json(res,201,o);
  }
  if(req.method==='POST'&&url.pathname==='/api/rooms')return json(res,201,create('coop',data.name));
  if(req.method==='POST'&&url.pathname==='/api/join'){
    const x=Object.values(sessions).find(x=>x.mode==='coop'&&x.code===String(data.code||'').trim().toUpperCase());
    if(!x)throw Error('Room code not found');if(x.game)throw Error('This game has already started');if(x.seats[1])throw Error('Room is full');
    const credential=token();x.seats[1]={name:String(data.name||'Partner').slice(0,40),token:credential};x.version++;save();sendEvents(x);
    return json(res,200,{room:roomSummary(x,1),token:credential});
  }
  if(segments[0]!=='api'||segments[1]!=='rooms'||!segments[2])return json(res,404,{error:'Unknown API route'});
  const x=sessions[segments[2]];if(!x)return json(res,404,{error:'Game not found'});
  const seat=credentials(x,req),operation=segments[3];
  if(req.method==='GET'&&operation==='state')return json(res,200,{room:roomSummary(x,seat),game:x.game?viewFor(x.game,seat):null,version:x.version});
  if(req.method==='GET'&&operation==='stream'){
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
    if(!listeners.has(x.id))listeners.set(x.id,new Set());const record=[res,seat];listeners.get(x.id).add(record);
    res.write(`data: ${JSON.stringify({room:roomSummary(x,seat),game:x.game?viewFor(x.game,seat):null})}\n\n`);
    const keepAlive=setInterval(()=>res.write(': heartbeat\n\n'),25000);
    req.on('close',()=>{clearInterval(keepAlive);listeners.get(x.id)?.delete(record)});return;
  }
  if(req.method==='POST'&&operation==='ready'){
    if(x.game)throw Error('The game has already started');x.ready[seat]=!!data.ready;x.version++;save();sendEvents(x);
    return json(res,200,{ok:true,version:x.version});
  }
  if(req.method==='POST'&&operation==='start'){
    if(x.mode!=='coop'||seat!==0)throw Error('Only the host can start the cooperative game');
    if(x.game)throw Error('Game already started');
    if(!x.seats[1]||!x.ready.every(Boolean))throw Error('Both players must join and be ready');
    x.game=newGame({mode:'coop',names:x.seats.map(v=>v.name)});x.version++;save();sendEvents(x);
    return json(res,200,{ok:true,version:x.version});
  }
  if(req.method==='POST'&&operation==='action'){
    if(!x.game)throw Error('Game has not started');
    if(seat!==x.game.active)throw Error('It is not your turn');
    if(!Number.isInteger(data.expectedVersion)||data.expectedVersion!==x.version)throw Error('State changed. The board has been refreshed; choose your action again.');
    const next=act(x.game,data.command);assertConserved(next);
    x.game=next;x.version++;save();sendEvents(x);
    return json(res,200,{ok:true,version:x.version});
  }
  return json(res,404,{error:'Unknown room operation'});
}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname.startsWith('/api/')){
      if(!['GET','POST'].includes(req.method))return json(res,405,{error:'Method not allowed'});
      let data=req.method==='POST'?await body(req):{};
      Object.entries(headers).forEach(([k,v])=>res.setHeader(k,v));
      return endpoint(req,res,url,data);
    }
    if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Method not allowed'});
    const requested=url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname);
    const file=resolve(root,'.'+requested);
    if(!file.startsWith(root+sep))return json(res,403,{error:'Forbidden'});
    let content;try{content=readFileSync(file);}catch{return json(res,404,{error:'Not found'});}
    res.writeHead(200,{...headers,'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});
    res.end(req.method==='HEAD'?undefined:content);
  }catch(e){json(res,/Not authorized/.test(e.message)?401:400,asError(e));}
});
const port=Number(process.env.PORT||3000);server.listen(port,()=>console.log(`Onirama running at http://localhost:${port}`));
