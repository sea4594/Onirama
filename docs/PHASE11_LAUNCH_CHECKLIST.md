# Phase 11: hosted launch, room codes, and QA

**Status:** Release code + automated backend tests complete. **Hosting, billing, configuration, real-device QA, backups, and legal/art verification require owner action.** Nothing in this phase creates a cloud service or certifies all source-game rules. No Onirama user account or login is required.

## What goes where

| Component | URL/location | Responsibility |
|---|---|---|
| GitHub `main` | `github.com/sea4594/Onirama` | Code and GitHub Actions source |
| GitHub Pages | `https://sea4594.github.io/Onirama/` | Static web interface, offline/local solo games, multiplayer client |
| Render (or other HTTPS Node 22+ host) | e.g. `https://onirama-multiplayer.onrender.com` | Multiplayer room codes, private hands, authoritative turns, save/reconnect, CORS |
| Persistent disk | `/var/data/sessions.json` (Render blueprint) | Hosted room/seat credentials and active game state; **must not be ephemeral** |
| GitHub Actions variable | `ONIRAMA_API_ORIGIN` | Tells Pages which backend origin to call; this is a public URL, not a secret/token |

## Manual launch (required, in order)

1. **Apply and push Phase 11** using its hotfix, confirming the full release gate and `main -> main` push. Make sure `.github/workflows/pages.yml` is on `main`.
2. **Choose hosting and budget.** On Render, sign in and link your GitHub account to Render (this is a *hosting administrator* connection, not an Onirama player login). Select **New → Blueprint**, choose `sea4594/Onirama` and its `render.yaml`. Review the resulting web service `onirama-multiplayer`, the paid `starter` plan and **1 GB persistent disk mounted at `/var/data`**. Approve any charges. Deploy **one instance only**. Do not choose free hosting with ephemeral files unless you are willing to lose rooms on restart. See [Render persistent disks](https://render.com/docs/disks) and [Render Blueprint specs](https://render.com/docs/blueprint-spec).
3. **Verify the Render service.** Wait for `Live`. Copy the actual HTTPS service origin (not the health URL, not a trailing slash). Open `https://YOUR-SERVICE.onrender.com/api/health` and confirm `{"ok":true,"version":"0.11.0"}`. Check Render logs for startup errors; verify the disk exists and `/var/data` is writable. Do not expose `sessions.json` publicly.
4. **Verify its environment values** in the Render dashboard: `NODE_ENV=production`, `ONIRAMA_DATA_DIR=/var/data`, `ONIRAMA_CORS_ORIGINS=https://sea4594.github.io`, `PORT` auto-assigned by Render. Leave `ONIRAMA_TRUST_PROXY` unset unless you specifically control your proxy/trust boundaries. Restart deployment after changing environment values.
5. **Connect the live site.** GitHub → Onirama → **Settings → Secrets and variables → Actions → Variables → New repository variable**. Name: `ONIRAMA_API_ORIGIN`. Value: `https://YOUR-SERVICE.onrender.com` (HTTPS origin **only**, no `/api`, no `/api/health`, no path, no trailing slash).
6. **Enable GitHub Pages.** Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**. Go to **Actions → GitHub Pages (solo + configured multiplayer) → Run workflow** (or push a new commit). Confirm the deployment finishes successfully. Open `https://sea4594.github.io/Onirama/`, visit **Settings → Test multiplayer connection**; you should see the backend's version.
7. **Check production API authorization and room codes** from your local checkout: `node scripts/verify-backend.js https://YOUR-SERVICE.onrender.com`. This test **creates one disposable game room** on production but does not touch existing rooms. It verifies Pages CORS, two seats, eight-character code join, ready/start authorization, draft, private-hand filtering, and duplicate-action rejection.
8. **Perform the real-device room flow below**, then decide whether to announce the website. Automated HTTP tests cannot substitute for visual/touch/browser acceptance on your devices.
9. **Arrange backups/alerts.** Decide retention, take a protected storage snapshot and rehearse restoring it to a *separate staging service*. Set provider uptime/error alerts for `/api/health`. If you lose the persistent disk, room credentials and saved multiplayer games cannot be reconstructed from GitHub. Review Render service restart/deploy logs after updates.
10. **Check artwork/rules permission and accessibility.** This is an independent, unofficial project. Do not present provisional Tower edges or undocumented cooperative adjudications as verified official play.

## How actual multiplayer and codes work

- On one device: open the Pages URL → **Multiplayer → Create room**. The room receives a random **eight-character hexadecimal code** (e.g. `A1B2C3D4`). Click **Copy room code** and send it to the second player, or **Copy invite link** (`https://sea4594.github.io/Onirama/#/join?code=...`) to pre-fill their join field. **The link contains no private seat token.**
- On a **different device or private browser profile**: follow the invite link or open **Multiplayer**, enter the code under **Join with a code**, enter a display name, and click **Join room**. Only **one guest seat** exists; a third person cannot join the same room. The host can see the guest seat filled.
- Both players click **I'm ready**. The host clicks **Start cooperative game** (disabled until both seats are filled and ready). The game starts with an eight-card public draft, then alternating turns. Each side sees its own private cards and the two shared cards.
- In each browser, the app keeps its seat credential in **localStorage**. Reload/reopen the same site and use **Resume current room**; the backend remains authoritative. Different browsers on the **same device** also work if they have isolated storage. **Do not share a seat token or copied browser storage.** Room code alone is only for filling the second seat; it does **not** transfer an occupied seat after the game starts.
- A host disconnect does **not** make the guest host. Turns wait while disconnected. The UI attempts reconnection, with **Retry now** for interruptions. Resume after restarting the backend to confirm persistent storage.

## Acceptance matrix (two devices recommended)

| Test | Expected result |
|---|---|
| Desktop Safari/Chrome/Firefox; mobile Safari/Chrome | Home/settings/board legible, no overflow preventing required controls |
| Mobile viewport, large text, high contrast, reduced motion | Entire hand and every mandatory decision remains accessible by tap/keyboard |
| Pages solo, close tab, reload, resume | Local solo state survives (unless browser storage cleared/private session ended) |
| Copy link → second device → Join | Code prefilled; 2nd seat gets unique bearer credential; no host token in URL |
| Join invalid/wrong code; join full/started room | Error; no third seat or takeover |
| Guest attempts Start, both players not ready | Server refuses; host Start disabled before ready |
| Alternate public draft and regular turns | Turn owner controls legal actions; other player cannot submit move |
| Private hand and deck-order inspection | Other player's hand faces, deck and random seed never appear in API responses |
| Page refresh during draft and pending Nightmare/Prophecy | Same seat, choices, cards, and version restored without extra card draws |
| Disconnect/reconnect Wi-Fi and restart app | Reconnect and retrieve latest authoritative version; no duplicate move |
| Restart hosted backend (keep disk) | Same two-seat room and pending decisions resume |
| End-of-game, multiplayer/solo, all enabled expansions | Victory/defeat and browser-local history recorded once |
| Bad bearer token / wrong Origin / duplicate or stale action | Rejected; no state mutation |
| Hosted redeploy and browser cache refresh | API version and Pages script match; site continues working |
| 320 px wide or landscape tablet, screen reader keyboard-only | Navigation, selection, reordering and dialogs remain operable |

## Operational limitations and troubleshooting

- **Pages shows “not configured”:** check `ONIRAMA_API_ORIGIN` in **Actions variables**, confirm no trailing slash, and *rerun* the Pages workflow; a variable change alone does not rebuild existing artifacts.
- **Test multiplayer connection fails:** check backend HTTPS URL, `/api/health`, Render logs and `ONIRAMA_CORS_ORIGINS`. CORS must list `https://sea4594.github.io` **without** `/Onirama`. A successful health check directly is not proof that CORS works; use the verification script.
- **Room code not found:** ensure both browsers use the **same deployed backend**; check capitalization, whether the service restarted on ephemeral storage, and whether the code was copied correctly. Codes are not joinable after the second seat is occupied or the game starts.
- **Host sees “Disconnected / reconnecting”:** backend may be asleep/offline, SSE connection was interrupted, or service restarted. Wait for reconnection / click Retry; never create a new game as a substitute for resuming until you check the original.
- **Rooms disappear after redeploy:** service lacks a persistent disk or the mount path/`ONIRAMA_DATA_DIR` is wrong. No app can restore games after their sole storage copy is lost.
- **Render free service:** free instances sleep and have ephemeral local storage. The included `render.yaml` intentionally specifies a paid persistent instance; paid hosting is required for this file-based durable configuration. Alternative deployments need an equally durable single-writer filesystem (or future database migration).
- **Scaling:** single-process file-backed persistence. **Never horizontally scale** this backend or share `sessions.json` between replicas without replacing its storage and concurrency model.
- **Backups:** `sessions.json` contains bearer seat credentials. Use encrypted/restricted backups, do not commit it to Git, and use a staging restore. See `docs/DEPLOYMENT.md`.
- **Rules:** printed Tower symbols and some multi-expansion/cooperative interpretations remain source-unverified (see `docs/RULES_AUDIT.md`). These cannot be certified by the release gate.
- **No Onirama player accounts** are needed or planned. GitHub/Render administrator accounts are only for deploying the website.
