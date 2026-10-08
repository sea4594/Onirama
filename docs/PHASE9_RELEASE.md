# Phase 9 — deliverables, limitations and remaining work

Delivered: single-instance atomic session persistence with save-before-commit, CORS allowlist and preflight for Pages, API request rate limits and restricted stream count, hostable HTTPS backend blueprint, configurable GitHub Pages API URL, health endpoint, server restart tests, authentication/duplicate-action regression checks, static asset validation and source-based privacy checks.

Unchanged: no account, original placeholder assets, fully local solo game, versioned Phase 8 game engine and guest data, all existing expansions, release gate.

**Release gate**: `npm run release:gate` (includes legacy suites and Phase 9 regressions). A passing release gate confirms code/tests, not a live cloud deployment or official-rule correctness.

**Not automated by the repository:** provisioning or paying for backend hosting, repository deployment variable settings, cloud TLS configuration, persistent disk backups, monitoring/alerts, production load tests and real-device acceptance. The hosting setup is documented in `docs/DEPLOYMENT.md`.

## Remaining phases after 9

- **Phase 10 — rules verification and final corrections:** compare all 12 physical Tower cards' edges, clarify outstanding publisher/cooperative expansion interactions and scarcity rules, explicitly label house-rule adjudications, add focused tests and correct the engine where evidence demands it. Requires reliable physical-card/rule references.
- **Phase 11 — live-launch acceptance and polish:** configure actual backend (owner action), test Pages ↔ API hosting end-to-end on separate devices, check reconnection, browser/mobile and accessibility, perform a practical load/monitoring/backup rehearsal, review publisher asset rights and user-facing privacy documentation.

These are release-quality follow-ups, not mandatory new product features. **Phase 9 is code-complete, but public multiplayer is not activated until a server URL is configured and a persistent Node host is running.**
