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
| Premonitions / Crossroads / Oniverse | Unavailable — Phase 5 | Full effect implementation |
| Mirrors / Sphinx / Incubus | Unavailable — Phase 6 | Full effect implementation |

## Phase 4 rulings and scope

- Book of Steps: if a won Door is lost, flip **its** Goal back to incomplete and treat the earliest incomplete Goal as required next. Extra Glyph Door Goals increase the ordered row from 8 to 12. Costs are 5/7/10 or hard 6/9/12, removed cards remain in the conservation registry.
- Dreamcatchers: one entire Limbo group is assigned to an empty catcher. Overload removes **one selected catcher**, shuffling its held cards with the current Limbo; other occupied catchers stay occupied. Failsafe freeing is allowed at the beginning of a turn. Deck-search shuffles may free a selected occupied catcher.
- Towers: the single Alignment is shared in two-player mode, per the printed expansion's cooperative clarification. Normal difficulty protects completed four-color Alignment; hard mode removes this protection. Tower side-symbol metadata requires verification against all 12 printed cards.
- Cooperative Glyphs extra Door ownership (team total 12 including one of each color per player) and cooperative Book shared Goal sequencing are implementation adjudications pending final publisher verification. They must not be mistaken for sourced publisher rulings.
- Phase 4 is **playable**, but this document is deliberately not a claim that all publisher card art, rare multi-expansion timings, or all six combinations are officially verified. Phase 7 resolves those remaining audits.
- Guest-only product: never implement account signup, signin or profile identity.

## Official sources

- Base (English): https://images.zmangames.com/filer_public/fd/0e/fd0ef6a2-c019-47a2-910a-a556f03a3d02/zm4900_onirim_rules.pdf
- Expansion book: https://images.zmangames.com/filer_public/7f/c7/7fc752e5-1a46-408f-b9cc-db5196be46ee/en-onirim-rules_ext-1.pdf
- Secondary base HTML: https://www.rulespal.com/onirim/rulebook

## Rule-adjudication acceptance criteria

For every unclear case, log: an ID, precise scenario, applicable expansion combination(s), verbatim section/page reference or publisher clarification, the chosen implementation behavior, whether it is **official** or **house rule**, and at least one deterministic test ID. Keep rule changes versioned so historical saved games can be replayed accurately.
