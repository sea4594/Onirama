/* The active hand is one physical region. Keep its actual DOM/buttons (and
   therefore their event handlers, IDs and private co-op cards) when moving it
   into the left half of the landscape bottom band. Restore the exact original
   DOM order in portrait; never create a second playable hand. */
let handAnchor=null;
export function arrangeGameplayHand(root,landscape){
 const shell=root?.querySelector?.('.game-viewport');
 const board=shell?.querySelector?.('.tt2-root');
 const shelf=shell?.querySelector?.('.tt6-hand-shelf');
 if(!board||!shelf)return;
 if(handAnchor&&!handAnchor.isConnected)handAnchor=null;
 const hand=shelf.firstElementChild||board.querySelector('.tt2-hand,.tt17-coop-hands > .tt6-self');
 if(!hand)return;
 if(landscape){
  if(hand.parentElement!==shelf){
   handAnchor=document.createComment('restore active hand');
   hand.parentNode.insertBefore(handAnchor,hand);
   shelf.appendChild(hand);
  }
  shelf.style.setProperty('--tt15-card',board.style.getPropertyValue('--tt15-card')||'70px');
 }else if(hand.parentElement===shelf&&handAnchor?.isConnected){
  handAnchor.parentNode.insertBefore(hand,handAnchor);
  handAnchor.remove();handAnchor=null;
 }
}
