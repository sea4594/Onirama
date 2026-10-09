# Second UI/UX refinement — Phase 1 audit (v0.21.0)

**Status:** Research, source review, and reproducible screenshot/geometry baseline complete. **No gameplay, UI, rules, Firebase schema, or saved-state code changed in Phase 1.** Subsequent phases own fixes. The attached checkpoint, not the public website, is the source of truth.

## Inspection and reproducible evidence

- Reviewed actual renderers and CSS for home, game setup, multiplayer entry/join/lobby, settings, rules, tutorial, history, roadmap, result state, solo/co-op tabletop, expansion zones, and mandatory/contextual decisions. Examined input handlers, engine pending states, client synchronization, Firestore protocol/rules, server fallback, tests, and prior QA screenshots.
- `python3 scripts/ui-refinement-audit.py` generates **34 offline real-renderer fixtures × 8 reference viewports = 272 browser geometry checks**, measurements JSON, and 12 representative screenshots in a temporary folder. It reports known defects, deliberately without treating the audit as a passing UI acceptance test. It needs the *optional* Playwright+Chromium toolchain; it is not part of `npm run release:gate`.
- Current baseline: **140/272** fixture/viewport combinations have page-level vertical overflow; **116/272** have at least one offscreen interactive control; **0/272** have page-level horizontal overflow. The last number is why prior “no horizontal overflow” tests missed these problems. Many fixtures intentionally render taller than a screen; these are usability failures against the new requirement, not necessarily newly introduced technical bugs.
- Full portable gate on the unchanged checkpoint: `npm run release:gate` **passes 168/168 Node tests and builds GitHub Pages**.
- Chromium navigation to localhost was blocked by this environment, so browser checks use HTML generated from the actual exported UI renderers (not a live mounted app). Firebase two-client gameplay, OS app suspension, genuine touch/long press, native browser safe areas, and visual animation timing **remain unverified**. Do not describe them as tested.

### Representative measured defects

| Screen / configuration | Viewport | Extra page height | Other observation |
|---|---|---:|---|
| Solo, all nine combinable expansions | 390×844 | 237 px | 2 game regions begin below viewport; 8 interactive controls offscreen |
| Solo, all nine expansions | 844×390 | 466 px | Short-landscape layout remains vertically stacked |
| Co-op, all nine expansions, seat 0 | 390×844 | 537 px | 4 regions begin below viewport; 11 controls offscreen |
| Co-op, all nine expansions, seat 0 | 844×390 | 719 px | 7 regions below viewport; 18 controls offscreen |
| Setup, all nine expansions | 568×320 | 779 px | Start and most selections require scrolling |
| Rules | 568×320 | 403 px | Page scroll required |
| Lobby | 568×320 | 340 px | Main actions sit outside initial viewport |
| Solo, base only | 390×844 | 0 px | Useful comparison: problem increases dramatically with density |
| Co-op, all nine expansions | 1440×900 | 0 px | Fits, but large empty margins/uneven card scales remain |

`documentExtraHeight` measures `document.documentElement.scrollHeight - innerHeight` in rendered fixtures. Offscreen control counts include controls behind the fold and must **not** be interpreted as blocked actions in current scroll-enabled UI. The broad fixture matrix includes five game configurations (base, four, nine, hard, Little Incubus), both modes and co-op seats, plus ten representative decision sheets; Little Incubus is tested independently, as it is incompatible with the other expansions in official mode.

## Findings and priority order

**P0 — foundational failures / user requirements**

1. **Outer shell consumes game space.** `app.js` always prepends `nav()`; `styles.css` wraps all routes in `.page` with substantial margins/padding and a limited max width; the green `.tt2-root`/`.tt6-root` lives *inside* that larger background rather than occupying the viewport. Gameplay's top rules link navigates to `#/rules`. The player can leave the game view unintentionally while consulting the rules. **Phase 2.**
2. **Short/compact layouts were only checked for horizontal clipping.** Solo/co-op CSS uses different breakpoints and stacks zones, while `applyTabletopMetrics` primarily adjusts card widths/density; it never assigns zones to a tested vertical viewport budget. Expansion grids remain under the main table. A one-size-fits-all scaling patch would shrink already-small symbols further. Requires real area allocation, adaptive side-by-side/compact grouping, a reserved control budget, and per-zone inspection rather than invisible content. **Phases 2 and 4.**
3. **Non-game views exceed available height**, especially setup, rules and lobby in landscape. Fixed navigation and bottom tabs add competing chrome, while the shell limits desktop content to 790 px and cannot reorganize landscape forms. The new requirement is **no document scrolling, only scroll inside explicit windows**. **Phases 2, 3 and 10.**
4. **Current multiplayer protocol cannot support departure/replacement.** Both Firestore and Node rooms make host = seat 0; new guests can only join before game start. There is no end/leave/transfer operation, seat-vacancy pause, or rejoin-to-vacated-seat transition. Codes are eight hex characters in generation, validation, rules, link handling, and join fields. This is a coordinated protocol/security/state migration, not a UI label edit. **Phase 8, then Phase 9.**

