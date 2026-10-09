# Onirama

An original-art, browser-based dream labyrinth card game. The project implements the base game, all seven Second Edition boxed expansions and both promotional expansions, with cooperative play and a phased roadmap for the rest.

> **Current state:** Runnable solo and two-player cooperative game with all seven boxed expansions, both promotional sets (Mirrors; Sphinx/Diver/Confusion), and the separate Little Incubus modifier. A Phase 7 cross-expansion regression audit is included; some publisher rulings remain unverified. This repository is an **unofficial, unaffiliated** adaptation; game concepts belong to their respective owners. No publisher artwork or rulebook text is included.

## Quick start

Requires **Node.js 22+**. No runtime dependencies and no `npm install` are required.

```bash
npm start
# http://localhost:3000
```

For automatic restart in development:

```bash
npm run dev
```

For tests and release gate:

```bash
npm run release:gate
```

Data is stored under `server-data/sessions.json` by default (ignored by Git). To change it, set `ONIRAMA_DATA_DIR`. To change the port, set `PORT`.

## Online publishing

**GitHub Pages hosts both solo and multiplayer. No paid Node server is needed.** Multiplayer now follows BibleGuessr's pattern: Firebase anonymous authentication, Firestore transactional code-based rooms, and real-time listeners. The hosted site runs at https://sea4594.github.io/Onirama/. See the [Firebase setup checklist](docs/FIREBASE_MULTIPLAYER.md) for the one-time Firebase configuration and Firestore security rules; the public web config is bundled in `public/runtime-config.js` and requires no GitHub variables. Single-player runs locally without Firebase; accounts, login and profile synchronization are not implemented.

`npm start` remains an optional legacy local Node server for development; it is **not used by GitHub Pages** once Firebase is configured. The Firebase client intentionally uses its own Firestore storage, so old Node-hosted rooms are not migrated.

## UI redesign progress (v0.16.0)

- **UI Phases 1–3:** reusable card and layout foundations; solo base-game virtual tabletop; tap, keyboard, and drag-to-play/discard; draggable revealed-card ordering.
- **UI Phase 4:** all 23 mandatory effect types appear in accessible temporary dialogs. Mirror pairs, Cyclobot, cooperative discard/swap and Spellbook use optional contextual dialogs. Mandatory effects cannot be dismissed without choosing a legal resolution. See [Phase 4 dialogs](docs/UI_PHASE4_DIALOGS.md).
- Phases 5–6 will redesign permanent expansion components and the full cooperative table; the older board areas remain usable until then.

## What works today

- **Phase 6:** Mirrors (nine printed references, conditional Glyph/Rainbow), Sphinx/Diver/Confusion (14 promo draw cards), and Little Incubus (three levels, base-game-only); **Phase 5:** Book of Steps (ordered Goals, rollback, three discard-funded spells, difficult costs); Glyphs (eight Glyph Locations, four extra Doors, Incantation); Dreamcatchers (four Lost Dreams, storing and freeing, overload, difficult mode); Towers (shared row, edge matching, discard peek, Nightmare consequences, difficult mode). Solo and guest cooperative configurations share one rules engine.
- **No accounts or login** (permanent product decision); room codes and local preferences are retained.

- Original, responsive, keyboard-usable card UI with Single Player / Multiplayer / Settings tabs and BibleGuessr-inspired theme presets (Ocean, Forest, Clay, Berry, light/dark); rulebook and roadmap.
- Base 76-card deck with unique card IDs and reproducible seeded shuffles.
- Solo base game: legal Labyrinth placement, Door search with choice to skip, Key Prophecy, all four Nightmare penalties, individual draw/refill decisions, Limbo, immediate victory and deck-exhaustion defeat.
- Official two-player *structure*: eight-card public initial draft, three private cards per player, two face-up shared cards, alternating turns, separate Labyrinths and Doors, optional swap after a discard, and whole-hand redraws.
- Invite-only cooperative rooms, Firestore anonymous UIDs, transactional turn/version checks, realtime room subscriptions, browser reload/reconnect, and shared game-state persistence. (The legacy Node service remains for local development.)
- Seat-filtered hand and deck rendering; GitHub Pages solo sessions are stored only in the current browser. The Firestore document is accessible to both room members, so a technically sophisticated player could inspect the hidden state; see the Firebase guide.
- Versioned ruleset/config validation, v1/v2→v3 saved-state migration, deterministic effect queue, expansion and Incubus modules, unique card zones, and objective hooks. Illegal combinations are blocked server-side.
- Node's built-in test runner; no install step. CI checks on GitHub Actions.

