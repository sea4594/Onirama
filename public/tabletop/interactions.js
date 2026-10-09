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

// Same commands as solo, but only this seat's personal cards and the shared
// resources are eligible. The other player's private card IDs are never targets.
export function cooperativeLegalTargets(g,cardId,seat=0){
  if(!g||g.mode!=='coop'||g.status!=='active'||g.phase!=='action'||seat!==g.active||![0,1].includes(seat))return [];
  const available=[...(g.players?.[seat]?.hand||[]),...(g.shared||[])];
  const c=available.find(card=>card.id===cardId);
  if(!c||c.kind==='hidden'||c.kind==='deadEnd')return [];
  if(c.kind==='tower'){
    const alignment=g.expansion?.towers?.alignment||[];
    const marks=v=>String(v||'').split('+').filter(Boolean);
    const overlaps=(a,b)=>marks(a).some(x=>marks(b).includes(x));
    return [...(!alignment.length||!overlaps(c.right,alignment[0].left)?['towerLeft']:[]),...(!alignment.length||!overlaps(alignment.at(-1).right,c.left)?['towerRight']:[]),'discard'];
  }
  if(c.kind!=='location')return [];
  return [...(g.players[seat].labyrinth?.at(-1)?.symbol!==c.symbol?['play']:[]),'discard'];
}
export const tabletopLegalTargets=(g,id,seat=0)=>g?.mode==='coop'?cooperativeLegalTargets(g,id,seat):soloLegalTargets(g,id,seat);

