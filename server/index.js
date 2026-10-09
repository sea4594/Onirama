import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync,mkdirSync,openSync,closeSync,fsyncSync,renameSync,unlinkSync} from 'node:fs';
import {join,extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {newGame,act,viewFor,assertConserved} from '../engine/game.js';
import {validateConfig,EXPANSION_CATALOG} from '../engine/config.js';

const root=resolve(fileURLToPath(new URL('../public/',import.meta.url)));
const store=resolve(process.env.ONIRAMA_DATA_DIR||'server-data');
mkdirSync(store,{recursive:true,mode:0o700});
const path=join(store,'sessions.json');
// Single-instance storage: atomic rename prevents truncated saves; do not run multiple workers
// against the same file. Disk write failure must leave authoritative memory unchanged.
let sessions=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{};
if(!sessions||typeof sessions!=='object'||Array.isArray(sessions))throw Error('Invalid session store');
const listeners=new Map();
const token=()=>randomBytes(24).toString('base64url');
const code=()=>randomBytes(4).toString('hex').toUpperCase();
function persist(next){
  const temp=join(store,`.sessions-${process.pid}-${token()}.tmp`);
  let fd;
  try{
    fd=openSync(temp,'wx',0o600);
    writeFileSync(fd,JSON.stringify(next));fsyncSync(fd);closeSync(fd);fd=undefined;
    renameSync(temp,path);
    try{const dir=openSync(store,'r');try{fsyncSync(dir);}finally{closeSync(dir);}}catch{} // Some filesystems cannot sync directories.
  }catch(e){if(fd!==undefined)closeSync(fd);try{unlinkSync(temp);}catch{}throw Object.assign(Error('Session storage unavailable; no action was committed'),{status:503,cause:e});}
}
function commit(x){const next={...sessions,[x.id]:x};persist(next);sessions=next;sendEvents(x);}
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
const headers={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; object-src 'none'"};
const allowedOrigins=new Set((process.env.ONIRAMA_CORS_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean));
const asError=e=>({error:e instanceof Error?e.message:'Request rejected'});
const roomSummary=(x,seat)=>({id:x.id,code:x.code,mode:x.mode,seat,host:seat===0,ready:x.ready,connected:x.seats.map(Boolean),started:!!x.game,phase:x.game?.phase,status:x.game?.status,config:x.config||validateConfig()});
const limits=new Map();let requests=0;
function rateLimit(req,pathname){
  const client=process.env.ONIRAMA_TRUST_PROXY==='1'?(String(req.headers['x-forwarded-for']||'').split(',')[0].trim()||req.socket.remoteAddress):req.socket.remoteAddress;
  const category=req.method==='POST'&&['/api/solo','/api/rooms','/api/join'].includes(pathname)?'create':pathname.endsWith('/stream')?'stream':'general';
  const max=category==='create'?16:category==='stream'?20:180;
  const key=`${client}:${category}`;const now=Date.now();const old=limits.get(key);
  const bucket=!old||old.until<=now?{count:0,until:now+60_000}:old;
  bucket.count++;limits.set(key,bucket);
  if(++requests%256===0)for(const [k,v] of limits)if(v.until<now)limits.delete(k);
  return bucket.count<=max;
}
function cors(req,res){
  const origin=req.headers.origin;if(!origin)return true;
  const host=req.headers.host;
  const same=origin===`http://${host}`||origin===`https://${host}`;
  if(!same&&!allowedOrigins.has(origin))return false;
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Vary','Origin');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age','600');
  return true;
}
function credentials(x,request){
  const bearer=request.headers.authorization||'';
  const credential=bearer.startsWith('Bearer ')?bearer.slice(7):null;
  const seat=x.seats.findIndex(s=>s?.token===credential);
  if(seat<0)throw Object.assign(Error('Not authorized for this game. Rejoin using your saved seat.'),{status:401});
  return seat;
}
function sendEvents(x){
  for(const record of listeners.get(x.id)||[])try{
    record.res.write(`data: ${JSON.stringify({room:roomSummary(x,record.seat),game:x.game?viewFor(x.game,record.seat):null})}\n\n`);
  }catch{record.res.end();listeners.get(x.id)?.delete(record);}
}
function create(mode,name,rawConfig){
  const config=validateConfig(rawConfig);let id=token().slice(0,12);while(sessions[id])id=token().slice(0,12);
  let roomCode=code();while(Object.values(sessions).some(x=>x.code===roomCode))roomCode=code();
  const key=token();const x={id,code:roomCode,mode,config,ready:[false,false],seats:[{name:String(name||'Dreamwalker').slice(0,40),token:key},null],game:mode==='solo'?newGame({mode:'solo',config}):null,version:0,createdAt:Date.now()};
  commit(x);return {room:roomSummary(x,0),token:key};
}
async function body(req){
  if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw Error('Content-Type must be application/json');
  const chunks=[];let size=0;
  for await(const c of req){size+=c.length;if(size>8192)throw Object.assign(Error('Request too large'),{status:413});chunks.push(c);}
  const parsed=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('JSON body must be an object');
  return parsed;
}
function endpoint(req,res,url,data){
  const segments=url.pathname.split('/').filter(Boolean);
  if(req.method==='GET'&&url.pathname==='/api/health')return json(res,200,{ok:true,version:'0.11.0'});
  if(req.method==='GET'&&url.pathname==='/api/catalog')return json(res,200,{expansions:EXPANSION_CATALOG});
  if(req.method==='POST'&&url.pathname==='/api/solo')return json(res,201,create('solo',data.name,data.config));
  if(req.method==='POST'&&url.pathname==='/api/rooms')return json(res,201,create('coop',data.name,data.config));
  if(req.method==='POST'&&url.pathname==='/api/join'){
    const x=Object.values(sessions).find(x=>x.mode==='coop'&&x.code===String(data.code||'').trim().toUpperCase());
    if(!x)throw Error('Room code not found');if(x.game)throw Error('This game has already started');if(x.seats[1])throw Error('Room is full');
    const credential=token(),next=structuredClone(x);next.seats[1]={name:String(data.name||'Partner').slice(0,40),token:credential};next.version++;commit(next);
    return json(res,200,{room:roomSummary(next,1),token:credential});
  }
  if(segments[0]!=='api'||segments[1]!=='rooms'||!segments[2])return json(res,404,{error:'Unknown API route'});
  const original=sessions[segments[2]];if(!original)return json(res,404,{error:'Game not found'});
  const seat=credentials(original,req),operation=segments[3];
  if(req.method==='GET'&&operation==='state')return json(res,200,{room:roomSummary(original,seat),game:original.game?viewFor(original.game,seat):null,version:original.version});
  if(req.method==='GET'&&operation==='stream'){
    if((listeners.get(original.id)?.size||0)>=12)throw Object.assign(Error('Too many open connections'),{status:429});
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
    if(!listeners.has(original.id))listeners.set(original.id,new Set());const record={res,seat};listeners.get(original.id).add(record);
    res.write(`data: ${JSON.stringify({room:roomSummary(original,seat),game:original.game?viewFor(original.game,seat):null})}\n\n`);
    const keepAlive=setInterval(()=>{try{res.write(': heartbeat\n\n');}catch{res.end();}},25000);
    req.on('close',()=>{clearInterval(keepAlive);listeners.get(original.id)?.delete(record);if(!listeners.get(original.id)?.size)listeners.delete(original.id);});return;
  }
  if(req.method==='POST'&&operation==='ready'){
    if(original.game)throw Error('The game has already started');const next=structuredClone(original);next.ready[seat]=!!data.ready;next.version++;commit(next);
    return json(res,200,{ok:true,version:next.version});
  }
  if(req.method==='POST'&&operation==='start'){
    if(original.mode!=='coop'||seat!==0)throw Error('Only the host can start the cooperative game');
    if(original.game)throw Error('Game already started');
    if(!original.seats[1]||!original.ready.every(Boolean))throw Error('Both players must join and be ready');
    const next=structuredClone(original);next.game=newGame({mode:'coop',names:next.seats.map(v=>v.name),config:next.config});next.version++;commit(next);
    return json(res,200,{ok:true,version:next.version});
  }
  if(req.method==='POST'&&operation==='action'){
    if(!original.game)throw Error('Game has not started');
    if(seat!==original.game.active)throw Error('It is not your turn');
    if(!Number.isInteger(data.expectedVersion)||data.expectedVersion!==original.version)throw Error('State changed. The board has been refreshed; choose your action again.');
    const next=structuredClone(original);next.game=act(original.game,data.command);assertConserved(next.game);next.version++;commit(next);
    return json(res,200,{ok:true,version:next.version});
  }
  return json(res,404,{error:'Unknown room operation'});
}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname.startsWith('/api/')){
      Object.entries(headers).forEach(([k,v])=>res.setHeader(k,v));
      if(!cors(req,res))return json(res,403,{error:'Origin not allowed'});
      if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
      if(!['GET','POST'].includes(req.method))return json(res,405,{error:'Method not allowed'});
      if(!rateLimit(req,url.pathname)){res.setHeader('Retry-After','60');return json(res,429,{error:'Too many requests; try again shortly'});}
      const data=req.method==='POST'?await body(req):{};
      return endpoint(req,res,url,data);
    }
    if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Method not allowed'});
    const requested=url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname);
    const file=resolve(root,'.'+requested);
    if(!file.startsWith(root+sep))return json(res,403,{error:'Forbidden'});
    let content;try{content=readFileSync(file);}catch{return json(res,404,{error:'Not found'});}
    res.writeHead(200,{...headers,'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});
    res.end(req.method==='HEAD'?undefined:content);
  }catch(e){if(!res.headersSent)json(res,e.status||(/Not authorized/.test(e.message)?401:400),asError(e));else res.end();}
});
const port=Number(process.env.PORT||3000);
server.listen(port,process.env.HOST||'0.0.0.0',()=>console.log(`Onirama listening on port ${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{for(const clients of listeners.values())for(const record of clients)record.res.end();server.close(()=>process.exit(0));});
