# Phase 10 — Final UI/UX refinement

**Baseline:** Phase 9 (`ONIRAMA_PHASE9_RECONNECTION_REPLAYS`). No game-rule, Firebase protocol, room ownership, or replay-data changes are included in this patch.

## Findings and corrections

1. **Compact phone tabletop was unnecessarily miniaturized.** At 320 × 568 with all compatible expansions, four full-width secondary expansion shelves forced a scale of ~0.58. The compact portrait layout now pairs Dreamcatchers/Premonitions and Denizens/Mirrors into two-column shelves, keeping every physical component present while increasing the rendered fit to ~0.74.
2. **Door and pile cards looked disconnected on wide screens.** Their flex children consumed the entire available width. Doors now form a centered sequence in goal order, and Limbo/Deck/Discard/Spells are presented as one compact grouping. Phone Door zones still span the full width.
3. **Selection appearance was inconsistent between objects.** The remaining selected Premonition, Goal, and reordering targets are explicitly outlined without background, transform, shadow, or border-size changes.
4. **Dreamcatcher inspection did not work from a keyboard.** Interactive expansion tiles are containers (because they can include separate buttons), so Enter/Space did not activate the parent tile. Both keys now dispatch that tile's original command without adding nested buttons.
5. **Replay could lose keyboard focus on multiplayer updates.** Replay controls now preserve focus when the underlying game rerenders; Tab and Shift-Tab remain in the read-only replay window, and closing replay returns to the Replay button.
6. **Card inspection could spill outside the bottom edge of a short viewport.** Positioning is now clamped on both axes. In addition, Escape previously failed because the inspector is mounted outside the app's event root. Escape now closes it and restores focus appropriately.
7. **Narrow replay controls were unnecessarily large.** They now shrink their horizontal padding and height on tight screens without changing their meaning.

## Verification

- Full Node release gate: syntax verification, all tests, GitHub Pages build.
- Browser-rendered matrix: eight viewport sizes × six scenarios (solo/co-op, base/all expansions, drafting, 45-card Labyrinth) × six themes = **288 themed checks**. Also compared selected and unselected layouts for **48 geometry pairs**. No document-level overflow, offscreen panel controls, tabletop/action-panel overlap, or zone movement detected.
- Card inspection gesture tests: **five viewports**; right-click, mouse-hold, Escape dismissal, viewport containment, and Premonition information.
- Reduced-motion, hidden-card privacy, all engine decisions, and multiplayer protocols continue under the existing regression suite; there were no corresponding engine changes.

## Not verified in this environment

Live Firebase synchronization/security-rule publication and real multi-device reconnection, iOS/Android native touch behaviors (including browser chrome/safe-area differences), or browser navigation to the running app (localhost/browser navigation was restricted). These require testing on the deployed site and physical devices. Offline Chromium fixtures are *not* a substitute for that verification.
