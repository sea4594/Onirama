// Unique, original-art card definitions. Printed Tower edge configurations are
// intentionally isolated here for future publisher-art audit (see RULES_AUDIT).
export const COLORS=['red','blue','green','brown'];
export const SYMBOLS=['sun','moon','key'];
export const DENIZENS=['architect','cyclobot','squirrel','harpoon','hammer','chromatic','mirror','keeper'];
export const LOCATION_COUNTS={red:{sun:9,moon:4,key:3},blue:{sun:8,moon:4,key:3},green:{sun:7,moon:4,key:3},brown:{sun:6,moon:4,key:3}};
export const EXPANSIONS=[
 {id:'book',name:'The Book of Steps Lost and Found',phase:4},
 {id:'glyphs',name:'The Glyphs',phase:4},
 {id:'dreamcatchers',name:'The Dreamcatchers',phase:4},
 {id:'towers',name:'The Towers',phase:4},
 {id:'premonitions',name:'Happy Dreams and Dark Premonitions',phase:5},
 {id:'crossroads',name:'Crossroads and Dead Ends',phase:5},
 {id:'oniverse',name:'The Door to the Oniverse',phase:5},
 {id:'mirrors',name:'The Mirrors (promo)',phase:6},
 {id:'sphinx',name:'Sphinx, Diver and Confusion (promo)',phase:6},
 {id:'incubus',name:'Little Incubus',phase:6}
];
export function createDeck(expansions=[]){
 const cards=[];let index=0;const add=(kind,color=null,symbol=null,extra={})=>cards.push({id:`c${++index}`,kind,color,symbol,...extra});
 for(const color of COLORS){for(const symbol of SYMBOLS)for(let n=0;n<LOCATION_COUNTS[color][symbol];n++)add('location',color,symbol);for(let n=0;n<2;n++)add('door',color);}
 for(let n=0;n<10;n++)add('nightmare');
 if(expansions.includes('glyphs'))for(const color of COLORS){for(let n=0;n<2;n++)add('location',color,'glyph',{expansion:'glyphs'});add('door',color,null,{expansion:'glyphs'});}
 if(expansions.includes('dreamcatchers'))for(let n=0;n<4;n++)add('lostDream',null,null,{expansion:'dreamcatchers'});
 if(expansions.includes('premonitions'))for(let n=0;n<4;n++)add('happyDream',null,null,{expansion:'premonitions'});
 if(expansions.includes('crossroads')){for(const symbol of ['sun','sun','sun','moon','moon','key'])add('location','wild',symbol,{expansion:'crossroads'});for(let n=0;n<10;n++)add('deadEnd',null,null,{expansion:'crossroads'});}
 if(expansions.includes('oniverse')){add('door','wild',null,{expansion:'oniverse'});for(const ability of DENIZENS)for(let n=0;n<2;n++)add('denizen',null,null,{ability,expansion:'oniverse'});}
 if(expansions.includes('sphinx')){for(const kind of ['sphinx','diver','confusion'])for(let n=0;n<4;n++)add(kind,null,null,{expansion:'sphinx'});for(let n=0;n<2;n++)add('nightmare',null,null,{expansion:'sphinx'});}
 if(expansions.includes('towers'))for(const color of COLORS)for(const number of [3,4,5]){
   // Edge patterns must be audited against the specific edition's physical card faces.
   const left=['red','green'].includes(color)?'sun':'moon';const right=left==='sun'?'moon':'sun';
   add('tower',color,null,{expansion:'towers',number,left,right});
 }
 return cards;
}
export function expectedCards(expansions=[]){return 76+(expansions.includes('glyphs')?12:0)+(expansions.includes('dreamcatchers')?4:0)+(expansions.includes('towers')?12:0)+(expansions.includes('premonitions')?4:0)+(expansions.includes('crossroads')?16:0)+(expansions.includes('oniverse')?17:0)+(expansions.includes('sphinx')?14:0);}
