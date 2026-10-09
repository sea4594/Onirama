// Original-art card definitions. Tower faces verified from the physical 12-card inventory supplied by the owner.
export const COLORS=['red','blue','green','brown'];
export const SYMBOLS=['sun','moon','key'];
export const DENIZENS=['architect','cyclobot','squirrel','harpoon','hammer','chromatic','mirror','keeper'];
// Each value 3/4/5 is an inspection value printed on its own physical Tower card.
// Empty string = no symbol printed on that edge; + = both printed symbols.
export const TOWER_FACES=Object.freeze({
 red:Object.freeze({3:{left:'sun+moon',right:'moon'},4:{left:'sun',right:'moon'},5:{left:'',right:'moon'}}),
 blue:Object.freeze({3:{left:'moon',right:'sun+moon'},4:{left:'moon',right:'moon'},5:{left:'moon',right:''}}),
 green:Object.freeze({3:{left:'sun',right:'sun+moon'},4:{left:'sun',right:'sun'},5:{left:'sun',right:''}}),
 brown:Object.freeze({3:{left:'sun+moon',right:'sun'},4:{left:'moon',right:'sun'},5:{left:'',right:'sun'}})
});
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
   add('tower',color,null,{expansion:'towers',number,...TOWER_FACES[color][number]});
 }
 return cards;
}
export function expectedCards(expansions=[]){return 76+(expansions.includes('glyphs')?12:0)+(expansions.includes('dreamcatchers')?4:0)+(expansions.includes('towers')?12:0)+(expansions.includes('premonitions')?4:0)+(expansions.includes('crossroads')?16:0)+(expansions.includes('oniverse')?17:0)+(expansions.includes('sphinx')?14:0);}
