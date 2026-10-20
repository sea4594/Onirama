import {CARD_MOTION,catcherTransferCounts} from './animation-timing.js';
import {renderCard} from './cards.js';
/* Phase 7: presentation-only transitions from successive *public game views*.
   Never mutate the engine, issue actions, read the unrevealed deck, or replay
   an effect by re-submitting a command. The source of truth is always the view. */
const visible = card => card && card.kind !== 'hidden' && typeof card.id === 'string';
const cards = value => Array.isArray(value) ? value.filter(visible) : [];
const ids = value => new Set(cards(value).map(c => c.id));
const arrays = game => [
  ...((game?.players || []).flatMap(p => [p.hand, p.labyrinth, p.doors])),
  game?.shared, game?.draft, game?.discard, game?.limbo,
  game?.expansion?.towers?.alignment, game?.expansion?.oniverse?.rallied,
  game?.expansion?.oniverse?.treasure,
  ...Object.values(game?.expansion?.mirrors?.stacks || {}),
  ...(game?.expansion?.dreamcatchers?.stacks || []),
  game?.expansion?.incubus?.stored,
  // Only the currently revealed decision cards. Never include deck-search
  // options or unrevealed card identities.
  game?.pending?.cards,
  game?.pending?.card ? [game.pending.card] : [],
  game?.spectatorDecision?.card ? [game.spectatorDecision.card] : []
];
const allVisible = game => new Set(arrays(game).flatMap(a => cards(a).map(c => c.id)));
// Card indices are layout positions, not game transfers. A hand losing its
// first card must not cause every remaining hand card to fly to a new slot.
// The first visible occurrence owns the card: a pending decision may also
// reference a card already present in its actual zone.
const zoneGroups = game => [
  ...((game?.players || []).flatMap((p,seat) => [
    [`player:${seat}:hand`,p.hand], [`player:${seat}:labyrinth`,p.labyrinth],
    [`player:${seat}:doors`,p.doors]
  ])),
  ['shared',game?.shared], ['draft',game?.draft],
  ['discard',game?.discard], ['limbo',game?.limbo],
  ['towers',game?.expansion?.towers?.alignment],
  ['rallied',game?.expansion?.oniverse?.rallied],
  ['treasure',game?.expansion?.oniverse?.treasure],
  ...Object.entries(game?.expansion?.mirrors?.stacks || {}).map(([name,stack])=>[`mirror:${name}`,stack]),
  ...(game?.expansion?.dreamcatchers?.stacks || []).map((stack,index)=>[`catcher:${index}`,stack]),
  ['incubus',game?.expansion?.incubus?.stored],
  ['pending',game?.pending?.cards],
  ['pending',game?.pending?.card ? [game.pending.card] : []],
  ['spectator',game?.spectatorDecision?.card ? [game.spectatorDecision.card] : []]
];
const locations = game => {
  const out=new Map();
  for(const [zone,group] of zoneGroups(game))for(const card of cards(group)){
    if(!out.has(card.id))out.set(card.id,zone);
  }
  return out;
};
const membership = (game,field) => ids(game?.[field]);
// A rendered card in a compact fan is NOT the destination for an action that
// moves a card into a pile. Those actions must land on the pile anchor.
export function transferDestinationZone(id,previous,next){
  if(!previous||!next||typeof id!=='string')return null;
  const before=locations(previous),after=locations(next);
  const oldZone=before.get(id),newZone=after.get(id);
  return oldZone&&newZone&&oldZone!==newZone?newZone:null;
}
// One physical destination per transfer. Piles and catchers own their own
// landing positions, including when individual card faces aren't in the DOM.
export function transferTargetRect(zone,visibleRect,anchors){
  if(zone==='discard'||zone==='limbo')return anchors?.[zone]||null;
  if(zone?.startsWith('catcher:'))return anchors?.catchers?.[Number(zone.slice(8))]||null;
  return visibleRect||null;
}
// A group of returned cards either animates individually or as one clearly
// counted stack. Never invent a fixed number of representative cards.
export function stackMotionCounts(count,limit=3){
  if(!Number.isInteger(count)||count<=0)return [];
  return count<=limit?Array(count).fill(1):[count];
}

