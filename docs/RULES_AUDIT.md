# Rules audit and adjudication log

This document separates **implemented and tested** from **unimplemented**, **assumed**, and **publisher-verified**. Sources are paraphrased; publisher text/artwork are not redistributed.

## Implemented base behavior

| Rule | Status | Source |
|---|---|---|
| 76-card base deck, 58 Locations, eight Doors, 10 Nightmares | Implemented/tested | Base rulebook pp. 4–7 |
| Five starting Locations and reshuffle non-Locations | Implemented/tested | Base pp. 6–7 |
| Play only different adjacent symbols | Implemented/tested | Base p. 7 |
| Third consecutive color earns optional Door search; fourth restarts | Implemented/tested | Base p. 7 |
| Discarding Key triggers top-five Prophecy, mandatory one discard, exact reorder | Implemented/tested | Base p. 8 |
| Normal drawn Doors allow optional matching Key; otherwise Limbo | Implemented/tested | Base p. 8 |
| All four Nightmare penalties | Implemented/tested | Base p. 8 |
| Nightmare special redraw ignores Dreams and Doors | Implemented/tested | Base p. 8 |
| End-of-turn Limbo shuffle, immediate 8-Door victory, deck-exhaustion defeat | Implemented/tested | Base pp. 8–9 |
| Cooperative eight-card face-up draft, three private and two shared resources | Implemented/tested | Base pp. 10–11 |
| Two player Labyrinths; one Door of each color for each player | Implemented/tested | Base pp. 10–11 |
| Swap one personal and one shared card immediately after discard | Implemented/tested | Base pp. 10–11 |
| Cooperative whole-hand special redraw (three personal, then two shared) | Implemented/tested | Base pp. 10–11 |

## Unresolved / needs targeted verification

- **Cooperative duplicates:** Code sends a matching Door to Limbo if its active player already owns that color; the published cooperative win condition requires one of each color for each player. Confirm whether the rules intend this as mandatory or allow holding duplicates with another remedy. Current choice should be labeled as an application adjudication pending verification.
- **Cooperative initial draft interaction:** Current draft selects alternately from eight face-up Locations, starting with the host. Official wording is 'each player takes one ... until each player has three'; exact pick order is not specified. If required, configure start-player draft order explicitly.
- **Cooperative expansion ownership:** Not implemented; ownership of shared Goals, Dreamcatchers, mirrors, and expansion Doors must be checked with publisher documentation or labeled house rules.
- **Partial-card effects:** Each expansion's handling of insufficient deck size and missing search targets needs a specific source-based decision, not a blanket fallback.
- **The Little Incubus** is documented separately from standard expansion combinations; keep official and custom combinations distinguishable.

## Status for each expansion

| Expansion | Status | Remaining verification |
|---|---|---|
| Book of Steps | Playable solo/co-op; Goal order, loss rollback and all three spells | Clarify spell interruption timing during nested searches |
| Glyphs | Playable solo/co-op; 8 Glyphs and 4 Doors | Cross-expansion pairing/adjudications during Phase 7 |
| Dreamcatchers | Playable solo/co-op; 4 Lost Dreams, 4 catchers, Failsafes, overload | Search/free timing and edge cases with future expansions |
| Towers | Playable solo/co-op; edge placement, deck peek, Nightmare loss | **Printed left/right symbols on each of the 12 physical cards need edition-level image audit**; current card metadata should be treated as provisional |
| Premonitions | Implemented/tested: four Happy Dreams, eight trigger/penalty types, 4/5/6 face-up, choice ordering | Publisher timing audit with additional expansion effects |
| Crossroads and Dead Ends | Implemented/tested: six wild Locations, ten Dead Ends, Escape, hard middle-only rule | Overlapping wildcard sequence edge-cases |
| Door to the Oniverse | Implemented/tested: wildcard Door, 8/16 randomly selected Denizens, rally, eight abilities, Treasure Keeper | Timing of Denizens versus spells, rare cooperative ownership |
| Mirrors / Sphinx / Incubus | Implemented with tested core effects and visible decisions | Rare simultaneous-trigger interactions, card scarcity and official cooperative rulings remain under Phase 7 audit |

## Phase 4 rulings and scope

