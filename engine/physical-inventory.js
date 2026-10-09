// Physical inventory is independent of the shuffled draw deck. It includes
// tabletop aids, goal cards and the promo mirrors, even when not enabled.
export const PHYSICAL_COMPONENTS=Object.freeze([
 {id:'base',total:76,drawn:76,offDeck:[]},
 {id:'book',total:9,drawn:0,offDeck:[['goal-red',2],['goal-blue',2],['goal-green',2],['goal-brown',2],['spellbook',1]]},
 {id:'glyphs',total:16,drawn:12,offDeck:[['goal-red-extra',1],['goal-blue-extra',1],['goal-green-extra',1],['goal-brown-extra',1]]},
 {id:'dreamcatchers',total:10,drawn:4,offDeck:[['dreamcatcher',4],['failsafe-book',2]]},
 {id:'towers',total:12,drawn:12,offDeck:[]},
 {id:'premonitions',total:12,drawn:4,offDeck:[['dark-premonition',8]]},
 {id:'crossroads',total:16,drawn:16,offDeck:[]},
 {id:'oniverse',total:18,drawn:17,offDeck:[['goal-oniverse',1]]},
 {id:'sphinx',total:14,drawn:14,offDeck:[]},
 {id:'mirrors',total:9,drawn:0,offDeck:[...['red','blue','green','brown','sun','moon','key','glyph','rainbow'].map(id=>[`mirror-${id}`,1])]}
]);
export const PHYSICAL_CARD_TOTAL=PHYSICAL_COMPONENTS.reduce((n,part)=>n+part.total,0);
export const INCUBUS_PAWN_COUNT=1; // Non-card component, not included in 192.
export function physicalCounts(id){return PHYSICAL_COMPONENTS.find(part=>part.id===id);}
