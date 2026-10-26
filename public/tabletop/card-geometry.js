// One physical card shape for layout fitting, Denizens and animated ghosts.
// CSS uses the matching --tt-card-height-ratio value (1.42).
export const CARD_HEIGHT_RATIO = 1.42;
export const CARD_WIDTH_RATIO = 1 / CARD_HEIGHT_RATIO;

export function cardHeight(width) {
  return Number.isFinite(width) && width > 0 ? width * CARD_HEIGHT_RATIO : 0;
}

// Fit a complete card inside a measured rectangle without distorting its art.
// Coordinates stay centered; this also handles a destination whose CSS box is
// temporarily the wrong shape while the viewport is settling.
export function fitCardRect(rect) {
  if (!rect || !Number.isFinite(rect.width) || !Number.isFinite(rect.height) ||
      rect.width <= 0 || rect.height <= 0) return null;
  const width = Math.min(rect.width, rect.height / CARD_HEIGHT_RATIO);
  const height = cardHeight(width);
  return {
    left: rect.left + (rect.width - width) / 2,
    top: rect.top + (rect.height - height) / 2,
    width, height
  };
}