const concealed = game => new Set((game?.players||[]).flatMap(p=>(p.hand||[]).filter(c=>c?.kind==='hidden'&&typeof c.id==='string').map(c=>c.id)));
function signature(game){
  if (!game) return '';
  return JSON.stringify([game.phase,game.status,game.turn,game.active,game.pending?.type,
    game.deckCount,game.shuffleSerial||0,(game.discard||[]).length,(game.limbo||[]).length,
    (game.players||[]).map(p=>(p.hand||[]).filter(c=>c?.kind==='hidden').length),
    arrays(game).map(a=>cards(a).map(c=>c.id))]);
}
export function planGameTransitions(previous,next){
  if (!previous || !next || previous.mode !== next.mode) return null;
  const before=allVisible(previous),after=allVisible(next);
  const hiddenBefore=concealed(previous),hiddenAfter=concealed(next);
  const oldLocations=locations(previous),newLocations=locations(next);
  const moved=[...after].filter(id=>before.has(id)&&oldLocations.get(id)!==newLocations.get(id));
  const toHidden=[...before].filter(id=>hiddenAfter.has(id));
  const fromHidden=[...after].filter(id=>hiddenBefore.has(id));
  const drawn=[...after].filter(id=>!before.has(id)&&!hiddenBefore.has(id));
  const removed=[...before].filter(id=>!after.has(id)&&!hiddenAfter.has(id));
  // Replay deliberately strips private hand IDs. If a public draft card
  // disappears while an anonymous hand gains a back, its public source is
  // still known. Animate that single public-to-face-down transfer without
  // inventing or retaining a concealed identifier.
  const anonHandGain=(next.players||[]).reduce((count,p,i)=>{
    const hand=p.hand||[],prior=previous.players?.[i]?.hand||[];
    return count+(hand.every(c=>c?.kind==='hidden'&&typeof c?.id!=='string')?
      Math.max(0,hand.length-prior.length):0);
  },0);
  const anonymousDraftToHand=(previous.phase==='draft'?cards(previous.draft):[]).filter(c=>
    !ids(next.draft).has(c.id)&&!hiddenAfter.has(c.id)
  ).slice(0,anonHandGain).map(c=>c.id);
  const anonymousDraw=Math.min(Math.max(0,(previous.deckCount||0)-(next.deckCount||0)),
    Math.max(0,anonHandGain-anonymousDraftToHand.length));
  const previousDiscard=membership(previous,'discard'), previousLimbo=membership(previous,'limbo');
  const destinations={discard:membership(next,'discard'),limbo:membership(next,'limbo')};
  return {
    moved,drawn,removed,toHidden,fromHidden,anonymousDraftToHand,anonymousDraw,
    // Concealment owns the transfer; do not schedule the same draft card twice.
    draftToHand: cards(previous.draft).filter(c=>!ids(next.draft).has(c.id)&&hiddenAfter.has(c.id)).map(c=>c.id),
    hiddenDraw:[...hiddenAfter].filter(id=>!hiddenBefore.has(id)).length,
    // Destination membership, not disappearance from all public arrays: a
    // discarded card is still visible and therefore cannot be `removed`.
    toDiscard:[...destinations.discard].filter(id=>!previousDiscard.has(id)&&before.has(id)),
    toLimbo:[...destinations.limbo].filter(id=>!previousLimbo.has(id)&&before.has(id)),
    draw:Math.max(0,(previous.deckCount||0)-(next.deckCount||0)),
    shuffle:(next.shuffleSerial||0)>(previous.shuffleSerial||0)||((next.deckCount||0)>(previous.deckCount||0)&&(previous.limbo||[]).length>(next.limbo||[]).length),
    premRevealed:(next.expansion?.premonitions?.faceUp||[]).filter(id=>!(previous.expansion?.premonitions?.faceUp||[]).includes(id)),
    turn:previous.turn!==next.turn||previous.active!==next.active,
    phase:previous.phase!==next.phase||previous.pending?.type!==next.pending?.type,
    finished:previous.status==='active'&&next.status!=='active',
    overload:previous.pending?.type!=='catchOverload'&&next.pending?.type==='catchOverload'&&next.pending?.returned===true,
    overloadLimbo:(previous.limbo||[]).length,
    catcherCaptured:catcherTransferCounts(previous,next),
    catcherFreed:(previous.expansion?.dreamcatchers?.stacks||[]).map((stack,index)=>({index,removed:(stack||[]).filter(c=>!(next.expansion?.dreamcatchers?.stacks?.[index]||[]).some(d=>d.id===c.id)&&!after.has(c.id))})).filter(x=>x.removed.length&&(next.shuffleSerial||0)>(previous.shuffleSerial||0)),
    draft:previous.phase==='draft'||next.phase==='draft',
    // Cards no longer visible anywhere after leaving Limbo returned to the deck.
    returnedLimbo:cards(previous.limbo).filter(c=>!after.has(c.id)).map(c=>c.id)
  };
}
const center=r=>({x:r.left+r.width/2,y:r.top+r.height/2});
const rectOK=r=>r&&r.width>0&&r.height>0&&Number.isFinite(r.left);
const rect=element=>element?.getBoundingClientRect?.();
// Motion copies must keep the same ancestor selectors as live cards. In particular,
// Tower marks and emblems are positioned by .game-viewport .tt2-root rules.
// A clone in document.body loses those rules; copying computed pixel positions
// also freezes them at the wrong card size during a draw/reveal.
function motionStage(root){
  const tabletop=root.querySelector?.('.tt6-table-slot .tt2-root');
  const stage=document.createElement('div');
  stage.className='game-viewport tt8-motion-stage';
  const scope=document.createElement('div');
  scope.className=tabletop?.className||'tt2-root';
  scope.classList.add('tt8-motion-scope');
  for(const attribute of tabletop?.attributes||[]){
    if(attribute.name.startsWith('data-'))scope.setAttribute(attribute.name,attribute.value);
  }
  stage.appendChild(scope);
  document.body.appendChild(stage);
  return {stage,scope};
}
function motionTemplate(el){return el.cloneNode(true);}
function capture(root){
  const found=new Map();
  // Landscape relocates the original solo/co-op hand outside .tt2-root.
  // Capture it as part of the same visual scene, without touching its cards.
  for(const el of root.querySelectorAll?.('.tt6-table-slot .tt2-root [data-tt-motion-id], .tt6-workspace [data-tt-motion-id], .tt6-hand-shelf [data-tt-motion-id]')||[]){
    const id=el.dataset.ttMotionId,r=rect(el);
    if(id&&!found.has(id)&&rectOK(r))found.set(id,{el,r,template:motionTemplate(el)});
  }
  found.backs=[...(root.querySelectorAll?.('.tt6-table-slot .tt6-opponent .tt6-card-back, .tt6-hand-shelf .tt6-opponent .tt6-card-back')||[])].map(el=>({el,r:rect(el),template:el.cloneNode(true)})).filter(entry=>rectOK(entry.r));
  return found;
}
function pile(root,name){
  return root.querySelector?.(`.tt6-table-slot [data-action="inspectPile:${name}"] .tt2-deck-back, .tt6-table-slot [data-action="inspectPile:${name}"] .tt6-pile-face, .tt6-table-slot [data-action="inspectPile:${name}"] .tt2-pile-face`)
    ||root.querySelector?.(`.tt6-table-slot [data-action="inspectPile:${name}"]`);
}
// Coordinate flight endpoints in viewport space. Scaling must be UNIFORM:
// distinct x/y scales would stretch a card while it travels across layouts.
export function flightGeometry(from,to){
  if(!rectOK(from)||!rectOK(to))return null;
  const source=center(from),dest=center(to);
  const scale=Math.max(.15,Math.min(from.width/to.width,from.height/to.height));
  return {dx:source.x-dest.x,dy:source.y-dest.y,scale};
}
// A CSS layout sometimes yields different bounding-box proportions for a card
// in the hand and in a compact pile. The moving copy stays a physical 1:1.42
// card throughout; it simply fits INSIDE each source/destination footprint.
export function cardFlightRects(from,to,card=true){
  if(!rectOK(from)||!rectOK(to))return null;
  if(!card)return {from,to};
  const fit=r=>{
    const width=Math.min(r.width,r.height/1.42),height=width*1.42;
    return {left:r.left+(r.width-width)/2,top:r.top+(r.height-height)/2,width,height};
  };
  return {from:fit(from),to:fit(to)};
}
function animateFlight(template,from,to,target,delay,active,scope,count=1){
  if(!rectOK(from)||!rectOK(to))return;
  const isCard=template.matches?.('.card,.tt6-card-back,.tt2-deck-back,.tt6-pile-face');
  const geometry=cardFlightRects(from,to,isCard);
  const start=geometry.from,destination=geometry.to;
  const ghost=template.cloneNode(true);ghost.removeAttribute('id');ghost.removeAttribute('data-pick');ghost.removeAttribute('data-action');ghost.querySelectorAll?.('.tt10-draw-count,.tt2-pile-label,.tt6-pile-label').forEach(el=>el.remove());
  ghost.setAttribute('aria-hidden','true');ghost.setAttribute('tabindex','-1');
  ghost.classList.add('tt8-flying-card');
  if(count>1){
    const label=document.createElement('span');label.className='tt8-stack-count';label.textContent=`×${count}`;
    ghost.appendChild(label);
  }
  Object.assign(ghost.style,{position:'fixed',left:`${destination.left}px`,top:`${destination.top}px`,width:`${destination.width}px`,height:`${destination.height}px`,margin:'0',zIndex:'2147483600',pointerEvents:'none'});
  // The card's CSS remains live inside this scope, even while the whole card
  // translates/scales. Never freeze individual icon coordinates in pixels.
  ghost.style.setProperty('--tt15-mini',`${destination.width}px`);
  ghost.style.setProperty('--tt4-mini',`${destination.width}px`);
  scope.appendChild(ghost);
  const {dx,dy,scale}=flightGeometry(start,destination);
  if(target)target.style.visibility='hidden';
  let finished=false;
  const cleanup=()=>{if(finished)return;finished=true;ghost.remove();if(target)target.style.removeProperty('visibility');const i=active.indexOf(cleanup);if(i!==-1)active.splice(i,1);};
  active.push(cleanup);
  if(typeof ghost.animate!=='function'){cleanup();return;}
  const motion=ghost.animate([
    {transform:`translate(${dx}px,${dy}px) scale(${scale})`,opacity:.85},
    {transform:'translate(0,0) scale(1)',opacity:1}
  ],{duration:CARD_MOTION.move,delay,easing:'cubic-bezier(.22,.75,.32,1)',fill:'both'});
  motion.finished.catch(()=>{}).then(cleanup);
}

