# Phase 24 — Offline installed web app

The built static web app registers `service-worker.js` on secure origins (including GitHub Pages). At first online launch, the worker precaches all files produced by `npm run build:pages`: the HTML shell, JavaScript modules (including the locally executed engine and all expansion logic), ordered CSS bundle, rules/tutorial, manifest and icon assets. The build produces a content-based cache version, replacing older caches on activation.

After a successful initial installation, the app can relaunch and run solo, hot-seat co-op, settings, rules/tutorial, and locally stored game sessions/history without network access. A service worker cannot make an application available offline until its resources have been fetched at least once. **Open the installed web app while connected before first offline use**, and allow a moment for the cache to complete. The app's saved games and preferences remain in browser/device storage; clearing site data or uninstalling the app may erase those saves.

Online multiplayer requires Firebase or the configured Node backend and is deliberately not cached. Host/Join are disabled when the browser reports that it is offline; if the browser incorrectly reports a connection, online requests may still fail. An offline user may start hot seat even when the last session was online. The home menu also exposes Resume offline solo / Resume offline hot seat for saved local games when the last session was an online room.

The worker caches only a generated allowlist of same-origin static assets and the app navigation shell. It does not cache or intercept API requests, Firebase CDN resources, or personal game data. The `service-worker.js` file is generated at build time from `scripts/service-worker.template.js`; it must be deployed alongside the other Pages build files. The Node dev server continues to run without a service worker; the built static app detects `ONIRAMA_STATIC_BUILD` and uses the local engine for solo play on custom static hostnames as well as GitHub Pages.

## Verification

- `npm run release:gate` includes service-worker installation, activation, cache scope and fetch regression tests.
- A file-backed Chromium rendering check verifies digit-count sizing at several narrow card widths.
- A genuine online-then-offline browser reload should be verified after deployment on an actual HTTPS origin and again on iOS/Android installed PWAs; the local HTTP navigation policy in the development environment may block that check.
