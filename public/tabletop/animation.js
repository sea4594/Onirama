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
  game?.pending?.card ? [game.pending.card] : []
];
const allVisible = game => new Set(arrays(game).flatMap(a => cards(a).map(c => c.id)));
const locations = game => {
  const out=new Map();
  arrays(game).forEach((group,zone)=>cards(group).forEach((card,index)=>{if(!out.has(card.id))out.set(card.id,`${zone}:${index}`);}));
  return out;
};
const membership = (game,field) => ids(game?.[field]);
const concealed = game => new Set((game?.players||[]).flatMap(p=>(p.hand||[]).filter(c=>c?.kind==='hidden'&&typeof c.id==='string').map(c=>c.id)));
function signature(game){
  if (!game) return '';
  return JSON.stringify([game.phase,game.status,game.turn,game.active,game.pending?.type,
    game.deckCount,game.shuffleSerial||0,(game.discard||[]).length,(game.limbo||[]).length,
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
  const destinations={discard:membership(next,'discard'),limbo:membership(next,'limbo')};
  return {
    moved,drawn,removed,toHidden,fromHidden,
    draftToHand: cards(previous.draft).filter(c=>!ids(next.draft).has(c.id)&&!after.has(c.id)).map(c=>c.id),
    hiddenDraw:Math.max(0,hiddenAfter.size-hiddenBefore.size),
    toDiscard:removed.filter(id=>destinations.discard.has(id)),
    toLimbo:removed.filter(id=>destinations.limbo.has(id)),
    draw:Math.max(0,(previous.deckCount||0)-(next.deckCount||0)),
    shuffle:(next.shuffleSerial||0)>(previous.shuffleSerial||0)||((next.deckCount||0)>(previous.deckCount||0)&&(previous.limbo||[]).length>(next.limbo||[]).length),
    premRevealed:(next.expansion?.premonitions?.faceUp||[]).filter(id=>!(previous.expansion?.premonitions?.faceUp||[]).includes(id)),
    turn:previous.turn!==next.turn||previous.active!==next.active,
    phase:previous.phase!==next.phase||previous.pending?.type!==next.pending?.type,
    finished:previous.status==='active'&&next.status!=='active',
    draft:previous.phase==='draft'||next.phase==='draft'
  };
}
const center=r=>({x:r.left+r.width/2,y:r.top+r.height/2});
const rectOK=r=>r&&r.width>0&&r.height>0&&Number.isFinite(r.left);
const rect=element=>element?.getBoundingClientRect?.();
function capture(root){
  const found=new Map();
  for(const el of root.querySelectorAll?.('.tt6-table-slot .tt2-root [data-tt-motion-id], .tt6-workspace [data-tt-motion-id]')||[]){
    const id=el.dataset.ttMotionId,r=rect(el);
    if(id&&!found.has(id)&&rectOK(r))found.set(id,{el,r,template:el.cloneNode(true)});
  }
  found.backs=[...(root.querySelectorAll?.('.tt6-table-slot .tt6-opponent .tt6-card-back')||[])].map(el=>({el,r:rect(el),template:el.cloneNode(true)})).filter(entry=>rectOK(entry.r));
  return found;
}
function pile(root,name){
  return root.querySelector?.(`.tt6-table-slot [data-action="inspectPile:${name}"] .tt2-deck-back, .tt6-table-slot [data-action="inspectPile:${name}"] .tt6-pile-face, .tt6-table-slot [data-action="inspectPile:${name}"] .tt2-pile-face`)
    ||root.querySelector?.(`.tt6-table-slot [data-action="inspectPile:${name}"]`);
}
function animateFlight(template,from,to,target,delay,active){
  if(!rectOK(from)||!rectOK(to))return;
  const ghost=template.cloneNode(true);ghost.removeAttribute('id');ghost.removeAttribute('data-pick');ghost.removeAttribute('data-action');
  ghost.setAttribute('aria-hidden','true');ghost.setAttribute('tabindex','-1');
  ghost.classList.add('tt8-flying-card');
  Object.assign(ghost.style,{position:'fixed',left:`${to.left}px`,top:`${to.top}px`,width:`${to.width}px`,height:`${to.height}px`,margin:'0',zIndex:'2147483600',pointerEvents:'none'});
  document.body.appendChild(ghost);
  const source=center(from),dest=center(to),sx=Math.max(.15,from.width/to.width),sy=Math.max(.15,from.height/to.height);
  if(target)target.style.visibility='hidden';
  let finished=false;
  const cleanup=()=>{if(finished)return;finished=true;ghost.remove();if(target)target.style.removeProperty('visibility');const i=active.indexOf(cleanup);if(i!==-1)active.splice(i,1);};
  active.push(cleanup);
  if(typeof ghost.animate!=='function'){cleanup();return;}
  const motion=ghost.animate([
    {transform:`translate(${source.x-dest.x}px,${source.y-dest.y}px) scale(${sx},${sy}) rotate(-4deg)`,opacity:.85},
    {transform:'translate(0,0) scale(1,1) rotate(0)',opacity:1}
  ],{duration:290,delay,easing:'cubic-bezier(.22,.75,.32,1)',fill:'both'});
  motion.finished.catch(()=>{}).then(cleanup);
}

// Reveal only faces that are already part of the authorized next public view.
// Never reconstruct cards from a hidden deck, replay commands, or show a partner's private hand.
const publicCardMap=game=>new Map(arrays(game).flatMap(a=>cards(a).map(c=>[c.id,c])));
function revealGhost(card,from,to,delay,cleanups,{premonition=false}={}){
 if(!rectOK(from)||!rectOK(to)||typeof document==='undefined')return;
 const width=Math.min(148,Math.max(93,innerWidth*.26)),height=Math.round(width*1.42);
 const cx=innerWidth/2,cy=innerHeight/2;
 const overlay=document.createElement('div');overlay.className='tt10-reveal-flight';
 Object.assign(overlay.style,{width:`${width}px`,height:`${height}px`,left:`${cx-width/2}px`,top:`${cy-height/2}px`});
 const front=premonition?card.outerHTML:renderCard(card,{tiny:true});
 overlay.innerHTML=`<div class="tt10-flipper"><div class="tt10-reveal-back"></div><div class="tt10-reveal-front">${front}</div></div>`;
 document.body.appendChild(overlay);
 const source=center(from),destination=center(to);
 const move=(pos)=>`translate(${pos.x-cx}px,${pos.y-cy}px) scale(${Math.max(.13,Math.min(2,pos.width/width))})`;
 const src={...source,width:from.width},dst={...destination,width:to.width};
 let finished=false;
 const cleanup=()=>{if(finished)return;finished=true;overlay.remove();const i=cleanups.indexOf(cleanup);if(i!==-1)cleanups.splice(i,1);};
 cleanups.push(cleanup);
 if(!overlay.animate){cleanup();return;}
 const motion=overlay.animate([{transform:move(src),opacity:.85,offset:0},{transform:'translate(0,0) scale(1)',opacity:1,offset:.3},{transform:'translate(0,0) scale(1)',opacity:1,offset:.65},{transform:move(dst),opacity:1,offset:1}],{duration:940,delay,easing:'ease-in-out',fill:'both'});
 motion.finished.catch(()=>{}).then(cleanup);
}
function premonitionNode(root,id){
 for(const el of root.querySelectorAll?.('.tt5-premonition[data-tt-card-info]')||[]){
  try{if(JSON.parse(el.dataset.ttCardInfo).premonitionId===id)return el;}catch{}
 }
 return null;
}
function shuffleOverlay(back,cleanups,delay=0){
 const r=rect(back);if(!rectOK(r)||typeof document==='undefined')return;
 const ghost=back.cloneNode(true);ghost.removeAttribute('data-action');ghost.removeAttribute('data-tt-drop');
 ghost.classList.add('tt10-shuffle-overlay');ghost.setAttribute('aria-hidden','true');
 Object.assign(ghost.style,{left:`${r.left}px`,top:`${r.top}px`,width:`${r.width}px`,height:`${r.height}px`,animationDelay:`${delay}ms`});
 document.body.appendChild(ghost);
 let timer;
 const cleanup=()=>{clearTimeout(timer);ghost.remove();const i=cleanups.indexOf(cleanup);if(i!==-1)cleanups.splice(i,1);};
 cleanups.push(cleanup);timer=setTimeout(cleanup,delay+700);
}

export function createTabletopAnimator({root}){
  let last=null,key=null,pending=null,cleanups=[];
  const stop=()=>{for(const fn of cleanups.splice(0))fn();};
  const enabled=()=>typeof document!=='undefined' && !document.hidden &&
    document.documentElement.dataset.motion!=='reduced' &&
    !(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
  return {
    before(game,roomKey,page){
      pending=null;
      if(page!=='#/game'||!game){last=null;key=null;stop();return;}
      const nextKey=`${roomKey||''}:${game.mode}`;
      const changed=last&&key===nextKey&&signature(last)!==signature(game);
      if(!changed){if(key!==nextKey)stop();return;}
      const plan=planGameTransitions(last,game);
      pending={plan,old:capture(root)};
      stop();
    },
    after(game,roomKey,page){
      if(page!=='#/game'||!game){last=null;key=null;pending=null;return;}
      const nextKey=`${roomKey||''}:${game.mode}`;
      const event=pending;pending=null;last=game;key=nextKey;
      if(!event||!enabled())return;
      const {plan,old}=event,now=capture(root);
      const deck=rect(pile(root,'deck')),discard=rect(pile(root,'discard')),limbo=rect(pile(root,'limbo'));
      const flies=[];
      // Shared visible cards: the same card moves between hand, draft,
      // Labyrinth, Doors, and expansion zones without inventing engine steps.
      for(const id of plan.moved){
        const a=old.get(id),b=now.get(id);
        if(!a||!b)continue;
        const ca=center(a.r),cb=center(b.r);
        if(Math.hypot(ca.x-cb.x,ca.y-cb.y)>14)flies.push([b.template,a.r,b.r,b.el]);
      }
      // Flip each newly public card in the screen center, then send it to its
      // actual zone (hand, Limbo, Discard or the fixed decision dock).
      if(plan.draw&&rectOK(deck)){
        const known=publicCardMap(game);
        plan.drawn.slice(0,8).forEach((id,i)=>{
          const c=known.get(id);if(!c)return;
          const target=now.get(id),destination=target?.r||(membership(game,'discard').has(id)?discard:membership(game,'limbo').has(id)?limbo:null);
          if(!rectOK(destination))return;
          revealGhost(c,deck,destination,i*175,cleanups);
        });
      }
      if(plan.premRevealed?.length){
        const reserve=rect(root.querySelector?.('.tt5-premonitions .tt5-tile:not(.tt5-premonition)'))||deck;
        for(const [i,id] of plan.premRevealed.slice(0,5).entries()){
          const target=premonitionNode(root,id),dest=rect(target);
          if(target&&rectOK(reserve)&&rectOK(dest))revealGhost(target,reserve,dest,i*180,cleanups,{premonition:true});
        }
      }
      // A cooperative partner's concealed cards remain face down. Moves to
      // and from that hand use only already public information or card backs.
      const oldBack=old.backs.at(-1),newBack=now.backs.at(-1);
      // Public draft cards can visibly enter a concealed hand without
      // storing the concealed card's ID (which can disclose its face).
      for(const id of plan.draftToHand||[]){const a=old.get(id);if(a&&newBack)flies.unshift([newBack.template,a.r,newBack.r,null]);}
      for(const id of plan.toHidden){const a=old.get(id);if(a&&newBack)flies.unshift([a.template,a.r,newBack.r,null]);}
      for(const id of plan.fromHidden){const b=now.get(id);if(b&&oldBack)flies.unshift([oldBack.template,oldBack.r,b.r,b.el]);}
      if(plan.draw&&plan.hiddenDraw&&rectOK(deck)&&newBack){
        for(let i=0;i<Math.min(plan.hiddenDraw,2);i++)flies.unshift([newBack.template,deck,newBack.r,newBack.el]);
      }
      for(const [list,dest] of [[plan.toDiscard,discard],[plan.toLimbo,limbo]]){
        if(!rectOK(dest))continue;
        for(const id of list){const a=old.get(id);if(a)flies.push([a.template,a.r,dest,null]);}
      }
      // A single accepted engine action can change many zones. Bound the
      // animation workload so dense expansion combinations stay responsive.
      flies.slice(0,9).forEach(([template,from,to,target],i)=>animateFlight(template,from,to,target,Math.min(i*36,180),cleanups));
      const flash=(el,cls,ms=600)=>{if(!el)return;el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);const release=()=>{el.classList.remove(cls);const i=cleanups.indexOf(release);if(i!==-1)cleanups.splice(i,1);};cleanups.push(release);setTimeout(release,ms);};
      if(plan.draw)flash(pile(root,'deck'),'tt8-draw-cue');
      if(plan.shuffle){
        const back=pile(root,'deck'),origin=rect(pile(root,'limbo'));
        if(back&&rectOK(origin)&&rectOK(deck)){
          // Two generic card backs visualize the return from Limbo.
          // No hidden card identity, order, or new game step is disclosed.
          animateFlight(back,origin,deck,null,25,cleanups);
          animateFlight(back,origin,deck,null,110,cleanups);
        }
        shuffleOverlay(pile(root,'deck'),cleanups,plan.shuffle&&(old?.size||0)>0&&(game.limbo||[]).length===0?320:0);
        flash(pile(root,'deck'),'tt8-shuffle-cue',750);
      }
      if(plan.turn||plan.phase||plan.finished)flash(root.querySelector?.('.tt6-dock-status'),'tt8-progress-cue');
      if(plan.turn)flash(root.querySelector?.('.tt6-current .tt6-player-heading, .tt2-top'),'tt8-turn-cue');
      if(plan.phase&&game.phase==='decision')flash(root.querySelector?.('.tt6-workspace'),'tt8-decision-cue');
    },
    reset(){last=null;key=null;pending=null;stop();}
  };
}
