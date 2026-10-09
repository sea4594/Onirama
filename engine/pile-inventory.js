import {createDeck} from './cards.js';

// Public aggregate counts only. Never include card IDs, identities in draw order,
// hidden-hand contents, or engine-only card-location arrays in the view.
const colors={red:'Red',blue:'Blue',green:'Green',brown:'Brown',wild:'Wild'};
const names={location:'Location',door:'Door',nightmare:'Nightmare',lostDream:'Lost Dream',happyDream:'Happy Dream',deadEnd:'Dead End',denizen:'Denizen',sphinx:'Sphinx',diver:'Diver',confusion:'Confusion',tower:'Tower'};
export function inventoryCategory(card){
 const extension=card.expansion||'base',kind=card.kind,color=card.color||'',symbol=card.symbol||'',ability=card.ability||'',number=card.number||'';
 return [extension,kind,color,symbol,ability,number].join(':');
}
export function pileInventory(state){
 const originals=createDeck(state.config?.expansions||[]);
 const groups=new Map();
 for(const card of originals){const key=inventoryCategory(card);if(!groups.has(key)){
   const section=card.expansion||'base';
   const label=[colors[card.color],card.symbol&&card.symbol[0].toUpperCase()+card.symbol.slice(1),kindLabel(card),card.ability&&card.ability[0].toUpperCase()+card.ability.slice(1),card.number].filter(Boolean).join(' ');
   groups.set(key,{key,section,label,total:0,deck:0,discard:0,limbo:0});
  }groups.get(key).total++;
 }
 for(const pile of ['deck','discard','limbo'])for(const card of state[pile]||[]){const item=groups.get(inventoryCategory(card));if(item)item[pile]++;}
 return [...groups.values()];
}
function kindLabel(card){if(card.kind==='location')return 'Location';if(card.kind==='tower')return 'Tower';if(card.kind==='denizen')return 'Denizen';return names[card.kind]||card.kind;}
