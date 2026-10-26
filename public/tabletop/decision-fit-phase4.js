/* Phase 4 — decision geometry belongs to the actual action workspace, not
   viewport vw units. This does not change game data or card artwork. */
import { CARD_HEIGHT_RATIO } from './card-geometry.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

/** Width of a full-aspect card in a decision lane. If the requested readable
    minimum will not fit, the lane scrolls rather than squeezing its artwork. */
export function decisionCardWidth({ width, height, count, reserve = 0, gap = 4, minimum = 32, maximum = 76 } = {}) {
  const w = Math.max(0, Number(width) || 0);
  const h = Math.max(0, Number(height) || 0);
  const n = Math.max(1, Math.floor(Number(count) || 1));
  const fitWidth = (w - reserve - 8 - gap * (n - 1)) / n;
  const fitHeight = (h - 10) / CARD_HEIGHT_RATIO;
  return Math.round(clamp(Math.floor(Math.min(fitWidth, fitHeight, maximum)), minimum, maximum));
}

/** Fit all decision families from the same available geometry. Resizing is
    idempotent; these properties belong to the regenerated dock element. */
export function fitDecisionPanel(root, { portraitPhone } = {}) {
  const dock = root?.querySelector?.('.game-viewport > .tt6-workspace');
  if (!dock) return null;
  const viewport = root.querySelector('.game-viewport');
  const w = viewport?.clientWidth || 0, h = viewport?.clientHeight || 0;
  if (portraitPhone === undefined) portraitPhone = w > 0 && h > 0 && h >= w && w < 600;
  // Preserve the painstakingly established smartphone-portrait sizing.
  if (portraitPhone) return null;
  const scroll = dock.querySelector('.tt6-dock-scroll');
  if (!scroll) return null;
  const width = Math.max(0, scroll.clientWidth || dock.clientWidth);
  const height = Math.max(0, scroll.clientHeight || dock.clientHeight - 35);
  if (!width || !height) return null;
  const d = dock.querySelector('.tt6-dock-decision');
  const draft = dock.querySelector('.tt28-draft-cards');
  const count = (selector, within = d) => within?.querySelectorAll?.(selector)?.length || 0;
  const available = { width, height };
  const results = {};
  if (draft) {
    const cards = count(':scope > .card', draft);
    if (cards) {
      const size = decisionCardWidth({ ...available, count: cards, minimum: 32, maximum: 72, gap: 5 });
      draft.style.setProperty('--tt36-draft-card', `${size}px`);
      results.draft = size;
    }
  }
  if (!d) return results;
  // Keep room for a heading and Confirm/Pass buttons in multi-stage effects.
  const controls = d.querySelector('.tt23-happy-controls, .tt7-prophecy > button[data-action="prophecyConfirm"], .tt20-incantation > button[data-action="effectConfirm"], .tt26-happy-fetch > .actions');
  const heading = d.querySelector('.decision > h2');
  const reserve = (controls ? Math.max(30, Math.min(44, controls.offsetHeight || 34)) : 0)
    + (heading ? Math.max(12, Math.min(24, heading.offsetHeight || 18)) : 0);
  const families = [
    ['prophecy', '.tt7-prophecy', '.tt26-prophecy-cards > .tt3-order-item', 1],
    ['happy', '.tt23-happy-peek', '.tt23-peek-cards > .tt3-order-item, .tt23-discard-card', 0],
    ['incantation', '.tt20-incantation', '.tt20-incantation-cards > :is(.tt20-incantation-choice,.tt20-incantation-reveal,.tt3-order-item)', 0],
    ['reorder', '.tt24-reveal-list, .tt3-order-list:not(.tt23-peek-cards):not(.tt26-prophecy-cards):not(.tt20-incantation-cards)', ':scope > .tt3-order-item', 0],
    ['options', '.tt4-card-choices', ':scope > .tt4-card-option', 0]
  ];
  let applied = false;
  for (const [family, selector, items, extra] of families) {
    const lane = d.querySelector(selector);
    if (!lane) continue;
    const number = count(items, lane) + extra;
    if (!number) continue;
    // Discard shelves and the Prophecy slot add height beyond the card itself.
    // Budget that extra chrome before fitting so Confirm remains visible.
    const extraVertical = family === 'happy' ? 22 : family === 'prophecy' ? 13 : 0;
    const size = decisionCardWidth({ ...available, height: Math.max(50, height - reserve - extraVertical), count: number, minimum: 32, maximum: 72, gap: 4 });
    lane.style.setProperty('--tt36-decision-card', `${size}px`);
    if (family === 'prophecy') lane.querySelector('.tt7-compact-row')?.style?.setProperty('--tt7-card-width', `${size}px`);
    if (family === 'happy') lane.querySelector('.tt23-happy-row')?.style?.setProperty('--tt23-card-width', `${size}px`);
    if (family === 'incantation') lane.querySelector('.tt20-incantation-cards')?.style?.setProperty('--tt31-card-width', `${size}px`);
    if (family === 'reorder' || family === 'options') d.style.setProperty('--tt26-panel-card', `${size}px`);
    results[family] = size;
    applied = true;
  }
  if (applied) d.dataset.tt36Fitted = 'true';
  return results;
}
