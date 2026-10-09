# UI Phase 6 — Two-player cooperative tabletop (0.18.0)

## Scope / implementation
- All cooperative gameplay now renders through `public/tabletop/coop-board.js`, replacing the legacy stacked `game-layout` during live games. `public/tabletop/coop.css` provides desktop/landscape (opposing left/right player regions), portrait/tablet, narrow phone and short-height landscape layouts.
- Always present: both player Labyrinths and Door collections; each player's private hand (partner's face-down); central shared cards; draw, discard and Limbo; public draft when active; every enabled expansion's applicable off-deck components.
- Only the authenticated viewer's personal cards and public shared resources can be selected; the other hand is face-down and cannot be an action source. Partner Labyrinth remains visible and updates on each broadcast.
- Active player may drag a personal/shared card to their Labyrinth or discard pile, click a card then its destination, or use Play/Discard buttons and keyboard. Towers retain separate left/right placement. Cooperative discards still open the optional personal/shared swap dialog instead of silently discarding.
- Draft cards invoke the existing `draft` engine command. Phase 4 effects and optional dialogs keep their original handlers; private pending decisions are resolved only by the active seat.
- View filtering continues to come from `engine/game.js:viewFor` and the existing Firebase room view. No Firebase rule, room document or save-format change.
- All cards are not all simultaneously legible on a 320px phone with every expansion: individual physical *zones* remain visible; stack, scroll, and card inspection/zoom are preferred to hiding zones.

## UI correctness audit
- Primary legal-target calculation: `cooperativeLegalTargets` in `public/tabletop/interactions.js`. It rejects inactive turns, partner-hand cards, hidden cards, Dead Ends, identical adjacent Labyrinth symbols and illegal Tower edge configurations. The original engine is the ultimate validator.
- Forbidden: direct gameplay mutations in UI renderer; sending partner cards as owned actions; revealing opponent card faces via card markup; treating shared cards as personal hand; skipping the discard-and-swap choice; accidentally accepting drops during a mandatory decision.
- A single `createTabletopInteractions` controller supports both solo and cooperative boards. It dispatches exactly the existing `play`, `discard`, and `playTower` commands. Cooperative `discard` first opens the existing swap dialog.
- Room code, invite URL, Firestore transaction rules, reconnect logic and engine deterministic state are unchanged.

## Verification / limitations
- Full release gate includes 149 tests (previous 142 plus 7 cooperative UI tests). New tests cover both seats, hidden hand isolation, public draft, Tower edge legality, shared cards, seeded card conservation and 512 combination renders.
- Actual Chromium **rendering fixtures** cover eight viewport sizes, two seats and base/all nine expansion groups (32 screenshots) with no page-level horizontal overflow and no non-scrollable zone overflow. Screenshot artifacts were generated from real renderer HTML and CSS using `page.set_content`, as direct file URL navigation is blocked here.
- Automated local live-Firebase interaction or remote multi-device session checks are not equivalent to fixture testing and remain for Phase 8's end-to-end QA. A full-screen tiny-phone dense setup necessarily scrolls vertically.
- Phase 7: simplify setup, lobby and settings; Phase 8: full hosted visual/interaction device matrix; Phase 9: remove unused legacy `board()` branch, performance and release cleanup.
