import {PENDING_DECISIONS} from './dialogs.js';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const step={sphinxName:'Name an aspect',sphinxResolve:'Choose a top card and reorder',diver:'Reveal another or stop',confusion:'Rearrange your hand',mirrorReward:'Choose the Mirror reward cards',doorSearch:'Claim a Door or skip',door:'Use a matching Key or let the Door go',nightmare:'Choose a Nightmare penalty',prophecy:'Choose one card to discard',happyDream:'Choose a Happy Dream benefit',happyFetch:'Choose a card to put on top',rally:'Rally the Denizen or skip',premonitionPick:'Choose a Premonition to resolve',premonitionDoor:'Choose a Door to sacrifice',incantation:'Choose a Door and reorder cards',towerLook:'Reorder inspected cards',spellPeek:'Reorder inspected cards',happyPeek:'Choose discards and reorder cards',denizenPeek:'Reorder inspected cards',catchChoose:'Choose a free Dreamcatcher',catchOverload:'Choose a Dreamcatcher to sacrifice',towerPenalty:'Choose a Tower penalty',moduleDecision:'Choose an effect','private-decision':'Partner resolving an effect'};
export const DOCK_PENDING_TYPES=PENDING_DECISIONS;
export function actionDockPrompt(game,seat,{selectedId=null,legal=[],prophecyDiscard=null,dialog=null}={}){
 if(game.status==='won')return {title:'Victory',hint:'All objectives completed.'};
 if(game.status!=='active')return {title:'Game over',hint:'The dream has ended.'};
 if(game.phase==='draft')return seat===game.active?{title:'Choose a draft card',hint:'Tap one of the face-up draft cards.'}:{title:'Partner drafting',hint:'Waiting for the next card selection.'};
 if(game.phase==='refill')return {title:'Refilling the hand',hint:'Cards are drawn automatically.'};
 if(game.phase==='decision'){
  if(seat!==game.active)return {title:'Partner resolving a card',hint:'The tabletop stays visible while they choose.'};
  if(dialog?.type==='spellbook')return {title:'Cast a spell',hint:'Choose a spell and its cost.'};
  const type=game.pending?.type||'';
  return {title:type==='prophecy'&&prophecyDiscard?'Rearrange the remaining cards':step[type]||'Resolve the card effect',hint:type==='prophecy'?'Leftmost card will be drawn first.':type==='confusion'?'Leftmost card returns to the deck first.':'Choose from the options below.'};
 }
 if(seat!==game.active)return {title:`${game.players[game.active]?.name||'Partner'}’s turn`,hint:'Waiting for their action.'};
 if(dialog)return {title:dialog.type==='mirrorPair'?'Choose two matching cards':dialog.type==='coopDiscard'?'Confirm discard or swap':dialog.type==='cyclobot'?'Choose replacement card':'Cast a spell',hint:'Complete the selection below.'};
 return selectedId?(legal.length?{title:'Play or discard',hint:'Choose a legal action for the selected card.'}:{title:'No legal action for this card',hint:'Select another card or use an eligible expansion ability.'}):{title:'Select a card',hint:'Play or discard one Location. Select a card on the table.'};
}
const button=(label,action)=>`<button type="button" data-action="${escape(action)}" class="tt6-dock-button">${escape(label)}</button>`;
export function renderActionDock(game,seat,{selectedId=null,legal=[],dialog=null,prophecyDiscard=null}={}){
 const {title,hint}=actionDockPrompt(game,seat,{selectedId,legal,prophecyDiscard,dialog});
 let controls='';
 if(!dialog&&game.phase==='action'&&game.status==='active'&&seat===game.active){
  if(selectedId)controls=[['play','Play'],['discard','Discard'],['towerLeft','Tower left'],['towerRight','Tower right']].filter(([type])=>legal.includes(type)).map(([type,label])=>button(label,type)).join('');
  if(game.config?.expansions?.includes('crossroads'))controls+=button('Escape','escape');
 }
 if(game.status!=='active')controls=button('New game','setup');
 const content=dialog?.html||controls||`<span class="tt6-dock-tip">${escape(hint)}</span>`;
 return `<section class="tt6-workspace" data-action-dock data-dock-phase="${escape(game.phase)}" aria-label="Game actions"><div class="tt6-dock-status"><strong role="status">${escape(title)}</strong><span class="tt6-dock-subtitle">${escape(hint)}</span></div><div class="tt6-dock-scroll" role="region" aria-label="Available actions" tabindex="0">${dialog?`<div class="tt6-dock-decision" data-dock-decision="${escape(dialog.type)}">${content}</div>`:`<div class="tt6-dock-buttons">${content}</div>`}</div></section>`;
}
export function renderPileInspector(game,pile){
 if(!['deck','discard','limbo'].includes(pile))return '';
 const inventory=Array.isArray(game.pileInventory)?game.pileInventory:[];
 const titles={deck:'Draw pile',discard:'Discard pile',limbo:'Limbo pile'};
 const sections=[['base','Base game'],['glyphs','Glyphs'],['dreamcatchers','Dreamcatchers'],['towers','Towers'],['premonitions','Happy Dreams'],['crossroads','Crossroads'],['oniverse','Oniverse'],['sphinx','Sphinx / Diver / Confusion']];
 const count=inventory.reduce((n,r)=>n+r[pile],0);
 const body=sections.map(([key,name])=>{const entries=inventory.filter(i=>i.section===key);if(!entries.length)return '';return `<section class="tt6-inventory-group"><h3>${escape(name)}</h3><div class="tt6-inventory-rows">${entries.map(i=>`<div class="tt6-inventory-line"><span>${escape(i.label)}</span><b>${i[pile]} <small>/ ${i.total}</small></b></div>`).join('')}</div></section>`;}).join('');
 return `<aside class="tt6-pile-inspector" data-pile-inspector role="dialog" aria-modal="false" aria-label="${titles[pile]} contents"><header><strong>${titles[pile]}</strong><span>${count} cards</span><button type="button" class="tt6-pile-close" data-action="closePile" aria-label="Close pile information">×</button></header><div class="tt6-pile-scroll">${body||'<p>Card counts unavailable.</p>'}</div></aside>`;
}
