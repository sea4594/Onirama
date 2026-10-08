import {validateConfig} from './config.js';
import {COLORS} from './cards.js';
import {shuffle} from './random.js';
const registry=new Map();
export function registerModule(def){if(!def?.id||registry.has(def.id)||typeof def.setup!=='function'||typeof def.onEvent!=='function'||typeof def.objectives!=='function')throw Error('Invalid/duplicate rules module');registry.set(def.id,Object.freeze(def));}
registerModule({id:'base',setup:()=>({zones:{}}),onEvent:()=>[],objectives:s=>[{id:'doors',required:s.config.expansions.includes('glyphs')?12:8,acquired:s.players.reduce((n,p)=>n+p.doors.filter(d=>d.expansion!=='oniverse').length,0)}]});
registerModule({id:'book',setup:s=>{const goals=COLORS.flatMap(color=>Array.from({length:s.config.expansions.includes('glyphs')?3:2},()=>({color,done:false,doorId:null})));if(s.config.expansions.includes('oniverse'))goals.push({color:'wild',done:false,doorId:null});shuffle(s,goals);return {goals,zones:{removed:[]}};},onEvent:()=>[],objectives:s=>[{id:'goals',required:s.moduleState.book.goals.length,acquired:s.moduleState.book.goals.filter(g=>g.done).length}]});
registerModule({id:'premonitions',setup:s=>{const ids=['red2','green2','blue2','brown2','pair2','doors5','rainbow4','doors3'];shuffle(s,ids);const count=s.config.difficulties.premonitions==='extreme'?6:s.config.difficulties.premonitions==='hard'?5:4;return {faceUp:ids.slice(0,count),reserve:ids.slice(count),resolved:[],zones:{}};},onEvent:()=>[],objectives:()=>[]});
registerModule({id:'crossroads',setup:()=>({zones:{}}),onEvent:()=>[],objectives:()=>[]});
registerModule({id:'oniverse',setup:()=>({zones:{unused:[],rallied:[],treasure:[]}}),onEvent:()=>[],objectives:s=>[{id:'oniverseDoor',required:1,acquired:s.players.flatMap(p=>p.doors).filter(d=>d.expansion==='oniverse').length}]});
registerModule({id:'glyphs',setup:()=>({zones:{}}),onEvent:()=>[],objectives:()=>[]});
registerModule({id:'dreamcatchers',setup:()=>({active:[true,true,true,true],failsafes:2,zones:{catch0:[],catch1:[],catch2:[],catch3:[]}}),onEvent:()=>[],objectives:s=>[{id:'lostDreams',required:4,acquired:Object.values(s.moduleState.dreamcatchers.zones).flat().filter(c=>c.kind==='lostDream').length}]});
registerModule({id:'towers',setup:()=>({zones:{alignment:[]}}),onEvent:()=>[],objectives:s=>[{id:'alignment',required:1,acquired:Number(hasAlignment(s.moduleState.towers.zones.alignment))}]});
export function hasAlignment(a){return a.some((_,i)=>i+4<=a.length&&new Set(a.slice(i,i+4).map(x=>x.color)).size===4);}
export function activeModules(config){const c=validateConfig(config);return ['base',...c.expansions].map(id=>{const m=registry.get(id);if(!m)throw Error(`Module not registered: ${id}`);return m;});}
export function emitGameEvent(s,event){s.events??=[];s.events.push({...event,turn:s.turn});if(s.events.length>500)s.events.shift();return activeModules(s.config).flatMap(m=>m.onEvent(s,event)||[]);}
export function objectives(s){return activeModules(s.config).flatMap(m=>m.objectives(s));}
