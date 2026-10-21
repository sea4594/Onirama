// Preserve the player's deliberate inspection position unless the visible
// Labyrinth actually changes. A newly added card must expose the next slot.
// DOM measurements are taken after the tabletop fitter has run.
const lanes = root => [...(root?.querySelectorAll?.('[data-tabletop-scroll]') || [])];
const cards = lane => [...lane.querySelectorAll('.card.tiny')];
const tail = list => list.at(-1)?.getAttribute('data-tt-motion-id') || null;

export function captureLabyrinthScroll(root) {
  return new Map(lanes(root).map(lane => {
    const shown = cards(lane);
    return [lane.dataset.tabletopScroll, {count: shown.length, last: tail(shown), left: lane.scrollLeft}];
  }));
}

export function restoreLabyrinthScroll(root, previous) {
  for (const lane of lanes(root)) {
    const before = previous?.get(lane.dataset.tabletopScroll), shown = cards(lane);
    if (before && before.count === shown.length && before.last === tail(shown)) {
      lane.scrollLeft = before.left;
    } else {
      // Includes the rightmost blank next-card slot, not just the last face.
      lane.scrollLeft = lane.scrollWidth;
    }
  }
}
