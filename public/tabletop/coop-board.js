import {icon} from '../icons.js';
import {renderCard,htmlEscape} from './cards.js';
import {renderExpansionTabletop,renderTowerTabletop,renderDenizenTabletop} from './expansions.js';
import {renderDoorSlots} from './door-slots.js';
import {cooperativeLegalTargets} from './interactions.js';

const esc=htmlEscape;
const button=(label,command,disabled=false,title=label)=>`<button type="button" class="tt2-action" data-action="${esc(command)}" title="${esc(title)}" aria-label="${esc(title)}" ${disabled?'disabled':''}>${label}</button>`;
const preview=c=>c.kind==='hidden'?`<div class="tt6-card-back" aria-label="Face-down private card"><span aria-hidden="true">${icon('sparkle')}</span></div>`:renderCard(c,{tiny:true});
export function cooperativeTabletopModel(g,seat,{selectedId=null,canAct=true}={}){
  if(g?.mode!=='coop'||![0,1].includes(seat)||g.players?.length!==2)throw Error('Cooperative tabletop requires two players and a valid seat');
  const mine=g.players[seat],partner=g.players[1-seat],active=canAct&&g.status==='active'&&g.phase==='action'&&g.active===seat;
  const permitted=[...mine.hand,...(g.shared||[])],selected=permitted.find(c=>c.id===selectedId)||null;
  const legal=selected?cooperativeLegalTargets(g,selectedId,seat):[];
  return {seat,mine,partner,shared:g.shared||[],draft:g.draft||[],selected,legal,active,isDraft:g.phase==='draft',canDraft:canAct&&g.active===seat&&g.status==='active',deckCount:g.deckCount??0,discard:g.discard||[],limbo:g.limbo||[]};
}
function doors(g,p,i,options){
  const {decisionTargets,spellGoalMode,spellGoals,incantationClaim,incantationPreview}=options;
  const claim=incantationClaim&&g.active===i;
  return `<section class="tt17-player-doors tt6-player-doors ${claim?'tt12-claim-zone':''}" data-tt6-player="${i}" aria-label="${esc(p.name)} Doors" ${claim?'data-action="incantationClaim" data-tt-incantation-drop="doors" role="button" tabindex="0"':''}>
    <div class="tt6-region-heading"><strong>${esc(p.name)} · Doors</strong><b>${p.doors.length}</b></div>
    <div class="tt6-doors-row tt8-doors-row">${renderDoorSlots(p.doors,{...g.config,bookGoals:g.expansion?.book?.goals},{targets:decisionTargets,spellGoalMode,spellGoals,incantationPreview:claim?incantationPreview:null})}</div>
  </section>`;
}
function labyrinth(g,p,i,canAct){
  return `<section class="tt17-player-labyrinth tt6-player-labyrinth ${canAct&&g.active===i&&g.phase==='action'?'tt6-active-labyrinth':''}" aria-label="${esc(p.name)} Labyrinth" ${canAct&&g.active===i&&g.phase==='action'?'data-tt-drop="play"':''}>
    <div class="tt6-region-heading"><strong>${esc(p.name)} · Labyrinth</strong><b>${p.labyrinth.length}</b></div>
    <div class="tt6-labyrinth-cards" data-tabletop-scroll="labyrinth-${i}">${p.labyrinth.length?p.labyrinth.map(preview).join(''):'<span class="tt14-empty-labyrinth" aria-hidden="true"></span>'}</div>
  </section>`;
}
function handArea(cards,label,{active=false,selectedId='',privateBacks=false,shared=false,decisionTargets=new Set(),decisionSelected=new Set()}={}){
  return `<div class="tt6-hand-block ${shared?'tt6-shared-block':''}" aria-label="${esc(label)}"><div class="tt6-region-heading"><strong>${esc(label)}</strong><b>${cards.length}</b></div><div class="tt6-hand-cards">${cards.map(c=>`<span class="tt6-card-wrap">${privateBacks||c.kind==='hidden'?preview({kind:'hidden'}):renderCard(c,{select:active||decisionTargets.has(c.id),interactive:active,selectedId:decisionSelected.has(c.id)?c.id:selectedId,highlight:decisionTargets.has(c.id)})}</span>`).join('')||'<span class="tt6-empty"></span>'}</div></div>`;
}
function piles(g,m){const pile=(name,cards)=>{const visible=name==='Limbo'?cards:cards.slice(-3);return `<div class="tt6-pile" ${name==='Discard'?'data-tt-drop="discard"':''}><button type="button" class="tt6-pile-inspect ${name==='Discard'&&m.active&&m.legal.includes('discard')?'tt9-discard-gesture':''}" ${name==='Discard'&&m.active&&m.legal.includes('discard')?'data-tt-drop="discard"':`data-action="inspectPile:${name.toLowerCase()}"`} aria-label="${name==='Discard'&&m.active&&m.legal.includes('discard')?'Discard selected card':`Inspect ${name} pile`}"><div class="tt6-pile-face">${visible.length?`<span class="tt14-pile-fan" style="--tt14-pile-count:${visible.length};--tt14-pile-last:${Math.max(1,visible.length-1)}">${visible.map((c,i)=>`<span class="tt14-fan-card" style="--tt14-i:${i};z-index:${i+1}">${renderCard(c,{tiny:true})}</span>`).join('')}</span>`:'<span class="tt14-empty-pile"></span>'}</div><small>${name}</small></button>${name==='Discard'&&m.active&&m.legal.includes('discard')?`<button type="button" class="tt9-pile-info" data-action="inspectPile:discard" aria-label="Inspect Discard pile">i</button>`:''}</div>`;};
  return `<section class="tt6-piles" aria-label="Card piles">${pile('Limbo',m.limbo)}<div class="tt6-pile" aria-label="Draw deck, ${m.deckCount} cards"><button type="button" class="tt6-pile-inspect" data-action="inspectPile:deck" aria-label="Inspect draw pile"><div class="tt2-deck-back" aria-hidden="true"><span class="tt10-draw-count">${m.deckCount}</span></div><small>Draw</small></button></div>${pile('Discard',m.discard)}${g.expansion?.book?`<button type="button" class="tt8-spell-button" data-action="openSpells" aria-label="Open spells, ${m.discard.length} discarded cards available">Spells · ${m.discard.length}</button>`:''}</section>`;
}
export function renderCooperativeTabletop(g,{seat=0,selectedId=null,canAct=true,connected=true,decisionTargets=new Set(),decisionSelected=new Set(),spellGoalMode=false,spellGoals=[],selectedPremonition=null,premonitionChoiceMode=false,incantationClaim=false,incantationPreview=null}={}){
  const m=cooperativeTabletopModel(g,seat,{selectedId,canAct}),active=m.active&&!m.isDraft;
  const playerOptions={decisionTargets,spellGoalMode,spellGoals,incantationClaim,incantationPreview};
  const handFor=i=>handArea(g.players[i].hand,`${g.players[i].name}'s hand`,{active:active&&i===seat,privateBacks:i!==seat,selectedId,decisionTargets,decisionSelected});
  const shared=handArea(m.shared,'Shared',{active,selectedId,shared:true,decisionTargets,decisionSelected});
  const draft=`<section class="tt6-draft" aria-label="Public card draft"><div class="tt6-region-heading">Draft <b>${g.draft?.length||0}</b><small>${esc(g.players[g.active]?.name||'Player')}'s pick</small></div><div class="tt6-draft-cards">${m.draft.map(c=>renderCard(c,{select:m.canDraft,interactive:false})).join('')}</div></section>`;
  const selected=m.selected;
  const expansion=renderExpansionTabletop(g,{canAct:active||m.canDraft,decisionTargets,spellGoalMode,spellGoals,selectedPremonition,premonitionChoiceMode,excludeDenizens:true});
  const doorsAll=g.players.reduce((n,p)=>n+p.doors.length,0);
  return `<div class="tt6-root tt2-root tt17-coop ${g.config?.expansions?.length?'tt5-has-expansions':''}" data-tabletop-coop="true" data-phase="${esc(g.phase)}" data-selected-card="${esc(selected?.id||'')}" data-tt6-seat="${seat}">
    <div class="tt6-top"><span class="tt2-game-name">CO-OP</span><span class="tt6-turn" aria-live="polite">${g.status!=='active'?(g.status==='won'?'Victory':'Defeat'):m.isDraft?'Draft':`Turn ${g.turn} · ${esc(g.players[g.active].name)}`}</span><span class="tt6-doors-total" aria-label="${doorsAll} Doors acquired">${doorsAll} Doors</span><span class="tt6-connection ${connected?'':'tt6-offline'}" title="${connected?'Connected':'Reconnecting'}">●</span><span class="game-top-actions"><button type="button" class="game-menu-trigger" data-action="openGamePause" aria-label="Pause menu" title="Pause">${icon('pause')}</button><button type="button" class="tt2-rule-link" data-action="openGameRules" aria-label="Game rules" title="Rules">${icon('help')}</button></span></div>
    ${!connected?`<div class="tt6-disconnected" role="status">Connection interrupted ${button('Retry','retryConnection')}</div>`:''}
    <div class="tt6-grid tt17-coop-grid">
      <div class="tt17-coop-doors">${g.players.map((p,i)=>doors(g,p,i,playerOptions)).join('')}</div>
      <div class="tt17-coop-equipment">${piles(g,m)}${renderTowerTabletop(g,{canAct:active,decisionTargets})}${expansion}</div>
      ${m.isDraft?draft:''}
      <div class="tt17-coop-labyrinths">${g.players.map((p,i)=>labyrinth(g,p,i,active)).join('')}</div>
      ${g.expansion?.oniverse?`<div class="tt17-coop-denizens" aria-label="Players’ Denizens">${g.players.map((p,i)=>renderDenizenTabletop(g,{owner:i,canAct:active,decisionTargets})).join('')}</div>`:''}
      <div class="tt17-coop-hands"><div class="${seat===0?'tt6-self':'tt6-opponent'} tt17-${seat===0?'your':'partner'}-hand">${handFor(0)}</div>${shared}<div class="${seat===1?'tt6-self':'tt6-opponent'} tt17-${seat===1?'your':'partner'}-hand">${handFor(1)}</div></div>
    </div>
  </div>`;
}
