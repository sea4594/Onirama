import {PENDING_DECISIONS} from './dialogs.js';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
import {renderCard} from './cards.js';
import {icon} from '../icons.js';
import {premonitionFace} from './expansions.js';
// The dock title describes the CURRENT PLAYER ACTION, not merely the card/effect name.
// Keep headings short: the controls and card inspector provide the full rules text.
const decisionTitles={
 sphinxName:'Sphinx: name an aspect',
 sphinxResolve:'Sphinx: arrange revealed cards',
 diver:'Diver: reveal or stop',
 confusion:'Confusion: reorder your hand',
 doorSearch:'Retrieve a Door',
 door:'Drawn Door: use a Key?',
 nightmare:'Nightmare: choose a penalty',
 prophecy:'Prophecy: choose a discard',
 happyDream:'Happy Dream: choose an effect',
 happyFetch:'Happy Dream: choose a card',
 rally:'Rally a Denizen: choose a card',
 premonitionPick:'Choose a Dark Premonition',
 premonitionDoor:'Dark Premonition: remove a Door',
 premonitionKeys:'Dark Premonition: discard Keys',
 premonitionNightmare:'Dark Premonition: return a Nightmare',
 incantation:'Incantation: arrange cards',
 incantationOrder:'Incantation: arrange remaining cards',
 towerLook:'Tower: arrange revealed cards',
 spellPeek:'Paradoxical Prophecy: choose a card',
 happyPeek:'Happy Dream: discard and arrange',
 denizenPeek:'Reorder revealed cards',
 catchChoose:'Catch the Limbo cards',
 catchOverload:'Overload!',
 towerPenalty:'Choose a Tower',
 moduleDecision:'Choose an effect',
 coopSwap:'Swap cards or pass',
 drawReady:'Draw a card',
 drawn:'Continue drawing'
};
export const DOCK_PENDING_TYPES=PENDING_DECISIONS;
export function actionDockPrompt(game,seat,{selectedId=null,legal=[],prophecyDiscard=null,dialog=null,failsafeChoosing=false,nightChoice=null,happyBanishMode=false,doorSearchChromatic=false}={}){
 if(game.status==='won')return {title:'You escaped the dream!',hint:''};
 if(game.status!=='active')return {title:'Game over',hint:''};
 if(dialog?.freeing&&seat===game.active)return {title:'Free a dreamcatcher?',hint:''};
 if(game.phase==='turnComplete'&&seat!==game.active)return {title:'Waiting for partner',hint:''};
 if(game.phase==='draft')return {title:seat===game.active?'Draft a card':'Partner drafting',hint:''};
 if(game.phase==='refill')return {title:seat===game.active?'Draw a card':'Partner drawing',hint:''};
 if(seat!==game.active)return {title:'Waiting for partner',hint:''};
 // Optional and interrupting actions take precedence over the suspended decision.
 if(dialog?.title)return {title:dialog.title,hint:''};
 if(dialog?.type==='spellbook')return {title:'Book of Steps: cast a spell',hint:''};
 if(dialog?.type==='denizen')return {title:'Use a Denizen?',hint:''};
 if(dialog?.type==='mirrorPair')return {title:'Mirror: choose two cards',hint:''};
 if(dialog?.type==='cyclobot')return {title:'Cyclobot: choose a Location',hint:''};
 if(game.phase==='turnComplete')return {title:'End your turn',hint:''};
 if(game.phase==='decision'){
  const p=game.pending||{},type=p.type||'';
  if(type==='nightmare'&&nightChoice==='key')return {title:'Nightmare: discard a Key',hint:''};
  if(type==='nightmare'&&nightChoice==='door')return {title:'Nightmare: remove a Door',hint:''};
  if(type==='prophecy'&&prophecyDiscard)return {title:'Prophecy: arrange remaining cards',hint:''};
  if(type==='doorSearch'&&doorSearchChromatic)return {title:'Chromatic Chaos: choose a Door',hint:''};
  if(type==='happyDream'&&happyBanishMode)return {title:'Happy Dream: remove a Premonition',hint:''};
  if(type==='incantation'&&p.cards?.some(c=>c.kind==='door'))return {title:'Incantation: choose a Door',hint:''};
  if(type==='diver'&&p.cards?.at(-1)?.kind==='nightmare')return {title:'Diver: resolve a Nightmare',hint:''};
  if(type==='sphinxResolve'&&p.aspect&&Array.isArray(p.cards)){
   const matched=p.cards.some(c=>['red','blue','green','brown'].includes(p.aspect)?c.color===p.aspect||c.color==='wild':c.symbol===p.aspect);
   return {title:matched?'Sphinx: choose a top card':'Sphinx: return cards to bottom',hint:''};
  }
  if(type==='denizenPeek')return {title:p.place==='bottom'?'Harpoon Hunter: arrange cards':'Squirrel Spies: arrange cards',hint:''};
  if(type==='premonitionKeys'&&Number.isInteger(p.count))return {title:`Dark Premonition: discard ${p.count} ${p.count===1?'Key':'Keys'}`,hint:''};
  if(type==='mirrorReward'){
   const mirror=String(p.mirror||'').toLowerCase();
   const action=['brown','glyph','key'].includes(mirror)?'choose Doors':'choose cards';
   const label=mirror?`${mirror[0].toUpperCase()}${mirror.slice(1)} Mirror`:'Mirror';
   return {title:`${label}: ${action}`,hint:''};
  }
  return {title:decisionTitles[type]||'Choose an action',hint:''};
 }
 if(failsafeChoosing)return {title:'Failsafe: choose a Dreamcatcher',hint:''};
 return {title:'Play or discard',hint:''};
}
const button=(label,action)=>`<button type="button" data-action="${escape(action)}" class="tt6-dock-button">${escape(label)}</button>`;
export function renderActionDock(game,seat,{selectedId=null,legal=[],dialog=null,prophecyDiscard=null,failsafeChoosing=false,nightChoice=null,happyBanishMode=false,doorSearchChromatic=false}={}){
 const {title}=actionDockPrompt(game,seat,{selectedId,legal,prophecyDiscard,dialog,failsafeChoosing,nightChoice,happyBanishMode,doorSearchChromatic});
 let controls='';
 if(game.phase==='draft'&&game.status==='active'){controls=`<div class="tt28-draft-cards" style="--tt28-per-card:${(100/Math.max(1,game.draft?.length||0)).toFixed(5)}cqw" aria-label="Draft cards">${(game.draft||[]).map(c=>renderCard(c,{select:seat===game.active})).join('')}</div>`;}
 if(game.phase==='turnComplete'&&game.status==='active'&&seat===game.active)controls=button('End turn','endTurn');
 if(game.phase==='decision'&&game.pending?.type==='coopSwap'&&seat===game.active)controls=button('Pass','swapPass');
 if(!dialog&&game.status==='active'&&seat===game.active&&game.phase==='decision'&&game.pending?.type==='drawReady')controls=button('Draw','draw');
 // Legacy saves paused mid-draw need a one-time, neutral recovery action.
 if(!dialog&&game.status==='active'&&seat===game.active&&game.pending?.type==='drawn')controls=button('Continue','confirmDraw');
 if(!dialog&&game.phase==='action'&&game.status==='active'&&seat===game.active){
  const d=game.expansion?.dreamcatchers,active=d?.active||[],occupied=active.map((yes,i)=>yes&&d.stacks?.[i]?.length>0?i:-1).filter(i=>i>=0);
  if(failsafeChoosing&&d?.failsafes>0&&occupied.length){controls=`<span class="tt23-failsafe-hint">Tap an outlined Dreamcatcher to free it.</span>${button('Cancel','failsafeCancel')}`;}
  else {
   if(d?.failsafes>0){
    const urgent=active.some(Boolean)&&active.every((yes,i)=>!yes||d.stacks?.[i]?.length>0);
    controls+=`<button type="button" data-action="failsafeStart" class="tt6-dock-button tt23-failsafe-button ${urgent?'tt23-failsafe-urgent':''}" ${occupied.length?'':'disabled'}>Use Failsafe</button>`;
   }
   // Selecting a card only outlines its legal tabletop destinations.
   if(game.config?.expansions?.includes('crossroads'))controls+=button('Escape','escape');
  }
 }
 if(game.status!=='active')controls=button('Exit','exitFinished')+button('Play again','playAgain');
 const content=dialog?.html||controls||'';
 const menu=`<button type="button" class="game-menu-trigger tt27-dock-menu" data-action="openGamePause" aria-label="Pause menu" title="Pause menu">${icon('pause')}</button>`;
 const drawn=seat===game.active&&game.phase==='decision'&&game.pending?.card&&game.pending.type!=='door'?`<div class="tt8-drawn-card" aria-label="Drawn card">${renderCard(game.pending.card,{tiny:true})}</div>`:'';
 const required=game.status==='active'&&seat===game.active&&(game.phase==='decision'||game.phase==='draft');
 return `<section class="tt6-workspace ${required?'tt8-required':''}" data-action-dock data-dock-phase="${escape(game.phase)}" aria-label="Game actions"><div class="tt6-dock-status"><strong role="status">${escape(title)}</strong>${menu}</div><div class="tt6-dock-scroll" role="region" aria-label="Available actions"><div class="${dialog?'tt6-dock-decision':'tt6-dock-buttons'} ${drawn?'tt9-drawn-layout':''}" ${dialog?`data-dock-decision="${escape(dialog.type)}"`:''}>${drawn}${drawn?`<div class="tt9-drawn-actions">${content}</div>`:content}</div></div></section>`;
}
export function renderInventoryTrack(count,total){
 const totalCards=Math.max(0,Number(total)||0),remaining=Math.max(0,Math.min(totalCards,Number(count)||0));
 const slots=Math.min(48,Math.ceil(totalCards)),filled=slots?Math.round(slots*remaining/Math.max(1,totalCards)):0;
 return `<div class="tt10-count-track" role="img" aria-label="${remaining} of ${totalCards} remaining" style="--tt10-slots:${Math.max(1,slots)}">${Array.from({length:slots},(_,i)=>`<i aria-hidden="true" class="${i<filled?'tt10-count-filled':'tt10-count-empty'}"></i>`).join('')}</div>`;
}
function inventoryPreview(row){
 const [,kind='',color='',symbol='',ability='',number='']=row.key.split(':');
 return renderCard({kind,color,symbol,ability,number,expansion:row.section},{tiny:true});
}
export function renderPileInspector(game,pile,seat=null){
 if(pile==='reserve'&&game.expansion?.premonitions){
  const p=game.expansion.premonitions;
  const descriptions={red2:'2 red Doors: discard red Locations',green2:'2 green Doors: return a Nightmare',blue2:'2 blue Doors: discard two Keys',brown2:'2 brown Doors: lose a Door',pair2:'2 matching Doors: lose one',doors5:'5 Doors: reveal two Premonitions',rainbow4:'4 colors: discard Happy Dreams',doors3:'3 Doors: redraw your hand'};
  return `<aside class="tt6-pile-inspector" data-pile-inspector role="dialog" aria-modal="false" aria-label="Reserve Premonitions"><header><strong>Reserve Premonitions</strong><span>${p.reserveCount} cards</span><button type="button" class="tt6-pile-close" data-action="closePile" aria-label="Close pile information">×</button></header><div class="tt6-pile-scroll"><p class="tt14-reserve-note">These are the Premonitions waiting in reserve.</p><div class="tt14-reserve-list">${(p.reserve||[]).map(id=>`<div class="tt14-reserve-item"><span class="tt5-tile tt5-premonition"><span class="tt5-pm-face">${premonitionFace(id)}</span></span><span>${escape(descriptions[id]||id)}</span></div>`).join('')||'<span>Reserve empty</span>'}</div></div></aside>`;
 }
 const catcherMatch=/^catcher:([0-3])$/.exec(pile);
 if(catcherMatch){
  const i=Number(catcherMatch[1]),stack=game.expansion?.dreamcatchers?.stacks?.[i];
  if(!Array.isArray(stack))return '';
  return `<aside class="tt6-pile-inspector" data-pile-inspector role="dialog" aria-modal="false" aria-label="Dreamcatcher ${i+1} contents"><header><strong>Dreamcatcher ${i+1}</strong><span>${stack.length} cards</span><button type="button" class="tt6-pile-close" data-action="closePile" aria-label="Close pile information">×</button></header><div class="tt6-pile-scroll tt9-stack-details">${stack.map(c=>renderCard(c,{tiny:true,focusable:true})).join('')||'<span>Empty</span>'}</div>${seat===game.active&&game.phase==='action'&&stack.length&&game.expansion.dreamcatchers.failsafes>0?`<div class="tt11-catcher-tools"><button type="button" data-action="freeCatcher:${i}">Free Dreamcatcher</button></div>`:''}</aside>`;
 }
 if(!['deck','discard','limbo'].includes(pile))return '';
 const inventory=Array.isArray(game.pileInventory)?game.pileInventory:[];
 const titles={deck:'Draw pile',discard:'Discard pile',limbo:'Limbo pile'};
 const sections=[['base','Base game'],['glyphs','Glyphs'],['dreamcatchers','Dreamcatchers'],['towers','Towers'],['premonitions','Happy Dreams'],['crossroads','Crossroads'],['oniverse','Oniverse'],['sphinx','Sphinx / Diver / Confusion']];
 const removed=pile==='discard'?(game.expansion?.book?.removed||[]):[];
 const count=inventory.reduce((n,r)=>n+r[pile],0);
 const visible=Array.isArray(game[pile])&&pile!=='deck'?`<section class="tt6-inventory-group"><h3>${pile==='discard'?'Recent discards':'Cards in Limbo'}</h3><div class="${pile==='discard'?'tt8-discard-history':'tt9-stack-details'}" ${pile==='discard'?'tabindex="0" role="region" aria-label="Discard history, oldest first, newest at right"':''}>${game[pile].map((c,i)=>pile==='discard'?`<span class="tt8-discard-item" style="z-index:${i+1}">${renderCard(c,{tiny:true})}</span>`:renderCard(c,{tiny:true})).join('')||'<span>Empty</span>'}</div></section>`:'';
 const removedSection=removed.length?`<section class="tt6-inventory-group tt-removed-group"><h3>Removed from the game · ${removed.length}</h3><p>These cards paid for Book of Steps spells and cannot be drawn again.</p><div class="tt9-stack-details">${removed.map(c=>renderCard(c,{tiny:true})).join('')}</div></section>`:'';
 const body=pile==='limbo'?visible:visible+removedSection+sections.map(([key,name])=>{const entries=inventory.filter(i=>i.section===key);if(!entries.length)return '';return `<section class="tt6-inventory-group"><h3>${escape(name)}</h3><div class="tt6-inventory-rows" data-inventory-section="${escape(key)}">${entries.map(i=>`<div class="tt6-inventory-line ${i[pile]===0?'tt9-empty-count':''}" aria-label="${escape(i.label)}: ${i[pile]} of ${i.total}"><span class="tt7-inventory-card">${inventoryPreview(i)}</span>${renderInventoryTrack(i[pile],i.total)}</div>`).join('')}</div></section>`;}).join('');
 return `<aside class="tt6-pile-inspector" data-pile-inspector role="dialog" aria-modal="false" aria-label="${titles[pile]} contents"><header><strong>${titles[pile]}</strong><span>${count} cards</span><button type="button" class="tt6-pile-close" data-action="closePile" aria-label="Close pile information">×</button></header><div class="tt6-pile-scroll">${body||'<p>Card counts unavailable.</p>'}</div></aside>`;
}