**P1 — interaction and information hierarchy**

5. **Inconsistent theming.** Non-game routes default to Ocean Light and use pale panels, while the tabletop has hardcoded forest colors in multiple CSS files. An app-wide theme must be tokenized across cards, backgrounds, overlays, navigation and controls, with legacy preference migration. **Phase 3.**
6. **Duplicated or low-value chrome.** Global brand/header, bottom nav, dense section borders, per-zone labels, permanent context hints, redundant selected-card buttons, and decorative empty card slots consume area. Remove only after their functions become discoverable through direct card/zone gestures. Avoid indiscriminately deleting player/expansion identification. **Phases 2–5 and 10.**
7. **Card density and proportion mismatch.** All nine expansions make the relative size of actual hand cards, Door slots, goal tiles, and other components inconsistent. Empty Doors can occupy more area than active hand cards; large desktop areas are not distributed evenly (notably central co-op stacks). Compact versions must retain recognizable cards and use touch-accessible zoom, not 8–10 px text as the only source of meaning. **Phase 4.**
8. **Reordering is visually ambiguous.** `createDecisionReorder` highlights the *target card tile*; `app.js` includes arrow buttons for Prophecy, Confusion, and other reorder effects, sometimes alongside lengthy instructions. Use a single insertion indicator in the *gap* and keep an accessible keyboard/tap fallback without permanent arrow clutter. **Phase 5.**
9. **Card inspection is not universal.** The gesture controller primarily handles left-pointer drag/click and a limited `data-tt-inspect` hook. There is no consistent mouse contextmenu/touch long-press system describing unfamiliar cards/effects; card-specific instructions are scattered across overlays and rules. On touch, short taps must remain distinct from holds and drags. **Phase 5.**
10. **Pile information is insufficient.** Current deck/discard/Limbo show only a face/back and total count; they do not provide fixed per-card-type counts or modular expansion breakdowns. The discard contents may be available in current engine views, but deriving *remaining draw-deck composition* may require a specifically authorized view projection. Decide whether count-by-category deliberately exposes otherwise hidden draw information, without revealing identities/order. **Phase 6.**
11. **Mandatory decisions obscure the state required to make them.** `.tt4-scrim` darkens/blurs everything; small-screen dialogs are bottom sheets up to 88dvh; desktop dialogs cover the central play area. Prophecy, tower, spell-payment, Mirror, Denizen, Dreamcatcher and multi-step expansion decisions need a persistent view of the relevant tabletop zones, not necessarily permission to interact with the whole table. Keep mandatory-effect dismissal guarded. **Phase 6.**
12. **Automatic progression is visually abrupt.** Engine actions immediately produce the next game state and `render()` replaces the app HTML. There is no reconciled transition/event timeline for card travel, reshuffling, drafts, interrupts, or turn handoff. Highlighting an unavailable manual draw action must not accidentally introduce new engine commands: the current engine auto-refills after a normal action. **Phase 7.**
13. **Multiplayer hides causality.** Room updates redraw the latest snapshot; there is no durable viewer-specific ordered visual event stream or replayable opponent-turn/draft log. Retrying/offline transitions may replace transient visual state. Must account for hidden opponent cards, event IDs, duplicate snapshots, deterministic animation, and replay of *past visible information only*. **Phase 9.**

**P2 — cohesion and details worth fixing together, not patch by patch**

