# UI redesign — Phase 8 visual and interaction QA (v0.20.0)

## Scope
This phase tests the deployed *source components* and renderer in a real local Chromium engine, across compact phones, landscape phones, tablets and desktop viewports; it corrects discovered clipping without touching the game rules, Firebase room protocol, save format, or card inventory. It does **not** assert live cloud/device verification.

## Fixed defects
1. **Split-column solo Piles clipping:** on 320/390px portrait, fixed 53px pile minimums made Limbo partially disappear when expansions moved Labyrinth and Piles side-by-side. Narrow-screen piles now flex-shrink, with proportionally sized faces/counts.
2. **Glyph Door slots clipping:** groups of three Door slots could extend beyond their column, including at some tablet widths, without creating page-level overflow. Every slot now flexes inside its assigned color group (retaining all physical slots).

Neither correction changes a game action or state transition.

## Reproducible coverage
Run:

```sh
npm run release:gate
node scripts/ui-phase8-fixtures.js
python3 scripts/visual-phase8.py
python3 scripts/interaction-phase8.py
```

The Python visual tools require Playwright and a Chromium executable at `/usr/bin/chromium`; they are optional developer QA, **not part of the portable Node release gate** and are not expected to run on a Mac without those tools. `scripts/visual-phase8.py` uses offline HTML generated from *real* solo/co-op and dialog renderer functions with the actual CSS. No network navigation is involved.

- **200 Chromium responsive checks**: 25 real-renderer game/dialog fixtures × 8 viewport sizes (320×568, 390×844, 568×320, 844×390, 768×1024, 1024×768, 1440×900, 1920×1080). Assert no document horizontal overflow, no game-region collapse, no component/slot clipping behind outer zones, no zero-size enabled buttons, and no dialog extending outside the viewport.
- Fixtures cover base, four-expansion, all-nine, and difficult all-expansion configurations, Little Incubus, both cooperative seats and ten representative decision-dialog shapes. Saved screenshot examples are available locally in `docs/ui-phase8-baselines` after running the tool.
- **52 Chromium interaction checks**: legal card selection and target highlighting, click/tap-to-discard, real pointer drag-to-discard, pending-effect blocking, and the inactive cooperative seat. Run across five solo/co-op states and four phone/desktop viewports.
- **163 Node release-gate tests** including all **512** expansion combinations rendered in both modes (including both co-op seats), all supported difficult-variant group configurations, mandatory/optional modal structure, private-hand noninteractivity, and existing game/Firebase/save tests.
- Manual inspection of screenshot examples: solo with all nine expansions (390×844), cooperative with all expansions (320×568, 1440×900), Nightmare and Prophecy sheets (390×844, 568×320).

## Important limitations and outstanding launch gate
These checks execute actual renderer output and controller code in Chromium, but **not** the deployed hosted application with two real Firebase-authenticated browsers. Before calling the redesign finished, manually check:

- On the GitHub Pages deployment, start a solo game, play/discard, open Prophecy/Nightmare and resume after refresh.
- Create a live Firestore room in Browser A, join in private/incognito Browser B (and two physical devices), draft, begin game, play and discard from personal/shared cards, and verify both clients update without refreshing.
- From both seats, check private hands, active turn enforcement, shared resources, expansion actions/choices, phone portrait/landscape, keyboard and touch input; refresh while a decision is pending and verify correct reconnection.
- Check Safari iOS and Chrome Android as well as desktop browsers. Browser emulation alone does not prove touch behavior or safe-area layout on real devices.
- Repeat with all expansions enabled and important hard variants, especially the shared Tower Alignment, Dreamcatchers, extra Doors, Mirrors, and interrupting Premonitions.

Any failure needs a follow-up hotfix and its own regression test. Publisher-rule ambiguities remain documented separately in `docs/UI_PHASE2_AND_RULINGS.md`; UI QA does not resolve them.

## Phase 9
Remove superseded legacy rendering/style paths carefully, do final accessibility and performance work, rerun the full gate and hosted two-device launch checklist, then publish the cleaned release. Do not remove rules/UI command paths solely because a selector is not exercised by these fixtures.
