# UI Phase 3 — Interaction contract and verification

**Status:** v0.15.0. The Phase 2 responsive solo base-game tabletop is now interactive. This is a UI/controller change only; the deterministic rules engine, Firebase transport, card counts, saves, difficulty settings and all expansion mechanics are unchanged.

## Direct tabletop gestures

| Situation | Pointer/touch | Keyboard / click alternative | Engine action |
|---|---|---|---|
| Select ordinary hand Location | Tap or click the card | Tab to card; Enter/Space | UI-only selection |
| Play a legal Location | Drag to Labyrinth, or select then tap Labyrinth | Select card, Play; or P while on board | `{type:'play',id}` |
| Discard a legal Location | Drag to discard pile, or select then tap discard | Select card, Discard; or D | `{type:'discard',id}` |
| Choose a different hand card | Tap/click another card | Arrow left/right while focused on hand | UI-only selection |
| Cancel selection | Tap current card again or press Escape | Escape | UI-only selection |
| Bad destination or cancelled pointer | No engine command; card stays in hand | N/A | None |
| Awaiting pending decision, opponent's turn, ended game | Moves unavailable | Disabled selectors/controls | None |
| Reorder revealed cards (including Prophecy and expansion effects) | Drag displayed card before another displayed card | Original up/down arrow buttons | UI-only change to order pending confirmation |

### Rules consistency and ownership

- Legal destinations come from `soloLegalTargets()` and are recomputed on submission. Only the active solo player in the *action* phase, holding an ordinary Location, can play/discard it. A Location matching the previous Labyrinth symbol can be discarded but cannot be played. All effects and final legality are still validated by `engine/game.js` on submission.
- The controller uses pointer events so mouse, stylus, and touch take the same path. A movement threshold prevents ordinary taps from becoming drags. On a successful drop, a synthetic click is suppressed to avoid submitting a second move.
- The only user data transmitted on play/discard is the card ID and original engine action type. No revealed deck information, card order, hidden card IDs, or new server APIs are introduced.
- Dragging ordered cards changes only the in-memory **pending visual ordering** (`prophecyOrder`/`effectOrder`); the preexisting confirmation button sends the same engine action as before. Order cards cannot be dragged between different decision groups. Previous up/down buttons remain supported.
- No board gesture can skip a Nightmare or Door decision, resolve an effect belonging to the other player, or dispatch during a busy mutation.

### Responsive and accessibility behavior

- Eight offline Chromium fixture layouts have been rendered (320×568, 568×320, 390×844, 844×390, 768×1024, 1024×768, 1440×900, 1920×1080). In these fixtures the four primary tabletop zones and all five hand cards remain present, with no document-level horizontal overflow.
- The same fixture exercised pointer drag to Labyrinth, tap/click onto discard, and P/D keyboard actions at all eight sizes. Additional browser checks exercised invalid same-symbol drops, pending decision blocking, synthetic touch pointer drops, and drag reordering.
- Native focusable buttons and their labels remain; a drag is **never required**. Reduced-motion preferences disable transition effects.

### Scope and remaining phases

- The Phase 3 physical drag-to-Play/Discard gesture currently targets the **solo base game board** introduced in Phase 2. Cooperative hand + shared-resource tabletop actions will be integrated in UI Phase 6; expansion-specific tabletop drops in Phase 5. Existing expansion/cooperative decision buttons are unchanged and remain functional.
- Phase 4 replaces inline mandatory decisions with accessible temporary popups and drag-capable card selectors; Phase 8 provides complete hosted-browser/device integration QA. This phase's browser fixtures are screenshots of the actual renderer with seeded state; browser navigation to `localhost` was blocked in this environment, so they are **not** claimed as full hosted app end-to-end tests.
- Rule ambiguities remain documented in `docs/UI_PHASE2_AND_RULINGS.md`; Phase 3 introduces no new rule adjudications.