**Important limitations:** Some publisher expansion rulings remain unverified; all 12 Tower faces are now explicitly encoded from the physical cards. A dedicated server is **not required** for ordinary Firebase cooperative play, but Firestore cannot enforce every rule or prevent members inspecting hidden game state in developer tools. Live Firebase rule deployment and two-device QA remain owner tasks. Tutorial, history, statistics and saved setups are browser-local. No user account or login features are planned. Use separate browser profiles for two different players on one device.

## Architecture

```text
engine/
  cards.js       Base and expansion card catalog
  config.js      Versioned rules configuration, expansion availability, save upgrade
  zones.js       Card-location registry and card conservation
  effects.js     Serializable, resumable effect processor
  modules.js     Registered rules module hooks and objective collection
  game.js        Deterministic rules engine, state machine, legality, secret filtering
  random.js      Deterministic shuffle
  firebase-protocol.js  Firebase room transitions and membership/turn validation
server/
  index.js       Node HTTP/SSE server, auth, persistence, endpoints
public/
  index.html     Browser entry point
  app.js         Rendering and interactions
  firebase-room.js Firebase anonymous auth, Firestore transactions and subscriptions
  styles.css     Responsive interface

tests/           Engine invariants, seeded bot simulations, HTTP auth/room tests
docs/            Phase plan, rules audit, architecture, test matrix
scripts/         Optional safe git initialization / push helper
.github/         Continuous integration
```

## Development phases

See **[docs/PHASES.md](docs/PHASES.md)** for the phase-by-phase plan, acceptance gates, and exact expansion coverage; **[docs/RULES_AUDIT.md](docs/RULES_AUDIT.md)** for rule coverage and unresolved official clarifications.

## Rules references

