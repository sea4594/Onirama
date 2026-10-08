# Onirama

An original-art, browser-based dream labyrinth card game. The project targets a faithful base-game implementation with cooperative play and a phased roadmap for all standard and promotional expansions.

> **Current state:** Runnable base-game solo and two-player cooperative MVP. **Expansions are not yet playable**; the UI disables them rather than pretending to implement them. This repository is an **unofficial, unaffiliated** adaptation; game concepts belong to their respective owners. No publisher artwork or rulebook text is included.

## Updates through hotfix ZIPs

Use the supplied `ONIRAMA_..._HOTFIX.zip` rather than copying repository files manually. Unzip the archive in `~/Downloads` and run `ONIRAMA_..._HOTFIX/apply-test-commit-push.sh`. The script applies its bundled `files/` to **`~/Desktop/Onirama`** on **`main`**, runs `npm run release:gate`, and commits/pushes **only if the entire gate succeeds**. It refuses a dirty working tree, the wrong branch, the wrong remote, or diverged remote history. An unsuccessful gate leaves edits uncommitted so the error can be diagnosed. The initial hotfix includes the full project because the remote repository is initially empty; subsequent hotfixes contain only changed files and required deletion instructions.

### Requirements

- macOS with `bash`, `git`, and **Node.js 22+** on `PATH`.
- GitHub credentials configured locally so `git push origin main` works.
- `~/Desktop/Onirama` may not exist (the initial installer creates it), or it must be a **clean** git repository on `main` connected to `sea4594/Onirama`.
- The script will add `origin` pointing to `https://github.com/sea4594/Onirama.git` if missing. It does not overwrite an existing, non-empty non-Git folder.

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

- Original, responsive, keyboard-usable card UI; rulebook and development roadmap routes.
- Base 76-card deck with unique card IDs and reproducible seeded shuffles.
- Solo base game: legal Labyrinth placement, Door search with choice to skip, Key Prophecy, all four Nightmare penalties, individual draw/refill decisions, Limbo, immediate victory and deck-exhaustion defeat.
- Official two-player *structure*: eight-card public initial draft, three private cards per player, two face-up shared cards, alternating turns, separate Labyrinths and Doors, optional swap after a discard, and whole-hand redraws.
- Invite-only cooperative rooms, seat-specific bearer credentials, server-authoritative game state, event stream, reconnection/reload, persistent state, action-version checks.
- Server-side hidden-hand and hidden-deck filtering.
- Node's built-in test runner; no install step. CI checks on GitHub Actions.

**Important limitations:** No expansion rules yet; no public deployment hardening, matchmaking, optional accounts, sophisticated visual card art, tutorial walkthroughs, history/stats, or complete expansion adjudications. Room state is stored using a small synchronous JSON store, suitable for testing, not a scaled production service. Same-device multiplayer requires separate browser profiles (one localStorage session per browser origin).

## Architecture

```text
engine/
  cards.js       Exact base card registry; expansion catalog
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
.github/         Continuous integration
```

## Development phases

See **[docs/PHASES.md](docs/PHASES.md)** for the phase-by-phase plan, acceptance gates, and exact expansion coverage; **[docs/RULES_AUDIT.md](docs/RULES_AUDIT.md)** for rule coverage and unresolved official clarifications.

## Rules references

- [Onirim Second Edition base rules (text transcription)](https://www.rulespal.com/onirim/rulebook)
- [Official base-game rulebook (PDF)](https://images.zmangames.com/filer_public/fd/0e/fd0ef6a2-c019-47a2-910a-a556f03a3d02/zm4900_onirim_rules.pdf)
- [Official Book of Expansions (PDF)](https://images.zmangames.com/filer_public/7f/c7/7fc752e5-1a46-408f-b9cc-db5196be46ee/en-onirim-rules_ext-1.pdf)

Do not mark a rule as verified merely because an automated test passes. Each rule and interaction needs a source citation or documented adjudication.
