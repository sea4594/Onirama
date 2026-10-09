# Second UI/UX refinement — Phase 2 (fullscreen shell and in-game navigation)

## Implemented

- **Fullscreen tabletop:** Active games no longer render the site header/bottom navigation. The existing forest-green tabletop fills the viewport backdrop, with no external framed page or page-level scrolling. Solo and co-op both expose two small in-tabletop buttons: Pause and Rules.
- **Fixed application viewport:** `#app` owns the available dynamic viewport. The document cannot scroll in either direction. Non-game routes retain current navigation, but long content now scrolls inside an explicit `.shell-viewport-window`, not the document; its scroll position is preserved across local rerenders.
- **Transitional card fit:** Existing zone layout still belongs to Phase 4. Meanwhile, a bounded CSS `zoom` fit keeps the *entire* tabletop onscreen while retaining full available width. This can produce very small content in expansion-heavy co-op portrait/landscape; do not represent the current result as the final usable-density solution. All engine interactions remain untouched.
- **In-game Pause:** Modal actions for Resume, Rules, accessibility/display settings (motion, card size, contrast, text size), and Return to Home. Home navigation preserves the saved game and session; it is not multiplayer leave/end, which remains Phase 8. The UI pause overlay prevents user input behind it; no server game-pause command is sent.
- **In-game Rules:** Collapsible base rules, with co-op information only in co-op, and only the individual active expansion rules. The same modal works during a mandatory decision without navigation away from gameplay. The rules text summarizes implemented behavior; existing rules audits document adjudications requiring publisher verification.
- **Modal behavior:** X/outside click/Escape dismissal; keyboard Tab trapping; scroll and expanded-rule preservation during live redraws; focus restoration to game controls, including mandatory-effect dialogs. The underlying game is not replaced, restarted, or mutated by opening a menu.
- **Regression coverage:** Added four tests for both game modes, active expansion-only rules, pause markup/commands, mandatory dialog navigation, and viewport shell contracts. Included a repeatable optional Chromium screenshot/geometry script.

## Checks performed

- `npm run release:gate`: **172 tests passed**, GitHub Pages build succeeded.
- `python3 scripts/visual-refinement-phase2.py`: **284 offline renderer / viewport checks passed** (34 existing route/tabletop/decision fixtures × eight viewport sizes, plus 12 Pause/Rules overlays). Zero document-level vertical/horizontal scrolling, tabletop cutoff, or modal overflow reported. Inspected representative screenshots for dense co-op 390×844, 844×390; dense solo 390×844; setup 568×320; desktop home; pause and rules popups.
- Browser fixtures use the real game/rendering functions and stylesheet sources, *not* an authenticated live application. Localhost/file navigation was blocked by the browser environment. Native touch, multiplayer in two live clients, safe-area hardware behavior, screenreader testing, and OS suspend/resume are not claimed verified.

## Intentionally deferred

1. **Phase 3:** Unified Forest styling beyond gameplay; new full-app themes and replacement of symbolic/emoji-style icons. Existing style selection and icons remain intact in Phase 2.
2. **Phase 4:** Density-aware arrangements rather than viewport-wide zoom, removal of internally scrolling tabletop card rows, legible compact stacks and inspectable cards at high expansion counts. Existing scrollable Labyrinth/decision rows are maintained for functional compatibility until then.
3. **Phase 5–6:** Unified gesture/card inspection and compact state-aware decisions/pile counts.
4. **Phase 7–9:** Card animations, multiplayer lifecycle/replacement, interruption recovery and replays.
5. **Phase 10:** Full accessibility and physical-device visual polish, acceptance and regressions.

No engine rules, card data, Firestore schemas, room codes or game-state formats were changed.
