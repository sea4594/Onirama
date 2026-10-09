import {icon,cardSymbol} from '../icons.js';
import {renderCard,htmlEscape,CARD_COLORS} from './cards.js';
import {targetState} from './interactions.js';
import {renderExpansionTabletop,renderTowerTabletop} from './expansions.js';
import {renderDoorSlots} from './door-slots.js';

// The UI is deliberately a projection of server/local-engine state. Only the
// existing command dispatcher can change game state; Phase 3 adds gestures.
export function soloTabletopModel(g,{selectedId=null,canAct=true}={}){
  if(g?.mode!=='solo'||!Array.isArray(g.players)||!g.players[0])throw Error('Solo tabletop requires a solo game view');
  const player=g.players[0],stored=g.expansion?.oniverse?.treasure||[],hand=player.hand||[],labyrinth=player.labyrinth||[];
  const selected=[...hand,...stored].find(card=>card.id===selectedId)||null;
  const active=canAct&&g.status==='active'&&g.phase==='action';
  const legal=targetState(g,selected?.id,canAct?g.active:-1);
  return {hand,stored,labyrinth,doors:player.doors||[],selected,active,
    canPlay:legal.play,canDiscard:legal.discard,canTowerLeft:getTowerSides(g,selected?.id,canAct).left,canTowerRight:getTowerSides(g,selected?.id,canAct).right,deckCount:g.deckCount??0,
    discard:g.discard||[],limbo:g.limbo||[],phase:g.phase,turn:g.turn,status:g.status};
}
function getTowerSides(g,id,canAct){if(!canAct||g.phase!=='action'||g.status!=='active')return {left:false,right:false};const cards=[...(g.players?.[0]?.hand||[]),...(g.expansion?.oniverse?.treasure||[])],c=cards.find(c=>c.id===id);if(c?.kind!=='tower')return {left:false,right:false};const a=g.expansion?.towers?.alignment||[];const match=(v,w)=>String(v||'').split('+').some(k=>k&&String(w||'').split('+').includes(k));return {left:!a.length||!match(c.right,a[0].left),right:!a.length||!match(a.at(-1).right,c.left)};}
const button=(label,action,cls='',disabled=false)=>`<button type="button" class="${cls}" data-action="${action}"${disabled?' disabled':''}>${label}</button>`;
function doorsRow(m,g,targets=new Set(),options={}){
 return renderDoorSlots(m.doors,{...g.config,bookGoals:g.expansion?.book?.goals},{targets,...options});
}

