# Onirama production deployment (Phase 9)

**No accounts.** The site at `https://sea4594.github.io/Onirama/` can run solo games entirely in the browser. Live multiplayer requires an always-on, HTTPS Node.js service. **Adding code to GitHub alone does not deploy the multiplayer service.**

## 1. Apply Phase 9
Run the supplied incremental hotfix on local `main`. Its gate must pass before it commits/pushes. CI rebuilds GitHub Pages, using any configured backend URL.

## 2. Provision backend (one persistent instance)

A `render.yaml` blueprint is included for Render's paid `starter` instance with a **persistent disk**. Provision a new Blueprint from `sea4594/Onirama` in Render, authorize your own Render billing, and deploy. Alternatively use another Node 22+ HTTPS host with a persistent mounted directory. Required environment:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `ONIRAMA_DATA_DIR` | `/var/data` on the mounted persistent disk (not ephemeral filesystem) |
| `ONIRAMA_CORS_ORIGINS` | `https://sea4594.github.io` (comma-separated exact origins) |
| `PORT` | Set by hosting provider, or `3000` locally |
| `ONIRAMA_TRUST_PROXY` | Leave unset unless **only** a trusted reverse proxy can connect to the Node server. When `1`, rate limiting uses the first X-Forwarded-For address. |

**Single-instance restriction:** File-backed transactions are atomic on one local filesystem, but this is **not** a distributed database. Do not run two replicas/workers sharing `sessions.json`. No automatically provisioned backend, cloud database, or backup service is included in this repository.

Verify `https://YOUR-SERVER-DOMAIN/api/health` returns `{"ok":true,"version":"0.9.0"}`. Require HTTPS; never embed a plain HTTP backend on a Pages HTTPS site.

## 3. Connect GitHub Pages

In the [Onirama GitHub repo](https://github.com/sea4594/Onirama), go to **Settings → Secrets and variables → Actions → Variables → New repository variable** and set:

`ONIRAMA_API_ORIGIN` = `https://YOUR-SERVER-DOMAIN` (no trailing slash or path).

In **Settings → Pages**, select **GitHub Actions** as deployment source. Run **Actions → GitHub Pages (solo edition) → Run workflow** again to embed this URL. The live Pages **Multiplayer** tab will then connect to the server while **Single Player** stays browser-local.

## 4. Acceptance checks on real hosted domains

1. Open Pages on desktop and mobile; play a base solo turn; reload and resume.
2. Host a coop room on Pages, copy the room code, open a different browser/private window on another device, and join.
3. Ready both players, start, draft, play, and verify each player's cards remain private.
4. Reload one browser; verify room ownership, turn and pending decisions are restored.
5. Restart the Node service without deleting the disk and confirm the room resumes.
6. Try the incorrect room token, duplicate action, and invalid Origin; each must be rejected.
7. Confirm GitHub Pages deployment and backend health after pushing a later version.

## 5. Operational boundaries and privacy

- Player nicknames, unexpired room/seat bearer tokens, and full games are stored on the backend persistent disk. Browser localStorage stores seat credentials and solo-game snapshots; users should avoid shared computers and may clear their browser data.
- The storage file is written by atomic rename using a restrictive file mode. **Backups and retention policies must be configured by the host**; do not claim that this release sets up automated backup/restore or permanent recovery.
- Rate limits are per IP by default. At high traffic or behind an unusual proxy, use a supported reverse-proxy/WAF and database-backed shared limiter.
- HTTPS termination and availability depend on the hosting service. Make sure the Render disk is attached before accepting multiplayer traffic.
- No personal account or analytics integration is included. Hosting providers may have their own operational logs.
- The game adapts third-party tabletop mechanics. Public use of original card illustrations or logos requires appropriate permission; only original placeholder visuals are shipped here.

## 6. Backups / restore

In a maintenance window, stop the backend or take a storage-level snapshot of the mounted disk that contains `sessions.json`. Keep a secure offsite copy protected like a credential database (session tokens are in the file). To restore, stop the server, replace `sessions.json` with the desired valid snapshot, preserve file permissions, and start one server instance. Test restore on a staging instance before replacing production data.
