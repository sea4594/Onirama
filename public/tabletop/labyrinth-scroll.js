// Preserve the player's deliberate inspection position while keeping a
// Labyrinth already at its active end pinned there across draws, rerenders,
// and responsive card-size changes. Never preserve a stale absolute pixel
// offset in place of a trailing-edge position.
const lanes = root => [...(root?.querySelectorAll?.('[data-tabletop-scroll]') || [])];
const cards = lane => [...lane.querySelectorAll('.card.tiny')];
const tail = list => list.at(-1)?.getAttribute('data-tt-motion-id') || null;
const rightmost = lane => Math.max(0, lane.scrollWidth - lane.clientWidth);
const nearEnd = lane => rightmost(lane) - lane.scrollLeft <= 4;

export function captureLabyrinthScroll(root) {
  return new Map(lanes(root).map(lane => {
    const shown = cards(lane);
    return [lane.dataset.tabletopScroll, {count: shown.length, last: tail(shown), left: lane.scrollLeft, followEnd: nearEnd(lane)}];
  }));
}

export function restoreLabyrinthScroll(root, previous) {
  for (const lane of lanes(root)) {
    const before = previous?.get(lane.dataset.tabletopScroll), shown = cards(lane);
    const unchanged = before && before.count === shown.length && before.last === tail(shown);
    if (unchanged && !before.followEnd) {
      // The player intentionally scrolled left to inspect older cards.
      lane.scrollLeft = Math.min(Math.max(0, before.left), rightmost(lane));
    } else {
      // Follow the active end during draws, fitting, and new placements.
      // Includes the rightmost blank next-card slot, not just the last face.
      lane.scrollLeft = rightmost(lane);
    }
  }
}
