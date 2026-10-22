/* Phase 3 interaction controller. UI-only: never mutates engine state.
 * Pointer drops and keyboard/tap actions all dispatch the same validated command.
 */
function allowsCrossroad(g,c,seat){
  if(c.color!=='wild'||g.config?.difficulties?.crossroads!=='hard')return true;
  const series=g.players?.[seat]?.series||[];return series.length===1&&series[0].color!=='wild';
}
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
  return [...(previous?.symbol!==c.symbol&&allowsCrossroad(g,c,seat)?['play']:[]),'discard'];
}

// Same commands as solo, but only this seat's personal cards and the shared
// resources are eligible. The other player's private card IDs are never targets.
export function cooperativeLegalTargets(g,cardId,seat=0){
  if(!g||g.mode!=='coop'||g.status!=='active'||g.phase!=='action'||seat!==g.active||![0,1].includes(seat))return [];
  const available=[...(g.players?.[seat]?.hand||[]),...(g.shared||[]),...(g.expansion?.oniverse?.treasure||[]).filter(c=>c.owner===seat)];
  const c=available.find(card=>card.id===cardId);
  if(!c||c.kind==='hidden'||c.kind==='deadEnd')return [];
  if(c.kind==='tower'){
    const alignment=g.expansion?.towers?.alignment||[];
    const marks=v=>String(v||'').split('+').filter(Boolean);
    const overlaps=(a,b)=>marks(a).some(x=>marks(b).includes(x));
    return [...(!alignment.length||!overlaps(c.right,alignment[0].left)?['towerLeft']:[]),...(!alignment.length||!overlaps(alignment.at(-1).right,c.left)?['towerRight']:[]),'discard'];
  }
  if(c.kind!=='location')return [];
  return [...(g.players[seat].labyrinth?.at(-1)?.symbol!==c.symbol&&allowsCrossroad(g,c,seat)?['play']:[]),'discard'];
}
export const tabletopLegalTargets=(g,id,seat=0)=>g?.mode==='coop'?cooperativeLegalTargets(g,id,seat):soloLegalTargets(g,id,seat);

