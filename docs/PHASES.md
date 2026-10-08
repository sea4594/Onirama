# Onirama — Implementation phases and release gates

Each phase must deliver code, documentation, and tests. No phase is considered complete solely because its UI is visible. The engine and game state must remain backward-compatible with versioned saves or provide a documented migration.

| Phase | Status | Work | Exit gate |
|---|---|---|---|
| 0: Foundation | **MVP implemented** | Repo, native JS modules, CI, responsive palette, data model, original card display, development/production commands | Syntax, unit and HTTP test gates pass |
| 1: Base solo | **MVP implemented** | 76 cards, setup, Labyrinth sequences, Door acquisition, mandatory/optional decisions, Nightmare penalties, Key Prophecy with explicit card order, Limbo, win/loss, logs | Deterministic games finish; card conservation holds for randomized seeds; adversarial decision tests |
| 2: Cooperative | **MVP implemented** | Room create/join, invite code, authenticated seats, 8-card draft, private/shared resources, swap-after-discard, turn authorization, synchronized state, persistence/reconnect | Both browser clients can play; no unauthorized hidden-hand access; stale/duplicate actions rejected |
| 3: Expansion-ready rules platform | Planned | Extract common effect interpreter, interruption stack/continuations, card-set loader, searchable zone registry, schema migrations, expansion configuration validators, effect explanations, authoritative rules references | Every base test passes using modular architecture; no behavior drift |
| 4: Standard set A | Planned | Book of Steps (Goals/spell costs/goal rollback), Glyphs (Incantation, 12 Doors), Dreamcatchers (Lost Dreams, catch/frees/overload), Towers (edge alignment, Nightmare loss) | Each separately playable with difficult modes; pairwise tests among these and base |
| 5: Standard set B | Planned | Happy Dreams / Dark Premonitions (triggers/order), Crossroads / Dead Ends (wildcards, Escape), Door to the Oniverse (Denizen abilities, protected resources) | All seven standard sets separately playable, tested in both supported player modes |
| 6: Promos & modifier | Planned | Mirrors, Sphinx/Diver/Confusion, Little Incubus, all documented variants; extra Goal/Mirror availability based on enabled expansions | All cards and variants matched to verified rule effects, with exact card conservation |
| 7: Combination adjudication | Planned | Pairwise and targeted 3+ expansion cases, simultaneous effects, missing targets, Dreamcatcher searches, ownership in coop; rule-source registry and player-visible 'house ruling' label where needed | Each supported combination explicitly verified; all-expansion simulations; no silent assumptions |
| 8: Full product | Planned | Guest/account upgrade, autosaves per user, history, replay, statistics, saved presets, tutorials, accessible dialogues, mobile layouts, localization, settings | End-to-end test suite passes across desktop/mobile and keyboard-only navigation |
| 9: Production | Planned | Move to transactional persistent DB, TLS, secure session cookies/auth, rate limits, metrics, recovery, tests against race conditions, deployment, security/asset review, privacy & terms | Security and performance gates; all required test suites green; production deployment documented |

## Phase 3 engine contract

Every physical card has a distinct ID, a card kind and traits, and exactly one current zone. Engine state includes ordered deck, hands, Labyrinths, collected Doors, discard, Limbo, external expansion zones, active turn, pending decision, continuation stack, event log, deterministic RNG seed, and ruleset version. Game commands must be validated by the engine, not only the browser. A `PendingDecision` names the authorized seat, revealed card IDs, allowed options, ordering/selection constraints, and the exact continuation. On accepted commands, apply a deterministic, atomic state transition; reject invalid or stale versions without mutation.

Suggested normalized effects: `move`, `reveal`, `inspect`, `draw`, `shuffle`, `gainDoor`, `reorder`, `discard`, `removeFromGame`, `queueTrigger`, `cancelEffect`, `changeTarget`, `checkVictory`. Every module registers setup, card definitions, triggered/activated abilities, win conditions, difficulty variants, and its interaction tests.

## Phase 4–6 expansion details

- **Book of Steps:** Shuffle Goals; acquire them in order; when a claimed Door is lost reopen its Goal, even if subsequent Goals were completed; pay discard-pile costs for all three spells; handle insufficient payments; difficulty costs.
- **Glyphs:** Introduce fourth symbol, eight Glyphs and four Doors; correct three-card sequences and Glyph-discard Incantations; expand Book of Steps Goals.
- **Dreamcatchers:** Extra Dream cards, four catchers, two Failsafe Books; catch entire Limbo at turn end; store/release piles; remove a catcher on overload; special searching against attached piles; difficult mode.
- **Towers:** Extra Location subtype, independent alignment, printed left/right-edge restrictions, Tower-discard rearrangement, Nightmare Tower loss, four-color win requirement, hard-mode behavior.
- **Premonitions:** Trigger-condition registry, ordering of simultaneous pending triggers, recalculate state after each effect, Happy Dream choices, variant starting count.
- **Crossroads/Dead Ends:** Wild colors and shared-symbol restrictions, limits per Door sequence, mandatory whole-hand Escape, special Nightmare revelation handling, difficult variant.
- **Oniverse Door:** Extra Door and Goal, random Denizen subset, rally costs, all eight Denizen effects, stored cards, cancellation windows and compatibility with other modules.
- **Sphinx / Diver / Confusion:** Bottom-deck lookups, stop/continue, symbols including conditional Glyph, replacement hand and extra Nightmares.
- **Mirrors:** Dedicated pair-playing action and stored sets, all color/symbol Mirror rewards, conditional Glyph/Rainbow, alternative victory condition.
- **Incubus:** Separate mode/variant selector with the published compatibility restriction, special penalty timing and stored-card cancellation.

## Interaction testing priorities

1. Door-acquisition events from Labyrinth, Keys, Incantations, Mirrors and Denizens all pass through the same verification and Goal-ordered handler.
2. Dreamcatchers intercept correct Limbo movements; freeing catcher stacks must preserve card IDs and search continuation.
3. Premonitions trigger on actual acquired Doors and never interrupt an immediate win incorrectly.
4. Wildcards retain their physical card identity; only local decisions supply effective color.
5. Full-hand redraw is distinct from normal draw: it does **not** resolve Doors or Dreams encountered during setup-style replacement.
6. Partial deck actions must follow official procedures, not a generic fallback that silently invents card targets.
7. Multiplayer expansion zones must have verified ownership: do not silently apply guessed rules to a game labeled 'official'.
8. Exact replay determinism, crash-safe resumes during nested effects, no card duplication and private information filtering after every step.
