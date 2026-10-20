// Phase 5: derive expansion presentation cues ONLY from consecutive authorized
// public views. No rules, commands, hidden deck identities, or private choices.
import {premonitionProgress} from './expansions.js';

const list=value=>Array.isArray(value)?value:[];
const publicIds=value=>new Set(list(value).filter(c=>c?.kind!=='hidden'&&typeof c?.id==='string').map(c=>c.id));
const newlyVisible=(before,after)=>list(after).filter(c=>c?.kind!=='hidden'&&typeof c?.id==='string'&&!publicIds(before).has(c.id)).map(c=>c.id);
const added=(before,after)=>list(after).filter(id=>!list(before).includes(id));

export function planExpansionMotion(previous,next){
  if(!previous||!next||previous.mode!==next.mode)return null;
  const a=previous.expansion||{},b=next.expansion||{};
  const towerBefore=a.towers||{},towerAfter=b.towers||{};
  const catchBefore=a.dreamcatchers||{},catchAfter=b.dreamcatchers||{};
  const premBefore=a.premonitions||{},premAfter=b.premonitions||{};
  const mirrorBefore=a.mirrors||{},mirrorAfter=b.mirrors||{};
  const oniBefore=a.oniverse||{},oniAfter=b.oniverse||{};
  const bookBefore=a.book||{},bookAfter=b.book||{};
  const incubusBefore=a.incubus||{},incubusAfter=b.incubus||{};
  const faceUp=list(premAfter.faceUp);
  const progress=faceUp.filter(id=>
    list(premBefore.faceUp).includes(id)&&
    premonitionProgress(id,previous.players).current!==premonitionProgress(id,next.players).current
  );
  const mirrorPlaced=Object.entries(mirrorAfter.stacks||{}).flatMap(([name,stack])=>
    newlyVisible(mirrorBefore.stacks?.[name],stack).map(id=>({id,name}))
  );
  const spellSpent=newlyVisible(bookBefore.removed,bookAfter.removed)
    .filter(id=>publicIds(previous.discard).has(id));
  return {
    towersPlaced:newlyVisible(towerBefore.alignment,towerAfter.alignment),
    towersRemoved:list(towerBefore.alignment).filter(c=>!publicIds(towerAfter.alignment).has(c?.id)).map(c=>c.id).filter(Boolean),
    towerProtectionChanged:Boolean(towerAfter.protected)!==Boolean(towerBefore.protected),
    catcherLost:list(catchBefore.active).flatMap((value,i)=>value===true&&catchAfter.active?.[i]===false?[i]:[]),
    failsafeSpent:Math.max(0,(catchBefore.failsafes||0)-(catchAfter.failsafes||0)),
    premonitionProgress:progress,
    premonitionResolved:added(premBefore.resolved,premAfter.resolved),
    mirrorPlaced,
    mirrorCompleted:added(mirrorBefore.completed,mirrorAfter.completed),
    rallied:newlyVisible(oniBefore.rallied,oniAfter.rallied),
    denizensDeparted:list(oniBefore.rallied).filter(c=>!publicIds(oniAfter.rallied).has(c?.id)).map(c=>c.id).filter(Boolean),
    treasureStored:newlyVisible(oniBefore.treasure,oniAfter.treasure),
    spellSpent,
    incubusStored:newlyVisible(incubusBefore.stored,incubusAfter.stored),
    incubusActivated:incubusBefore.used!==true&&incubusAfter.used===true,
    doorsGained:(next.players||[]).flatMap((p,i)=>newlyVisible(previous.players?.[i]?.doors,p.doors)),
    doorsLost:(previous.players||[]).flatMap((p,i)=>list(p.doors).filter(c=>!publicIds(next.players?.[i]?.doors).has(c.id)).map(c=>c.id)),
    bookGoalsChanged:list(bookAfter.goals).some((goal,i)=>goal.done!==bookBefore.goals?.[i]?.done),
    nightmareRevealed:previous.pending?.type!=='nightmare'&&next.pending?.type==='nightmare'&&next.pending?.card?.kind==='nightmare'
  };
}

// Pure public-only fingerprint. Position/order changes remain in the main card
// signature; these supplementary statuses must trigger effects even when no
// card changes physical zones (e.g., a Failsafe or a resolved Premonition).
export function expansionMotionSignature(game){
  const e=game?.expansion||{};
  return JSON.stringify([
    e.towers?.protected||false,
    e.dreamcatchers?.active||[],e.dreamcatchers?.failsafes??null,
    e.premonitions?.faceUp||[],e.premonitions?.resolved||[],
    e.mirrors?.completed||[],
    (e.book?.removed||[]).map(c=>c.id),(e.book?.goals||[]).map(g=>!!g.done),
    e.incubus?.used||false,
    // Changes to already-active Premonition progress must be recognized.
    (e.premonitions?.faceUp||[]).map(id=>[id,premonitionProgress(id,game?.players).current])
  ]);
}

// Some expansion zones only render the last 1–2 cards. Missing card elements
// should land on the zone/tile itself, NOT vanish or target another card.
export function expansionDestinationRect(zone,visibleRect,anchors={}){
  if(zone==='towers')return visibleRect||anchors.towers||null;
  if(zone==='incubus')return visibleRect||anchors.incubus||null;
  if(zone==='rallied'||zone==='treasure')return visibleRect||anchors.denizens||null;
  if(zone?.startsWith('mirror:'))return anchors.mirrors?.[zone.slice(7)]||visibleRect||null;
  return visibleRect||null;
}
