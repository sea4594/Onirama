/* Move the original hand DOM, not a clone, so selection/dragging and private
   multiplayer card backs retain their existing identities across rotation. */
const handAnchors = new WeakMap();

export function landscapeCardWidth(width, height, count, {gap=3, heading=17, padding=10}={}) {
  if (count < 1 || width <= 0 || height <= 0) return 0;
  return Math.max(0, Math.floor(Math.min(
    (width - padding - gap*(count-1))/count,
    (height - heading - padding)/1.42
  )));
}

export function sizeLandscapeHands(shelf) {
  if (!shelf?.firstElementChild || !shelf.clientWidth || !shelf.clientHeight) return;
  const content = shelf.firstElementChild;
  const width = shelf.clientWidth - 12;
  const height = shelf.clientHeight - 12;
  if (content.matches('.tt17-coop-hands')) {
    const parts = [...content.children];
    const unit = (width - 8)/2.72; // Same relative columns as the portrait row.
    parts.forEach(part => {
      const count = part.querySelectorAll('.tt6-card-wrap').length;
      const partWidth = part.classList.contains('tt6-shared-block') ? unit*.72 : unit;
      part.style.setProperty('--landscape-hand-card', `${landscapeCardWidth(partWidth,height,count,{padding:13})}px`);
    });
  } else {
    const count = content.querySelectorAll('.tt2-hand-card').length;
    content.style.setProperty('--landscape-hand-card', `${landscapeCardWidth(width,height,count,{padding:12})}px`);
  }
}

/* Grow the dock only when its real decision content would otherwise need an
   inner scrollbar. Cap its growth so the board never disappears entirely. */
export function fitLandscapeDock(shell, landscape) {
  if (!shell?.style) return 0;
  shell.style.removeProperty('--tt6-dock-height');
  if (!landscape) return 0;
  const height = shell.clientHeight;
  if (height <= 0) return 0;
  const base = Math.min(290, Math.max(150, height*.43));
  const panel = shell.querySelector?.('.tt6-workspace');
  shell.style.setProperty('--tt6-dock-height', `${Math.round(base)}px`, 'important');
  const scroll = panel?.querySelector?.('.tt6-dock-scroll');
  const overflow = scroll ? Math.max(0, scroll.scrollHeight - scroll.clientHeight) : 0;
  const maxDock = Math.min(height*.58, height-115);
  const chosen = Math.max(base, Math.min(maxDock, base+(overflow>1?overflow+8:0)));
  shell.style.setProperty('--tt6-dock-height', `${Math.round(chosen)}px`, 'important');
  return Math.round(chosen);
}

export function arrangeGameplayHand(root, landscape) {
  const shell = root?.querySelector?.('.game-viewport');
  const board = shell?.querySelector?.('.tt2-root');
  const shelf = shell?.querySelector?.('.tt6-hand-shelf');
  if (!board || !shelf) return;
  let handAnchor = handAnchors.get(shelf);
  if (handAnchor && !handAnchor.isConnected) { handAnchors.delete(shelf); handAnchor = null; }
  const hand = shelf.firstElementChild || board.querySelector('.tt17-coop-hands,.tt2-hand');
  if (!hand) return;
  if (landscape) {
    if (hand.parentElement !== shelf) {
      handAnchor = document.createComment('restore original tabletop hand');
      handAnchors.set(shelf, handAnchor);
      hand.parentNode.insertBefore(handAnchor, hand);
      shelf.appendChild(hand);
    }
    sizeLandscapeHands(shelf);
  } else if (hand.parentElement === shelf && handAnchor?.isConnected) {
    handAnchor.parentNode.insertBefore(hand, handAnchor);
    handAnchor.remove();
    handAnchors.delete(shelf);
    hand.style?.removeProperty?.('--landscape-hand-card');
    for (const part of hand.children) part.style?.removeProperty?.('--landscape-hand-card');
  }
}
