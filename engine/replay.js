// Bounded snapshots of PUBLIC game information for spectator-safe turn replay.
// No raw commands, RNG state, deck order, private hands, or pending choices.
import {viewFor} from './game.js';
const MAX_FRAMES=36,MAX_SERIALIZED=170000;
export function publicFrame(game){
 const frame=viewFor(game,null);
 delete frame.pileInventory;delete frame.log;
 // Conceal card identifiers as well as card faces. Card IDs are not needed
 // for a private hand's visual card backs.
 for(const p of frame.players||[])p.hand=(p.hand||[]).map(()=>({kind:'hidden'}));
 return JSON.parse(JSON.stringify(frame));
}
export function recordReplay(previous,game,actor,command=null){
 const replay=Array.isArray(previous)?previous.slice():[];
 const frame=publicFrame(game);
 const entry={actor:Number.isInteger(actor)?actor:null,turn:Number.isInteger(actor)?(replay.at(-1)?.frame?.turn??game.turn):game.turn,phase:game.phase,action:typeof command?.type==='string'?command.type.slice(0,36):'start',frame};
 replay.push(entry);
 while(replay.length>MAX_FRAMES||JSON.stringify(replay).length>MAX_SERIALIZED){
  if(replay.length<=1)break;
  replay.shift();
 }
 return replay;
}
export function visibleReplay(entries){return Array.isArray(entries)?entries.filter(e=>e&&[0,1,null].includes(e.actor)&&e.frame?.mode==='coop').map(e=>e):[];}
export function opponentReplay(entries,viewerSeat){
 if(![0,1].includes(viewerSeat))return [];
 const list=visibleReplay(entries);
 let end=list.length-1;
 while(end>=0&&list[end].actor!==1-viewerSeat)end--;
 if(end<0)return [];
 let start=end;
 while(start>0&&list[start-1].actor===1-viewerSeat&&list[start-1].turn===list[end].turn)start--;
 return list.slice(Math.max(0,start-1),end+1);
}
export function replayCaption(entry){
 const actions={start:'Game started',draft:'Drafted a card',play:'Played a card',discard:'Discarded a card',draw:'Drew a card',confirmDraw:'Resolved draw',nightmare:'Nightmare',happyDream:'Happy Dream',prophecy:'Prophecy',cast:'Cast a spell',playTower:'Played a Tower',chooseDoor:'Claimed a Door',rally:'Denizen',freeCatcher:'Dreamcatcher',mirrorPair:'Mirror',escape:'Escaped',sphinxName:'Sphinx',sphinxResolve:'Sphinx',diver:'Diver',incubusActivate:'Incubus'};
 return actions[entry?.action]||'Resolved an action';
}
