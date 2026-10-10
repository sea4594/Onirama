import {PENDING_DECISIONS} from './dialogs.js';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
import {renderCard} from './cards.js';
const step={sphinxName:'Sphinx',sphinxResolve:'Sphinx',diver:'Diver',confusion:'Confusion',mirrorReward:'Mirror',doorSearch:'Door',door:'Door!',nightmare:'Nightmare!',prophecy:'Prophecy',happyDream:'Happy Dream!',happyFetch:'Search',rally:'Denizen',premonitionPick:'Premonitions',premonitionDoor:'Lose a Door',incantation:'Incantation',towerLook:'Towers',spellPeek:'Prophecy',happyPeek:'Happy Dream',denizenPeek:'Denizen',catchChoose:'Dreamcatcher',catchOverload:'Free a Dreamcatcher',towerPenalty:'Towers',moduleDecision:'Effect'};
export const DOCK_PENDING_TYPES=PENDING_DECISIONS;
export function actionDockPrompt(game,seat,{selectedId=null,legal=[],prophecyDiscard=null,dialog=null}={}){
 if(game.status==='won')return {title:'Victory',hint:''};
 if(game.status!=='active')return {title:'Game over',hint:''};
 if(game.phase==='draft')return {title:seat===game.active?'Draft':'Partner drafting',hint:''};
 if(game.phase==='refill')return {title:'Draw',hint:''};
 if(game.phase==='decision'){
  if(seat!==game.active)return {title:'Partner resolving',hint:''};
  if(dialog?.type==='spellbook')return {title:'Spellbook',hint:''};
  const type=game.pending?.type||'';
  if(type==='drawReady')return {title:'Draw',hint:''};
  if(type==='drawn')return {title:'Drawn',hint:''};
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
 if(!dialog&&game.status==='active'&&seat===game.active&&game.phase==='decision'&&game.pending?.type==='drawReady')controls=button('Draw','draw');
 // Legacy saves paused mid-draw need a one-time, neutral recovery action.
 if(!dialog&&game.status==='active'&&seat===game.active&&game.pending?.type==='drawn')controls=button('Continue','confirmDraw');
 if(!dialog&&game.phase==='action'&&game.status==='active'&&seat===game.active){
  // Selecting a card only outlines its legal tabletop destinations. No duplicate action buttons.
  if(game.config?.expansions?.includes('crossroads'))controls+=button('Escape','escape');
 }
 if(game.status!=='active')controls=button('New game','setup');
 const content=dialog?.html||controls||'';
 const drawn=seat===game.active&&game.phase==='decision'&&game.pending?.card?`<div class="tt8-drawn-card" aria-label="Drawn card">${renderCard(game.pending.card,{tiny:true})}</div>`:'';
 const required=game.status==='active'&&seat===game.active&&(game.phase==='decision'||game.phase==='draft');
 return `<section class="tt6-workspace ${required?'tt8-required':''}" data-action-dock data-dock-phase="${escape(game.phase)}" aria-label="Game actions"><div class="tt6-dock-status"><strong role="status">${escape(title)}</strong></div><div class="tt6-dock-scroll" role="region" aria-label="Available actions"><div class="${dialog?'tt6-dock-decision':'tt6-dock-buttons'} ${drawn?'tt9-drawn-layout':''}" ${dialog?`data-dock-decision="${escape(dialog.type)}"`:''}>${drawn}${drawn?`<div class="tt9-drawn-actions">${content}</div>`:content}</div></div></section>`;
}
export function renderInventoryTrack(count,total){
 const slots=Math.max(0,Math.min(300,Number(total)||0)),filled=Math.max(0,Math.min(slots,Number(count)||0));
 return `<div class="tt10-count-track" role="img" aria-label="${filled} of ${slots} remaining" style="--tt10-slots:${Math.max(1,slots)}">${Array.from({length:slots},(_,i)=>`<i aria-hidden="true" class="${i<filled?'tt10-count-filled':'tt10-count-empty'}"></i>`).join('')}</div>`;
}
function inventoryPreview(row){
 const [,kind='',color='',symbol='',ability='',number='']=row.key.split(':');
 return renderCard({kind,color,symbol,ability,number,expansion:row.section},{tiny:true});
}
export function renderPileInspector(game,pile,seat=null){
 const catcherMatch=/^catcher:([0-3])$/.exec(pile);
 if(catcherMatch){
  const i=Number(catcherMatch[1]),stack=game.expansion?.dreamcatchers?.stacks?.[i];
  if(!Array.isArray(stack))return '';
  return `<aside class="tt6-pile-inspector" data-pile-inspector role="dialog" aria-modal="false" aria-label="Dreamcatcher ${i+1} contents"><header><strong>Dreamcatcher ${i+1}</strong><span>${stack.length} cards</span><button type="button" class="tt6-pile-close" data-action="closePile" aria-label="Close pile information">×</button></header><div class="tt6-pile-scroll tt9-stack-details">${stack.map(c=>renderCard(c,{tiny:true})).join('')||'<span>Empty</span>'}</div>${seat===game.active&&game.phase==='action'&&stack.length&&game.expansion.dreamcatchers.failsafes>0?`<div class="tt11-catcher-tools"><button type="button" data-action="freeCatcher:${i}">Free Dreamcatcher</button></div>`:''}</aside>`;
 }
 if(!['deck','discard','limbo'].includes(pile))return '';
 const inventory=Array.isArray(game.pileInventory)?game.pileInventory:[];
 const titles={deck:'Draw pile',discard:'Discard pile',limbo:'Limbo pile'};
 const sections=[['base','Base game'],['glyphs','Glyphs'],['dreamcatchers','Dreamcatchers'],['towers','Towers'],['premonitions','Happy Dreams'],['crossroads','Crossroads'],['oniverse','Oniverse'],['sphinx','Sphinx / Diver / Confusion']];
 const count=inventory.reduce((n,r)=>n+r[pile],0);
 const visible=Array.isArray(game[pile])&&pile!=='deck'?`<section class="tt6-inventory-group"><h3>${pile==='discard'?'Recent discards':'Cards in Limbo'}</h3><div class="${pile==='discard'?'tt8-discard-history':'tt9-stack-details'}" ${pile==='discard'?'tabindex="0" role="region" aria-label="Recent discards, newest first"':''}>${(pile==='discard'?[...game[pile]].reverse():game[pile]).map((c,i)=>pile==='discard'?`<span class="tt8-discard-item" style="z-index:${game[pile].length-i}">${renderCard(c,{tiny:true})}</span>`:renderCard(c,{tiny:true})).join('')||'<span>Empty</span>'}</div></section>`:'';
 const body=pile==='limbo'?visible:visible+sections.map(([key,name])=>{const entries=inventory.filter(i=>i.section===key);if(!entries.length)return '';return `<section class="tt6-inventory-group"><h3>${escape(name)}</h3><div class="tt6-inventory-rows">${entries.map(i=>`<div class="tt6-inventory-line ${i[pile]===0?'tt9-empty-count':''}" aria-label="${escape(i.label)}: ${i[pile]} of ${i.total}"><span class="tt7-inventory-card">${inventoryPreview(i)}</span>${renderInventoryTrack(i[pile],i.total)}</div>`).join('')}</div></section>`;}).join('');
 return `<aside class="tt6-pile-inspector" data-pile-inspector role="dialog" aria-modal="false" aria-label="${titles[pile]} contents"><header><strong>${titles[pile]}</strong><span>${count} cards</span><button type="button" class="tt6-pile-close" data-action="closePile" aria-label="Close pile information">×</button></header><div class="tt6-pile-scroll">${body||'<p>Card counts unavailable.</p>'}</div></aside>`;
}
