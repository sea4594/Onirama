import {renderRulesReference} from './rules-guide.js';
import {icon} from './icons.js';
import {renderCard} from './tabletop/cards.js';
/** View-only in-game navigation. Never dispatches gameplay/room commands. */
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
export const BASE_RULES = [
  ['Objective','Collect eight Doors (two of each color) before the deck runs out. In co-op, each player collects one Door of each color. Active expansions may add other objectives.'],
  ['Each turn','Play or discard one Location, then refill your hand to five Locations. Resolve Doors and Dreams as they appear; shuffle Limbo back into the deck after resolving the turn.'],
  ['Labyrinth & Doors','Consecutive played Locations must have different symbols. Three consecutive Locations of one color unlock a matching Door from the deck; a fourth starts a new sequence.'],
  ['Keys & Prophecy','When drawn, a Door may be claimed with a matching Key or moved to Limbo. Discard a Key to inspect up to five cards, discard one and order the rest on top of the deck.'],
  ['Nightmares','Choose one penalty: discard a Key, lose an acquired Door, reveal and resolve up to five cards, or discard and replace your entire hand. Unavailable choices cannot be taken.'],
  ['Two-player co-op','Draft eight face-up Locations: each player takes three personal cards, leaving two shared cards. Players alternate turns with separate Labyrinths and Doors, while using shared Locations as permitted. After a discard, a personal/shared swap can be chosen.']
];
export const EXPANSION_RULES = {
  book:['Book of Steps','Collect Doors in Goal order. Discard cards to pay for spells: Parallel Planning swaps Goals, Paradoxical Prophecy manipulates the deck, and Powerful Punishment can cancel a Nightmare. Difficulty changes spell costs.'],
  glyphs:['Glyphs','Glyph is a fourth Location symbol. The objective becomes twelve Doors (three of each color). Discarding Glyphs can trigger an Incantation to inspect cards and claim an eligible Door.'],
  dreamcatchers:['Dreamcatchers','Lost Dreams can be captured in Dreamcatchers; catchers can also hold Limbo cards and be searched for Doors. If they fill up, choose which catcher to sacrifice. Failsafe Books offer protection when available.'],
  towers:['Towers','Play Tower cards at either end of the Alignment, matching their edge rules. Discarding a Tower lets you inspect and reorder deck cards. Nightmares can force a legal Tower loss; completion of the Alignment matters for victory.'],
  premonitions:['Happy Dreams & Dark Premonitions','Dark Premonitions show conditions that trigger penalties. Happy Dreams offer a choice to remove a Premonition, inspect upcoming cards or search for a card. Difficulty changes the number of starting Premonitions.'],
  crossroads:['Crossroads & Dead Ends','Crossroads are wild-color Locations with restrictions on Door sequences. Dead Ends complicate your Labyrinth; Escape is an alternative turn action. Hard mode narrows where a Crossroad can appear in a trio.'],
  oniverse:['Door to the Oniverse','An extra Door and the Denizens enter play. Rally an eligible Denizen by paying its cost, then use its particular power when allowed. Denizens may provide card manipulation or Nightmare protection.'],
  mirrors:['Mirrors','Complete Mirror objectives by playing two matching Locations together. Each Mirror grants a particular reward. Rainbow and other requirements can vary by difficulty and active modules.'],
  sphinx:['Sphinx, Diver & Confusion','Sphinx asks you to name an aspect and inspect cards; Diver lets you continue inspecting or stop; Confusion reorders and replaces your hand. Resolve their card-specific decisions when they appear.'],
  incubus:['Little Incubus','The Little Incubus changes the opening and turn procedure, including cards stored by the pawn and the timing of penalties. Choose its Easy, Apprentice or True Dreamwalker rules at setup. It cannot be combined with other expansions in official mode.']
};
export function rulesSections(expansions=[],coop=false){
  const base=BASE_RULES.filter(([heading])=>coop||heading!=='Two-player co-op');
  return [...base,...[...new Set(expansions)].filter(id=>Object.hasOwn(EXPANSION_RULES,id)).map(id=>EXPANSION_RULES[id])];
}
export function renderActionHistory(log=[]){
  const entries=Array.isArray(log)?[...log].reverse():[];
  const item=line=>{
    const raw=String(line),match=raw.match(/\b(played|discarded) (red|blue|green|brown|wild) (sun|moon|key|glyph)\b/i);
    if(!match)return `<li>${escape(raw)}</li>`;
    const c={kind:'location',color:match[2].toLowerCase(),symbol:match[3].toLowerCase()};
    const start=match.index+match[1].length+1,end=match.index+match[0].length;
    return `<li>${escape(raw.slice(0,start))}<span class="tt9-log-card">${renderCard(c,{tiny:true})}</span>${escape(raw.slice(end))}</li>`;
  };
  return `<details class="game-menu-history" data-pause-history open><summary>Action log <small>${entries.length}</small></summary><ol class="tt9-action-log" aria-label="Previous game actions">${entries.map(item).join('')||'<li>No actions yet</li>'}</ol></details>`;
}
export function renderOverlay(kind,expansions=[],coop=false,settings={}){
  if(!['pause','rules'].includes(kind))return '';
  const rules=rulesSections(expansions,coop);
  const options=(key,items)=>items.map(([value,label])=>`<option value="${value}"${settings[key]===value?' selected':''}>${label}</option>`).join('');
  const field=(key,label,items)=>`<label class="game-menu-setting"><span>${label}</span><select class="inline-input" data-setting="${key}" aria-label="${label}">${options(key,items)}</select></label>`;
  return `<div class="game-menu-layer" data-game-overlay="${kind}"><div class="game-menu-scrim" data-game-menu-dismiss aria-hidden="true"></div><section class="game-menu-dialog" role="dialog" aria-modal="true" aria-label="${kind==='rules'?'Game rules':'Game menu'}" tabindex="-1" data-game-menu-dialog>
    <header class="game-menu-head"><h2>${kind==='rules'?'Rules':'Paused'}</h2><button type="button" data-action="closeGameOverlay" class="game-menu-close" aria-label="Close ${kind==='rules'?'rules':'pause menu'}" title="Close">${icon('close')}</button></header>
    <div class="game-menu-content" data-game-menu-scroll>${kind==='rules'?`<div class="game-menu-accordions">${renderRulesReference(expansions,coop,{inGame:true})}</div>`:`<div class="game-menu-actions"><button type="button" data-action="gameGoHome" class="primary">Exit game</button><button type="button" data-action="openGameRules">Rules</button></div><details class="game-menu-settings" data-pause-settings><summary>Settings</summary>${field('theme','Theme',(settings.themes||[{id:'forest',name:'Forest'}]).map(p=>[p.id,p.name]))}${field('motion','Animations',[['normal','On'],['reduced','Reduced motion']])}${field('cardSize','Card size',[['normal','Standard'],['large','Large']])}${field('contrast','Contrast',[['normal','Standard'],['high','High contrast']])}${field('textSize','Text size',[['normal','Standard'],['large','Large']])}</details>${renderActionHistory(settings.log)}${settings.multiplayer?`<div class="game-room-actions"><button type="button" data-action="leaveRoom">Leave game</button>${settings.host?'<button type="button" data-action="endRoom">End game for both</button>':''}</div>`:''}`}</div>
    ${kind==='rules'?`<footer class="game-menu-footer"><button type="button" data-action="${settings.fromPause?'openGamePause':'closeGameOverlay'}">${settings.fromPause?'Back to pause':'Back to game'}</button></footer>`:''}
  </section></div>`;
}