function pile(name,detail,cards,cls='',drop=false){
  const last=cards?.at(-1);
  const action=drop&&cls.includes('tt2-valid-target');
  return `<div class="tt2-pile ${cls}" ${drop?'data-tt-drop="discard"':''} aria-label="${name}, ${detail}"><button type="button" class="tt6-pile-inspect ${action?'tt9-discard-gesture':''}" ${action?'data-tt-drop="discard"':`data-action="inspectPile:${name.toLowerCase()}"`} aria-label="${action?'Discard selected card':`Inspect ${name} pile`}"><div class="tt2-pile-face">${last?`<span class="tt9-visible-pile">${cards.slice(-5).map(c=>renderCard(c,{tiny:true})).join('')}</span>`:`<span class="tt2-empty-pile" aria-hidden="true">${icon('diamond')}</span>`}</div><span class="tt2-pile-label">${name}</span><span class="tt2-pill">${detail}</span></button>${action?`<button type="button" class="tt9-pile-info" data-action="inspectPile:discard" aria-label="Inspect Discard pile">i</button>`:''}</div>`;
}
export function renderSoloTabletop(g,{selectedId=null,canAct=true,decisionHtml='',decisionTargets=new Set(),decisionSelected=new Set(),spellGoalMode=false,spellGoals=[],selectedPremonition=null,premonitionChoiceMode=false}={}){
  const m=soloTabletopModel(g,{selectedId,canAct}),isDecision=g.phase==='decision';
  const handCards=[...m.hand,...m.stored].map(c=>`<div class="tt2-hand-card ${m.stored.includes(c)?'tt5-keeper-hand':''}">${renderCard(c,{select:m.active||decisionTargets.has(c.id),selectedId:decisionSelected.has(c.id)?c.id:selectedId,interactive:m.active,highlight:decisionTargets.has(c.id)})}</div>`).join('');
  const chosen=m.selected&&m.active,hasExpansions=Boolean(g.config?.expansions?.length);
  const doorGoal=8+(g.config?.expansions?.includes('glyphs')?4:0)+(g.config?.expansions?.includes('oniverse')?1:0);
  return `<div class="tt2-root ${hasExpansions?'tt5-has-expansions':''}" data-tabletop-solo="true" data-phase="${htmlEscape(g.phase)}" data-selected-card="${htmlEscape(m.selected?.id||'')}">
    <div class="tt2-top"><span class="tt2-game-name">SOLO</span><span class="tt2-status" aria-live="polite">${g.status==='won'?'Victory':g.status==='lost'?'Defeat':`Turn ${m.turn}${isDecision?' · resolve effect':''}`}</span><span class="game-top-actions"><button type="button" class="game-menu-trigger" data-action="openGamePause" aria-label="Pause menu" title="Pause">${icon('pause')}</button><button type="button" class="tt2-rule-link" data-action="openGameRules" aria-label="Game rules" title="Rules">${icon('help')}</button></span></div>
    <div class="tt2-grid">
      <section class="tt2-zone tt2-doors" aria-label="Collected Doors"><header><span>Doors</span><b>${m.doors.length}/${doorGoal}</b></header><div class="tt2-doors-row tt8-doors-row">${doorsRow(m,g,decisionTargets,{spellGoalMode,spellGoals})}</div></section>
      ${renderTowerTabletop(g,{canAct,decisionTargets})}
      <section class="tt2-zone tt2-labyrinth ${m.canPlay?'tt2-valid-target':''}" data-tt-drop="play" aria-label="Labyrinth"><header><span>Labyrinth</span><b>${m.labyrinth.length}</b></header><div class="tt2-labyrinth-row" data-tabletop-scroll="labyrinth">${m.labyrinth.length?m.labyrinth.map(c=>renderCard(c,{tiny:true})).join(''):`<div class="tt2-blank-target" aria-hidden="true">${icon('sparkle')}</div>`}</div></section>
      <section class="tt2-zone tt2-piles" aria-label="Draw deck, discard pile and Limbo"><header><span>Piles</span></header><div class="tt2-pile-row tt8-pile-row">${pile('Limbo',m.limbo.length,m.limbo)}<div class="tt2-pile draw" aria-label="Draw deck, ${m.deckCount} cards"><button type="button" class="tt6-pile-inspect" data-action="inspectPile:deck" aria-label="Inspect draw pile"><div class="tt2-deck-back" aria-hidden="true">${icon('sparkle')}</div><span class="tt2-pile-label">Deck</span><span class="tt2-pill">${m.deckCount}</span></button></div>${pile('Discard',m.discard.length,m.discard,m.canDiscard?'tt2-valid-target':'',true)}${g.expansion?.book?`<button type="button" class="tt8-spell-button" data-action="openSpells" aria-label="Open spells" ${!canAct?'disabled':''}>Spells</button>`:''}</div></section>
      <section class="tt2-zone tt2-hand" aria-label="Your hand"><header><span>Hand</span><b>${m.hand.length}/5</b></header><div class="tt2-hand-row">${handCards}</div></section>
      ${renderExpansionTabletop(g,{canAct,decisionTargets,spellGoalMode,spellGoals,selectedPremonition,premonitionChoiceMode,group:"primary"})}
      ${renderExpansionTabletop(g,{canAct,decisionTargets,spellGoalMode,spellGoals,selectedPremonition,premonitionChoiceMode,group:"secondary"})}
    </div>
    ${isDecision?`<div class="tt2-decision" role="region" aria-label="Resolve card effect">${decisionHtml}</div>`:''}
    ${g.status!=='active'?`<div class="tt2-finish" role="status"><strong>${g.status==='won'?'The dream is escaped':'The dream ends'}</strong><div>${button('New game','setup','tt2-action tt2-primary')}${button('History','history','tt2-action')}</div></div>`:''}
  </div>`;
}