export function targetState(g, cardId, seat=0){
  const legal=soloLegalTargets(g,cardId,seat);
  return {play:legal.includes('play'),discard:legal.includes('discard')};
}
const DRAG_THRESHOLD=8;
// Small deliberate movements are gestures, not taps, even when the card returns
// to its starting position before release. Ignore subpixel touch jitter.
export function isCancelledCardGesture(maxDistance, durationMs){return maxDistance>=DRAG_THRESHOLD||(maxDistance>=2.5&&durationMs>=130);}
export function isBlankGameTap(target){
  return !!target?.closest&&!target.closest('button,a,input,select,textarea,summary,label,[role="button"],[role="link"],[data-action],[data-pick],[data-tt-card],[data-tt-drop],[data-tt-inspect],[data-tt-order-id],[data-tt-order-group],[data-tt-prophecy-discard],[data-tt-happy-discard],[data-tt-happy-restore],[data-tt-order-end],[data-tt-incantation-drop]');
}
export function createTabletopInteractions({root, getGame, getSeat=()=>0, isBusy=()=>false, onSelect, onClearSelection=()=>{}, onCommand, onDrop=()=>{}, onSwap=()=>{}, onInspect=()=>{}}){
  let pointer=null, ghost=null, currentDrop=null, suppressClick=false;
  const $=selector=>root.querySelector(selector);
  const board=()=>$('.tt2-root[data-tabletop-solo="true"],.tt6-root[data-tabletop-coop="true"]');
  const inPlay=el=>Boolean(board()?.contains(el)||$('.tt6-hand-shelf')?.contains(el));
  const playableCards=()=>[...(board()?.querySelectorAll('[data-tt-card]')||[]),...($('.tt6-hand-shelf')?.querySelectorAll('[data-tt-card]')||[])];
  const selected=()=>board()?.dataset.selectedCard||'';
  const legal=id=>isBusy()?[]:tabletopLegalTargets(getGame(),id,getSeat());
  const swapZone=id=>{const g=getGame(),seat=getSeat();if(isBusy()||g?.mode!=='coop'||g.phase!=='decision'||g.pending?.type!=='coopSwap'||g.active!==seat)return null;return g.players[seat].hand.some(c=>c.id===id)?'personal':g.shared.some(c=>c.id===id)?'shared':null;};
  function syncTargets(id=selected()){
    const b=board();if(!b)return;
    const targets=legal(id);
    for(const el of b.querySelectorAll('[data-tt-drop]')){
      const allowed=targets.includes(el.dataset.ttDrop);
      el.classList.toggle('tt3-target-ready',allowed);
      if(el.matches('button'))el.disabled=!allowed;
      el.setAttribute('data-tt-legal',String(allowed));
    }
    for(const card of playableCards()){
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
    pointer.maxDistance=Math.max(pointer.maxDistance,Math.hypot(dx,dy));
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
    const hover=swapZone(pointer.cardId)?document.elementFromPoint(e.clientX,e.clientY)?.closest?.('[data-tt-card]'):null;
    const next=hover&&swapZone(hover.dataset.ttCard)&&swapZone(hover.dataset.ttCard)!==swapZone(pointer.cardId)?hover:hitTarget(e.clientX,e.clientY,pointer.cardId);
    if(currentDrop!==next){currentDrop?.classList.remove('tt3-drop-hover');currentDrop=next;currentDrop?.classList.add('tt3-drop-hover');}
  }
  function release(e){
    if(!pointer||e.pointerId!==pointer.id)return;
    pointer.maxDistance=Math.max(pointer.maxDistance,Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y));
    const {cardId,dragging}=pointer;
    const cancelled=isCancelledCardGesture(pointer.maxDistance,performance.now()-pointer.started);
    const hover=dragging&&swapZone(cardId)?document.elementFromPoint(e.clientX,e.clientY)?.closest?.('[data-tt-card]'):null;
    const drop=hover&&swapZone(hover.dataset.ttCard)&&swapZone(hover.dataset.ttCard)!==swapZone(cardId)?hover:dragging?hitTarget(e.clientX,e.clientY,cardId):null;
    if(dragging||cancelled){
      // Mobile Safari can delay the synthetic click beyond the next event-loop
      // turn. Consume exactly that click; the next pointerdown resets the guard.
      suppressClick=true;
    }
    // pointerup may arrive without a final pointermove (notably on iOS).
    // Capture where the finger/mouse ACTUALLY released the card, rather than
    // the previous move event or the original hand slot.
    if(dragging&&ghost){
      ghost.style.left=`${e.clientX-pointer.offsetX}px`;
      ghost.style.top=`${e.clientY-pointer.offsetY}px`;
    }
    const released=dragging&&ghost?.getBoundingClientRect?.();
    clearDrag();
    if(drop?.dataset.ttCard){const first=swapZone(cardId),second=swapZone(drop.dataset.ttCard);onDrop(cardId,released);onSwap(first==='personal'?cardId:drop.dataset.ttCard,second==='shared'?drop.dataset.ttCard:cardId);return;}
    if(drop){
      // Only arm an animation for a legal, accepted action. Do not leak a
      // failed drop's coordinates into the next unrelated game transition.
      if(legal(cardId).includes(drop.dataset.ttDrop)){
        onDrop(cardId,released);
        dispatch(drop.dataset.ttDrop,cardId);
      }
      return;
    }
    if(dragging||cancelled)onClearSelection();
  }
  function onPointerDown(e){
    suppressClick=false;
    if(e.button!==0&&e.pointerType==='mouse')return;
    const c=e.target.closest?.('[data-tt-card]');
    if(!c||!inPlay(c)||!(legal(c.dataset.ttCard).length||swapZone(c.dataset.ttCard)))return;
    const bounds=c.getBoundingClientRect();
    pointer={id:e.pointerId,card:c,cardId:c.dataset.ttCard,x:e.clientX,y:e.clientY,offsetX:e.clientX-bounds.left,offsetY:e.clientY-bounds.top,dragging:false,maxDistance:0,started:performance.now()};
  }
  function onClick(e){
    // Pile-inspection buttons live inside discard drop targets; inspection must never discard.
    if(suppressClick){e.preventDefault();e.stopImmediatePropagation();suppressClick=false;return;}
    if(e.target.closest?.('[data-action^="inspectPile:"]'))return;
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
    const b=board();if(!b||!inPlay(e.target))return;
    if(e.key==='Escape'){
      if(pointer)clearDrag();
      if(selected()){onSelect(selected());e.preventDefault();}
      return;
    }
    // Cards remain native buttons. Arrow keys let keyboard-only players choose
    // adjacent hand cards without requiring repeated Tab presses.
    const card=e.target.closest?.('[data-tt-card]');
    if(card&&(e.key==='ArrowRight'||e.key==='ArrowLeft')){
      const cards=playableCards();let idx=cards.indexOf(card);
      idx=Math.max(0,Math.min(cards.length-1,idx+(e.key==='ArrowRight'?1:-1)));
      cards[idx]?.focus();e.preventDefault();return;
    }
    if((e.key==='p'||e.key==='P'||e.key==='d'||e.key==='D')&&!e.altKey&&!e.ctrlKey&&!e.metaKey){
      if(e.target.matches('input,textarea,select'))return;
      if(dispatch(e.key.toLowerCase()==='p'?'play':'discard',selected()))e.preventDefault();
    }
  }
  function onCancel(){if(pointer){const wasDragging=pointer.dragging;clearDrag();if(wasDragging)onClearSelection();}}
  root.addEventListener('pointerdown',onPointerDown);
  window.addEventListener('pointermove',move,{passive:false});
  window.addEventListener('pointerup',release);
  window.addEventListener('pointercancel',onCancel);
  window.addEventListener('blur',onCancel);
  root.addEventListener('click',onClick,true);
  root.addEventListener('keydown',onKey);
  return {syncTargets,dispose(){clearDrag();root.removeEventListener('pointerdown',onPointerDown);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',release);window.removeEventListener('pointercancel',onCancel);window.removeEventListener('blur',onCancel);root.removeEventListener('click',onClick,true);root.removeEventListener('keydown',onKey);}};
}

/** Animate the card explicitly moved into an insertion gap. Neighbors only
 * slide the short distance necessary to close/open the gap; no flying copies,
 * fake transfers, or changed aspect ratios. The commit renders synchronously.
 * Works for marker clicks, mouse/touch dragging and keyboard reordering. */
export function animateReorderCommit(root,kind,movedId,commit,{releasedRect=null,reduced=false}={}){
  const rects=()=>{
    const map=new Map();
    const list=[...(root?.querySelectorAll?.('[data-tt-order-group]')||[])].find(el=>el.dataset.ttOrderGroup===kind);
    for(const item of list?.querySelectorAll?.(':scope > [data-tt-order-id]')||[]){
      const r=item.getBoundingClientRect();
      if(r.width>0&&r.height>0)map.set(item.dataset.ttOrderId,{rect:r,item});
    }
    return map;
  };
  const before=rects();
  // Reducers and rendering are authoritative; motion is purely decorative.
  const result=commit();
  if(reduced||typeof document==='undefined'||document.documentElement.dataset.motion==='reduced'||
    (typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches))return result;
  const after=rects();
  for(const [id,entry] of after){
    const prior=before.get(id);if((!prior&&!(id===movedId&&releasedRect))||typeof entry.item.animate!=='function')continue;
    const start=id===movedId&&releasedRect?releasedRect:prior.rect;
    const dx=start.left+start.width/2-(entry.rect.left+entry.rect.width/2);
    const dy=start.top+start.height/2-(entry.rect.top+entry.rect.height/2);
    if(Math.hypot(dx,dy)<2)continue;
    const direct=id===movedId;
    entry.item.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0,0)'}],{
      duration:direct?260:170,easing:'cubic-bezier(.2,.72,.3,1)'
    });
  }
  return result;
}

