/* Phase 3 interaction controller. UI-only: never mutates engine state.
 * Pointer drops and keyboard/tap actions all dispatch the same validated command.
 */
export function soloLegalTargets(g, cardId, seat=0){
  if(!g||g.mode!=='solo'||g.status!=='active'||g.phase!=='action'||seat!==g.active)return [];
  const available=[...(g.players?.[0]?.hand||[]),...(g.expansion?.oniverse?.treasure||[])];
  const c=available.find(card=>card.id===cardId);
  if(!c||c.kind==='deadEnd')return [];
  if(c.kind==='tower'){
    const alignment=g.expansion?.towers?.alignment||[];
    const intersects=(a,b)=>{const split=v=>Array.isArray(v)?v:typeof v==='string'?v.split(/[+|,/ ]+/).filter(Boolean):[];return split(a).some(s=>split(b).includes(s));};
    return [...(!alignment.length||!intersects(c.right,alignment[0].left)?['towerLeft']:[]),...(!alignment.length||!intersects(alignment.at(-1).right,c.left)?['towerRight']:[]),'discard'];
  }
  if(c.kind!=='location')return [];
  const previous=g.players[0].labyrinth?.at(-1);
  return [...(previous?.symbol!==c.symbol?['play']:[]),'discard'];
}

export function targetState(g, cardId, seat=0){
  const legal=soloLegalTargets(g,cardId,seat);
  return {play:legal.includes('play'),discard:legal.includes('discard')};
}
const DRAG_THRESHOLD=8;
export function createTabletopInteractions({root, getGame, getSeat=()=>0, isBusy=()=>false, onSelect, onCommand, onInspect=()=>{}}){
  let pointer=null, ghost=null, currentDrop=null, suppressClick=false;
  const $=selector=>root.querySelector(selector);
  const board=()=>$('.tt2-root[data-tabletop-solo="true"]');
  const selected=()=>board()?.dataset.selectedCard||'';
  const legal=id=>isBusy()?[]:soloLegalTargets(getGame(),id,getSeat());
  function syncTargets(id=selected()){
    const b=board();if(!b)return;
    const targets=legal(id);
    for(const el of b.querySelectorAll('[data-tt-drop]')){
      const allowed=targets.includes(el.dataset.ttDrop);
      el.classList.toggle('tt3-target-ready',allowed);
      if(el.matches('button'))el.disabled=!allowed;
      el.setAttribute('data-tt-legal',String(allowed));
    }
    for(const card of b.querySelectorAll('[data-tt-card]')){
      card.setAttribute('aria-grabbed',String(card.dataset.ttCard===id&&!!id));
    }
  }
  function clearDrag(){
    ghost?.remove();ghost=null;
    currentDrop?.classList.remove('tt3-drop-hover');currentDrop=null;
    if(pointer?.card)pointer.card.classList.remove('tt3-drag-source');
    pointer=null;syncTargets();
  }
  function hitTarget(x,y,id){
    const raw=document.elementFromPoint(x,y)?.closest?.('[data-tt-drop]');
    if(!raw||!board()?.contains(raw)||!legal(id).includes(raw.dataset.ttDrop))return null;
    return raw;
  }
  function dispatch(target,id){
    if(!legal(id).includes(target))return false;
    onCommand(target,id);
    return true;
  }
  function move(e){
    if(!pointer||e.pointerId!==pointer.id)return;
    const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;
    if(!pointer.dragging&&Math.hypot(dx,dy)<DRAG_THRESHOLD)return;
    if(!pointer.dragging){
      pointer.dragging=true;
      pointer.card.classList.add('tt3-drag-source');
      const clone=pointer.card.cloneNode(true);
      clone.removeAttribute('id');clone.removeAttribute('data-pick');clone.removeAttribute('data-tt-card');
      clone.classList.add('tt3-ghost');clone.setAttribute('aria-hidden','true');clone.tabIndex=-1;
      const bounds=pointer.card.getBoundingClientRect();clone.style.width=`${bounds.width}px`;clone.style.height=`${bounds.height}px`;
      document.body.appendChild(clone);ghost=clone;syncTargets(pointer.cardId);
    }
    e.preventDefault();
    ghost.style.left=`${e.clientX-pointer.offsetX}px`;ghost.style.top=`${e.clientY-pointer.offsetY}px`;
    const next=hitTarget(e.clientX,e.clientY,pointer.cardId);
    if(currentDrop!==next){currentDrop?.classList.remove('tt3-drop-hover');currentDrop=next;currentDrop?.classList.add('tt3-drop-hover');}
  }
  function release(e){
    if(!pointer||e.pointerId!==pointer.id)return;
    const {cardId,dragging}=pointer;
    const drop=dragging?hitTarget(e.clientX,e.clientY,cardId):null;
    if(dragging){
      // Browsers synthesize click after pointerup. Suppress it so a completed
      // drag cannot accidentally select a different card or run an action twice.
      suppressClick=true;setTimeout(()=>{suppressClick=false;},0);
    }
    clearDrag();
    if(drop){dispatch(drop.dataset.ttDrop,cardId);return;}
    if(dragging)onSelect(cardId);
  }
  function onPointerDown(e){
    if(e.button!==0&&e.pointerType==='mouse')return;
    const c=e.target.closest?.('[data-tt-card]');
    if(!c||!board()?.contains(c)||!legal(c.dataset.ttCard).length)return;
    const bounds=c.getBoundingClientRect();
    pointer={id:e.pointerId,card:c,cardId:c.dataset.ttCard,x:e.clientX,y:e.clientY,offsetX:e.clientX-bounds.left,offsetY:e.clientY-bounds.top,dragging:false};
  }
  function onClick(e){
    if(suppressClick){e.preventDefault();e.stopImmediatePropagation();suppressClick=false;return;}
    const t=e.target.closest?.('[data-tt-drop]');
    if(t&&board()?.contains(t)){
      // A click on a zone invokes the action only when there is a selected card;
      // the corresponding keyboard-focusable button uses the same route.
      if(dispatch(t.dataset.ttDrop,selected())){e.preventDefault();e.stopImmediatePropagation();}
      return;
    }
    const inspect=e.target.closest?.('[data-tt-inspect]');
    if(inspect&&board()?.contains(inspect))onInspect(inspect.dataset.ttInspect);
  }
  function onKey(e){
    const b=board();if(!b||!b.contains(e.target))return;
    if(e.key==='Escape'){
      if(pointer)clearDrag();
      if(selected()){onSelect(selected());e.preventDefault();}
      return;
    }
    // Cards remain native buttons. Arrow keys let keyboard-only players choose
    // adjacent hand cards without requiring repeated Tab presses.
    const card=e.target.closest?.('[data-tt-card]');
    if(card&&(e.key==='ArrowRight'||e.key==='ArrowLeft')){
      const cards=[...b.querySelectorAll('[data-tt-card]')];let idx=cards.indexOf(card);
      idx=Math.max(0,Math.min(cards.length-1,idx+(e.key==='ArrowRight'?1:-1)));
      cards[idx]?.focus();e.preventDefault();return;
    }
    if((e.key==='p'||e.key==='P'||e.key==='d'||e.key==='D')&&!e.altKey&&!e.ctrlKey&&!e.metaKey){
      if(e.target.matches('input,textarea,select'))return;
      if(dispatch(e.key.toLowerCase()==='p'?'play':'discard',selected()))e.preventDefault();
    }
  }
  function onCancel(){if(pointer)clearDrag();}
  root.addEventListener('pointerdown',onPointerDown);
  window.addEventListener('pointermove',move,{passive:false});
  window.addEventListener('pointerup',release);
  window.addEventListener('pointercancel',onCancel);
  window.addEventListener('blur',onCancel);
  root.addEventListener('click',onClick,true);
  root.addEventListener('keydown',onKey);
  return {syncTargets,dispose(){clearDrag();root.removeEventListener('pointerdown',onPointerDown);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',release);window.removeEventListener('pointercancel',onCancel);window.removeEventListener('blur',onCancel);root.removeEventListener('click',onClick,true);root.removeEventListener('keydown',onKey);}};
}

/** Pure visual reordering: moves a card in front of the card it was dropped on.
 * The confirmation action still sends the ordered card IDs through the engine. */
export function moveOrderedCard(ids,from,to){
  if(!Array.isArray(ids)||!ids.includes(from)||!ids.includes(to)||from===to)return ids;
  const next=[...ids];next.splice(next.indexOf(from),1);next.splice(next.indexOf(to),0,from);
  return next;
}
export function createDecisionReorder({root,canReorder,onReorder}){
  let press=null,ghost=null,hover=null,suppress=false;
  function clear(){
    ghost?.remove();ghost=null;hover?.classList.remove('tt3-order-hover');hover=null;
    press?.item?.classList.remove('tt3-order-dragging');press=null;
  }
  const targetAt=(x,y,kind)=>{
    const item=document.elementFromPoint(x,y)?.closest?.('[data-tt-order-id]');
    return item?.closest?.('[data-tt-order-group]')?.dataset.ttOrderGroup===kind?item:null;
  };
  function down(e){
    if(e.button!==0&&e.pointerType==='mouse')return;
    const grip=e.target.closest?.('[data-tt-order-handle]');
    const item=grip?.closest?.('[data-tt-order-id]');const list=item?.closest?.('[data-tt-order-group]');
    if(!item||!list||!canReorder(list.dataset.ttOrderGroup))return;
    const rect=grip.getBoundingClientRect();press={pointerId:e.pointerId,id:item.dataset.ttOrderId,kind:list.dataset.ttOrderGroup,item,grip,x:e.clientX,y:e.clientY,offsetX:e.clientX-rect.left,offsetY:e.clientY-rect.top,dragging:false};
  }
  function move(e){
    if(!press||e.pointerId!==press.pointerId)return;
    if(!press.dragging&&Math.hypot(e.clientX-press.x,e.clientY-press.y)<DRAG_THRESHOLD)return;
    if(!press.dragging){
      press.dragging=true;press.item.classList.add('tt3-order-dragging');
      const card=press.grip.cloneNode(true),rect=press.grip.getBoundingClientRect();
      card.classList.add('tt3-order-ghost');card.style.width=`${rect.width}px`;card.style.height=`${rect.height}px`;
      card.setAttribute('aria-hidden','true');document.body.appendChild(card);ghost=card;
    }
    e.preventDefault();ghost.style.left=`${e.clientX-press.offsetX}px`;ghost.style.top=`${e.clientY-press.offsetY}px`;
    const next=targetAt(e.clientX,e.clientY,press.kind);
    if(hover!==next){hover?.classList.remove('tt3-order-hover');hover=next;hover?.classList.add('tt3-order-hover');}
  }
  function up(e){
    if(!press||e.pointerId!==press.pointerId)return;
    const {dragging,id,kind}=press,target=dragging?targetAt(e.clientX,e.clientY,kind):null;
    if(dragging){suppress=true;setTimeout(()=>suppress=false,0);}
    clear();if(target&&target.dataset.ttOrderId!==id)onReorder(kind,id,target.dataset.ttOrderId);
  }
  function click(e){if(suppress&&e.target.closest?.('[data-tt-order-group]')){suppress=false;e.preventDefault();e.stopImmediatePropagation();}}
  root.addEventListener('pointerdown',down);window.addEventListener('pointermove',move,{passive:false});
  window.addEventListener('pointerup',up);window.addEventListener('pointercancel',clear);window.addEventListener('blur',clear);
  root.addEventListener('click',click,true);
  return {dispose(){clear();root.removeEventListener('pointerdown',down);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',clear);window.removeEventListener('blur',clear);root.removeEventListener('click',click,true);}};
}
