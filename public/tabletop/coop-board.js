import {icon,cardSymbol} from '../icons.js';
import {renderCard,htmlEscape,CARD_COLORS} from './cards.js';
import {renderExpansionTabletop,renderTowerTabletop} from './expansions.js';
import {renderDoorSlots} from './door-slots.js';
import {cooperativeLegalTargets} from './interactions.js';

const esc=htmlEscape;
const button=(label,command,disabled=false,title=label)=>`<button type="button" class="tt2-action" data-action="${esc(command)}" title="${esc(title)}" aria-label="${esc(title)}" ${disabled?'disabled':''}>${label}</button>`;
const preview=(c)=>c.kind==='hidden'?`<div class="tt6-card-back" aria-label="Face-down private card"><span aria-hidden="true">${icon('sparkle')}</span></div>`:renderCard(c,{tiny:true});
const stack=(cards)=>cards.length?cards.map(preview).join(''):`<span class="tt6-empty" aria-hidden="true">${icon('diamond')}</span>`;
function doorSpots(player,config,targets=new Set(),options={}){
 return renderDoorSlots(player.doors,config,{targets,...options});
}

export function cooperativeTabletopModel(g,seat,{selectedId=null,canAct=true}={}){
  if(g?.mode!=='coop'||![0,1].includes(seat)||g.players?.length!==2)throw Error('Cooperative tabletop requires two players and a valid seat');
  const mine=g.players[seat],partner=g.players[1-seat],active=canAct&&g.status==='active'&&g.phase==='action'&&g.active===seat;
  const permitted=[...mine.hand,...(g.shared||[])];const selected=permitted.find(c=>c.id===selectedId)||null;
  const legal=selected?cooperativeLegalTargets(g,selectedId,seat):[];
  return {seat,mine,partner,shared:g.shared||[],draft:g.draft||[],selected,legal,active,
    isDraft:g.phase==='draft',canDraft:canAct&&g.active===seat&&g.status==='active',
    deckCount:g.deckCount??0,discard:g.discard||[],limbo:g.limbo||[]};
}
function playerArea(p,seat,isTurn,config,canDrop=false,decisionTargets=new Set(),spellGoalMode=false,spellGoals=[],incantationClaim=false,incantationPreview=null){
  return `<section class="tt6-player ${isTurn?'tt6-current':''}" data-tt6-player="${seat}" aria-label="${esc(p.name)}'s play area">
    <div class="tt6-player-heading"><strong>${esc(p.name)}</strong><span class="tt6-turn-dot" title="${isTurn?'Taking turn':'Waiting'}" aria-label="${isTurn?'Taking turn':'Waiting'}"></span></div>
    <div class="tt6-player-fields"><div class="tt6-player-doors ${incantationClaim?'tt12-claim-zone':''}" ${incantationClaim?'data-action="incantationClaim" data-tt-incantation-drop="doors" role="button" tabindex="0" aria-label="Place revealed Door here"':''}><div class="tt6-region-heading">Doors <b>${p.doors.length}</b></div><div class="tt6-doors-row tt8-doors-row">${doorSpots(p,config,decisionTargets,{spellGoalMode,spellGoals,incantationPreview})}</div></div>
      <div class="tt6-player-labyrinth ${canDrop?'tt6-active-labyrinth':''}" ${canDrop?'data-tt-drop="play"':''} aria-label="${esc(p.name)}'s Labyrinth"><div class="tt6-region-heading">Labyrinth <b>${p.labyrinth.length}</b></div><div class="tt6-labyrinth-cards" data-tabletop-scroll="labyrinth-${seat}">${stack(p.labyrinth)}</div></div></div>
  </section>`;
}
function handArea(cards,label,{active=false,selectedId='',privateBacks=false,shared=false,decisionTargets=new Set(),decisionSelected=new Set(),spellGoalMode=false,spellGoals=[],selectedPremonition=null,premonitionChoiceMode=false,incantationClaim=false,incantationPreview=null}={}){
  return `<div class="tt6-hand-block ${shared?'tt6-shared-block':''}" aria-label="${esc(label)}"><div class="tt6-region-heading">${esc(label)} <b>${cards.length}</b></div><div class="tt6-hand-cards">${cards.map(c=>`<span class="tt6-card-wrap">${privateBacks||c.kind==='hidden'?preview({kind:'hidden'}):renderCard(c,{select:active||decisionTargets.has(c.id),interactive:active,selectedId:decisionSelected.has(c.id)?c.id:selectedId,highlight:decisionTargets.has(c.id)})}</span>`).join('')||`<span class="tt6-empty">${icon('diamond')}</span>`}</div></div>`;
}
function piles(g,m){const pile=(name,cards)=>`<div class="tt6-pile" ${name==='Discard'?'data-tt-drop="discard"':''}><button type="button" class="tt6-pile-inspect ${name==='Discard'&&m.active&&m.legal.includes('discard')?'tt9-discard-gesture':''}" ${name==='Discard'&&m.active&&m.legal.includes('discard')?'data-tt-drop="discard"':`data-action="inspectPile:${name.toLowerCase()}"`} aria-label="${name==='Discard'&&m.active&&m.legal.includes('discard')?'Discard selected card':`Inspect ${name} pile`}"><div class="tt6-pile-face">${cards.length?`<span class="tt9-visible-pile">${cards.slice(-5).map(c=>renderCard(c,{tiny:true})).join('')}</span>`:icon('diamond')}</div><small>${name}</small></button>${name==='Discard'&&m.active&&m.legal.includes('discard')?`<button type="button" class="tt9-pile-info" data-action="inspectPile:discard" aria-label="Inspect Discard pile">i</button>`:''}</div>`;
 return `<section class="tt6-piles" aria-label="Card piles">${pile('Limbo',m.limbo)}<div class="tt6-pile" aria-label="Draw deck, ${m.deckCount} cards"><button type="button" class="tt6-pile-inspect" data-action="inspectPile:deck" aria-label="Inspect draw pile"><div class="tt2-deck-back" aria-hidden="true">${icon('sparkle')}<span class="tt10-draw-count">${m.deckCount}</span></div><small>Draw</small></button></div>${pile('Discard',m.discard)}${g.expansion?.book?`<button type="button" class="tt8-spell-button" data-action="openSpells">Spells</button>`:''}</section>`;}