/** Restore a Happy Dream discard into an exact insertion gap, without losing order. */
export function restoreDiscardedCardToGap(ids,discardedIds,id,gap){
  if(!Array.isArray(ids)||!discardedIds.has(id)||!ids.includes(id))return ids;
  const kept=ids.filter(x=>x!==id&&!discardedIds.has(x));
  if(!Number.isInteger(gap)||gap<0||gap>kept.length)return ids;
  const discarded=ids.filter(x=>x!==id&&discardedIds.has(x));
  return [...kept.slice(0,gap),id,...kept.slice(gap),...discarded];
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
export function createDecisionReorder({root,canReorder,onReorder,onDiscard=()=>{},onRestore=()=>{},onUndiscard=()=>{}}){
  let press=null,ghost=null,highlight=null,tap=null,suppress=false;
  const group=kind=>[...root.querySelectorAll('[data-tt-order-group]')].find(l=>l.dataset.ttOrderGroup===kind);
  function eraseLine(){highlight?.classList.remove('tt5-insert-before','tt5-insert-after');highlight=null;}
  function clear(){ghost?.remove();ghost=null;eraseLine();press?.item?.classList.remove('tt3-order-dragging');press=null;}
  function cancelTap(){
    root.querySelectorAll('.tt5-order-selected,.tt5-order-picking').forEach(el=>el.classList.remove('tt5-order-selected','tt5-order-picking'));
    root.querySelectorAll('[data-tt-order-gap]').forEach(el=>el.remove());tap=null;
  }
  // Markers are layered over the actual gaps, not inserted into the flex flow:
  // even densely packed decision cards stay at their existing sizes/positions.
  function showGaps(list,id,kind){
    const items=[...list.querySelectorAll(':scope > [data-tt-order-id]')],origin=items.findIndex(item=>item.dataset.ttOrderId===id);
    if(origin<0)return;
    const area=list.getBoundingClientRect();
    for(let gap=0;gap<=items.length;gap++){
      // Moving immediately before or after itself would not change the order.
      if(gap===origin||gap===origin+1)continue;
      const previous=items[gap-1]?.getBoundingClientRect(),next=items[gap]?.getBoundingClientRect();
      const newRow=previous&&next&&Math.abs(previous.top-next.top)>Math.min(previous.height,next.height)*.45;
      const reference=newRow?next:(next||previous);
      if(!reference)continue;
      const x=(!previous||newRow?next.left-3:!next?previous.right+3:(previous.right+next.left)/2)-area.left+list.scrollLeft;
      const top=reference.top-area.top+list.scrollTop;
      const marker=document.createElement('button');marker.type='button';
      marker.className='tt5-order-gap';marker.dataset.ttOrderGap=String(gap);marker.dataset.ttOrderKind=kind;
      marker.setAttribute('aria-label',`Insert selected card at position ${gap+1}`);
      marker.title=`Insert here (position ${gap+1})`;
      marker.style.left=`${Math.max(12,Math.min(list.scrollWidth-12,x))}px`;
      marker.style.top=`${top}px`;marker.style.height=`${reference.height}px`;
      list.appendChild(marker);
    }
  }
  function markGap(list,gap){
    eraseLine();const items=[...list.querySelectorAll(':scope > [data-tt-order-id]')];
    highlight=gap===items.length?items.at(-1):items[gap];
    highlight?.classList.add(gap===items.length?'tt5-insert-after':'tt5-insert-before');
  }
  function dragGap(x,y){
    const list=group(press.kind==='happyDiscard'?'effect':press.kind);if(!list)return null;
    const rect=list.getBoundingClientRect();if(y<rect.top-45||y>rect.bottom+45||x<rect.left-42||x>rect.right+42)return null;
    if(x<rect.left+30)list.scrollLeft-=11;
    if(x>rect.right-30)list.scrollLeft+=11;
    return {list,index:gapAtPoint(list,x,y)??0};
  }
  function down(e){
    if(e.button!==0&&e.pointerType==='mouse')return;
    const restore=e.target.closest?.('[data-tt-happy-restore]');
    if(restore&&root.querySelector('[data-tt-happy-discard]')){
      const rect=restore.getBoundingClientRect();
      press={pointerId:e.pointerId,id:restore.dataset.ttHappyRestore,kind:'happyDiscard',item:restore,grip:restore,x:e.clientX,y:e.clientY,offsetX:e.clientX-rect.left,offsetY:e.clientY-rect.top,dragging:false};
      return;
    }
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
    const releasedRect=dragging?ghost?.getBoundingClientRect?.():null;
    const isHappy=press.kind==='effect'&&root.querySelector('[data-tt-happy-discard]');
    const slot=isHappy|| (press.kind==='prophecy'?root.querySelector('[data-tt-prophecy-discard]'):null);
    const box=slot?.getBoundingClientRect();const discarded=dragging&&box&&e.clientX>=box.left-10&&e.clientX<=box.right+10&&e.clientY>=box.top-10&&e.clientY<=box.bottom+10;
    if(dragging){suppress=true;setTimeout(()=>suppress=false,0);}
    const fromDiscard=press.kind==='happyDiscard';
    clear();if(fromDiscard){if(target?.index!==null&&target?.index!==undefined)onRestore(id,target.index);return;}
    if(discarded){onDiscard(id,isHappy?'happyPeek':'prophecy');return;}if(target&&target.index!==null)onReorder(target.list.dataset.ttOrderGroup,id,target.index,{releasedRect});
  }
  function activate(item){
    const list=item?.closest('[data-tt-order-group]');if(!list||!canReorder(list.dataset.ttOrderGroup))return;
    const id=item.dataset.ttOrderId,kind=list.dataset.ttOrderGroup;
    if(tap?.kind===kind&&tap.id===id){cancelTap();return;}
    // Tapping another card selects that card instead of silently placing the
    // previous one before it. Only explicit insertion markers commit a move.
    cancelTap();tap={id,kind};item.classList.add('tt5-order-selected');list.classList.add('tt5-order-picking');
    showGaps(list,id,kind);
  }
  function click(e){
    if(suppress&&e.target.closest?.('[data-tt-order-group],[data-tt-happy-restore]')){suppress=false;e.preventDefault();e.stopImmediatePropagation();return;}
    if(e.target.closest?.('[data-tt-happy-restore]'))return; // A discarded card restores itself, not the selected retained card.
    const marker=e.target.closest?.('[data-tt-order-gap]');
    if(marker){
      if(tap?.kind===marker.dataset.ttOrderKind&&canReorder(tap.kind)){
        const {id,kind}=tap,gap=Number(marker.dataset.ttOrderGap);
        cancelTap();onReorder(kind,id,gap);
      }
      e.preventDefault();return;
    }
    const slot=e.target.closest?.('[data-tt-prophecy-discard],[data-tt-happy-discard]');
    if(slot&&tap&&(tap.kind==='prophecy'||(tap.kind==='effect'&&slot.hasAttribute('data-tt-happy-discard')))){
      const id=tap.id,kind=slot.hasAttribute('data-tt-happy-discard')?'happyPeek':'prophecy';cancelTap();onDiscard(id,kind);e.preventDefault();return;
    }
    if(slot?.hasAttribute('data-tt-prophecy-discard')&&slot.querySelector('.card')){
      cancelTap();onUndiscard();e.preventDefault();return;
    }
    const end=e.target.closest?.('[data-tt-order-end]');
    if(end&&tap&&tap.kind===end.dataset.ttOrderEnd){
      const kind=tap.kind,from=tap.id,list=group(kind),count=list?.querySelectorAll(':scope > [data-tt-order-id]').length;
      cancelTap();if(count!==undefined)onReorder(kind,from,count);e.preventDefault();return;
    }
    if(e.target.closest?.('[data-action]'))return;
    const item=e.target.closest?.('[data-tt-order-handle]')?.closest?.('[data-tt-order-id]');
    if(item){activate(item);e.preventDefault();return;}
    if(tap)cancelTap();
  }
  function key(e){
    if(e.key==='Escape'&&tap){cancelTap();e.preventDefault();return;}
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
  }
  root.addEventListener('pointerdown',down);window.addEventListener('pointermove',move,{passive:false});
  window.addEventListener('pointerup',up);window.addEventListener('pointercancel',clear);window.addEventListener('blur',clear);
  root.addEventListener('click',click,true);root.addEventListener('keydown',key);
  return {dispose(){clear();cancelTap();root.removeEventListener('pointerdown',down);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',clear);window.removeEventListener('blur',clear);root.removeEventListener('click',click,true);root.removeEventListener('keydown',key);}};
}

