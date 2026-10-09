# UI redesign — Phase 7 (v0.19.0)

## Scope
A new `public/shell.css` style layer covers **non-game screens only**; game tabletop CSS and renderers are unchanged. Existing route names, `data-action` commands, game engine, Firebase protocol, browser-local settings/presets/history and no-account policy are preserved. `app.js` renders a shorter shell with the same three bottom tabs. `public/index.html` loads the new stylesheet. The About area still links the deployed commit hash.

## Visible surface / retained actions
- **Single Player:** Play solo, Choose expansions, Resume (when present), Learn to play, History. No redundant expansion catalog, motto or rule paragraphs.
- **Multiplayer:** host nickname/Create room, room code/guest nickname/Join, resume if present. Direct invite link still prepopulates the code.
- **Setup:** Solo/Co-op, nickname, all ten expansion/modifier selections, difficulty variants (including Premonitions extreme and Incubus three levels), start and saved setup management in a collapsed `details` panel. Enabling Incubus disables other expansions, per original client logic. The nickname is preserved through expansion toggles.
- **Room lobby:** large selectable code, Copy code/Copy invite link, visible URL fallback, both player ready states, Ready toggle, host Start with original guard.
- **Settings:** all five UI preferences; Rules, Tutorial, History, connectivity diagnostic, Resume when present, Git commit and secondary Roadmap. No account/deployment explanation block.
- **Tutorial:** seven precise screens with progress and back/next; underlying rules remain accessible.
- **History:** concise local win/loss record with all four existing statistics and clearing.
- **Rules:** base instructions available via six collapsible sections, with an external rules link. Text is *not* deleted, only hidden until requested.
- **Roadmap:** compact nine-phase summary instead of verbose engineering notices.
- **Results:** gameplay end-state buttons (New game, History) continue to use existing tabletop rendering; untouched by this phase.

## Visual checks
`node scripts/ui-phase7-fixtures.js` produces HTML from the *actual app route renderer*, not re-created mock designs. The offline Chromium probe `python scripts/visual-phase7.py` embeds the shipped stylesheets and checks nine screens × eight viewports (320×568, 390×844, 568×320, 844×390, 768×1024, 1024×768, 1440×900, 1920×1080): no page-level horizontal overflow and all interactive controls visible (nonzero dimensions). Screenshots were inspected, including 320px setup, phone multiplayer and lobby, and desktop layouts.

This validates static layout and VM route/action contracts, **not** production browser Firebase sessions or interaction on real devices; those remain for UI Phase 8. The full `npm run release:gate` covers rules, privacy, save compatibility, existing expansion configurations, and GitHub Pages build.

## Remaining phases
- **UI Phase 8:** real browsing, touch/keyboard, all expansion/difficulty combinations, both Firebase seats across devices, dialogs/scrolling/orientation, accessibility and visible regression fixes.
- **UI Phase 9:** remove superseded UI paths/styles, optimize rendering, final rule/multiplayer regression suite, release.
