# UI Phase 4 — Contextual Card-Effect Dialogs (v0.16.0)

## Scope

The card-game engine, Firebase room protocol, save format and rule implementations are **unchanged**. The UI now presents every modeled `pending` effect in one modal dialog **above** the board instead of extending the page with an inline `decision` section. These are mandatory decisions: backdrop/Escape cannot dismiss them, and the board/nav become inert while they are open. A waiting partner sees only their existing public board and waiting status, never another player's private choices.

- Modal markup and lifecycle controller: `public/tabletop/dialogs.js`.
- Responsive styles, accessible focus containment, short phone-landscape support: `public/tabletop/dialogs.css`.
- The original `decision(g,canAct)` and `handle()` commands are retained and rendered in the new shell; selections still use the same `action(command)` path (which validates in the local rules engine or the Firebase/Node multiplayer transport).
- Ordering controls for Prophecy, Incantation, Sphinx, Diver, Happy Dream, Tower, Denizen and Spell inspection remain accessible via draggable cards and ↑/↓ controls.
- Visual card choices now replace text-only selection for available Keys, Door rewards/searches, Dream searches, Nightmare sacrifices, Premonition Door sacrifices, Denizen rally payments, and Mirror rewards.

## Mandatory effect coverage — 23 types

| Group | Pending type(s) | Interaction |
|---|---|---|
| Sphinx / Diver | `sphinxName`, `sphinxResolve`, `diver` | Name aspect, choose top, bottom arrangement, continue/stop/nightmare |
| Confusion | `confusion` | Order cards and rebuild hand |
| Mirrors | `mirrorReward` | Choose eligible reward cards/color and optional catcher |
| Doors | `doorSearch`, `door` | Choose eligible Door/catcher or Key/Limbo |
| Nightmare | `nightmare` | Four normal penalties, eligible card sacrifices, Incubus/Denizen cancellation |
| Key | `prophecy` | Discard one, arrange remainder |
| Happy Dream | `happyDream`, `happyFetch`, `happyPeek` | Benefit, search or inspection/discard/reorder |
| Denizens | `rally`, `denizenPeek` | Payment, inspect/reorder |
| Premonitions | `premonitionPick`, `premonitionDoor` | Trigger resolution priority and Door choice |
| Glyphs | `incantation` | Door choice and bottom-deck order |
| Towers | `towerLook`, `towerPenalty` | Inspect/reorder or select legal removal / false destruction |
| Book of Steps | `spellPeek` | Inspect bottom and choose top |
| Dreamcatchers | `catchChoose`, `catchOverload` | Choose catcher/failure consequence |
| Generic effects | `moduleDecision` | Select allowed effect |

The four nonmandatory context dialogs are **Mirror pair**, **Cyclobot replacement**, **cooperative discard/swap**, and **Book of Steps Spellbook**. These may be canceled without mutating game state. In particular, the Spellbook can be temporarily opened from an outstanding mandatory decision (including a real Nightmare) and closed to resume the pending effect; spells still use the existing server/engine validation, costs and timing.

## Interaction / accessibility invariants

- Engine owns all legal choices; the overlay never changes the deck, effect stack or card zones directly.
- Every dialog uses `role=dialog`, `aria-modal=true`, a concise accessible label, a contained Tab cycle and appropriate Escape handling.
- Dialogs scroll independently of the tabletop; body scroll is locked only while an overlay is open. On phone portrait, use a bottom sheet; on desktop a centered window; on short landscape, a nearly fullscreen compact dialog.
- Card ordering, selections, and partial effect state persist through UI rerenders. Accepted commands advance the *engine*, not the overlay; the next pending effect then replaces the prior dialog.
- UI controls are visually disabled as needed, but this is not the authorization/security boundary.

## Verification and known limitations

- `npm run release:gate`: 132 tests, including the unchanged card-engine suite and six new Phase 4 tests.
- Chromium offline visual fixture (actual source renderers + styles): **16 screen/decision combinations** covering eight viewports for Prophecy and Nightmare with no outer overflow. Screenshots in `docs/ui-phase4-baselines/`.
- Chromium keyboard smoke checks confirm mandatory Escape behavior, optional Escape handling, board inert state and focus containment.
- Live hosted-app navigation and full two-browser Firebase E2E were **not available in this environment** and remain Phase 8 manual/hosted verification tasks. Offline fixtures are not a substitute for those tests.
- **Phase 5** will move expansion *components* onto the tabletop, and **Phase 6** will redesign the physical two-player table. This phase changes only temporary decision surfaces, not the permanent layout of expansion boards or cooperative areas.
- Publisher-rule ambiguities previously tracked in the rules audit remain unchanged.