// Reveal only faces that are already part of the authorized next public view.
// Never reconstruct cards from a hidden deck, replay commands, or show a partner's private hand.
const publicCardMap=game=>new Map(arrays(game).flatMap(a=>cards(a).map(c=>[c.id,c])));
function revealGhost(card,from,to,delay,cleanups,{premonition=false,target=null,scope=null}={}){
 if(!rectOK(from)||!rectOK(to)||typeof document==='undefined')return;
 const width=Math.min(148,Math.max(93,innerWidth*.26)),height=Math.round(width*1.42);
 const cx=innerWidth/2,cy=innerHeight/2;
 if(target)target.style.visibility='hidden';
 const overlay=document.createElement('div');overlay.className='tt10-reveal-flight';
 Object.assign(overlay.style,{width:`${width}px`,height:`${height}px`,left:`${cx-width/2}px`,top:`${cy-height/2}px`});
 const front=premonition?card.outerHTML:renderCard(card,{tiny:true});
 overlay.innerHTML=`<div class="tt10-flipper"><div class="tt10-reveal-back"></div><div class="tt10-reveal-front">${front}</div></div>`;
 // The reveal face needs the same Tower and special-card CSS as the tabletop.
 const face=overlay.querySelector('.tt10-reveal-front>.card');
 if(face){face.style.setProperty('--tt15-mini',`${width}px`);face.style.setProperty('--tt4-mini',`${width}px`);}
 (scope||document.body).appendChild(overlay);
 const source=center(from),destination=center(to);
 const move=(pos)=>`translate(${pos.x-cx}px,${pos.y-cy}px) scale(${Math.max(.13,Math.min(2,pos.width/width))})`;
 const src={...source,width:from.width},dst={...destination,width:to.width};
 let finished=false;
 const cleanup=()=>{if(finished)return;finished=true;overlay.remove();if(target)target.style.removeProperty('visibility');const i=cleanups.indexOf(cleanup);if(i!==-1)cleanups.splice(i,1);};
 cleanups.push(cleanup);
 if(!overlay.animate){cleanup();return;}
 const motion=overlay.animate([{transform:move(src),opacity:.85,offset:0},{transform:'translate(0,0) scale(1)',opacity:1,offset:.3},{transform:'translate(0,0) scale(1)',opacity:1,offset:.65},{transform:move(dst),opacity:1,offset:1}],{duration:CARD_MOTION.reveal,delay,easing:'ease-in-out',fill:'both'});
 motion.finished.catch(()=>{}).then(cleanup);
}
function premonitionNode(root,id){
 for(const el of root.querySelectorAll?.('.tt5-premonition[data-tt-card-info]')||[]){
  try{if(JSON.parse(el.dataset.ttCardInfo).premonitionId===id)return el;}catch{}
 }
 return null;
}
function shuffleOverlay(back,cleanups,delay=0,scope=null,snapshotRect=null){
 const r=snapshotRect||rect(back);if(!rectOK(r)||typeof document==='undefined')return;
 const ghost=back.cloneNode(true);ghost.removeAttribute('data-action');ghost.removeAttribute('data-tt-drop');
 ghost.classList.add('tt10-shuffle-overlay');ghost.setAttribute('aria-hidden','true');
 Object.assign(ghost.style,{left:`${r.left}px`,top:`${r.top}px`,width:`${r.width}px`,height:`${r.height}px`,animationDelay:`${delay}ms`});
 (scope||document.body).appendChild(ghost);
 let timer;
 const cleanup=()=>{clearTimeout(timer);ghost.remove();const i=cleanups.indexOf(cleanup);if(i!==-1)cleanups.splice(i,1);};
 cleanups.push(cleanup);timer=setTimeout(cleanup,delay+CARD_MOTION.shuffle);
}

