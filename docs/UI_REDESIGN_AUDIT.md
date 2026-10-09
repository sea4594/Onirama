# Onirama UI rebuild — Phase 1 audit and architectural contract

This document is **not** an assertion that every publisher rule is verified. `docs/RULES_AUDIT.md` and `docs/PHASE10_RULES_MATRIX.md` remain authoritative for outstanding uncertainties. Phase 1 must not change game semantics.

## Baseline inspection (v0.12.3)

Current file layout: `public/app.js` owns routes, game actions, expansion panels, pending-decision controls, local/Firebase session glue, and large HTML templates. `public/styles.css` includes a legacy board layout followed by overlapping phase-specific overrides. The engine in `engine/` supplies actions, view masking, state transitions, and module-specific state. **Keep the engine, commands, Firestore protocol, saves, themes, and game rules unchanged.**

Main design failures identified:
- The `.game-layout` is a stack of panels that grows dramatically with enabled expansions; the draw/discard pile, hand, and both players are spatially separated.
- Actions are detached from cards, with permanent Play/Discard/Use controls and explanatory paragraphs.
- Decision choices are inline HTML in `decision()`, `expansionBoard()`, and `prophecy()`, sometimes alongside unrelated panels.
- `board()` shows only the latest 18 Labyrinth cards, hides some physical tabletop information in a sidebar or truncated list, and uses two narrow columns that do not react to expansion density.
- Existing mobile CSS chiefly forces horizontal scrolling and stack breaks; orientation and actual game complexity are not used to choose the arrangement.
- Shared/player-private multiplayer information needs explicit visual zoning to prevent accidental reveal or mixing.
- Long selected-card descriptions compete with gameplay area; text labels should move to card inspection and contextual actions.

## Target modules and strict boundaries

| Area | Contract | Status after Phase 1 |
|---|---|---|
| `engine/*` | Sole authority for legal state transitions, random draws, and masking | Unchanged |
| `public/firebase-room.js` | Real-time cooperative transport/anonymous identity | Unchanged |
| `public/tabletop/cards.js` | Pure, escaped card markup/semantic description; no action logic | **Extracted and used by old board** |
| `public/tabletop/zones.js` | Named, immutable inventory of all game zones and decision types | **Implemented** |
| `public/tabletop/layout.js` | Deterministic response to viewport, mode, and expansion count | **Implemented; metrics connected to board** |
| `public/tabletop/tokens.css` | Scoped visual tokens for new tabletop | **Implemented; does not restyle old game** |
| `public/tabletop/layout.css` | Isolated layout study; future tabletop selectors | **Scaffolded** |
| `public/tabletop-preview.html` | Non-playable layout study for testing density/viewports | **Implemented, deliberately not linked in navigation** |
| Action interpreter (Phase 3) | Only generates existing engine commands from gestures | Pending |
| Decision overlay (Phase 4) | One reusable temporary dialog covering every pending type | Pending |
| Expansion tabletop (Phase 5) | Visible on-table objects matching actual expansion state | Pending |

**Do not introduce a second rules engine in the UI.** Do not let CSS/data attributes decide legal actions. Each accepted gesture must dispatch an existing validated command.

## Complete game zone inventory

Always present: draw, discard, Limbo, turn/objective; each player: Labyrinth, Doors, hand. Cooperative mode adds two player areas, the shared hand, and draft area when drafting. Expansion-owned additional zones:

- Book of Steps: ordered Goals and Spellbook; Glyphs: additional Doors are part of existing Door zones.
- Dreamcatchers: four catcher piles, Failsafe Books; Towers: Alignment.
- Happy Dreams/Dark Premonitions: face-up Premonitions and unseen reserve.
- Crossroads/Dead Ends: special cards inside ordinary hand/Labyrinth (not a permanent panel).
- Door to the Oniverse: rallied Denizens and Treasure Keeper storage, extra Door in Doors.
- Mirrors: Mirror board with cards stored under each mirror.
- Sphinx/Diver/Confusion: temporary choices, no permanent expansion board.
- Little Incubus: pawn/charge and stored cards, alone with base game.

The inventory is executable via `zonesFor()`. An inactive expansion cannot produce an orphan panel. Dense arrangements may use represented stacks and counts, but every required **zone** must remain visible and inspectable.

## Decision contract (23 engine pending types)

