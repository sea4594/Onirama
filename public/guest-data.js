// Guest-only records. Never store decks, hands, room credentials or personal names here.
export const HISTORY_KEY='onirama.history.v1';
export const PRESETS_KEY='onirama.presets.v1';
const EXPANSIONS=new Set(['book','glyphs','dreamcatchers','towers','premonitions','crossroads','oniverse','mirrors','sphinx','incubus']);
const DIFFICULTIES={book:['normal','hard'],dreamcatchers:['normal','hard'],towers:['normal','hard'],premonitions:['normal','hard','extreme'],crossroads:['normal','hard'],mirrors:['normal','hard'],incubus:['easy','apprentice','true']};
const read=(storage,key)=>{try{const value=JSON.parse(storage.getItem(key)||'[]');return Array.isArray(value)?value:[];}catch{return [];}};
const write=(storage,key,value)=>storage.setItem(key,JSON.stringify(value));
export function cleanConfig(value={}){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid configuration');
  if(!Array.isArray(value.expansions))throw Error('Configuration is missing expansion choices');
  const expansions=[...new Set(value.expansions)];
  if(expansions.some(id=>!EXPANSIONS.has(id)))throw Error('Unknown expansion');
  if(expansions.includes('incubus')&&expansions.length>1)throw Error('Little Incubus cannot be combined with expansions');
  const difficulties={};
  for(const [id,choice] of Object.entries(value.difficulties||{})){
    if(!expansions.includes(id)||!DIFFICULTIES[id]?.includes(choice))throw Error('Unknown expansion difficulty');
    if(choice!=='normal')difficulties[id]=choice;
  }
  return {ruleset:'official',expansions,difficulties};
}
export function readHistory(storage){return read(storage,HISTORY_KEY).flatMap(x=>{try{
  if(!x||typeof x.id!=='string'||!x.id||x.id.length>128||!['won','lost'].includes(x.status)||!['solo','coop'].includes(x.mode)||!Number.isSafeInteger(x.turn)||x.turn<1||!Number.isFinite(x.finishedAt)||x.finishedAt<=0) return [];
  return [{id:x.id,mode:x.mode,status:x.status,turn:x.turn,config:cleanConfig(x.config),startedAt:Number.isFinite(x.startedAt)?x.startedAt:x.finishedAt,finishedAt:x.finishedAt}];
}catch{return [];}}).slice(0,200);}
export function recordResult(storage,{id,mode,status,turn,config,startedAt,finishedAt=Date.now()}){
  if(typeof id!=='string'||!id||id.length>128)throw Error('Invalid game ID');
  if(!['won','lost'].includes(status)||!['solo','coop'].includes(mode))return false;
  const records=readHistory(storage);if(records.some(record=>record.id===id))return false;
  const entry={id,mode,status,turn:Number.isSafeInteger(turn)&&turn>0?turn:1,config:cleanConfig(config),startedAt:Number.isFinite(startedAt)&&startedAt>0?startedAt:finishedAt,finishedAt};
  write(storage,HISTORY_KEY,[entry,...records].slice(0,200));return true;
}
export function summarizeHistory(records){const wins=records.filter(x=>x.status==='won').length,losses=records.filter(x=>x.status==='lost').length;const solo=records.filter(x=>x.mode==='solo'),coop=records.filter(x=>x.mode==='coop');return {played:records.length,wins,losses,winRate:records.length?Math.round(wins/records.length*100):0,solo:solo.length,coop:coop.length,bestWinTurns:Math.min(...records.filter(x=>x.status==='won').map(x=>x.turn),Infinity)};}
export function readPresets(storage){return read(storage,PRESETS_KEY).filter(p=>{try{return typeof p?.id==='string'&&/^[A-Za-z0-9_.-]{1,100}$/.test(p.id)&&typeof p?.name==='string'&&p.name.length<=48&&!!cleanConfig(p.config);}catch{return false;}}).slice(0,30);}
export function savePreset(storage,name,config){const title=String(name||'').trim().slice(0,48);if(!title)throw Error('Enter a preset name');const valid=cleanConfig(config),list=readPresets(storage);const found=list.find(p=>p.name.toLowerCase()===title.toLowerCase());const preset={id:found?.id||`preset-${Date.now()}-${Math.random().toString(36).slice(2,9)}`,name:title,config:valid,updatedAt:Date.now()};write(storage,PRESETS_KEY,[preset,...list.filter(p=>p.id!==preset.id)].slice(0,30));return preset;}
export function deletePreset(storage,id){const items=readPresets(storage),next=items.filter(x=>x.id!==id);if(next.length===items.length)return false;write(storage,PRESETS_KEY,next);return true;}
export function clearHistory(storage){storage.removeItem(HISTORY_KEY);}