// A room version covers both game actions and lobby/choice updates. Only
// consecutive observed versions can be interpreted as one physical transition.
// Never synthesize flights from an unknown number of skipped remote actions.
export function networkMotionContinuity(previousVersion,nextVersion){
  if(!Number.isSafeInteger(previousVersion)||!Number.isSafeInteger(nextVersion))return 'baseline';
  if(nextVersion<=previousVersion)return 'duplicate';
  return nextVersion===previousVersion+1?'continuous':'resync';
}

// Jobs are visual-only copies of already authorized public views. The queue is
// deliberately short: a burst catches up to the authoritative view rather than
// making players sit through stale animations (or inventing missing actions).
export function createOrderedMotionQueue({onFinish=()=>{},schedule=setTimeout,cancel=clearTimeout,maxPending=2}={}){
  let queued=[],running=false,timer=null;
  const clear=()=>{
    if(timer!==null)cancel(timer);
    timer=null;queued=[];running=false;onFinish();
  };
  const next=()=>{
    if(running||!queued.length)return;
    running=true;
    const job=queued.shift();
    try{job.run();}catch(error){clear();throw error;}
    timer=schedule(()=>{
      timer=null;onFinish();running=false;next();
    },job.duration);
  };
  return {
    enqueue(run,duration){
      if(queued.length>=maxPending){clear();return false;}
      queued.push({run,duration});next();return true;
    },
    clear,
    get length(){return queued.length+(running?1:0);}
  };
}

