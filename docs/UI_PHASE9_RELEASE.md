# UI Phase 9 — Final cleanup & release audit (v0.21.0)

## Delivered changes

- Removed the unreachable single-player/co-op legacy `board()` branch and obsolete `expansionBoard()` and old Door-panels renderer calls. Both game modes now route *only* through `renderSoloTabletop` or `renderCooperativeTabletop`.
- Removed unused styling tied to the deleted UI, including `.game-layout`, `.board-main`, `.board-side`, the old `.hero`, old expansion lists/tiles, and old page stats panels. Preserved card visuals, game decisions, modern tabletop zones, accessibility styles, themes, and the standalone renderer preview utility.
- Restored keyboard focus to the same card/choice after an open dialog rerenders (for example, toggling spell-payment cards). Closing optional dialogs attempts to restore focus to the invoking control. Focus containment, Escape restrictions and screen-reader semantics are preserved.
- Fixed a stale Phase 11 test that searched for disconnected text in the removed legacy board; it now checks the current cooperative tabletop's connection UI.
- Kept game engine, server, Firebase config/protocol, Firestore rules, session schema, saved game formats, and room-code behavior **unchanged**.

## Automated coverage

Run the portable release gate on Node.js 22+: `npm run release:gate`. It covers syntax, deterministic base/expansion games, card conservation, all 512 combinable expansion configurations, solo/co-op privacy and rules, Firebase protocol tests, new Phase 9 structural/focus checks, and the GitHub Pages build.

Chromium offline QA was repeated with `python scripts/visual-phase8.py`: **200 viewport/decision cases, 0 issues**. The Phase 8 gesture suite timed out in this container after the visual audit; a smaller fresh `python scripts/interaction-phase9-smoke.py` run passed **6 interaction cases, 0 failures**, testing solo/co-op click-target, pointer drag, and pending-decision blocking at phone portrait size. A timeout is not a pass for the full gesture suite.

The Chromium scripts require Playwright and Chromium at `/usr/bin/chromium`; they are not in the Mac-compatible release gate. The fixture tests render actual exported tabletop components and controls, not a production Firebase session.

## Owner-run release acceptance checklist (not verified here)

1. After GitHub Pages finishes deploying, confirm **Settings → Current commit** matches the new commit.
2. In a new solo base game, play/discard via mouse and touch, trigger a Key Prophecy and a Nightmare, change card order, refresh during a mandatory decision, and resume.
3. Solo with *all nine combinable expansions*: verify the Goal row, 12 Door slots, Towers, Dreamcatchers, Premonitions, Denizens, Mirrors, and all decision types, including hard variants. Include Little Incubus **separately** with the base game.
4. Open the GitHub Pages game in two distinct browser profiles or physical devices. Host, copy link, join by code, Ready/Start, draft, take turns, and play/discard from private and shared hands. Both boards should synchronize; the inactive player's private hand must remain face down in the UI.
5. Refresh during a pending Nightmare or expansion effect; check that the same authorized player can finish the effect after reconnection, with no duplicated card action. Test network loss and recovery.
6. Repeat gameplay on iOS Safari, Android Chrome, tablet portrait/landscape and desktop Chrome/Firefox/Safari, including reduced motion, high contrast, large text, screen-reader announcements and keyboard-only navigation.
7. Verify Firebase anonymous authentication is enabled, the published Firestore rules still match `firestore.rules`, and no room credentials appear in the invite URL. The client-side Firestore architecture does not prevent an advanced player from inspecting game data through developer tools.

## Explicit remaining limitations

- Live cloud Firebase, mobile Safari/Chrome on physical hardware, screen-reader testing, and public deployment need the owner to run the steps above. This work does **not** claim those steps passed.
- Some rare expansion/co-op combinations use documented application adjudications rather than publisher-confirmed rulings. These remain in `docs/UI_PHASE2_AND_RULINGS.md` and `docs/RULES_AUDIT.md`.
- No publisher artwork is bundled; the project remains an unaffiliated adaptation.
- No account or player login is planned (Firebase anonymous sessions are internal).
