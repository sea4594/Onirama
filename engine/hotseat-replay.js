// Persist only the same public, bounded frames used by online multiplayer.
// The active hot-seat save remains the authority; corrupt/stale replay is ignored.
import {recordReplay,visibleReplay} from './replay.js';
const KEY='onirama.hotseat.replay.v1';

export function readHotseatReplay(storage,game){
 try{
  const saved=JSON.parse(storage.getItem(KEY)||'null');
  if(saved?.turn!==game?.turn||!Array.isArray(saved.frames)||!saved.frames.length)return [];
  const last=saved.frames.at(-1)?.frame;
  if(last?.turn!==game.turn||last?.mode!=='coop'||last?.status!==game.status)return [];
  return visibleReplay(saved.frames);
 }catch{return [];}
}
function store(storage,game,frames){
 try{storage.setItem(KEY,JSON.stringify({turn:game.turn,frames}));}catch{/* Replay is optional; a full storage quota must never block a game action. */}
 return frames;
}
export function resetHotseatReplay(storage,game){return store(storage,game,recordReplay([],game,null));}
export function advanceHotseatReplay(storage,before,after,command){
 const frames=readHotseatReplay(storage,before);
 // Older saves had no replay history. Start with a public pre-action frame.
 return store(storage,after,recordReplay(frames.length?frames:recordReplay([],before,null),after,before.active,command));
}
