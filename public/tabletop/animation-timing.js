// Presentation-only timing. The maximum movement time is an upper bound used
// by multiplayer sequencing and replay; individual flights use distance.
export const CARD_MOTION=Object.freeze({move:620,reveal:1180,stagger:95,shuffle:780,highlight:460,turn:360});

const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
export function cardTransferDuration(from,to){
  if(!from||!to)return CARD_MOTION.move;
  const coordinates=[from.left,from.top,from.width,from.height,to.left,to.top,to.width,to.height];
  if(!coordinates.every(Number.isFinite))return CARD_MOTION.move;
  const x=from.left+from.width/2-to.left-to.width/2;
  const y=from.top+from.height/2-to.top-to.height/2;
  // Pixel distance is in CSS pixels, independent of device pixel density.
  // Short reorganizations feel immediate; long desktop moves stay readable.
  return Math.round(clamp(185+Math.hypot(x,y)*.36,230,CARD_MOTION.move));
}

export function catcherTransferCounts(previous,next){
 const before=previous?.expansion?.dreamcatchers?.stacks||[];
 const after=next?.expansion?.dreamcatchers?.stacks||[];
 const limboIds=new Set((previous?.limbo||[]).map(c=>c?.id).filter(Boolean));
 return after.map((stack,index)=>({index,ids:(stack||[]).filter(c=>limboIds.has(c?.id)&&!(before[index]||[]).some(old=>old.id===c.id)).map(c=>c.id)}))
   .filter(x=>x.ids.length).map(x=>({...x,count:x.ids.length}));
}
