# Test matrix

## Included now

`tests/engine.test.js`: card counts, setup, cooperative draft, illegal actions, optional Door search, Prophecy ordering, Nightmare reveal, private-hand filtering, 320 seeded simulations across solo and cooperative modes. `tests/http.test.js`: running HTTP server, solo creation, authorization, opaque deck, optimistic concurrency, cooperative lobby/start/draft, seat privacy and out-of-turn rejection.

## Required before expansion release

- Every card effect (both positive and negative targets) has named deterministic test cases.
- Every phase interruption preserves the stack and resumes the exact pending action.
- A zone conservation assertion runs after every transition; expansion cards and objects have exact declared totals.
- Card order for every top- and bottom-of-deck manipulation is explicitly verified.
- Repeat setup and full games across thousands of seeds; use property-based tests for state transition invariants.
- All expansions pass solo isolated, solo pairwise and targeted large-combination tests.
- Additional two-player tests cover expansion ownership, shared resources, card visibility, disconnects, reconnections and simultaneous network submits.
- Save/resume during every pending decision must produce identical subsequent game state.
- Rules-adjudication tests are tied to rulebook page or official clarification before official-mode enablement.
- Playwright tests cover desktop/mobile viewports, keyboard and screen reader semantics, dialogs and visible legal actions.

## Phase 4
- All 16 combinations of the first four expansions tested across solo/cooperative seeded games (12 seeds per combination and mode).
- Dedicated tests for printed expansion totals, Goal reopening, spell costs/order, Glyph Incantations, Dreamcatcher Failsafe and overload preservation, Tower alignment and Nightmare penalty.
- Browser UI and HTTP acceptance tests follow the same full release gate.


## Phase 5 gate

- All 128 combinations of the seven standard expansions undergo seeded solo/cooperative simulations with full card-conservation checks.
- Every Denizen ability is exercised at least once in targeted unit tests.
- Premonitions, Happy Dream actions, Deck fetch without doubled card identity, Dead End Escape, Crossroads difficult variant, Oniverse wild Door/Goal, and migrated Phase 4 saves have separate tests.
- These tests **do not** certify every publisher rule interaction; Phase 7 tracks unresolved multiplayer and stacked-effect adjudications.

## Phase 6 gate

- 53 tests: 512 initialization/configuration combinations of the nine combinable expansion sets, tested for solo and cooperative game state conservation (1,024 setups).
- Sphinx named aspects, Diver continuations/penalty, Confusion, Mirror pair matching/rewards, hard Rainbow requirements, Incubus levels/compatibility and private viewer filtering have targeted tests.
- Browser rendering smoke tested with a Node VM shim. Full Chromium screenshot navigation unavailable under the current container network restrictions.
- GitHub Pages workflow copies relative-path static files and engine and must pass the full release gate before deploying.

## Phase 7 regression gate

- **61 tests**, including **1,024 complete seeded solo/co-op games** across all **512 possible configurations** of the nine combinable expansion groups (not counting difficulty permutations). Unlike Phase 6's setup-only sweep, each runs until victory or defeat while checking physical card conservation on every transition.
- Book of Steps + Glyph Mirror: mandatory ordered Door goals, including returned Doors when a goal is not next.
- Key Mirror + Dark Premonitions: the first Door is acquired, its triggered penalty blocks the reward, and only afterward is the second Door awarded. This is tested with persistent extra-card-zone accounting.
- Hammer Bird: removal of one Labyrinth color restores the preceding unfinished color sequence, allowing a later Door.
- Dreamcatchers + Red and Green Mirrors: optional catcher freeing on deck-search reshuffle, retaining Failsafe Books.
- Phase 6 save migration for queued Mirror Doors and hidden state filtering in cooperative play.

**Caveat:** The general simulation bot favors ordinary card play; it does not deliberately activate every expansion ability. Named regression tests cover specific interactions, but exhaustive publisher equivalence is not claimed. Browser rendering/full end-to-end tests remain Phase 8–9 obligations.
