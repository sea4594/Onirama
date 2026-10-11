# Adaptive tabletop layout — October 2026

This pass changes presentation only. The engine, Firebase protocol, save format, card identities, and touch actions are unchanged.

## Space allocation

`public/tabletop/fit.js` measures the actual board slot *after* fixed action controls. It chooses one of four layouts (phone portrait, short landscape, tablet, wide) and passes coordinated card, compact-card, shelf, spacing and gap sizes to `public/tabletop/adaptive.css`. It tries comfortable, compact, dense and ultra-dense internal allocations before considering an overall scale fallback. Extra room is reinvested in card sizes and/or the playable Labyrinth area.

In portrait solo, Doors and Piles share a row, optional expansion equipment comes next, and the Labyrinth is immediately above the hand. Co-op reserves full-width prominent active cards, shows the partner's private cards face down, and groups partner / common / active zones. Landscape phones use a full-width bottom action strip in place of the narrow right rail, with active equipment in a horizontal shelf. Tablets and wide desktops combine Dreamcatchers and Premonitions into a single horizontal band where there is room.

Door sizing remains tied to the compact-card scale. Towers are larger than other compact equipment. All card faces keep their original 1:1.42 proportions. Dreamcatchers remain four equal-width compartments; reserve, held cards, piles, and other small groups can still be inspected by tapping. Long Labyrinths adjust overlap so the final card remains visible. The game page itself does not scroll during normal play. Phone portrait action controls reserve a consistent 112px rather than the former 152px, freeing space for the tabletop while permitting the decision content to scroll within its panel.

## Visual verification and limits

Browser screenshots were examined at phone portrait 390×844, phone landscape 844×390, tablet portrait 768×1024, and desktop 1440×900, each with solo/co-op and base, partial or all supported combinable expansions. Both initial and populated states were inspected. A second round corrected excessive short-landscape shrinking, portrait co-op row stacking and a Dreamcatcher aspect-ratio collapse. Additional viewport sizes and overlay checks were performed using Chromium with screenshots, not just DOM dimensions.

Very short phones with all combinable expansions and long public drafts may still require a **last-resort** board scale. This is a physical space limit; keep tappable inspection rather than removing real-game components. Verify actual Firebase and mobile Safari interactions on devices before release.
