// Every on-table object has a stable semantic ID; a compact layout must not drop zones.
export const EXPANSION_ZONES=Object.freeze({
  book:['goals','spellbook'], glyphs:[], dreamcatchers:['catchers','failsafe'],
  towers:['alignment'], premonitions:['premonitions','premonition-reserve'],
  crossroads:[], oniverse:['denizens','keeper'], mirrors:['mirrors'],
  sphinx:[], incubus:['incubus']
});
export const SHARED_ZONES=Object.freeze(['draw','discard','limbo','game-status']);
export const PER_PLAYER_ZONES=Object.freeze(['labyrinth','doors','hand']);
export const MULTIPLAYER_ZONES=Object.freeze(['shared-hand','draft']);
export const PENDING_DECISIONS=Object.freeze([
  'doorSearch','door','nightmare','prophecy','incantation','towerLook','towerPenalty',
  'catchChoose','catchOverload','spellPeek','moduleDecision','happyDream',
  'happyPeek','happyFetch','rally','premonitionPick','premonitionDoor',
  'denizenPeek','sphinxName','sphinxResolve','diver','confusion','mirrorReward'
]);
export const OUT_OF_TURN_ACTIONS=Object.freeze(['cast-spell','use-denizen','free-catcher']);
export const EXTRA_INTERACTIONS=Object.freeze([
  'play-location','discard-location','play-tower-left','play-tower-right','discard-tower',
  'discard-key','escape','mirror-pair','cooperative-discard-swap','rally-denizen',
  'use-denizen','incubus-activate','free-dreamcatcher','spell-payment',
  'reorder-goals','cooperative-draft','drawn-door-key','prophecy-order',
  'incantation-door','reorder-revealed','choose-nightmare-penalty'
]);
export function zonesFor({mode='solo',expansions=[]}={}){
  if(!['solo','coop'].includes(mode))throw new TypeError('Invalid game mode');
  const ids=[...SHARED_ZONES];
  for(let seat=0;seat<(mode==='coop'?2:1);seat++)for(const zone of PER_PLAYER_ZONES)ids.push(`p${seat}-${zone}`);
  if(mode==='coop')ids.push(...MULTIPLAYER_ZONES);
  for(const id of new Set(expansions)){
    if(!(id in EXPANSION_ZONES))throw new TypeError(`Unknown expansion: ${id}`);
    ids.push(...EXPANSION_ZONES[id]);
  }
  return ids;
}
export function assertZoneCoverage(zones,options){
  const expected=zonesFor(options),actual=new Set(zones);
  return {missing:expected.filter(id=>!actual.has(id)),unexpected:[...actual].filter(id=>!expected.includes(id))};
}
