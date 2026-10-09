# Onirama — Implementation phases and release gates

Each phase must deliver code, documentation, and tests. No phase is considered complete solely because its UI is visible. The engine and game state must remain backward-compatible with versioned saves or provide a documented migration.

| Phase | Status | Work | Exit gate |
|---|---|---|---|
| 0: Foundation | **MVP implemented** | Repo, native JS modules, CI, responsive palette, data model, original card display, development/production commands | Syntax, unit and HTTP test gates pass |
| 1: Base solo | **MVP implemented** | 76 cards, setup, Labyrinth sequences, Door acquisition, mandatory/optional decisions, Nightmare penalties, Key Prophecy with explicit card order, Limbo, win/loss, logs | Deterministic games finish; card conservation holds for randomized seeds; adversarial decision tests |
| 2: Cooperative | **MVP implemented** | Room create/join, invite code, authenticated seats, 8-card draft, private/shared resources, swap-after-discard, turn authorization, synchronized state, persistence/reconnect | Both browser clients can play; no unauthorized hidden-hand access; stale/duplicate actions rejected |
| 3: Expansion-ready rules platform | **Foundation implemented** | Resumable FIFO effect interpreter, persistent pending decisions, module hooks/objectives, card-zone registry, v1→v2 save migration, configuration validation; BibleGuessr-inspired three-tab navigation and theme presets | All base/Phase 3 tests pass; expansion activation is rejected until complete; save upgrade passes |
| 4: Standard set A | **Implemented, pending final physical-card audit** | Book of Steps (Goals/spell costs/goal rollback), Glyphs (Incantation, 12 Doors), Dreamcatchers (Lost Dreams, catch/frees/overload), Towers (edge alignment, Nightmare loss) | Each separately playable with difficult modes; pairwise tests among these and base |
| 5: Standard set B | **Implemented; final interactions pending Phase 7** | Happy Dreams / Dark Premonitions (triggers/order), Crossroads / Dead Ends (wildcards, Escape), Door to the Oniverse (Denizen abilities, protected resources) | All seven standard sets separately playable, tested in both supported player modes |
| 6: Promos & modifier | **Implemented; uncommon interactions pending Phase 7** | Mirrors, Sphinx/Diver/Confusion, Little Incubus, all documented variants; extra Goal/Mirror availability based on enabled expansions | All cards and variants matched to verified rule effects, with exact card conservation |
| 7: Combination adjudication | **Implementation/test pass delivered; official-rule verification incomplete** | Sequential Mirror Doors, Premonition interrupts, Denizen Labyrinth replay, Dreamcatcher search freeing, 512-configuration solo/co-op simulations, audited open rulings | 61 automated tests pass; publisher-verification exceptions remain listed under Rules Audit |
| 8: Guest experience | **Implemented (scoped)** | Browser-local completed-game history/stats, named expansion presets, seven-step guided base-game tutorial, contrast/text-size preferences, screen-reader status and mobile board improvements. No login. | 66+ automated tests; final manual accessibility audit remains |
| 9: Production infrastructure | **Code implemented; cloud activation pending** | Atomic single-instance persistence, HTTPS API endpoint configuration for Pages, CORS, rate limiting, health check, hosting blueprint, restart/security tests and deployment documentation. Real cloud hosting requires user/provider action. | Gate passes; host integration and security tests; see `docs/DEPLOYMENT.md` |
| 10: Rules and interaction verification | **Implementation audit delivered; source gaps explicitly open** | Fix discovered interaction bugs, expand 23-dialog UI coverage and variant tests, document source-backed vs app-adjudicated rules | Release gate and Pages build pass; unresolved print-card and publisher questions remain labeled |
| 11: Hosted release verification | **Code + local integration checks implemented; deployment pending owner** | Invite links, reconnect safeguards, backend smoke command, deployment and device QA guide; paid backend/Pages variable/manual QA still required | 90+ automated tests, Pages build, owner-run hosted and visual acceptance |

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
