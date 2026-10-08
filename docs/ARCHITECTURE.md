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
7. Define account deletion/privacy policies and retention schedule before collecting personal information.
8. Conduct authorization, injection, XSS, CSP, accessibility and network failure testing before declaring production-ready.
