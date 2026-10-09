import {icon,cardSymbol} from '../icons.js';
/** Temporary decision surfaces. Never invents or applies game commands. */
export const PENDING_DECISIONS = Object.freeze([
  'sphinxName','sphinxResolve','diver','confusion','mirrorReward',
  'doorSearch','door','nightmare','prophecy','happyDream','happyFetch','rally',
  'premonitionPick','premonitionDoor','incantation','towerLook','spellPeek',
  'happyPeek','denizenPeek','catchChoose','catchOverload','towerPenalty','moduleDecision'
]);
export const CONTEXT_DIALOGS = Object.freeze(['mirrorPair','cyclobot','coopDiscard','spellbook']);
const LABELS={
  sphinxName:'Sphinx',sphinxResolve:'Sphinx',diver:'Diver',confusion:'Confusion',
  mirrorReward:'Mirror',doorSearch:'Door search',door:'Door',nightmare:'Nightmare',
  prophecy:'Prophecy',happyDream:'Happy Dream',happyFetch:'Card search',rally:'Denizen',
  premonitionPick:'Dark Premonition',premonitionDoor:'Dark Premonition',
  incantation:'Incantation',towerLook:'Tower inspection',spellPeek:'Spell',
  happyPeek:'Happy Dream',denizenPeek:'Denizen',catchChoose:'Dreamcatcher',
  catchOverload:'Dreamcatcher',towerPenalty:'Tower',moduleDecision:'Effect',
  mirrorPair:'Mirror pair',cyclobot:'Cyclobot',coopDiscard:'Discard',spellbook:'Spellbook'
};
export function decisionDialogKey(game,seat){
  if(game?.status!=='active'||game.phase!=='decision'||seat!==game.active||!game.pending)return null;
  const p=game.pending;
  // The card/effect identity must change when an interruption takes over; restoring
  // the same pending effect after a nested decision must not lose draft selections.
  return `pending:${p.type}:${p.id||p.card?.id||p.mirror||''}`;
}
export function renderGameDialog({type,html,key,mandatory=false}){
  if(!type||!html)return '';
  const label=LABELS[type]||'Card effect';
  // Internal HTML comes only from trusted local renderers; caller escapes card text.
  return `<div class="tt4-overlay" data-tt4-overlay="${mandatory?'required':'optional'}" data-tt4-key="${escapeAttribute(key||type)}">
    <div class="tt4-scrim" aria-hidden="true"></div>
    <div class="tt4-dialog" role="dialog" aria-modal="true" aria-label="${escapeAttribute(label)}" tabindex="-1" data-tt4-dialog>
      <div class="tt4-head"><span class="tt4-label">${escapeAttribute(label)}</span><span class="tt4-game-controls"><button type="button" data-action="openGamePause" class="tt4-game-nav" aria-label="Pause menu" title="Pause">${icon('pause')}</button><button type="button" data-action="openGameRules" class="tt4-game-nav" aria-label="Game rules" title="Rules">${icon('help')}</button></span>${mandatory?'<span class="tt4-required" aria-label="Mandatory decision">●</span>':`<button type="button" class="tt4-close" data-action="dialogClose" aria-label="Close dialog" title="Close">${icon('close')}</button>`}</div>
      <div class="tt4-content">${html}</div>
    </div>
  </div>`;
}
function escapeAttribute(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
/** Called after each render; persistent listener survives innerHTML replacements. */
export function createDialogController({root,onDismiss}){
  let previousKey='',returnFocus=null;
  const dialog=()=>root.querySelector?.('[data-tt4-dialog]');
  const overlay=()=>root.querySelector?.('[data-tt4-overlay]');
  const tabbable=()=>[...(dialog()?.querySelectorAll?.('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')||[])].filter(el=>!el.hidden&&el.getAttribute?.('aria-hidden')!=='true');
  // Capture a stable descriptor BEFORE app.innerHTML replaces the current controls.
  // Remember the exact card/checkbox/field rather than returning focus to <body>.
  const focusKeys=['data-action','data-pick','data-mirror-pair','data-mirror-choice','data-spell-choice','data-tt-card','data-tt-order-handle','id'];
  function describe(el){
    if(!el||!root.contains?.(el))return null;
    const name=focusKeys.find(k=>k==='id'?!!el.id:el.hasAttribute?.(k));
    return name?{name,value:name==='id'?el.id:el.getAttribute(name),modal:!!el.closest?.('[data-tt4-dialog]')}:{modal:!!el.closest?.('[data-tt4-dialog]')};
  }
  function recover(info){
    if(!info?.name)return null;
    return [...(root.querySelectorAll?.('[data-tt4-dialog] button,[data-tt4-dialog] input,[data-tt4-dialog] select,[data-tt4-dialog] textarea,[data-tt-order-handle],[data-action],[data-pick],[id]')||[])].find(el=>(info.name==='id'?el.id:el.getAttribute?.(info.name))===info.value&&(!info.modal||dialog()?.contains?.(el)))||null;
  }
  const capture=()=>describe(typeof document==='undefined'?null:document.activeElement);
  function sync(before){
    const over=overlay(),key=over?.dataset.tt4Key||'';
    for(const node of root.querySelectorAll?.('.nav,.page,.bottom-nav')||[]){if(over)node.setAttribute?.('inert','');else node.removeAttribute?.('inert');}
    if(typeof document!=='undefined')document.documentElement?.classList?.toggle?.('tt4-dialog-open',!!over);
    if(key){
      if(!previousKey&&before&&!before.modal)returnFocus=before;
      // Restore the current selection within a rerendered decision, otherwise put
      // keyboard focus on the first actionable control in the new dialog.
      const restored=key===previousKey&&before?.modal?recover(before):null;
      (restored||tabbable()[0]||dialog())?.focus?.({preventScroll:true});
    }else if(previousKey){
      (recover(returnFocus)||root.querySelector?.('main [data-action],main a,main button,main input')||root.querySelector?.('#main-content'))?.focus?.({preventScroll:true});
      returnFocus=null;
    }
    previousKey=key;
  }
  root.addEventListener?.('keydown',e=>{
    const over=overlay();if(!over)return;
    if(e.key==='Escape'){
      e.preventDefault();if(over.dataset.tt4Overlay==='optional')onDismiss?.();return;
    }
    if(e.key!=='Tab')return;
    const list=tabbable();if(!list.length){e.preventDefault();dialog()?.focus?.();return;}
    const first=list[0],last=list.at(-1);
    if(e.shiftKey&&(document.activeElement===first||!dialog()?.contains?.(document.activeElement))){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&(document.activeElement===last||!dialog()?.contains?.(document.activeElement))){e.preventDefault();first.focus();}
  });
  return {capture,sync};
}
