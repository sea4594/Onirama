// Consistent tempo for UI transitions; never changes game-state timing.
export const CARD_MOTION=Object.freeze({move:850,reveal:1550,stagger:140,shuffle:1050,highlight:700});
export function catcherTransferCounts(previous,next){
 const before=previous?.expansion?.dreamcatchers?.stacks||[];
 const after=next?.expansion?.dreamcatchers?.stacks||[];
 const limboIds=new Set((previous?.limbo||[]).map(c=>c?.id).filter(Boolean));
 return after.map((stack,index)=>({index,ids:(stack||[]).filter(c=>limboIds.has(c?.id)&&!(before[index]||[]).some(old=>old.id===c.id)).map(c=>c.id)}))
   .filter(x=>x.ids.length).map(x=>({...x,count:x.ids.length}));
}
