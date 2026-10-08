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
