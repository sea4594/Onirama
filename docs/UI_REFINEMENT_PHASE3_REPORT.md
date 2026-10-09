# Onirama UI Refinement — Phase 3: Forest-Based Theme System

## Delivered

- Replaced the old unrelated Ocean/BW/Forest/Clay/Berry light/dark palette set with **Forest (default)** and five new coordinated variants: **Moonlit, Copper, Lagoon, Heather, Sandstone**.
- Unified the application's navigation, home, setup, multiplayer/lobby, settings, tutorials, results/history, game felt, expansion controls, deck backs, and in-game popup styling under shared semantic design tokens in `public/theme.css`.
- Made legacy saved theme IDs safely fall back to Forest; preserved motion, card sizing, contrast and text preferences. The browser theme-color metadata now tracks the selected palette when supported.
- Added the same Theme selector to the in-game Pause settings, without interrupting the game.
- Replaced typography-dependent UI icons with locally rendered accessible, decorative SVG vectors (`public/icons.js`), including navigation, pause, rules, dialogs, expansion equipment, card symbols and card backs. Text descriptions and existing button actions remain unchanged.
- Preserved the four canonical gameplay card colors; other palettes alter the surrounding environment rather than the game rules.
- Updated existing VM fixture harnesses to include the new icon renderer, keeping baseline/regression tests meaningful. The full Pages build copies both new assets.

## Verification

- Full gate: `npm run release:gate` — **178 tests passing** and GitHub Pages build passing (previously 172 tests).
- Offline Chromium/Playwright: **108 page/theme/viewport render checks** (six themes × six fixture groups × three representative viewports). Home, setup, settings, multiplayer, full-expansion solo and full-expansion co-op rendered without document overflow and with visible SVG icons. Captured representative screenshots, inspected results, and verified palette tokens change with themes.
- Included reproducible optional visual script: `python scripts/visual-refinement-phase3.py` (requires Playwright and Chromium).
- Browser environment blocked even loopback HTTP navigations, so live clicking/reload persistence and Firebase sessions were not independently exercised in Chromium. Settings persistence is covered by the existing automated tests, while real-device testing remains recommended.

## Deferred to future phases

- Phase 4: physical tabletop density/card legibility and layout adjustments. Existing Phase 2 fit behavior is intentionally preserved.
- Phase 5: card reordering, inspection gestures and interaction simplification.
- Phase 6: detailed pile inspections and view-preserving decisions.
- Phases 7–9: animated progression, multiplayer lifecycle and replays.
- Phase 10: holistic polish and physical-device QA.

No rules, network protocols, game-state transitions or Firebase security rules were modified.
