# Onirama

An original-art, browser-based dream labyrinth card game. The project implements the base game and the first four Second Edition expansions, with cooperative play and a phased roadmap for the rest.

> **Current state:** Runnable solo and two-player cooperative game with Book of Steps, Glyphs, Dreamcatchers, Towers, and their documented difficulty variants. Unfinished expansions remain disabled on both client and server. This repository is an **unofficial, unaffiliated** adaptation; game concepts belong to their respective owners. No publisher artwork or rulebook text is included.

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

## What works today

- **Phase 4:** Book of Steps (ordered Goals, rollback, three discard-funded spells, difficult costs); Glyphs (eight Glyph Locations, four extra Doors, Incantation); Dreamcatchers (four Lost Dreams, storing and freeing, overload, difficult mode); Towers (shared row, edge matching, discard peek, Nightmare consequences, difficult mode). Solo and guest cooperative configurations share one rules engine.
- **No accounts or login** (permanent product decision); room codes and local preferences are retained.

- Original, responsive, keyboard-usable card UI with Single Player / Multiplayer / Settings tabs and BibleGuessr-inspired theme presets (Ocean, Forest, Clay, Berry, light/dark); rulebook and roadmap.
- Base 76-card deck with unique card IDs and reproducible seeded shuffles.
- Solo base game: legal Labyrinth placement, Door search with choice to skip, Key Prophecy, all four Nightmare penalties, individual draw/refill decisions, Limbo, immediate victory and deck-exhaustion defeat.
- Official two-player *structure*: eight-card public initial draft, three private cards per player, two face-up shared cards, alternating turns, separate Labyrinths and Doors, optional swap after a discard, and whole-hand redraws.
- Invite-only cooperative rooms, seat-specific bearer credentials, server-authoritative game state, event stream, reconnection/reload, persistent state, action-version checks.
- Server-side hidden-hand and hidden-deck filtering.
- Versioned ruleset/config validation, v1/v2→v3 saved-state migration, deterministic effect queue, all Phase 4 expansion modules, unique card zones, and objective hooks. Unavailable expansions are blocked server-side.
- Node's built-in test runner; no install step. CI checks on GitHub Actions.

**Important limitations:** No public deployment hardening, matchmaking, sophisticated visual card art, tutorial walkthroughs, guest history/stats, or complete expansion adjudications. Room state is stored using a small synchronous JSON store, suitable for testing, not a scaled production service. Accounts and login are explicitly out of scope permanently; all gameplay is guest-based. Same-device multiplayer requires separate browser profiles (one localStorage session per browser origin).

## Architecture

```text
engine/
  cards.js       Base and Phase 4 card catalog
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
