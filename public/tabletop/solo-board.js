import {renderCard,htmlEscape,CARD_COLORS} from './cards.js';

// The UI is deliberately a projection of server/local-engine state. Only the
// existing command dispatcher can change game state. Phase 3 will add gestures.
export function soloTabletopModel(g,{selectedId=null,canAct=true}={}){
  if(g?.mode!=='solo'||!Array.isArray(g.players)||!g.players[0])throw Error('Solo tabletop requires a solo game view');
  const player=g.players[0],hand=player.hand||[],labyrinth=player.labyrinth||[];
  const selected=hand.find(card=>card.id===selectedId)||null;
  const active=canAct&&g.status==='active'&&g.phase==='action';
  return {hand,labyrinth,doors:player.doors||[],selected,active,
    canPlay:active&&selected?.kind==='location'&&(!labyrinth.length||labyrinth.at(-1).symbol!==selected.symbol),
    canDiscard:active&&selected?.kind==='location',deckCount:g.deckCount??0,
    discard:g.discard||[],limbo:g.limbo||[],phase:g.phase,turn:g.turn,status:g.status};
}
const button=(label,action,cls='',disabled=false)=>`<button type="button" class="${cls}" data-action="${action}"${disabled?' disabled':''}>${label}</button>`;
function doorsRow(m){return CARD_COLORS.map(color=>{
  const found=m.doors.filter(c=>c.color===color);
  return `<div class="tt2-door-group ${color}" aria-label="${color}: ${found.length} of 2 Doors"><div class="tt2-door-stack">${[0,1].map(i=>found[i]?renderCard(found[i],{tiny:true}):`<div class="tt2-door-empty" aria-label="Missing ${color} Door"><span aria-hidden="true">◇</span></div>`).join('')}</div><span class="tt2-color-name">${color}</span></div>`;
}).join('');}
function pile(name,detail,cards,cls=''){
  const last=cards?.at(-1);
  return `<div class="tt2-pile ${cls}" aria-label="${name}, ${detail}"><div class="tt2-pile-face">${last?renderCard(last,{tiny:true}):'<span class="tt2-empty-pile" aria-hidden="true">◇</span>'}</div><span class="tt2-pile-label">${name}</span><span class="tt2-pill">${detail}</span></div>`;
}
export function renderSoloTabletop(g,{selectedId=null,canAct=true,decisionHtml=''}={}){
  const m=soloTabletopModel(g,{selectedId,canAct}),isDecision=g.phase==='decision';
  const handCards=m.hand.map(c=>`<div class="tt2-hand-card">${renderCard(c,{select:m.active,selectedId})}</div>`).join('');
  const chosen=m.selected&&m.active;
  return `<div class="tt2-root" data-tabletop-solo="true" data-phase="${htmlEscape(g.phase)}">
    <div class="tt2-top"><span class="tt2-game-name">SOLO</span><span class="tt2-status" aria-live="polite">${g.status==='won'?'Victory':g.status==='lost'?'Defeat':`Turn ${m.turn}${isDecision?' · resolve effect':''}`}</span><a class="tt2-rule-link" href="#/rules" aria-label="Rules" title="Rules">?</a></div>
    <div class="tt2-grid">
      <section class="tt2-zone tt2-doors" aria-label="Collected Doors"><header><span>Doors</span><b>${m.doors.length}/8</b></header><div class="tt2-doors-row">${doorsRow(m)}</div></section>
      <section class="tt2-zone tt2-labyrinth ${m.canPlay?'tt2-valid-target':''}" aria-label="Labyrinth"><header><span>Labyrinth</span><b>${m.labyrinth.length}</b></header><div class="tt2-labyrinth-row" data-tabletop-scroll="labyrinth">${m.labyrinth.length?m.labyrinth.map(c=>renderCard(c,{tiny:true})).join(''):`<div class="tt2-blank-target" aria-hidden="true">✧</div>`}</div>${m.canPlay?button('Play here','play','tt2-zone-target'):''}</section>
      <section class="tt2-zone tt2-piles" aria-label="Draw deck, discard pile and Limbo"><header><span>Piles</span></header><div class="tt2-pile-row"><div class="tt2-pile draw" aria-label="Draw deck, ${m.deckCount} cards"><div class="tt2-deck-back" aria-hidden="true">✧</div><span class="tt2-pile-label">Deck</span><span class="tt2-pill">${m.deckCount}</span></div>${pile('Discard',m.discard.length,m.discard,m.canDiscard?'tt2-valid-target':'')}${pile('Limbo',m.limbo.length,m.limbo)}</div>${m.canDiscard?button('Discard here','discard','tt2-discard-target'):''}</section>
      <section class="tt2-zone tt2-hand" aria-label="Your hand"><header><span>Hand</span><b>${m.hand.length}/5</b></header><div class="tt2-hand-row">${handCards}</div><div class="tt2-context" role="group" aria-label="Selected card actions">${chosen?`${button('Play','play','tt2-action tt2-primary',!m.canPlay)}${button('Discard','discard','tt2-action',!m.canDiscard)}`:(m.active?'<span class="tt2-hint">Select a card</span>':'')}</div></section>
    </div>
    ${isDecision?`<div class="tt2-decision" role="region" aria-label="Resolve card effect">${decisionHtml}</div>`:''}
    ${g.status!=='active'?`<div class="tt2-finish" role="status"><strong>${g.status==='won'?'The dream is escaped':'The dream ends'}</strong><div>${button('New game','setup','tt2-action tt2-primary')}${button('History','history','tt2-action')}</div></div>`:''}
  </div>`;
}
