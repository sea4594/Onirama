# Onirama 0.22.0 — Interaction, artwork and production cleanup

This release does not change the game rules, game-state schemas, save keys, or multiplayer protocol.

- Removes unused pre-tab lobby renderers and the pre-Phase-20 Incantation drag handler.
- Uses compact SVG silhouettes for detailed miniature cards, with shared card face/back sizing constraints. Base Location sun, moon and key remain unchanged.
- Separates usable Discard counts from permanently removed Book of Steps cards. Inventory tracks are bounded to 48 segments while retaining exact accessible numeric labels.
- Unifies motion durations, slows card movements and adds face-down Limbo-to-Dreamcatcher movement cues, respecting reduced-motion preference. Only cards already visible in the public game view are considered.
- Bundles CSS into one ordered stylesheet for Pages production, retaining development files and preserving cascade order.
- Reads the Node health endpoint version from `package.json` rather than a stale literal.
- Provides `node scripts/visual-fixture.mjs [output-directory]` to generate standalone, self-contained solo/co-op/base/all-expansion and 28–100px card fixtures for future visual regression.

Known next steps not included here: backend-authoritative Firebase rules, full CSS source refactoring (production bundling eliminates network overhead but not historical selector debt), and browser-driven two-client gesture tests.
