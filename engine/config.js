// The catalog is visible now; gameplay remains explicitly unavailable until validated.
export const RULESET_VERSION = 'base-2';
export const EXPANSION_CATALOG = Object.freeze([
  {id:'book',name:'The Book of Steps Lost and Found',phase:4,available:false},
  {id:'glyphs',name:'The Glyphs',phase:4,available:false},
  {id:'dreamcatchers',name:'The Dreamcatchers',phase:4,available:false},
  {id:'towers',name:'The Towers',phase:4,available:false},
  {id:'premonitions',name:'Happy Dreams and Dark Premonitions',phase:5,available:false},
  {id:'crossroads',name:'Crossroads and Dead Ends',phase:5,available:false},
  {id:'oniverse',name:'The Door to the Oniverse',phase:5,available:false},
  {id:'mirrors',name:'The Mirrors (promo)',phase:6,available:false},
  {id:'sphinx',name:'Sphinx, Diver and Confusion (promo)',phase:6,available:false},
  {id:'incubus',name:'Little Incubus',phase:6,available:false}
]);
export const BASE_CONFIG=Object.freeze({ruleset:'official',expansions:[],difficulties:{}});
export function validateConfig(raw=BASE_CONFIG){
  if(raw===null||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid rules configuration');
  const ruleset=raw.ruleset??'official';if(ruleset!=='official')throw Error('Only official base rules are currently available');
  const expansions=raw.expansions??[];
  if(!Array.isArray(expansions)||new Set(expansions).size!==expansions.length||expansions.some(x=>typeof x!=='string'))throw Error('Invalid expansions list');
  for(const id of expansions){const entry=EXPANSION_CATALOG.find(e=>e.id===id);if(!entry)throw Error(`Unknown expansion: ${id}`);if(!entry.available)throw Error(`${entry.name} is not yet playable`);}
  const difficulties=raw.difficulties??{};
  if(difficulties===null||typeof difficulties!=='object'||Array.isArray(difficulties)||Object.keys(difficulties).length)throw Error('Expansion difficulty variants are not available yet');
  return {ruleset,expansions:[...expansions],difficulties:{}};
}
export function normalizeSave(s){
  if(!s||typeof s!=='object')throw Error('Invalid saved game');
  if(s.schema===2){validateConfig(s.config);return s;}
  if(s.schema!==1)throw Error('Unsupported saved game schema');
  return {...s,schema:2,rulesVersion:RULESET_VERSION,config:validateConfig(),moduleState:{},effects:[],continuations:[],events:[]};
}
