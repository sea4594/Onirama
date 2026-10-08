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
