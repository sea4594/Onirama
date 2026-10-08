// Central zone resolution for card-set modules; no card identities are synthesized.
export function zoneArray(s,ref){
  if(ref==='deck'||ref==='discard'||ref==='limbo'||ref==='shared'||ref==='draft')return s[ref];
  const match=/^player:(\d+):(hand|labyrinth|doors)$/.exec(ref);
  if(match){const p=s.players[Number(match[1])];if(!p)throw Error('Unknown player zone');return p[match[2]];}
  const moduleMatch=/^module:([a-z][a-z0-9-]*):([a-z][a-z0-9-]*)$/.exec(ref);
  if(moduleMatch){const arr=s.moduleState?.[moduleMatch[1]]?.zones?.[moduleMatch[2]];if(!Array.isArray(arr))throw Error('Unknown module zone');return arr;}
  throw Error(`Unknown card zone: ${ref}`);
}
export function physicalZones(s){
  const result=[['deck',s.deck],['discard',s.discard],['limbo',s.limbo],['shared',s.shared],['draft',s.draft],...s.players.flatMap((p,i)=>[['player:'+i+':hand',p.hand],['player:'+i+':labyrinth',p.labyrinth],['player:'+i+':doors',p.doors]])];
  for(const [moduleId,module] of Object.entries(s.moduleState||{}))for(const [name,cards] of Object.entries(module.zones||{})){if(!Array.isArray(cards))throw Error('Module zone must be an array');result.push([`module:${moduleId}:${name}`,cards]);}
  if(s.pending?.card)result.push(['pending:card',[s.pending.card]]);
  if(s.pending?.cards)result.push(['pending:cards',s.pending.cards]);
  return result;
}
export function assertCardsUnique(s,expected=76){
  const entries=physicalZones(s).flatMap(([zone,items])=>items.map(card=>({zone,id:card.id})));
  if(entries.length!==expected)throw Error(`Card count ${entries.length}, expected ${expected}`);
  const ids=new Set();for(const entry of entries){if(!entry.id||ids.has(entry.id))throw Error(`Missing or duplicate card instance: ${entry.id}`);ids.add(entry.id);}
  return true;
}
export function findCard(s,id){
  for(const [zone,cards] of physicalZones(s)){const index=cards.findIndex(c=>c.id===id);if(index>=0)return {zone,index,card:cards[index]};}
  return null;
}