14. **Screen hierarchy varies.** Setup favors checkboxes across two columns, multiplayer uses two equal cards, settings uses split rows, history uses four stat cards, rules and tutorial use other patterns. The hierarchy and available space should be resolved by route/viewport, not one global narrow column. **Phases 3 and 10.**
15. **Small or ambiguous controls.** Many micro controls, card labels, Door/color tags, icon-only links, and old symbolic glyphs need clearer affordance, focus/pressed states and accessible names; some are below a comfortable touch target. Replace pseudo-icons/emoji-like characters with a coherent non-emoji SVG system while keeping genuine game symbols distinguishable. **Phases 3, 5 and 10.**
16. **Lifecycle and focus edge cases.** The app restores focus across many rerenders and has modal trapping, but document rerender can also reset visual affordances/scroll. Overlay stacking, keyboard navigation, saved selection in interruption chains, reduced motion, large text, and native safe areas need actual interactive tests. **Phases 5–7 and 10.**
17. **Room information and statuses.** The lobby emphasizes a very large copyable code, input-style invite URL, and ready cards while waiting/paused/replacement states do not exist. When lifecycle is added, show seat occupancy, host ownership, pause state, and the one available action with minimal explanation. **Phase 8.**
18. **Statistics, tutorial, results, and auxiliary screens still use independent visual rhythms.** Audit includes routes and actual result renderer; full post-game state, saved presets, multi-record history and long error messages need live viewport and pointer checks when updated. **Phase 10.**

## Interaction and state inventory — do not lose access during simplification

- **Always-visible tabletop zones:** draw, discard, Limbo, Doors, Labyrinth, hand, progress; co-op adds both players' Doors/Labyrinth/hands, shared hand and drafting area. Inactive/private hands must remain masked.
- **Expansion zones:** Steps Goals/Spellbook; Glyph Doors; Dreamcatchers and Failsafe Books; Tower Alignment; Premonitions/reserve; Crossroads/Dead Ends within regular zones; Oniverse Denizens/Treasure Keeper; Mirrors; Sphinx/Diver/Confusion decisions; Little Incubus separately. Expansion-only content must not appear when disabled.
- **All 23 engine pending types:** `sphinxName`, `sphinxResolve`, `diver`, `confusion`, `mirrorReward`, `doorSearch`, `door`, `nightmare`, `prophecy`, `happyDream`, `happyFetch`, `rally`, `premonitionPick`, `premonitionDoor`, `incantation`, `towerLook`, `spellPeek`, `happyPeek`, `denizenPeek`, `catchChoose`, `catchOverload`, `towerPenalty`, `moduleDecision`. Contextual dialogs: Mirror pair, Cyclobot, co-op discard/exchange, Spellbook.
- **Distinct interaction states:** solo turn/action, co-op inactive/active seat, co-op drafting, pending mandatory decision, interrupt and resume, end result, selected card, pointer drag, keyboard reordering, reduced motion, offline/reconnect, host/guest leave and replacement.

## Design/architecture contract for subsequent phases

1. Keep the engine the only legal-action authority; viewport changes, motion and replay must **never** issue speculative commands.
2. No page-level scrolling at 320×568, 568×320, 390×844, 844×390, 768×1024, 1024×768, 1440×900, or 1920×1080. Test safe-area insets and very large accessibility text separately. Windows may scroll their **own content** when unavoidable. At maximum density, all zones remain recognizable simultaneously but a compact stack may stand in for individual cards.
3. One layout allocator for actual usable height and width; distinguish phone portrait/landscape, tablet portrait/landscape, desktop, solo/co-op, expansion density, and mandatory decision. Do not solve every case with cascading CSS overrides.
4. One semantic interaction contract for tap, pointer drag, keyboard, inspect/long-press and right-click. One reusable lightweight card inspection surface, contextual action system, insert-between-cards feedback, and consistent dismissal rules.
5. Pile counts must distinguish **deck composition totals**, **currently remaining category counts**, and **public versus intentionally revealed data**. No deck order/private hand leakage by accident; clarify any desired game-information policy change before implementation.
6. Room host and player seat identities are separate: explicit leave/end commands, transfer, vacancy pause, replacement, host takeover, race-resistant transactions, updated Firestore security rules, Node fallback parity, and old-room compatibility.
7. Animation/replay derives from committed, versioned game events and cannot modify current rules/snapshots. Replays and disconnect recovery preserve the same state without extra turns/draws. Respect reduced motion.
8. Every phase adds focused tests to the portable gate, reruns the offline visual audit, inspects screenshots/interaction behavior, and reports honestly what was **not** verifiable without Firebase and real devices. Fix severe regressions before the phase ships; the audit numbers here are a baseline, **not an acceptable target**.

## Recommended sequencing

Phases 2 (viewport/navigation) → 3 (visual system/icons) → 4 (density-responsive tabletop) → 5 (gesture/inspection) → 6 (piles/decisions) → 7 (progression/motion/event foundations) → 8 (room lifecycle/codes) → 9 (reconnect/remote playback/replay) → 10 (full-site polish and live-device acceptance). Any change spanning stages should be implemented against its owner phase, not as an isolated one-off patch.
