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
// Game logs are strings in the engine for save compatibility. Interpret them
// only for presentation: the underlying history is never changed or discarded.
const TURN_MARKER=/^(.+?)'s turn\.$/i;
const LOG_CHROME=/^(?:A new dream begins\.|Draft three personal Locations each\.|Ready to end turn\.|Started\.|Started game\.|Turn (?:started|ended)\.?|End(?:ed)? turn\.?)$/i;
const LOG_ICONS=[
  [/nightmare|incubus/i,'moon'],[/door|goal/i,'diamond'],[/tower/i,'tower'],
  [/premonition|prophecy/i,'eye'],[/dreamcatcher|limbo|deck|shuffle/i,'layers'],
  [/spell|book/i,'book'],[/mirror/i,'sparkle'],[/denizen|rallied/i,'users'],
  [/discard|lost|sacrific/i,'discard-art'],[/draft|hand|draw/i,'cards']
];
function logCard(kind,color,symbol=''){
  const c={kind,color:color.toLowerCase(),...(kind==='location'?{symbol:symbol.toLowerCase()}:{} )};
  return `<span class="tt9-log-card">${renderCard(c,{tiny:true})}</span>`;
}
function shortLogText(raw,players=[]){
  let text=String(raw).replace(/\s+/g,' ').trim();
  for(const name of players){if(name&&text.toLowerCase().startsWith(name.toLowerCase()+' ')){text=text.slice(name.length+1);break;}}
  text=text.replace(/\.$/,'');
  text=text.charAt(0).toUpperCase()+text.slice(1);
  text=text.replace(/^A card was placed beneath the Treasure Keeper$/i,'Stored under Treasure Keeper')
    .replace(/^A Key was sacrificed$/i,'Sacrificed a Key')
    .replace(/^Drew a card$/i,'Drew')
    .replace(/^Limbo shuffled into deck$/i,'Limbo → Deck')
    .replace(/^Swapped a private and shared card$/i,'Swapped personal ↔ shared')
    .replace(/^All objectives completed\. Victory!?$/i,'Victory!')
    .replace(/^Used (.+) Denizen$/i,'Used $1')
    .replace(/^Rallied the (.+) Denizen$/i,'Rallied $1')
    .replace(/^Played (\w+) Tower on the (left|right)$/i,'Placed $1 Tower · $2')
    .replace(/^Cast (.+?); removed (\d+) cards from the game$/i,'Cast $1 · $2 cards spent');
  // Visible card illustrations replace verbose color/symbol or Door names.
  const picture=/(\b(?:played|discarded) )((?:red|blue|green|brown|wild)) (sun|moon|key|glyph)\b/i;
  const match=text.match(picture);
  if(match){
    const first=match.index+match[1].length;
    return `${escape(text.slice(0,first))}${logCard('location',match[2],match[3])}${escape(text.slice(first+match[2].length+1+match[3].length))}`;
  }
  const door=/\b(red|blue|green|brown|wild) Door\b/i;
  const found=text.match(door);
  if(found){
    return `${escape(text.slice(0,found.index))}${logCard('door',found[1])}${escape(text.slice(found.index+found[0].length))}`;
  }
  return escape(text);
}
export function renderActionHistory(log=[],{players=[],coop=false}={}){
  const names=(Array.isArray(players)?players:[]).map(p=>typeof p==='string'?p:p?.name||'').slice(0,2);
  if(!names.length)names.push('You');
  const seatOf=line=>names.findIndex(name=>name&&(line.toLowerCase().startsWith(name.toLowerCase()+' ')||line.toLowerCase().startsWith(name.toLowerCase()+"'s turn.")));
  const groups=[];
  let turn=1,seat=0,phase='play';
  for(const value of Array.isArray(log)?log:[]){
    const line=String(value??'').trim();
    if(!line||LOG_CHROME.test(line))continue;
    const turnMatch=line.match(TURN_MARKER);
    if(turnMatch){turn++;phase='play';seat=Math.max(0,names.findIndex(name=>name.toLowerCase()===turnMatch[1].toLowerCase()));continue;}
    const actor=seatOf(line);
    const draft=/\bdrafted a card\.?$/i.test(line);
    if(draft){phase='draft';if(actor>=0)seat=actor;}
    else if(phase==='draft') {phase='play';turn=1;seat=0;}
    else if(actor>=0)seat=actor;
    // Refill narration is visual noise; it carries no additional card identity.
    if(/^(?:Drew a card|Added to hand)\.$/i.test(line))continue;
    const key=`${phase}:${turn}:${seat}`;
    if(groups.at(-1)?.key!==key)groups.push({key,phase,turn,seat,entries:[]});
    groups.at(-1).entries.push({line,icon:LOG_ICONS.find(([pattern])=>pattern.test(line))?.[1]||'circle'});
  }
  const contents=groups.reverse().map(group=>{
    const who=names[group.seat]||`Player ${group.seat+1}`;
    const heading=coop?(group.phase==='draft'?`Draft · ${who}`:`Turn ${group.turn} · ${who}`):`Turn ${group.turn}`;
    return `<li class="tt9-log-turn${coop?` tt9-log-player-${group.seat}`:''}"><div class="tt9-log-turn-head"><span class="tt9-log-turn-dot" aria-hidden="true"></span><strong>${escape(heading)}</strong></div><ul class="tt9-log-events">${group.entries.map(({line,icon:kind})=>`<li><span class="tt9-log-event-icon" aria-hidden="true">${icon(kind)}</span><span class="tt9-log-message">${shortLogText(line,names)}</span></li>`).join('')}</ul></li>`;
  }).join('');
  const count=groups.reduce((n,g)=>n+g.entries.length,0);
  return `<details class="game-menu-history" data-pause-history open><summary>Action log <small>${count}</small></summary><ol class="tt9-action-log" aria-label="Previous game actions">${contents||'<li class="tt9-log-empty">No actions yet</li>'}</ol></details>`;
}
// Shared by the main Settings page and the in-game Settings tab.
export function renderSettingsContents({theme='moonlit',motion='normal',themes=[],commit=null}={}){
  const options=(key,choices)=>choices.map(([value,label])=>`<option value="${value}"${(key==='theme'?theme:motion)===value?' selected':''}>${escape(label)}</option>`).join('');
  const field=(id,label,key,choices)=>`<label class="shell-setting"><span>${label}</span><select class="inline-input" id="${id}" data-setting="${key}" aria-label="${label}">${options(key,choices)}</select></label>`;
  const revision=/^[a-f0-9]{40}$/.test(commit||'')?`<a href="https://github.com/sea4594/Onirama/commit/${commit}" target="_blank" rel="noopener noreferrer" title="${commit}" class="commit-sha"><code>${commit.slice(0,8)}</code></a>`:'local';
  return `<div class="shell-settings-meta"><span class="shell-settings-commit">commit: ${revision}</span></div>
    <section class="shell-card shell-settings"><h2 class="shell-section-title">Appearance</h2>
      ${field('themeChoice','Theme','theme',themes.map(t=>[t.id,t.name]))}
      ${field('motionChoice','Animations','motion',[['normal','On'],['reduced','Reduced motion']])}
    </section>
    <div class="shell-settings-footer"><button type="button" data-action="history" class="shell-link">History &amp; statistics</button></div>`;
}
export function renderOverlay(kind,expansions=[],coop=false,settings={}){
  if(!['pause','rules'].includes(kind))return '';
  const active=['log','settings','rules'].includes(settings.tab)?settings.tab:(kind==='rules'?'rules':'log');
  const tabs=['log','settings','rules'].map(tab=>`<button type="button" class="game-menu-tab ${active===tab?'is-active':''}" role="tab" id="game-menu-tab-${tab}" aria-controls="game-menu-panel-${tab}" aria-selected="${active===tab}" data-action="gameMenuTab:${tab}">${tab==='log'?'Log':tab==='settings'?'Settings':'Rules'}</button>`).join('');
  const settingsFields=renderSettingsContents(settings);
  const actions=`<footer class="game-menu-footer"><button type="button" data-action="gameGoHome" class="primary">Exit game</button>${settings.multiplayer&&settings.host?'<div class="game-room-actions"><button type="button" data-action="endRoom">End game for both</button></div>':''}</footer>`;
  return `<div class="game-menu-layer" data-game-overlay="${kind}"><div class="game-menu-scrim" data-game-menu-dismiss aria-hidden="true"></div><section class="game-menu-dialog" role="dialog" aria-modal="true" aria-label="Game menu" tabindex="-1" data-game-menu-dialog>
    <header class="game-menu-head"><h2>Game menu</h2><button type="button" data-action="closeGameOverlay" class="game-menu-close" aria-label="Close game menu" title="Close">${icon('close')}</button></header>
    <nav class="game-menu-tabs" role="tablist" aria-label="Game menu tabs">${tabs}</nav>
    <div class="game-menu-content" data-game-menu-scroll>
      <section id="game-menu-panel-log" role="tabpanel" aria-labelledby="game-menu-tab-log" ${active==='log'?'':'hidden'}>${renderActionHistory(settings.log,{players:settings.players,coop:settings.coop})}</section>
      <section id="game-menu-panel-settings" role="tabpanel" aria-labelledby="game-menu-tab-settings" ${active==='settings'?'':'hidden'}><div class="game-menu-settings-fields"><div class="shell shell-settings-body">${settingsFields}</div></div></section>
      <section id="game-menu-panel-rules" role="tabpanel" aria-labelledby="game-menu-tab-rules" ${active==='rules'?'':'hidden'}><div class="game-menu-accordions"><button type="button" class="game-menu-tutorial" data-action="tutorial">Guided tutorial</button>${renderRulesReference(expansions,coop,{inGame:true})}</div></section>
    </div>
    ${actions}
  </section></div>`;
}
