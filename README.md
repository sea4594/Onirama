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

A GitHub Pages workflow (`.github/workflows/pages.yml`) builds a **static, browser-only solo edition**, including the rules engine and local saved game. After the hotfix is pushed, choose **GitHub → Settings → Pages → Source → GitHub Actions** once; the site is published at https://sea4594.github.io/Onirama/. GitHub Pages does **not** run Node services. Online multiplayer needs a separately hosted server (Phase 9), while `npm start` runs both frontend and multiplayer locally. See [deployment notes](docs/DEPLOYMENT.md).

## What works today

- **Phase 6:** Mirrors (nine printed references, conditional Glyph/Rainbow), Sphinx/Diver/Confusion (14 promo draw cards), and Little Incubus (three levels, base-game-only); **Phase 5:** Book of Steps (ordered Goals, rollback, three discard-funded spells, difficult costs); Glyphs (eight Glyph Locations, four extra Doors, Incantation); Dreamcatchers (four Lost Dreams, storing and freeing, overload, difficult mode); Towers (shared row, edge matching, discard peek, Nightmare consequences, difficult mode). Solo and guest cooperative configurations share one rules engine.
- **No accounts or login** (permanent product decision); room codes and local preferences are retained.

- Original, responsive, keyboard-usable card UI with Single Player / Multiplayer / Settings tabs and BibleGuessr-inspired theme presets (Ocean, Forest, Clay, Berry, light/dark); rulebook and roadmap.
- Base 76-card deck with unique card IDs and reproducible seeded shuffles.
- Solo base game: legal Labyrinth placement, Door search with choice to skip, Key Prophecy, all four Nightmare penalties, individual draw/refill decisions, Limbo, immediate victory and deck-exhaustion defeat.
- Official two-player *structure*: eight-card public initial draft, three private cards per player, two face-up shared cards, alternating turns, separate Labyrinths and Doors, optional swap after a discard, and whole-hand redraws.
- Invite-only cooperative rooms, seat-specific bearer credentials, server-authoritative game state, event stream, reconnection/reload, persistent state, action-version checks.
- Server-side hidden-hand and hidden-deck filtering. GitHub Pages solo sessions are stored only in the current browser.
- Versioned ruleset/config validation, v1/v2→v3 saved-state migration, deterministic effect queue, expansion and Incubus modules, unique card zones, and objective hooks. Illegal combinations are blocked server-side.
- Node's built-in test runner; no install step. CI checks on GitHub Actions.

**Important limitations:** No public deployment hardening, matchmaking, sophisticated visual card art, tutorial walkthroughs, guest history/stats, or complete expansion adjudications. Room state is stored using a small synchronous JSON store, suitable for testing, not a scaled production service. Accounts and login are explicitly out of scope permanently; all gameplay is guest-based. Same-device multiplayer requires separate browser profiles (one localStorage session per browser origin).

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
server/
  index.js       Node HTTP/SSE server, auth, persistence, endpoints
public/
  index.html     Browser entry point
  app.js         Rendering and interactions
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

**Not publisher-verified:** The twelve Tower cards' exact left/right printed symbols remain provisional. Rare official cooperative expansion ownership/timing rulings, wildcard handling under Rainbow Mirror, and some scarcity/interrupt cases also remain open. See `docs/RULES_AUDIT.md` for explicit evidence and gaps. Passing the tests does not establish rulebook completeness.
