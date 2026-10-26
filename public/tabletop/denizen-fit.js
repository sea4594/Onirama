import {CARD_HEIGHT_RATIO,cardHeight} from './card-geometry.js';
// Size Denizen cards against the lane's measured, unscaled content width.
// A card always retains a definite width and height: percentage-based flex
// sizing with height:auto can form a circular intrinsic-size dependency and
// collapse the cards into narrow vertical slivers in fitted viewports.
export const DENIZEN_MIN_WIDTH = 24;
export const DENIZEN_MAX_WIDTH = 44;

export function denizenCardWidth(availableWidth, count, gap=3) {
 if(!Number.isFinite(availableWidth)||availableWidth<=0||!Number.isSafeInteger(count)||count<1)
  return DENIZEN_MAX_WIDTH;
 const spacing=Number.isFinite(gap)?Math.max(0,gap):3;
 const fit=Math.floor((availableWidth-spacing*(count-1))/count);
 return Math.min(DENIZEN_MAX_WIDTH,Math.max(DENIZEN_MIN_WIDTH,fit));
}

// Use actual element dimensions with inline !important. The board has many
// legacy card sizing overrides; a CSS variable alone cannot protect the face
// when a later/more-specific card rule sizes its button or artwork to zero.
function setRect(el,width,height){
 const style=el?.style;
 if(!style?.setProperty)return;
 for(const [name,value] of [
  ['box-sizing','border-box'],['width',`${width}px`],['min-width',`${width}px`],
  ['max-width',`${width}px`],['height',`${height}px`],
  ['min-height',`${height}px`],['max-height',`${height}px`],
  ['flex',`0 0 ${width}px`],['aspect-ratio',`1 / ${CARD_HEIGHT_RATIO}`]
 ])style.setProperty(name,value,'important');
}
export function fitDenizenCards(root){
 if(!root?.querySelectorAll)return 0;
 let fitted=0;
 for(const lane of root.querySelectorAll('.tt35-denizen-lane,.tt17-denizen-cards')){
  const cards=[...(lane.children||[])].filter(el=>
   el.classList?.contains('tt17-denizen-holder')||el.classList?.contains('tt17-denizen-reserve'));
  if(!cards.length)continue;
  const css=typeof getComputedStyle==='function'?getComputedStyle(lane):null;
  const pad=(parseFloat(css?.paddingLeft)||0)+(parseFloat(css?.paddingRight)||0);
  const gap=parseFloat(css?.columnGap||css?.gap)||3;
  const width=denizenCardWidth(Math.max(0,(lane.clientWidth||0)-pad),cards.length,gap);
  lane.style?.setProperty?.('--tt35-measured-width',`${width}px`);
  const height=Math.round(cardHeight(width)*100)/100;
  for(const holder of cards){
   setRect(holder,width,height);
   // Keeper reserves are cards themselves; rallied Denizens are inside a
   // button. These are the same physical rectangle, not nested flex tracks.
   const face=holder.classList.contains('tt17-denizen-reserve')
    ?holder.querySelector?.(':scope > .card')
    :holder.querySelector?.(':scope > .tt17-denizen-card');
   setRect(face,width,height);
   if(face!==holder)setRect(face?.querySelector?.(':scope > .card'),width,height);
  }
  fitted++;
 }
 return fitted;
}