- [Onirim Second Edition base rules (text transcription)](https://www.rulespal.com/onirim/rulebook)
- [Official base-game rulebook (PDF)](https://images.zmangames.com/filer_public/fd/0e/fd0ef6a2-c019-47a2-910a-a556f03a3d02/zm4900_onirim_rules.pdf)
- [Official Book of Expansions (PDF)](https://images.zmangames.com/filer_public/7f/c7/7fc752e5-1a46-408f-b9cc-db5196be46ee/en-onirim-rules_ext-1.pdf)

Do not mark a rule as verified merely because an automated test passes. Each rule and interaction needs a source citation or documented adjudication.


## Phase 5: Seven standard expansions

Phase 5 enables **Happy Dreams and Dark Premonitions**, **Crossroads and Dead Ends**, and **Door to the Oniverse**, including configurable harder variants, card-zone tracking, interaction panels, and Denizen choices. All seven standard expansions can now be selected in solo or cooperative mode. The Oniverse set randomly removes eight of sixteen Denizens unseen; those cards remain in a private removed-card zone for card conservation. No account/profile/login is implemented or planned.

**Rules audit status:** Gameplay is enabled, but Phase 7 still must verify rare cross-expansion rulings, physical Tower edge symbols, and multiplayer expansion ownership. These should not be described as publisher-verified.

## Phase 6 — Promos, Incubus, and Pages

- Mirrors: double-Location pair placement, explore/discard four cards, eight normal Mirrors plus optional Rainbow and Glyph, immediate or player-selected rewards, additional victory requirements.
- Sphinx, Diver, Confusion: bottom-deck reveals, feature nomination, continuation and order decisions, hand renewal, 2 extra Nightmares.
- Little Incubus: New Dreamwalker cancellation or Apprentice/True charging and Nightmare anticipation; blocked from combined expansion games by official-compatibility validation.
- GitHub Pages workflow deploys frontend and engine; local solo saves require no server, and multiplayer correctly informs users they need its separately hosted Node backend.

**Scope of verification:** 53 automated tests, including setup/card conservation for all 512 combinations of the nine combinable expansion groups in both player modes. This is not a substitute for the Phase 7 printed-card and rare-combination rules audit.

## Phase 7 — Cross-expansion timing and integrity

- Mirror-granted Doors resolve **one at a time**; a newly triggered Dark Premonition interrupts the reward and the unclaimed Doors remain in a persistent, conserved expansion zone. Effects resume after each decision, and immediate victory is honored.
- Hammer Bird now recomputes the remaining Labyrinth's Door sequence instead of losing legitimate prior progress.
- Mirror deck searches can optionally free a Dreamcatcher (including Green Mirror); the Happy Dream deck-search interface now exposes its existing free-catcher action.
- Phase 6 saves migrate to the versioned Phase 7 queue layout without deleting games.
- **61 passing tests:** 1,024 seeded solo/cooperative games spanning all 512 nine-expansion configurations; also targeted timing, card-identity, privacy, migration, and search/freeing tests.

**Not publisher-verified:** The Tower faces are now transcribed from all twelve physical cards (UI Phase 2). Rare official cooperative expansion ownership/timing rulings, wildcard handling under Rainbow Mirror, and some scarcity/interrupt cases also remain open. See `docs/RULES_AUDIT.md` for explicit evidence and gaps. Passing the tests does not establish rulebook completeness.

## Phase 8 — Guest experience (no account)

- **Completed game summaries:** `Settings → History & statistics`; the app automatically records a finished solo or cooperative game once on the browser where its result is viewed. Stats include win rate and solo/co-op totals. No hidden cards, player identities, session tokens, or decks are stored in the new history data. History is not synchronized between devices; clearing browser storage deletes it. Existing Phase 7 sessions still resume.
- **Saved expansion setups:** `New dream → Saved setups` lets you name, load, overwrite, and delete configurations. These are browser-local and independently validate expansion IDs and difficulty values. No profile or login.
- **Guided tutorial:** seven short steps under Single Player / Settings, linking to the full rules and a base-game starting setup. This is a written walkthrough, not an interactive scripted card scenario.
- **Accessibility/mobile:** high-contrast and larger-text settings, clear keyboard focus, skip-to-content, screen-reader turn/decision announcements, scalable game panels and mobile horizontal scrolling for card rows.
- **Intentional limits:** A live backend is still required for multiplayer. Phase 8 stores **summaries**, not deterministic replay files; true replay, localization and automated cross-browser accessibility testing remain separate future work. Some official combination adjudications remain unverified (see `docs/RULES_AUDIT.md`).

## Phase 9 — production hosting integration

- `npm run build:pages`: static Pages distribution including the solo engine and `runtime-config.js`; pass `ONIRAMA_API_ORIGIN=https://your-host` to enable the remote multiplayer API.
- `npm start`: Node 22+ backend (single-instance, atomic persistent file in `ONIRAMA_DATA_DIR`). `/api/health` reports readiness.
- `render.yaml`: optional paid Render Blueprint with a persistent disk. Actual provider setup and the GitHub Actions variable must be completed by the repo owner before multiplayer becomes live on Pages.
- Detailed instructions: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Future work: [docs/PHASE9_RELEASE.md](docs/PHASE9_RELEASE.md).
- **No accounts or login**, and no account features are planned. Local solo games and settings remain browser-local.

## Phase 10 — Rules and interaction audit

- Extended deterministic tests for all configured difficulty branches, conservation, Dreamcatcher searches during Door claims, Tower dual-symbol edge restrictions, Nightmare false destruction, Book Goals, multiplayer hidden data, pending decisions, and older saves.
- Added in-board selections for Mirror pairs, Cyclobot exchange, cooperative discard/swaps and Confusion card ordering. Corrected Tower-removal visual legality checks and catcher freeing safeguards.
- The full release gate now includes the GitHub Pages production build. See [the detailed Phase 10 matrix](docs/PHASE10_RULES_MATRIX.md) for the full action/decision inventory and source-status of remaining exceptions.
- **Not a claim of perfect publisher fidelity:** ambiguous cooperative expansion ownership, Rainbow/Crossroad interaction, and some partial-deck combinations still need authoritative verification.

## Phase 11 — hosted release readiness

- Added copyable invite links with auto-filled eight-character room codes; links contain no seat credentials. Added multiplayer connection test, reconnection safeguards, and a visible retry action.
- Added `scripts/verify-backend.js` for owner-run live-backend verification and regression tests for CORS, room ownership, streaming, privacy and stale actions.
- **Owner activation remains necessary:** Render (or another durable Node host), GitHub Actions `ONIRAMA_API_ORIGIN`, Pages redeploy, real-device QA, monitoring and backups. See **[the Phase 11 launch checklist](docs/PHASE11_LAUNCH_CHECKLIST.md)**.
- No player login/accounts. Printed Tower edges and rare rules questions are still open; a green automated gate is not proof of every publisher ruling.

## Firebase configuration (0.12.1)

Onirama uses the six public Firebase web-app settings for project `onirama-5124e` directly from `public/runtime-config.js` in both local development and GitHub Pages. No `ONIRAMA_FIREBASE_*` GitHub Actions variables are needed. Enable Anonymous Auth and publish `firestore.rules` in the Firebase Console; see [docs/FIREBASE_MULTIPLAYER.md](docs/FIREBASE_MULTIPLAYER.md).

## UI redesign · Phase 1 foundation (v0.13.0)
- The current playable board and game mechanics are unchanged.
- New reusable card component, complete tabletop zone registry, and responsive layout planner are in `public/tabletop/`.
- Preview a **non-playable** tabletop layout study at `/tabletop-preview.html` (choose solo/co-op and expansion density).
- See `docs/UI_REDESIGN_AUDIT.md` and `docs/ui-baselines/` for the migration contract and visual baselines. Phase 2 begins replacing the actual game board.


### UI Phase 2 (v0.14.0)

The live solo **base-game** board now uses the responsive virtual tabletop (`public/tabletop/solo-board.js`, `solo.css`). It shows all physical play zones at once with selectable hand cards and existing legal action commands. Cooperative and expansion-enabled boards remain on their fully functional original renderer until their planned migration phases. Exact printed Tower cards and the complete 192-card inventory are documented in `docs/UI_PHASE2_AND_RULINGS.md`.

### UI Phase 3 (v0.15.0)

The responsive **solo base-game tabletop** now supports pointer drag from hand to Labyrinth or discard, plus card selection followed by tapping/clicking a legal destination. Play/Discard still invoke exactly the same engine commands and remain usable as small contextual buttons or keyboard shortcuts (`P`, `D`); Escape cancels selection, and arrow keys navigate the hand. Targets are highlighted only when legal. Pointer cancellation, interrupted gestures, bad drops and pending decisions never submit actions.

Existing ordered-card decision controls (Prophecy, Happy Dream, Sphinx/Diver, Tower inspection, Denizen inspection, spell inspection, Incantation and Confusion) additionally support dragging revealed cards into a different position; the preexisting arrow controls are retained as accessible alternatives. None of these gestures changes game state until the user confirms the decision. Expansion-enabled and cooperative full-tabletop redesigns remain scheduled for UI Phases 5 and 6; their existing buttons and decisions continue to work.

See `docs/UI_PHASE3_INTERACTIONS.md` and `docs/ui-phase3-baselines/` for the interaction contract and responsive Chromium screenshots.

## UI Phase 5 — expansion tabletop (v0.17.0)

All solo expansions use the compact physical tabletop, including Goals, Tower Alignment, Dreamcatchers, Premonitions, Denizens, Mirrors, special Door slots and Incubus. Card abilities use the existing engine and decision overlays. See `docs/UI_PHASE5_EXPANSION_TABLETOP.md`. Cooperative boards remain on the original layout until UI Phase 6.


## UI Phase 6 — two-player cooperative tabletop (v0.18.0)

The responsive two-player board now shares the solo tabletop's cards, zones, expansion components and contextual decision dialogs. Both players' Doors and Labyrinths, the face-down partner hand, private personal hand, shared resources, draw/discard/Limbo and every applicable expansion area remain visible. Drafting, Firestore transactions and cooperative discard-and-swap actions still use the existing engine commands; no room schema or save migration is required. Pointer drag/drop, tap selection and keyboard alternatives work with the active seat only. See `docs/UI_PHASE6_COOPERATIVE_TABLETOP.md`.