- Book of Steps: if a won Door is lost, flip **its** Goal back to incomplete and treat the earliest incomplete Goal as required next. Extra Glyph Door Goals increase the ordered row from 8 to 12. Costs are 5/7/10 or hard 6/9/12, removed cards remain in the conservation registry.
- Dreamcatchers: one entire Limbo group is assigned to an empty catcher. Overload removes **one selected catcher**, shuffling its held cards with the current Limbo; other occupied catchers stay occupied. Failsafe freeing is allowed at the beginning of a turn. Deck-search shuffles may free a selected occupied catcher.
- Towers: the single Alignment is shared in two-player mode, per the printed expansion's cooperative clarification. Normal difficulty protects completed four-color Alignment; hard mode removes this protection. Tower side-symbol metadata requires verification against all 12 printed cards.
- Cooperative Glyphs extra Door ownership (team total 12 including one of each color per player) and cooperative Book shared Goal sequencing are implementation adjudications pending final publisher verification. They must not be mistaken for sourced publisher rulings.
- Phase 4 is **playable**, but this document is deliberately not a claim that all publisher card art, rare multi-expansion timings, or all six combinations are officially verified. Phase 7 resolves those remaining audits.
- Guest-only product: never implement account signup, signin or profile identity.

## Phase 5 rules and adjudications

- Oniverse Door: is a distinct wildcard Door and does not replace one of the eight/twelve normal Doors. Book of Steps gains one additional wildcard Goal. Unselected Denizens are hidden in a removed-from-play physical zone. Each rallied Denizen belongs to its acquiring player in this implementation.
- Premonitions: checked on successful Door acquisition, with immediate victory priority. If multiple conditions are met, active player chooses resolution order, and eligibility is recalculated after each effect. The one-of-a-color co-op win condition is preserved; Premonitions currently evaluate the team Door display collectively, pending publisher adjudication.
- Crossroads: at most one wildcard per Door trio; hard mode permits it only in the middle. Dead Ends cannot be individually discarded; the player can use Escape to discard and replace the whole hand (personal plus shared). Nightmare reveal sends Dead Ends to Limbo.
- Treasure Keeper: stored cards are in a separate physical zone; using them removes the associated rallied Keeper from play. In two-player mode, the stored card belongs to the player's Keeper, not the shared resources.
- Card searches with fewer cards than requested use the available cards, without inventing replacements. This is an application ruling until the combination-by-combination audit is complete.
- **Potential mismatch with official rules:** The base app currently treats a Nightmare in the Tower expansion using its existing two-way Tower penalty; exact timing and all 12 printed edge symbols are still marked unverified from Phase 4. Do not claim fully verified Onirim fidelity until Phase 7.

## Official sources

- Base (English): https://images.zmangames.com/filer_public/fd/0e/fd0ef6a2-c019-47a2-910a-a556f03a3d02/zm4900_onirim_rules.pdf
- Expansion book: https://images.zmangames.com/filer_public/7f/c7/7fc752e5-1a46-408f-b9cc-db5196be46ee/en-onirim-rules_ext-1.pdf
- Secondary base HTML: https://www.rulespal.com/onirim/rulebook

## Rule-adjudication acceptance criteria

For every unclear case, log: an ID, precise scenario, applicable expansion combination(s), verbatim section/page reference or publisher clarification, the chosen implementation behavior, whether it is **official** or **house rule**, and at least one deterministic test ID. Keep rule changes versioned so historical saved games can be replayed accurately.

## Phase 6 audit

- **Mirrors:** nine conceptual double-sided Mirror slots live outside the draw deck. Glyph is conditional on Glyphs; Rainbow is an opt-in hard variant. Four stacked cards return to discard after exploration; Red, Blue, Green, Brown, Key, and Glyph rewards use deck/discard searches. Tested pair validity, three extra win goals, selection, and card conservation.
- **Promo dreams:** Sphinx names one color or Moon/Key/Glyph but not Sun, inspects bottom five, and forces redraw upon failure. Diver reveals from deck bottom, may stop or continue, and becomes a Nightmare on a drawn Nightmare. Confusion returns the hand to the deck bottom then special-refills. 4 copies each plus two ordinary Nightmares.
- **Incubus:** official mode prevents combining with expansions. Easy one-off cancel, Apprentice/True charge using one/two Locations before paying a virtual Nightmare consequence. The pawn and Mirror slots are non-deck objects; stored Incubus Locations are tracked as physical cards.
- **Known adjudications:** card scarcity during Mirror rewards and wild Crossroads under Rainbow need edition-specific rulings; multiplayer shared Mirrors and compound Premonition effects need resolution order verification. Phase 6's successful tests do not establish publisher approval.
- **Source for promo:** https://funmill.ru/images/rules/02768-2.pdf . Incubus source: official Expansion Book appendix.
