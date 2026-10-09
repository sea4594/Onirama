# UI Phase 2 / physical card verification and unresolved rule adjudications

## Confirmed card faces (supplied by owner, 2026-10-08)

The 12 printed Towers are encoded exactly in `engine/cards.js` -> `TOWER_FACES`. There is one card with inspection value 3, 4 and 5 per color. `sun+moon` denotes BOTH printed symbols on the edge; `''` denotes NO symbol. The engine's Tower neighbor check treats two touching edges as incompatible if they share ANY symbol; an empty edge is compatible with any opposite edge. Their values and symbols now have exhaustive tests in `tests/tabletop-phase2.test.js`.

The card-count distinction is fixed in `engine/physical-inventory.js`: 76 base + 93 standard expansion + 23 promotional = **192 cards**, of which 155 are in the *potential* shuffled-deck factory (before the eight unused Oniverse Denizens are removed); 37 are auxiliary cards represented in board state, and the Incubus pawn is not a card. See `physicalCounts()` for components.

**Saved Tower games from before this change:** old generated edge metadata is embedded in serialized card objects. To avoid silently altering an in-progress placement, the app does not forcibly replace those cards' attributes during save migration. Start a new Towers game to use correct metadata throughout.

## Verified published clarifications

- Two-player game has separate player Labyrinths/Doors and shared two-card resource row. Source: https://www.ultraboardgames.com/onirim/two-player-rules.php
- Towers: **one shared Alignment** in cooperative play. Source: expansion-rule transcription (includes explicit sentence), https://www.scribd.com/document/400773801/Onirim-Expansiones-reglas-ES-pdf
- Mirrors: an exploration requires two matching Locations in one action; the difficult Rainbow Mirror requires a total of one Location of each color. Source: https://ultraboardgames.com/onirim/expansion.php
- Standard card definitions: official book at https://images.zmangames.com/filer_public/7f/c7/7fc752e5-1a46-408f-b9cc-db5196be46ee/en-onirim-rules_ext-1.pdf

## Application rulings still not unequivocally specified by available official text

These are implementation choices, **not claims of official rulings**. They must have targeted tests before the full expansion tabletop redesign is certified.

| ID | Combination | Implementation/adjudication | Status |
|----|-------------|-----------------------------|--------|
| COOP-GLYPHS | Cooperative + extra Glyph Doors | Team must collect all additional colored Doors; both players must still have at least one each of the four basic colors | House interpretation; verify publisher |
| COOP-BOOK | Cooperative + Book of Steps | Team shares one ordered Goal row; acquisition is checked against that row, while Doors are credited to acquiring player | House interpretation; verify publisher |
| COOP-OBJECTIVES | Coop + Dreamcatchers/Mirrors/Premonitions | Public Dreamcatcher/Mirror/Premonition areas are shared, Premonitions count Doors across the team | House interpretation; verify publisher |
| WILD-RAINBOW | Crossroads + difficult Rainbow Mirror | Only a printed-colored Location counts as a new unique Rainbow color, NOT a wild-colored Crossroad | Conservative app rule. Promo rules say “one card of each color” but do not specify Crossroads |
| LOW-DECK | Any search/reveal of more cards than available | Resolve with remaining legal targets, no implicit discard/deck recycle or invented replacements | Engine fallback; official multi-expansion precedence unclear |
| EFFECT-ORDER | Simultaneous optional/nested effects | Resolve pending decisions in engine effect queue and check immediate victory after qualifying acquisitions | Application deterministic sequencing pending rare-case publisher clarification |

Cards, abilities and all physical expansion zones beyond solo base game stay on the *legacy functional UI* until UI Phases 4–6. Phase 2 does **not** change expansion legality or game mechanics. The board route chooses the new renderer only for a solo game with no expansions; all expansion-enabled games and two-player games continue through the existing renderer until their dedicated migration phases. Nothing is silently disabled.

## Phase 2 UI contract

- Actual solo/base tabletop: Doors, Labyrinth (full ordered sequence in scrollable overlap), deck, discard, Limbo, and five-card hand visible together. Each card has stable identity, and empty Door slots are visible.
- A card is selected with mouse/touch/keyboard; legal Play and Discard invoke original `app.js` action commands. Each action is revalidated by existing engine. Card dragging and full contextual overlays are reserved for UI Phases 3 and 4.
- Decisions use the **existing** complete decision renderer, embedded below the tabletop. No existing mandatory choices are dropped.
- Responsive layouts reorganize between three columns (desktop), two-column blocks (tablet), vertical sections (phone portrait), and two-by-two zones (short landscape screens). Long labyrinths are scrollable, with latest card scrolled into view after state updates.
- Solo saves, guest history, Firebase room transport, cooperative UI, all ten modules, difficulty variants and settings are unchanged.
