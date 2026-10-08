# Architecture and threat model

## Current implementation

One Node HTTP process hosts static assets, JSON endpoints, and an authenticated server-sent event stream. The engine is a pure state transformer (`act(structuredClone(state), command)`); a failed command throws without mutating persisted state. Room updates are sent only after accepted transitions. Rooms and seed/state are saved as JSON in `server-data/`. The server holds the actual deck order and PRNG seed; `viewFor(state, seat)` redacts the draw deck, RNG and other players' hands, and hides pending decisions from non-active players. Bearer tokens are 192-bit random, stored per seat.

One browser stores one room seat credential under `localStorage` and reconnects automatically when reloaded. For testing both seats on the same machine, use a normal browser plus a private window/different browser profile.

## Protocol

- `POST /api/solo {name}` -> room + secret seat token
- `POST /api/rooms {name}` -> private cooperative lobby, room + secret seat token
- `POST /api/join {code,name}` -> seat 2 token
- `GET /api/rooms/:id/state` (Authorization Bearer) -> room, redacted game, version
- `GET /api/rooms/:id/stream` (Authorization Bearer) -> SSE redacted updates
- `POST /api/rooms/:id/ready {ready}` -> update readiness
- `POST /api/rooms/:id/start` -> only host after both ready; initializes cooperative draft
- `POST /api/rooms/:id/action {expectedVersion,command}` -> validates seat/turn/version and applies action

A stale `expectedVersion` returns an error and never replays an old command. For future horizontal scaling, move from synchronous JSON writes to a transactionally updated database row (`WHERE version=?`) and a distributed broadcast adapter.

## Security limitations to resolve before public deployment

1. HTTPS and strict HSTS; do not expose bearer tokens on non-TLS connections.
2. Replace bearer tokens stored in localStorage with robust session cookies or equivalent anti-theft controls, expiring/rotating credentials and recovery flows.
3. Implement room-code rate limiting, expiry, quotas, token revocation and abusive-request controls.
4. Protect all writes with transactions, crash recovery, versioned schema migration, and backups; synchronous JSON persistence is not safe for scaling or multiple servers.
5. Add comprehensive audit/visibility tagging to event logs so private information never appears in a public history or replay.
6. Scope updates to authorized seats only; test reconnects while resolving decisions.
7. Publish guest-session retention and deletion policies before collecting personal information.
8. Conduct authorization, injection, XSS, CSP, accessibility and network failure testing before declaring production-ready.

## Phase 3/4 implementation

- `config.js` rejects unimplemented expansion combinations even when a caller bypasses the browser and submits direct API requests. The game includes `schema:2`, `rulesVersion`, `config`, `moduleState`, `effects`, `continuations`, `events`. Existing schema-1 session games are upgraded on use without losing card instances.
- `zones.js` enumerates player, common, temporary, and module card zones and checks card conservation. Module state is never exposed in client views.
- `effects.js` provides deterministic, serializable `log`, `move`, `shuffle`, `decision` effects. A decision suspends subsequent effects until the authorized actor responds. Unsupported effects fail explicitly. Phase 4 expansion actions also use serializable, server-validated pending decisions; future expansions will extend this framework.
- `modules.js` is a registry with `setup`, `onEvent`, and `objectives` hooks. The base game calls it on Door acquisition and Limbo resolution. Additional effects will be integrated at phase-specific rule boundaries as expansions are implemented.
- UI remains dependency-free. The theme palettes and navigation pattern were adapted from the supplied BibleGuessr project, without copying its Next.js stack or private app data. Settings persist locally; server game state remains authoritative.
