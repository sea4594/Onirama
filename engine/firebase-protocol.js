// Pure cooperative-room transitions shared by Firebase and offline regression tests.
import {newGame,act,viewFor,assertConserved} from './game.js';
import {validateConfig} from './config.js';
import {recordReplay,visibleReplay} from './replay.js';
export const ROOM_TTL_MS=30*24*60*60*1000;
export const ROOM_COLLECTION='oniramaRooms';
export const ROOM_CODE=/^(?:[A-Z]{4}|[A-F0-9]{8})$/; // Old invitation codes remain joinable.
const requireRule=(ok,message)=>{if(!ok)throw Error(message);};
const identity=uid=>{requireRule(typeof uid==='string'&&uid.length>0,'Anonymous session unavailable');return uid;};
const playerName=(value,fallback)=>String(value||fallback).trim().slice(0,40)||fallback;
const clone=value=>JSON.parse(JSON.stringify(value));
export function seatFor(room,uid){return uid&&room.hostUid===uid?0:uid&&room.guestUid===uid?1:-1;}
export function hostSeat(room){return room.hostSeat===1?1:0;}
export function occupied(room){return !!room.hostUid&&!!room.guestUid;}
export function makeRoom(code,uid,name,rawConfig,now=Date.now()){
 identity(uid);requireRule(ROOM_CODE.test(code),'Invalid room code');
 return {code,hostUid:uid,guestUid:null,hostName:playerName(name,'Dreamwalker'),guestName:'',hostSeat:0,ended:false,config:validateConfig(rawConfig),ready:[false,false],game:null,version:0,createdAt:now,updatedAt:now,expiresAt:now+ROOM_TTL_MS};
}
export async function allocateRoom(write,generateCode,uid,name,rawConfig,maxAttempts=8){
 requireRule(typeof write==='function'&&typeof generateCode==='function','Invalid room allocator');
 for(let attempt=0;attempt<maxAttempts;attempt++){
  const code=generateCode(),room=makeRoom(code,uid,name,rawConfig);
  try{await write(code,room);return code;}catch(err){if(err?.code!=='permission-denied')throw err;}
 }
 const err=Error('Firestore denied room creation. Check Firebase project onirama-5124e, Anonymous Authentication and publish firestore.rules, or retry with a new code.');err.code='permission-denied';throw err;
}
export function roomView(room,uid){
 const seat=seatFor(room,identity(uid));requireRule(seat>=0,'This room belongs to another browser session');
 const ended=room.ended===true;
 const game=!ended&&room.game?viewFor(room.game,seat):null;
 if(game)for(const [i,display] of [room.hostName,room.guestName].entries())if((i===0?room.hostUid:room.guestUid)&&display)game.players[i].name=display;
 return {replay:visibleReplay(room.replay),room:{id:room.code,code:room.code,mode:'coop',seat,host:seat===hostSeat(room),hostSeat:hostSeat(room),ready:room.ready,connected:[!!room.hostUid,!!room.guestUid],paused:!!room.game&&!occupied(room)&&!ended,ended,started:!!room.game||ended,phase:room.game?.phase,status:ended?'ended':room.game?.status,config:room.config},game,version:room.version};
}
export function joinRoom(room,uid,name,now=Date.now()){
 identity(uid);requireRule(room&&now<room.expiresAt,'Room has expired');requireRule(!room.ended,'Game has ended');
 if(seatFor(room,uid)>=0)return room;
 const seat=room.hostUid===null?0:room.guestUid===null?1:-1;requireRule(seat>=0,'Room is full');
 return {...room,[seat===0?'hostUid':'guestUid']:uid,[seat===0?'hostName':'guestName']:playerName(name,'Partner'),ready:room.game?room.ready:room.ready.map((v,i)=>i===seat?false:v),updatedAt:now,version:room.version+1};
}
export function updateSetup(room,uid,rawConfig,now=Date.now()){
 requireRule(seatFor(room,uid)===hostSeat(room),'Only the host can change setup');requireRule(!room.ended&&!room.game,'Setup is locked after the game starts');
 return {...room,config:validateConfig(rawConfig),ready:[false,false],updatedAt:now,version:room.version+1};
}
export function setReady(room,uid,value,now=Date.now()){
 const seat=seatFor(room,uid);requireRule(seat>=0,'Not a room member');requireRule(!room.ended&&!room.game,'Game already started');
 const ready=[...room.ready];ready[seat]=!!value;
 return {...room,ready,updatedAt:now,version:room.version+1};
}
export function startRoom(room,uid,now=Date.now()){
 requireRule(seatFor(room,uid)===hostSeat(room),'Only the host can start');
 requireRule(!room.ended&&!room.game&&occupied(room)&&room.ready.every(Boolean),'Both players must join and be ready');
 const game=newGame({mode:'coop',config:room.config,names:[room.hostName,room.guestName],interactiveDraw:true,manualTurnEnd:true});assertConserved(game);
 return {...room,game:clone(game),replay:recordReplay([],game,null),updatedAt:now,version:room.version+1};
}
export function playRoom(room,uid,expectedVersion,command,now=Date.now()){
 const seat=seatFor(room,uid);requireRule(seat>=0,'Not a room member');
 requireRule(!room.ended&&occupied(room),'Game paused until another player joins');
 requireRule(room.version===expectedVersion,'State changed. Choose your action again.');
 requireRule(room.game?.status==='active','Game is not active');requireRule(room.game.active===seat,'It is not your turn');
 const next=act(room.game,command);assertConserved(next);
 return {...room,game:clone(next),replay:recordReplay(room.replay,next,seat,command),updatedAt:now,version:room.version+1};
}
export function leaveRoom(room,uid,now=Date.now()){
 const seat=seatFor(room,uid);requireRule(seat>=0,'Not a room member');requireRule(!room.ended,'Game has ended');
 const other=1-seat,remains=other===0?room.hostUid:room.guestUid;
 const next={...room,[seat===0?'hostUid':'guestUid']:null,[seat===0?'hostName':'guestName']:'',ready:room.ready.map((v,i)=>i===seat?false:v),updatedAt:now,version:room.version+1};
 if(remains)next.hostSeat=other;
 else {next.ended=true;next.game=null;}
 return next;
}
export function endRoom(room,uid,now=Date.now()){
 requireRule(seatFor(room,uid)===hostSeat(room),'Only the host can end the game');requireRule(!room.ended,'Game has ended');
 return {...room,ended:true,game:null,updatedAt:now,version:room.version+1};
}
