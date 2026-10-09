import {PENDING_DECISIONS} from './dialogs.js';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
import {renderCard} from './cards.js';
const step={sphinxName:'Sphinx',sphinxResolve:'Sphinx',diver:'Diver',confusion:'Confusion',mirrorReward:'Mirror',doorSearch:'Door',door:'Door!',nightmare:'Nightmare!',prophecy:'Prophecy',happyDream:'Happy Dream!',happyFetch:'Search',rally:'Denizen',premonitionPick:'Premonitions',premonitionDoor:'Lose a Door',incantation:'Incantation',towerLook:'Towers',spellPeek:'Prophecy',happyPeek:'Happy Dream',denizenPeek:'Denizen',catchChoose:'Dreamcatcher',catchOverload:'Free a Dreamcatcher',towerPenalty:'Towers',moduleDecision:'Effect'};
export const DOCK_PENDING_TYPES=PENDING_DECISIONS;
export function actionDockPrompt(game,seat,{selectedId=null,legal=[],prophecyDiscard=null,dialog=null}={}){
 if(game.status==='won')return {title:'Victory',hint:''};
 if(game.status!=='active')return {title:'Game over',hint:''};
 if(game.phase==='draft')return {title:seat===game.active?'Draft':'Partner drafting',hint:''};
 if(game.phase==='refill')return {title:'Drawing…',hint:''};
 if(game.phase==='decision'){
  if(seat!==game.active)return {title:'Partner resolving',hint:''};
  if(dialog?.type==='spellbook')return {title:'Spellbook',hint:''};
  const type=game.pending?.type||'';
  return {title:type==='prophecy'&&prophecyDiscard?'Prophecy · order':'Prophecy'===step[type]?'Prophecy · discard':step[type]||'Resolve',hint:''};
 }
 if(seat!==game.active)return {title:`${game.players[game.active]?.name||'Partner'}’s turn`,hint:''};
 if(dialog)return {title:dialog.type==='mirrorPair'?'Mirror':dialog.type==='coopDiscard'?'Discard / swap':dialog.type==='cyclobot'?'Cyclobot':'Spellbook',hint:''};
 return selectedId?{title:'Play / discard',hint:''}:{title:'Your turn',hint:''};
}
const button=(label,action)=>`<button type="button" data-action="${escape(action)}" class="tt6-dock-button">${escape(label)}</button>`;
export function renderActionDock(game,seat,{selectedId=null,legal=[],dialog=null,prophecyDiscard=null}={}){
 const {title}=actionDockPrompt(game,seat,{selectedId,legal,prophecyDiscard,dialog});
 let controls='';
 if(!dialog&&game.phase==='action'&&game.status==='active'&&seat===game.active){
  if(selectedId)controls=[['play','Play'],['discard','Discard'],['towerLeft','Tower left'],['towerRight','Tower right']].filter(([type])=>legal.includes(type)).map(([type,label])=>button(label,type)).join('');
  if(game.config?.expansions?.includes('crossroads'))controls+=button('Escape','escape');
 }
 if(game.status!=='active')controls=button('New game','setup');
 const content=dialog?.html||controls||'';
 return `<section class="tt6-workspace" data-action-dock data-dock-phase="${escape(game.phase)}" aria-label="Game actions"><div class="tt6-dock-status"><strong role="status">${escape(title)}</strong></div><div class="tt6-dock-scroll" role="region" aria-label="Available actions"><div class="${dialog?'tt6-dock-decision':'tt6-dock-buttons'}" ${dialog?`data-dock-decision="${escape(dialog.type)}"`:''}>${content}</div></div></section>`;
}
function inventoryPreview(row){
 const [,kind='',color='',symbol='',ability='',number='']=row.key.split(':');
 return renderCard({kind,color,symbol,ability,number,expansion:row.section},{tiny:true});
}
export function renderPileInspector(game,pile){
 if(!['deck','discard','limbo'].includes(pile))return '';
 const inventory=Array.isArray(game.pileInventory)?game.pileInventory:[];
 const titles={deck:'Draw pile',discard:'Discard pile',limbo:'Limbo pile'};
 const sections=[['base','Base game'],['glyphs','Glyphs'],['dreamcatchers','Dreamcatchers'],['towers','Towers'],['premonitions','Happy Dreams'],['crossroads','Crossroads'],['oniverse','Oniverse'],['sphinx','Sphinx / Diver / Confusion']];
 const count=inventory.reduce((n,r)=>n+r[pile],0);
 const body=sections.map(([key,name])=>{const entries=inventory.filter(i=>i.section===key);if(!entries.length)return '';return `<section class="tt6-inventory-group"><h3>${escape(name)}</h3><div class="tt6-inventory-rows">${entries.map(i=>`<div class="tt6-inventory-line" aria-label="${escape(i.label)}: ${i[pile]} of ${i.total}"><span class="tt7-inventory-card">${inventoryPreview(i)}</span><b>${i[pile]}<small>/${i.total}</small></b></div>`).join('')}</div></section>`;}).join('');
 return `<aside class="tt6-pile-inspector" data-pile-inspector role="dialog" aria-modal="false" aria-label="${titles[pile]} contents"><header><strong>${titles[pile]}</strong><span>${count} cards</span><button type="button" class="tt6-pile-close" data-action="closePile" aria-label="Close pile information">×</button></header><div class="tt6-pile-scroll">${body||'<p>Card counts unavailable.</p>'}</div></aside>`;
}