export function renderCooperativeTabletop(g,{seat=0,selectedId=null,canAct=true,connected=true,decisionTargets=new Set(),decisionSelected=new Set(),spellGoalMode=false,spellGoals=[],selectedPremonition=null,premonitionChoiceMode=false,incantationClaim=false,incantationPreview=null}={}){
  const m=cooperativeTabletopModel(g,seat,{selectedId,canAct}),opponent=1-seat;
  const canSelect=m.active&&!m.isDraft;
  const draft=`<section class="tt6-draft" aria-label="Public card draft"><div class="tt6-region-heading">Draft ${g.draft?.length||0} <small>${esc(g.players[g.active]?.name||'Player')}'s pick</small></div><div class="tt6-draft-cards">${m.draft.map(c=>renderCard(c,{select:m.canDraft,interactive:false})).join('')}</div></section>`;
  const hand=handArea(m.mine.hand,'Your hand',{active:canSelect,selectedId,decisionTargets,decisionSelected});
  const shared=handArea(m.shared,'Shared',{active:canSelect,selectedId,shared:true,decisionTargets,decisionSelected});
  const partner=handArea(m.partner.hand,`${m.partner.name}'s hand`,{privateBacks:true});
  const selected=m.selected;
  const actions=canSelect?`<div class="tt6-context" aria-label="Selected card actions">${selected?`${selected.kind==='tower'?`${button('←','towerLeft',!m.legal.includes('towerLeft'),'Place Tower left')}${button('→','towerRight',!m.legal.includes('towerRight'),'Place Tower right')}`:button('Play','play',!m.legal.includes('play'))}${button('Discard','discard',!m.legal.includes('discard'))}`:''}${g.expansion?.crossroads?button('Escape','escape'):''}</div>`:'';
  const doorsAll=g.players.reduce((n,p)=>n+p.doors.length,0);
  const content=`<div class="tt6-root tt2-root ${g.config?.expansions?.length?'tt5-has-expansions':''}" data-tabletop-coop="true" data-phase="${esc(g.phase)}" data-selected-card="${esc(selected?.id||'')}" data-tt6-seat="${seat}">
    <div class="tt6-top"><span class="tt2-game-name">CO-OP</span><span class="tt6-turn" aria-live="polite">${g.status!=='active'?(g.status==='won'?'Victory':'Defeat'):m.isDraft?'Draft':`Turn ${g.turn} · ${esc(g.players[g.active].name)}`}</span><span class="tt6-doors-total" aria-label="${doorsAll} Doors acquired">${doorsAll} Doors</span><span class="tt6-connection ${connected?'':'tt6-offline'}" title="${connected?'Connected':'Reconnecting'}">●</span><span class="game-top-actions"><button type="button" class="game-menu-trigger" data-action="openGamePause" aria-label="Pause menu" title="Pause">${icon('pause')}</button><button type="button" class="tt2-rule-link" data-action="openGameRules" aria-label="Game rules" title="Rules">${icon('help')}</button></span></div>
    ${!connected?`<div class="tt6-disconnected" role="status">Connection interrupted ${button('Retry','retryConnection')}</div>`:''}
    <div class="tt6-grid">
      <div class="tt6-opponent">${playerArea(m.partner,opponent,g.active===opponent,{...g.config,bookGoals:g.expansion?.book?.goals},false,decisionTargets,spellGoalMode,spellGoals)}${partner}</div>
      <div class="tt6-center">${piles(g,m)}${shared}</div>
      ${m.isDraft?draft:''}
      <div class="tt6-self">${playerArea(m.mine,seat,g.active===seat,{...g.config,bookGoals:g.expansion?.book?.goals},m.active,decisionTargets,spellGoalMode,spellGoals,incantationClaim,incantationPreview)}${renderTowerTabletop(g,{canAct:m.active,decisionTargets})}${hand}</div>
      ${renderExpansionTabletop(g,{canAct:m.active||m.canDraft,decisionTargets,spellGoalMode,spellGoals,selectedPremonition,premonitionChoiceMode})}
    </div>
    ${g.status!=='active'?`<div class="tt2-finish"><strong>${g.status==='won'?'The dream is escaped':'The dream ends'}</strong>${button('New game','setup')}${button('History','history')}</div>`:''}
  </div>`;
  return content;
}
