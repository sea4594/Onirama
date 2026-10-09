// The same room transitions used by the Firestore transport and its offline regression tests.
import {newGame,act,viewFor,assertConserved} from './game.js';
import {validateConfig} from './config.js';
export const ROOM_TTL_MS=30*24*60*60*1000;
export const ROOM_COLLECTION='oniramaRooms';
const requireRule=(ok,message)=>{if(!ok)throw Error(message);};
const identity=(uid)=>{requireRule(typeof uid==='string'&&uid.length>0,'Anonymous session unavailable');return uid;};
const name=(value,fallback)=>String(value||fallback).trim().slice(0,40)||fallback;
const clone=value=>JSON.parse(JSON.stringify(value));
export function seatFor(room,uid){return room.hostUid===uid?0:room.guestUid===uid?1:-1;}
export function makeRoom(code,uid,playerName,rawConfig,now=Date.now()){
  identity(uid);requireRule(/^[A-F0-9]{8}$/.test(code),'Invalid room code');
  return {code,hostUid:uid,guestUid:null,hostName:name(playerName,'Dreamwalker'),guestName:'',config:validateConfig(rawConfig),ready:[false,false],game:null,version:0,createdAt:now,updatedAt:now,expiresAt:now+ROOM_TTL_MS};
}
export function roomView(room,uid){
  const seat=seatFor(room,identity(uid));requireRule(seat>=0,'This room belongs to another browser session');
  return {room:{id:room.code,code:room.code,mode:'coop',seat,host:seat===0,ready:room.ready,connected:[true,!!room.guestUid],started:!!room.game,phase:room.game?.phase,status:room.game?.status,config:room.config},game:room.game?viewFor(room.game,seat):null,version:room.version};
}
export function joinRoom(room,uid,playerName,now=Date.now()){
  identity(uid);requireRule(room&&now<room.expiresAt,'Room has expired');
  if(seatFor(room,uid)>=0)return room;
  requireRule(room.guestUid===null,'Room is full');requireRule(room.game===null,'This game has already started');
  return {...room,guestUid:uid,guestName:name(playerName,'Partner'),updatedAt:now,version:room.version+1};
}
export function setReady(room,uid,value,now=Date.now()){
  const seat=seatFor(room,uid);requireRule(seat>=0,'Not a room member');requireRule(room.game===null,'Game already started');
  const ready=[...room.ready];ready[seat]=!!value;
  return {...room,ready,updatedAt:now,version:room.version+1};
}
export function startRoom(room,uid,now=Date.now()){
  requireRule(seatFor(room,uid)===0,'Only the host can start');
  requireRule(!room.game&&room.guestUid&&room.ready.every(Boolean),'Both players must join and be ready');
  const game=newGame({mode:'coop',config:room.config,names:[room.hostName,room.guestName]});assertConserved(game);
  return {...room,game:clone(game),updatedAt:now,version:room.version+1};
}
export function playRoom(room,uid,expectedVersion,command,now=Date.now()){
  const seat=seatFor(room,uid);requireRule(seat>=0,'Not a room member');
  requireRule(room.version===expectedVersion,'State changed. Choose your action again.');
  requireRule(room.game?.status==='active','Game is not active');
  requireRule(room.game.active===seat,'It is not your turn');
  const next=act(room.game,command);assertConserved(next);
  return {...room,game:clone(next),updatedAt:now,version:room.version+1};
}
