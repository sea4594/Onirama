import {validateConfig} from './config.js';
// Modules deliberately declare hooks rather than patching the base game directly.
// The 'base' registration is the only activated module in Phase 3.
const registry=new Map();
export function registerModule(def){
  if(!def||typeof def.id!=='string'||!def.id||typeof def.setup!=='function'||typeof def.onEvent!=='function'||typeof def.objectives!=='function')throw Error('Invalid rules module');
  if(registry.has(def.id))throw Error('Duplicate rules module');
  registry.set(def.id,Object.freeze(def));
}
registerModule({id:'base',setup:()=>({zones:{}}),onEvent:()=>[],objectives:s=>[{id:'doors',required:s.mode==='solo'?8:8,acquired:s.players.reduce((n,p)=>n+p.doors.length,0)}]});
export function activeModules(config){const c=validateConfig(config);return ['base',...c.expansions].map(id=>{const mod=registry.get(id);if(!mod)throw Error(`Module not registered: ${id}`);return mod;});}
export function emitGameEvent(s,event){
  s.events??=[];s.events.push({...event,turn:s.turn});if(s.events.length>500)s.events.shift();
  // Future modules may produce effects. Caller controls the event boundary.
  return activeModules(s.config).flatMap(mod=>mod.onEvent(s,event)||[]);
}
export function objectives(s){return activeModules(s.config).flatMap(mod=>mod.objectives(s));}