export function targetState(g, cardId, seat=0){
  const legal=soloLegalTargets(g,cardId,seat);
  return {play:legal.includes('play'),discard:legal.includes('discard')};
}
const DRAG_THRESHOLD=8;
export function createTabletopInteractions({root, getGame, getSeat=()=>0, isBusy=()=>false, onSelect, onCommand, onInspect=()=>{}}){
  let pointer=null, ghost=null, currentDrop=null, suppressClick=false;
  const $=selector=>root.querySelector(selector);
  const board=()=>$('.tt2-root[data-tabletop-solo="true"],.tt6-root[data-tabletop-coop="true"]');
  const selected=()=>board()?.dataset.selectedCard||'';
  const legal=id=>isBusy()?[]:tabletopLegalTargets(getGame(),id,getSeat());
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
    // Pile-inspection buttons live inside discard drop targets; inspection must never discard.
    if(e.target.closest?.('[data-action^="inspectPile:"]'))return;
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

/** Reordering uses a GAP index (0..length), not the card under the cursor. */
export function moveOrderedCardToGap(ids,from,gap){
  if(!Array.isArray(ids)||!ids.includes(from)||!Number.isInteger(gap)||gap<0||gap>ids.length)return ids;
  const old=ids.indexOf(from),next=[...ids];next.splice(old,1);
  next.splice(gap>old?gap-1:gap,0,from);
  return next;
}
// Retained for compatibility with existing third-party/older UI fixtures.
export function moveOrderedCard(ids,from,to){
  if(!Array.isArray(ids)||!ids.includes(from)||!ids.includes(to)||from===to)return ids;
  return moveOrderedCardToGap(ids,from,ids.indexOf(to));
}
export function gapAtX(list,x){
  if(!list)return null;
  const items=[...list.querySelectorAll(':scope > [data-tt-order-id]')];
  if(!items.length)return null;
  const at=items.findIndex(item=>x<item.getBoundingClientRect().left+item.getBoundingClientRect().width/2);
  return at===-1?items.length:at;
}
export function gapAtPoint(list,x,y){
 const items=[...(list?.querySelectorAll?.(':scope > [data-tt-order-id]')||[])];
 if(!items.length)return null;
 const rows=[];
 for(let i=0;i<items.length;i++){
  const box=items[i].getBoundingClientRect(),row=rows.find(row=>Math.abs(row.top-box.top)<box.height*.45);
  if(row)row.cards.push({index:i,box});else rows.push({top:box.top,bottom:box.bottom,cards:[{index:i,box}]});
 }
 const row=rows.reduce((best,row)=>Math.abs(y-(row.top+row.bottom)/2)<Math.abs(y-(best.top+best.bottom)/2)?row:best,rows[0]);
 for(const c of row.cards)if(x<c.box.left+c.box.width/2)return c.index;
 return row.cards.at(-1).index+1;
}
export function createDecisionReorder({root,canReorder,onReorder,onDiscard=()=>{}}){
  let press=null,ghost=null,highlight=null,tap=null,suppress=false;
  const group=kind=>[...root.querySelectorAll('[data-tt-order-group]')].find(l=>l.dataset.ttOrderGroup===kind);
  function eraseLine(){highlight?.classList.remove('tt5-insert-before','tt5-insert-after');highlight=null;}
  function clear(){ghost?.remove();ghost=null;eraseLine();press?.item?.classList.remove('tt3-order-dragging');press=null;}
  function cancelTap(){root.querySelectorAll('.tt5-order-selected,.tt5-order-picking').forEach(el=>el.classList.remove('tt5-order-selected','tt5-order-picking'));tap=null;}
  function markGap(list,gap){
    eraseLine();const items=[...list.querySelectorAll(':scope > [data-tt-order-id]')];
    highlight=gap===items.length?items.at(-1):items[gap];
    highlight?.classList.add(gap===items.length?'tt5-insert-after':'tt5-insert-before');
  }
  function dragGap(x,y){
    const list=group(press.kind);if(!list)return null;
    const rect=list.getBoundingClientRect();if(y<rect.top-45||y>rect.bottom+45||x<rect.left-42||x>rect.right+42)return null;
    if(x<rect.left+30)list.scrollLeft-=11;
    if(x>rect.right-30)list.scrollLeft+=11;
    return {list,index:gapAtPoint(list,x,y)};
  }
  function down(e){
    if(e.button!==0&&e.pointerType==='mouse')return;
    const grip=e.target.closest?.('[data-tt-order-handle]');
    const item=grip?.closest?.('[data-tt-order-id]'),list=item?.closest?.('[data-tt-order-group]');
    if(!item||!list||!canReorder(list.dataset.ttOrderGroup))return;
    const rect=grip.getBoundingClientRect();
    press={pointerId:e.pointerId,id:item.dataset.ttOrderId,kind:list.dataset.ttOrderGroup,item,grip,x:e.clientX,y:e.clientY,offsetX:e.clientX-rect.left,offsetY:e.clientY-rect.top,dragging:false};
  }
  function move(e){
    if(!press||e.pointerId!==press.pointerId)return;
    if(!press.dragging&&Math.hypot(e.clientX-press.x,e.clientY-press.y)<DRAG_THRESHOLD)return;
    if(!press.dragging){
      cancelTap();press.dragging=true;press.item.classList.add('tt3-order-dragging');
      const card=press.grip.cloneNode(true),rect=press.grip.getBoundingClientRect();
      card.classList.add('tt3-order-ghost');card.style.width=`${rect.width}px`;card.style.height=`${rect.height}px`;
      card.setAttribute('aria-hidden','true');document.body.appendChild(card);ghost=card;
    }
    e.preventDefault();ghost.style.left=`${e.clientX-press.offsetX}px`;ghost.style.top=`${e.clientY-press.offsetY}px`;
    const target=dragGap(e.clientX,e.clientY);if(target)markGap(target.list,target.index);else eraseLine();
  }
  function up(e){
    if(!press||e.pointerId!==press.pointerId)return;
    const {dragging,id}=press,target=dragging?dragGap(e.clientX,e.clientY):null;
    const slot=press.kind==='prophecy'?root.querySelector('[data-tt-prophecy-discard]'):null;
    const box=slot?.getBoundingClientRect();const discarded=dragging&&box&&e.clientX>=box.left-10&&e.clientX<=box.right+10&&e.clientY>=box.top-10&&e.clientY<=box.bottom+10;
    if(dragging){suppress=true;setTimeout(()=>suppress=false,0);}
    clear();if(discarded){onDiscard(id);return;}if(target&&target.index!==null)onReorder(target.list.dataset.ttOrderGroup,id,target.index);
  }
  function activate(item){
    const list=item?.closest('[data-tt-order-group]');if(!list||!canReorder(list.dataset.ttOrderGroup))return;
    const id=item.dataset.ttOrderId,kind=list.dataset.ttOrderGroup;
    if(tap?.kind===kind&&tap.id!==id){const from=tap.id,index=[...list.querySelectorAll(':scope > [data-tt-order-id]')].indexOf(item);cancelTap();onReorder(kind,from,index);return;}
    if(tap?.kind===kind&&tap.id===id){cancelTap();return;}
    cancelTap();tap={id,kind};item.classList.add('tt5-order-selected');list.classList.add('tt5-order-picking');
  }
  function click(e){
    if(suppress&&e.target.closest?.('[data-tt-order-group]')){suppress=false;e.preventDefault();e.stopImmediatePropagation();return;}
    const slot=e.target.closest?.('[data-tt-prophecy-discard]');
    if(slot&&tap?.kind==='prophecy'){const id=tap.id;cancelTap();onDiscard(id);e.preventDefault();return;}
    const end=e.target.closest?.('[data-tt-order-end]');
    if(end&&tap&&tap.kind===end.dataset.ttOrderEnd){
      const kind=tap.kind,from=tap.id,list=group(kind),count=list?.querySelectorAll(':scope > [data-tt-order-id]').length;
      cancelTap();if(count!==undefined)onReorder(kind,from,count);e.preventDefault();return;
    }
    if(e.target.closest?.('[data-action]'))return;
    const item=e.target.closest?.('[data-tt-order-handle]')?.closest?.('[data-tt-order-id]');
    if(item){activate(item);e.preventDefault();}
  }
  function key(e){
    const handle=e.target.closest?.('[data-tt-order-handle]'),item=handle?.closest?.('[data-tt-order-id]');
    if(!item)return;
    const list=item.closest('[data-tt-order-group]'),kind=list?.dataset.ttOrderGroup;
    if(!canReorder(kind))return;
    if((e.key==='ArrowLeft'||e.key==='ArrowRight')&&e.altKey){
      const items=[...list.querySelectorAll(':scope > [data-tt-order-id]')],idx=items.indexOf(item),gap=idx+(e.key==='ArrowRight'?2:-1);
      if(gap>=0&&gap<=items.length){cancelTap();onReorder(kind,item.dataset.ttOrderId,gap);}
      e.preventDefault();return;
    }
    if(e.key==='Enter'||e.key===' '){activate(item);e.preventDefault();}
    if(e.key==='Escape'&&tap){cancelTap();e.preventDefault();}
  }
  root.addEventListener('pointerdown',down);window.addEventListener('pointermove',move,{passive:false});
  window.addEventListener('pointerup',up);window.addEventListener('pointercancel',clear);window.addEventListener('blur',clear);
  root.addEventListener('click',click,true);root.addEventListener('keydown',key);
  return {dispose(){clear();cancelTap();root.removeEventListener('pointerdown',down);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',clear);window.removeEventListener('blur',clear);root.removeEventListener('click',click,true);root.removeEventListener('keydown',key);}};
}