export function createTabletopAnimator({root}){
  let last=null,key=null,pending=null,drop=null,lastVersion=null;
  let cleanups=[],activeStage=null;
  const finishMotion=()=>{
    for(const fn of cleanups.splice(0))fn();
    activeStage?.stage.remove();activeStage=null;
  };
  const motionQueue=createOrderedMotionQueue({onFinish:finishMotion});
  const clearMotion=()=>motionQueue.clear();
  const enabled=()=>typeof document!=='undefined' && !document.hidden &&
    document.documentElement.dataset.motion!=='reduced' &&
    !(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
  const reset=()=>{last=null;key=null;lastVersion=null;pending=null;drop=null;clearMotion();};
  return {
    dragRelease(id,from){if(id&&rectOK(from))drop={id,from};},
    before(game,roomKey,page,meta={}){
      pending=null;
      if(page!=='#/game'||!game){reset();return;}
      const nextKey=`${roomKey||''}:${game.mode}`;
      const changed=last&&key===nextKey&&signature(last)!==signature(game);
      if(key!==nextKey){clearMotion();return;}
      const continuity=meta.online?networkMotionContinuity(lastVersion,meta.version):'continuous';
      if(continuity==='resync'){
        // Even if the visible game coincidentally matches, drop old movement
        // after an unobserved version gap.
        clearMotion();drop=null;return;
      }
      if(!changed)return;
      if(continuity!=='continuous'){
        // A missed snapshot is a resynchronization, NOT a single card action.
        // Keep the new authoritative game view; omit all speculative flights.
        clearMotion();drop=null;return;
      }
      pending={plan:planGameTransitions(last,game),old:capture(root)};
      if(!meta.online)clearMotion();
    },
    after(game,roomKey,page,meta={}){
      if(page!=='#/game'||!game){reset();return;}
      const nextKey=`${roomKey||''}:${game.mode}`;
      const event=pending,previous=last;pending=null;last=game;key=nextKey;
      lastVersion=meta.online&&Number.isSafeInteger(meta.version)?meta.version:null;
      if(!event||!enabled()){drop=null;return;}
      const {plan,old}=event,now=capture(root),released=drop;drop=null;
      // Snapshot DOM anchors at the same instant as the state transition;
      // a later Firebase render must not retarget an earlier animation.
      const deckEl=pile(root,'deck'),discardEl=pile(root,'discard'),limboEl=pile(root,'limbo');
      const deck=rect(deckEl),discard=rect(discardEl),limbo=rect(limboEl);
      const catcherEls=new Map((plan.catcherCaptured||[]).concat(plan.catcherFreed||[]).map(t=>[t.index,root.querySelector?.(`.tt5-catcher[data-action="inspectCatcher:${t.index}"]`)]));
      const catcherRects=new Map([...catcherEls].map(([index,el])=>[index,rect(el)]));
      const premonitionEls=new Map((plan.premRevealed||[]).map(id=>[id,premonitionNode(root,id)]));
      const premonitionRects=new Map([...premonitionEls].map(([id,el])=>[id,rect(el)]));
      const premonitionReserve=rect(root.querySelector?.('.tt5-premonitions .tt5-tile:not(.tt5-premonition)'))||deck;
      const statusEl=root.querySelector?.('.tt6-dock-status');
      const turnEl=root.querySelector?.('.tt6-current .tt6-player-heading, .tt2-top');
      const workspaceEl=root.querySelector?.('.tt6-workspace');
      const play=()=>{
      activeStage=motionStage(root);
      const flightScope=activeStage.scope;
      const flies=[];
      const scheduled=new Set();
      const catchers={};
      for(const transfer of [...(plan.catcherCaptured||[]),...(plan.catcherFreed||[])]){
        catchers[transfer.index]=catcherRects.get(transfer.index);
      }
      const anchors={discard,limbo,catchers};
      const queue=(id,template,from,to,target,front=false,count=1)=>{
        if(id&&scheduled.has(id))return;
        if(!template||!rectOK(from)||!rectOK(to))return;
        if(id)scheduled.add(id);
        const item=[template,from,to,target,id,count];
        if(front)flies.unshift(item);else flies.push(item);
      };
      // Shared visible cards: the same card moves between hand, draft,
      // Labyrinth, Doors, and expansion zones without inventing engine steps.
      for(const id of plan.moved){
        const a=old.get(id),b=now.get(id);
        if(!a||plan.drawn.includes(id))continue;
        const zone=transferDestinationZone(id,previous,game);
        const dest=transferTargetRect(zone,b?.r,anchors);
        const origin=released?.id===id?released.from:a.r;
        if(!rectOK(dest))continue;
        const target=(zone==='discard'||zone==='limbo'||zone?.startsWith('catcher:'))?null:b?.el;
        if(Math.hypot(center(origin).x-center(dest).x,center(origin).y-center(dest).y)>14)
          queue(id,zone==='discard'||zone==='limbo'?a.template:(b?.template||a.template),origin,dest,target);
      }
      // Newly revealed deck cards animate independently of how the previous
      // action was triggered. Dragging one card must not hide its draw/refill.
      if(plan.draw&&rectOK(deck)){
        const known=publicCardMap(game);
        plan.drawn.slice(0,8).forEach((id,i)=>{
          const c=known.get(id);if(!c)return;
          const target=now.get(id);
          const zone=locations(game).get(id);
          const destination=transferTargetRect(zone,target?.r,anchors);
          if(!rectOK(destination)||scheduled.has(id))return;
          scheduled.add(id);
          revealGhost(c,deck,destination,i*250,cleanups,{target:zone==='discard'||zone==='limbo'?null:target?.el||null,scope:flightScope});
        });
      }
      // A private inspection becomes public only when a card actually leaves
      // the inspected deck for a public pile. Animate that reveal at resolution,
      // never while its identity remains private to the acting player.
      if(previous?.spectatorDecision?.visibility==='private'&&rectOK(deck)&&rectOK(discard)){
        const beforeDiscard=membership(previous,'discard'),afterDiscard=membership(game,'discard'),known=publicCardMap(game);
        let revealIndex=0;
        for(const id of afterDiscard){
          if(beforeDiscard.has(id)||old.has(id)||scheduled.has(id)||revealIndex>=8)continue;
          const c=known.get(id);if(c){scheduled.add(id);revealGhost(c,deck,discard,revealIndex++*180,cleanups,{scope:flightScope});}
        }
      }
      if(plan.premRevealed?.length){
        const reserve=premonitionReserve;
        for(const [i,id] of plan.premRevealed.slice(0,5).entries()){
          const target=premonitionEls.get(id),dest=premonitionRects.get(id);
          if(target&&rectOK(reserve)&&rectOK(dest))revealGhost(target,reserve,dest,i*180,cleanups,{premonition:true,target,scope:flightScope});
        }
      }
      // A cooperative partner's concealed cards remain face down. Moves to
      // and from that hand use only already public information or card backs.
      const oldBack=old.backs.at(-1),newBack=now.backs.at(-1);
      // Public draft cards can visibly enter a concealed hand without
      // storing the concealed card's ID (which can disclose its face).
      for(const id of plan.toHidden){const a=old.get(id);if(a&&newBack)queue(id,newBack.template,released?.id===id?released.from:a.r,newBack.r,null,true);}
      for(const id of plan.anonymousDraftToHand||[]){const a=old.get(id);if(a&&newBack)queue(id,newBack.template,a.r,newBack.r,null,true);}
      if(plan.anonymousDraw&&newBack&&rectOK(deck)){
        for(const bundle of stackMotionCounts(plan.anonymousDraw))queue(null,newBack.template,deck,newBack.r,null,true,bundle);
      }
      for(const id of plan.fromHidden){const b=now.get(id);if(b&&oldBack)queue(id,oldBack.template,oldBack.r,b.r,b.el,true);}
      if(plan.draw&&plan.hiddenDraw&&rectOK(deck)&&newBack){
        // Draft-to-hand already has a public source and a single face-down flight.
        const count=Math.max(0,plan.hiddenDraw-plan.toHidden.length);
        for(const bundle of stackMotionCounts(count))queue(null,newBack.template,deck,newBack.r,null,true,bundle);
      }
      for(const [list,dest] of [[plan.toDiscard,discard],[plan.toLimbo,limbo]]){
        if(!rectOK(dest))continue;
        for(const id of list){const a=old.get(id);if(a)queue(id,a.template,released?.id===id?released.from:a.r,dest,null);}
      }
      // Some Limbo cards are not individually rendered in the compact fan.
      // Still show their capture using a generic, face-down card: no hidden
      // identity or deck information may be inferred from this animation.
      const captureSource=limbo||deck;
      const genericBack=deckEl;
      if(rectOK(captureSource)&&genericBack){
        for(const transfer of (plan.catcherCaptured||[])){
          const destination=catcherRects.get(transfer.index);
          if(!rectOK(destination))continue;
          // Explicit movement already animates a recognizable, visible card;
          // avoid an extra generic duplicate for that specific transfer.
          const movedIds=transfer.ids;
          const alreadyFlying=movedIds.filter(id=>scheduled.has(id)).length;
          for(const count of stackMotionCounts(Math.max(0,transfer.count-alreadyFlying)))
            queue(null,genericBack,captureSource,destination,null,false,count);
        }
      }
      // A single accepted engine action can change many zones. Bound the
      // animation workload so dense expansion combinations stay responsive.
      // Dragged and tapped actions use the same transfer plan. A drag changes
      // only that card's start point; it must not suppress legitimate secondary
      // card movements such as draws, discard effects or a partner's transfer.
      flies.slice(0,9).forEach(([template,from,to,target,,count],i)=>animateFlight(template,from,to,target,Math.min(i*CARD_MOTION.stagger,420),cleanups,flightScope,count));
      const flash=(el,cls,ms=CARD_MOTION.highlight)=>{if(!el)return;el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);const release=()=>{el.classList.remove(cls);const i=cleanups.indexOf(release);if(i!==-1)cleanups.splice(i,1);};cleanups.push(release);setTimeout(release,ms);};
      if(plan.draw)flash(deckEl,'tt8-draw-cue');
      if(plan.shuffle){
        const back=deckEl,origin=(old?.size||0)>0?limbo:null;
        if(plan.overload){
          let index=0;
          for(const transfer of plan.catcherFreed||[]){
            const from=catcherRects.get(transfer.index);
            for(const c of transfer.removed){
              const source=old.get(c.id),start=source?.r||from;
              if(rectOK(start)&&rectOK(deck)&&back)animateFlight(source?.template||back,start,deck,null,Math.min(index++*32,600),cleanups,flightScope);
            }
          }
          const from=limbo;
          if(back&&rectOK(from)&&rectOK(deck))for(const count of stackMotionCounts(plan.overloadLimbo))
            animateFlight(back,from,deck,null,Math.min(index++*80,600),cleanups,flightScope,count);
        }else for(const transfer of plan.catcherFreed||[]){
          const from=catcherRects.get(transfer.index);if(back&&rectOK(from)&&rectOK(deck))
            for(const [i,count] of stackMotionCounts(transfer.removed.length).entries())
              animateFlight(back,from,deck,null,i*85,cleanups,flightScope,count);
        }
        if(!plan.overload&&back&&rectOK(origin)&&rectOK(deck)){
          // Correct return count, with a marked bundle for larger shuffles.
          // Deck order and concealed faces are never displayed.
          for(const [i,count] of stackMotionCounts(plan.returnedLimbo.length).entries())
            animateFlight(back,origin,deck,null,25+i*85,cleanups,flightScope,count);
        }
        shuffleOverlay(deckEl,cleanups,plan.overload?CARD_MOTION.move+650:plan.catcherFreed?.length?CARD_MOTION.move+220:plan.shuffle&&(old?.size||0)>0&&(game.limbo||[]).length===0?320:0,flightScope,deck);
        flash(deckEl,'tt8-shuffle-cue',CARD_MOTION.shuffle);
      }
      if(plan.turn||plan.phase||plan.finished)flash(statusEl,'tt8-progress-cue');
      if(!released&&plan.turn)flash(turnEl,'tt8-turn-cue');
      if(!released&&plan.phase&&game.phase==='decision')flash(workspaceEl,'tt8-decision-cue');
      };
      if(!meta.online){play();return;}
      // Never replay a backlog forever. If Firebase sends more than two
      // transitions while one is running, catch up to the latest view without
      // presenting older movements over newer board positions. The cap below
      // still allows every scheduled reveal to finish before the next job.
      const delay=Math.min(420,8*CARD_MOTION.stagger);
      const duration=Math.min(3700,Math.max(
        CARD_MOTION.move+delay,
        plan.drawn.length&&plan.draw?CARD_MOTION.reveal+Math.min(7,plan.drawn.length-1)*250:0,
        plan.shuffle?CARD_MOTION.shuffle+450:0,
        plan.premRevealed?.length?CARD_MOTION.reveal+Math.min(4,plan.premRevealed.length-1)*180:0
      )+60);
      motionQueue.enqueue(play,duration);
    },
    reset,
    resync:reset
  };
}
