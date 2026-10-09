# UI Phase 5 — Physical expansion tabletop

## Scope and release boundary

All **solo** games, regardless of which standard/promo expansions are active, now use the Phase 2–4 virtual tabletop. Components are rendered from the existing `viewFor` projection in `public/tabletop/expansions.js`; input controls call the existing `handle` / `act` entry points. No game-state schema, timing rules, Firebase room data, or engine action implementation changes are included in this phase.

Multiplayer keeps its existing working board until UI Phase 6, when both player areas will be redesigned as a coherent whole. Mandatory and optional pop-ups still use the Phase 4 dialog controller.

| Expansion | Persistent tabletop representation | Available actions / behavior |
|---|---|---|
| Book of Steps | Ordered colored Goal tiles, progress, Spellbook | Spellbook popup; Goals show completed state; paid spell decisions remain in pop-ups |
| Glyphs | Glyphs in hand, 3 Door slots/color | Discard a Glyph → Incantation modal, automatically resolved by engine |
| Dreamcatchers | Four catcher slots with stored-card previews, Lost Dream counts, Failsafe Books | Free eligible catcher; full caught stack and overflow choices via the existing popup |
| Towers | Physical shared Alignment, printed left/right edge symbols and numbers, left/right insertion targets | Drag/tap legal left or right; discard Tower → inspect/reorder popup; Nightmare penalty popup |
| Happy Dreams / Premonitions | All revealed Premonition faces and count of unrevealed cards | Trigger and Happy Dream decisions remain automatic/modals |
| Crossroads / Dead Ends | Wild cards and Dead Ends in hand; Escape appears when available | Normal play/discard restrictions from engine; Escape discards all resources |
| Door to the Oniverse | Dedicated wild Door slot, rallied Denizens, stored Treasure Keeper card | Denizen ability buttons; selectable stored card; interrupt abilities remain in modals |
| Mirrors | Each enabled Mirror, exploration state, held-card previews | Tap enabled Mirror → select two Locations in Phase 4 popup; reward popup |
| Sphinx / Diver / Confusion | Dream cards in deck; no permanent board object | Existing conditional reveal/reorder dialogs |
| Little Incubus | Pawn with level, stored Locations, used state | Activate anticipation; cancel a Nightmare during its modal |

## Important interaction details

- All selectable/dragged hand Locations and Towers use the **same validated engine commands**. Tower side legality uses the exact printed `left`/`right` marks; it does not assume Sun and Moon are mutually exclusive.
- Every permanent expansion zone remains in the DOM regardless of responsive density, even when represented by stacks with a count. The actual content of a stack can be inspected via card tooltip/accessible label, and action-specific popups expose choices.
- Hidden deck order and unrevealed cards are **not** displayed.
- Optional buttons are shown only when the action is available; controls are disabled while a mandatory decision is open.
- With many expansions on a phone, scrolling **the tabletop vertically** is necessary; shrinking all physical cards to an illegible size would be worse. Desktop uses multiple columns, while narrow and short viewports reflow expansion components into compact shelves.
- Off-deck rules assumptions remain in `docs/UI_PHASE2_AND_RULINGS.md`. This UI-only phase makes no new rule adjudications.

## QA status

- `npm run release:gate` includes all engine, transport, migration, and prior UI tests.
- `tests/tabletop-phase5.test.js` covers every one of the 512 solo expansion enablement combinations, special Door slot counts, Tower side legality, stored cards, Dead Ends, action entry points, difficulty variants, and engine card conservation.
- `scripts/tabletop-phase5-fixture.js` generates static HTML using the **actual UI modules and game view** for all-expansion, smaller-combination, and Incubus cases, with populated off-deck components for layout stress testing.
- Chromium execution was attempted, including a minimal `Hello` page, but failed to complete even the minimal render in this environment. **No visual screenshot validation is claimed**. This is an explicit remaining condition for the final Phase 8 visual QA and should also be checked in the live site after installing this phase.

## Future phases

6. Complete cooperative tabletop, two personal rows, shared cards, draft, Firebase sync and privacy.
7. Refine other screens and navigation to match the tabletop.
8. Responsive visual and interaction QA across all viewport/mode/expansion combinations with real browser screenshots; fix defects.
9. Remove obsolete UI code; run full release gate and production polish.
