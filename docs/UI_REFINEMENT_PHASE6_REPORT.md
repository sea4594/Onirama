# Onirama — UI/UX Refinement Phase 6

## Fixed action workspace
- A persistent, fixed-size action strip reserves **126px in portrait phones** (132px on larger portrait displays), or a **194px-wide side rail in short landscape / 234px on larger landscape**. The game tabletop fits in the remaining rectangle, regardless of the current prompt or decision. Page-level scrolling is not introduced.
- Engine phase and pending decision type determine the instruction displayed for drafting, action, automatic refill, all 24 pending-effect types, opponent turns, and win/loss. During Prophecy, the instruction changes from choosing a discard to arranging the remaining cards. No incorrect manual Draw command is presented because engine refill is automatic.
- Existing decision choice controls (including reordering, special expansion effects, spell costs, searches, Dreams, Doors, Nightmares, Incubus, Denizens and Dreamcatchers) now render **inside the workspace**, not over the board. The workspace itself can scroll to accommodate complicated decisions without resizing or covering game zones. All commands still use the original engine dispatcher. Pause and Rules remain optional overlays.
- Play, discard, Tower-side placement, and Escape alternatives are consolidated in the workspace when relevant. Direct drag/drop and clicking tabletop targets remain supported. Redundant in-board selected-card action rows are hidden.
- The Phase 5 insertion-gap implementation now recognizes wrapped, multi-row decision cards using both pointer coordinates.

## Inspectable piles
- Tapping Deck, Discard or Limbo opens a small dismissible, scrollable count window. Pile drop targets still work when playing or dragging cards. The inspector provides counts grouped by base and enabled deck-card expansions, including *zero-count* categories, with original card totals beside current pile counts.
- The game viewer exposes only aggregate counts (`pileInventory`) computed from authoritative deck, discard and Limbo arrays. It does not transmit the draw order or IDs of unrevealed deck cards. Counts are available identically to each co-op seat, as intentionally requested.
- Types not added to the draw deck (e.g. Book of Steps, Mirrors) do not invent entries in draw pile inventory. Expansions that add cards are grouped separately.

## Validation and limitations
- Run `npm run release:gate` and `python scripts/visual-refinement-phase6.py` after application. Phase 6 Node regression tests verify card totals, privacy of card IDs, prompts for all pending decision types, and multi-row reordering. The browser visual matrix uses rendered game fixtures across 64 solo/co-op/expansion/device combinations; it checks dock geometry and viewport overflow.
- Live Firebase, real-device touch behavior and browser-driven end-to-end gameplay under the production hostname could not be exercised in this test environment. These remain acceptance checks for later phases.
- Extreme 320px and 568x320, all-expansion games still depend on Phase 4 fallback scaling; the reserved dock makes this somewhat more pronounced. Readability/animation refinements are scheduled for Phase 7 and final QA.