| Family | Engine types | Required future temporary UI |
|---|---|---|
| Door/Key | `doorSearch`, `door` | Claim/skip, matching Key source, catcher search/free choices |
| Nightmare | `nightmare`, `towerPenalty` | Choose legal penalty, Door/Key targets, Tower destruction/cancel |
| Inspect/reorder | `prophecy`, `incantation`, `towerLook`, `spellPeek`, `happyPeek`, `denizenPeek`, `sphinxResolve`, `diver`, `confusion` | Select/reorder cards with keyboard fallback and discard/top/bottom targets |
| Dreamcatchers | `catchChoose`, `catchOverload` | Choose catcher or overload consequence |
| Denizens | `rally` | Choose rally payment or decline |
| Happy Dream | `happyDream`, `happyFetch` | Choose benefit/card from deck |
| Premonitions | `premonitionPick`, `premonitionDoor` | Resolve order, Door ownership/target |
| Promo | `sphinxName` | Name valid aspect |
| Mirror | `mirrorReward` | Choose correct reward cards/colors |
| Generic | `moduleDecision` | Effect choices |

This table tracks all `PENDING_DECISIONS`; a future release gate will require every type to render a valid choice set in solo/co-op, including interrupted effects/reconnection.

Additional contextual actions to retain: play/discard Location, Tower placement both ends, Tower penalty, Escape, cooperative draft/discard+swap, Mirror pairs, spell costs/Goals, Denizen ability, Dreamcatcher freeing, Incubus activation, hand inspection. Rules remain source-driven.

## Responsive layout specification

### Modes / density

- `portrait`, `portrait-dense`, `landscape`, `landscape-dense` result from **actual available width and height**, number of enabled expansions, and solo vs two-player play.
- `compact` is triggered at small width OR short landscape height; `medium` and `spacious` permit larger cards. Both standard and compact card sizes have floor dimensions; the overflow strategy is **overlapping stacks + inspection**, not microscopic cards.
- Dense states must not disable zones or actions. Decorative components may compress, the card inspector/dialog must always have a keyboard/tap alternative.
- Solo needs a single hand and Labyrinth; cooperative needs both Labyrinths and Door areas plus the shared hand and owner-only private cards.
- Use `ResizeObserver` on the actual tabletop in Phase 2; Phase 1 uses render/viewport resize metrics only to avoid changing legacy interaction timing.

### Reference viewports

320×568, 568×320, 390×844, 844×390, 768×1024, 1024×768, 1440×900, 1920×1080. Test base, four-expansion, and all-nine expansion modes for solo and cooperative play at each viewport (48 plan configurations). Also check every difficult variant, scaling, reduced motion, keyboard interactions, and native mobile touch in later phases.

### Small-screen compromise

All actual card faces cannot fit full-size on a 320×568 phone with all expansions. Keep every zone identifiable at once (piles, miniatures, stacked cards, and counters) and offer contextual inspection on tap. Persistent menus/tabs must **not** hide an entire expansion. Exception: during a rules-required private reveal, only authorized players may see those faces.

## Baseline tests and limitations

`tests/tabletop-phase1.test.js` checks viewports, mode/expansion zone conservation, card renderer escaping, hidden-card invariants, and 23 pending types. `scripts/tabletop-snapshot.js` generates static renderable layout studies from the same layout/zones modules. Screen captures in `docs/ui-baselines/` are layout-study mockups **not live gameplay screenshots**.

The environment's browser blocks navigation to both localhost and file URLs, so full interactive app screenshot capture was unavailable. A Chromium `set_content()` render of the static layout studies was inspected at seven sizes/configurations, with no horizontal viewport overflow. **Live app visual and gesture verification remain mandatory in Phases 2, 3, 6, and 8.**

## Non-negotiable release invariants for Phases 2–9

1. Do not change engine/public protocol except in separate, explicitly tested fixes.
2. Every previous action remains accessible using touch/keyboard; gestures send identical command shapes.
3. Never display another player's private cards or the deck's hidden contents.
4. Rendering/reflow is pure; changing orientation never consumes cards or restarts pending choices.
5. One visual component owns each card at a time; the total game card count is unchanged.
6. Dialogs must handle interrupted/sequential effects without speculative local state mutation.
7. GitHub Pages + Firebase guest multiplayer, local solo saves, settings, themes, and commit display continue working.
8. Every hotfix is incremental, branch `main`, runs the complete gate, and commits/pushes only after success.
