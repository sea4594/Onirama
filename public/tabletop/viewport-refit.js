/* Presentation-only viewport change classification. Safari's visual viewport
   scrolls when its browser chrome moves even if the tabletop's usable geometry
   is identical. Never treat those scroll events as new card destinations. */
const valid = n => Number.isFinite(n) && n > 0;
export function viewportRefitPlan(previous,next,{type='resize'}={}){
  const force = type==='orientationchange'||type==='pageshow';
  if (!next || !valid(next.width) || !valid(next.height))
    return {fit:false,cancelMotion:false,settle:false};
  if (!previous || !valid(previous.width) || !valid(previous.height))
    return {fit:true,cancelMotion:force,settle:force};
  const changed = ['width','height','visualWidth','visualHeight'].some(k=>
    valid(next[k]) && valid(previous[k]) && Math.abs(next[k]-previous[k])>1);
  if (!force && !changed)return {fit:false,cancelMotion:false,settle:false};
  const rotated=(next.width>next.height)!==(previous.width>previous.height);
  const material=rotated||Math.abs(next.width-previous.width)>32||Math.abs(next.height-previous.height)>110;
  return {fit:true,cancelMotion:force||material,settle:force||material};
}
