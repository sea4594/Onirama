export const RULESET_VERSION='phase5-1';
export const EXPANSION_CATALOG=Object.freeze([
 {id:'book',name:'The Book of Steps Lost and Found',phase:4,available:true},
 {id:'glyphs',name:'The Glyphs',phase:4,available:true},
 {id:'dreamcatchers',name:'The Dreamcatchers',phase:4,available:true},
 {id:'towers',name:'The Towers',phase:4,available:true},
 {id:'premonitions',name:'Happy Dreams and Dark Premonitions',phase:5,available:true},
 {id:'crossroads',name:'Crossroads and Dead Ends',phase:5,available:true},
 {id:'oniverse',name:'The Door to the Oniverse',phase:5,available:true},
 {id:'mirrors',name:'The Mirrors (promo)',phase:6,available:false},
 {id:'sphinx',name:'Sphinx, Diver and Confusion (promo)',phase:6,available:false},
 {id:'incubus',name:'Little Incubus',phase:6,available:false}
]);
export const BASE_CONFIG=Object.freeze({ruleset:'official',expansions:[],difficulties:{}});
export function validateConfig(raw=BASE_CONFIG){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid rules configuration');
 if((raw.ruleset??'official')!=='official')throw Error('Only official rules are available');
 const expansions=raw.expansions??[];
 if(!Array.isArray(expansions)||new Set(expansions).size!==expansions.length||expansions.some(x=>typeof x!=='string'))throw Error('Invalid expansions list');
 for(const id of expansions){const entry=EXPANSION_CATALOG.find(e=>e.id===id);if(!entry)throw Error(`Unknown expansion: ${id}`);if(!entry.available)throw Error(`${entry.name} is not yet playable`);}
 const d=raw.difficulties??{};
 if(!d||typeof d!=='object'||Array.isArray(d))throw Error('Invalid difficulties');
 for(const [k,v] of Object.entries(d)){
   if(!expansions.includes(k))throw Error(`Difficulty for disabled expansion: ${k}`);
   if(v==='normal'&&['book','dreamcatchers','towers','premonitions','crossroads'].includes(k))continue;
   if(k==='book'&&v==='hard'||k==='dreamcatchers'&&v==='hard'||k==='towers'&&v==='hard'||k==='premonitions'&&['hard','extreme'].includes(v)||k==='crossroads'&&v==='hard')continue;
   throw Error(`Unavailable difficulty variant: ${k}=${v}`);
 }
 return {ruleset:'official',expansions:[...expansions],difficulties:{...d}};
}
export function normalizeSave(s){
 if(!s||typeof s!=='object')throw Error('Invalid saved game');
 if(s.schema===3){validateConfig(s.config);if(s.rulesVersion==='phase4-1'||s.rulesVersion==='base-2'){const n=structuredClone(s);for(const p of n.players||[])if(!Array.isArray(p.series))p.series=p.labyrinth.slice(-Math.min(2,p.streak||0)).map(c=>({id:c.id,color:c.color}));n.rulesVersion=RULESET_VERSION;return n;}return s;}
 if(s.schema===2){validateConfig(s.config);return {...s,schema:3,rulesVersion:'base-2',interrupts:[]};}
 if(s.schema!==1)throw Error('Unsupported saved game schema');
 return {...s,schema:3,rulesVersion:'base-2',config:validateConfig(),moduleState:{},effects:[],continuations:[],events:[],interrupts:[]};
}
