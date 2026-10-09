# UI refinement Phase 4 — responsive virtual tabletop

The UI is still the same engine-driven tabletop. Phase 4 changes only its projection, sizing and layout, building on the Phase 3 checkpoint. The engine, game commands, rules, card definitions, and Firebase protocol are unchanged.

## Implemented
- Added a width/height-dependent layout allocator (`public/tabletop/fit.js`) and one focused responsive stylesheet (`public/tabletop/responsive.css`) loaded after the theme. Four layouts: wide, medium, phone-landscape, portrait. The shape is based on the actual game viewport rather than orientation alone.
- Solo Doors/piles, Labyrinth, hand and expansion shelf are arranged by available aspect ratio; cooperative play keeps both player fields and hands, shared cards, drafting, and all active expansion components visible.
- Expansion shelf changes column count and tile geometry to limit wasted rows in narrow/short viewports. Card faces and draft cards retain their aspect ratio. Overlong visible card descriptions are constrained to two lines, preserving complete `title` and `aria-label` values.
- Public co-op drafting is promoted to a full-width tabletop row, not restricted to the narrow middle column. The Doors total is now in the top status line rather than floating over the expansion shelf.
- Labyrinth cards fan/overlap based on actual zone width and count. Long sequences remain in the non-scrolling tabletop, with the final card unobstructed and counts visible. No rule/state behavior is changed.
- On resize, the app first adapts the actual arrangement and components, then reduces internal density if required. A last-resort overall zoom is retained only for especially small, expansion-heavy configurations (notably 320×568 and 568×320, particularly during drafting), instead of being the default.
- Reflows on window and visual-viewport resize; does not remove zones or disable card actions.

## Verification
- `npm run release:gate`: 185 automated tests and Pages build passed.
- `python scripts/visual-refinement-phase4.py`: 80 real-renderer Chromium checks: solo/co-op; both seats; base, all available expansions, Incubus, co-op draft, and 45-card Labyrinths; 320×568, 568×320, 390×844, 844×390, 768×1024, 1024×768, 1440×900, 1920×1080. Zero offscreen zones, clipped expansion panels, or horizontally overflowing Labyrinths in these offline fixtures. Visual snapshots are written to `docs/ui-phase4-refinement/` when the optional script is run (not packaged in this hotfix).
- Known limits: very small screens with all expansions still use some last-resort fitting, and dense card labels require inspection in the upcoming Phase 5. Tests are fixture-based and not a substitute for real-touch, live Firebase, or full gameplay lifecycle checks. Phase 6 will revisit overlays and pile inspection separately.
