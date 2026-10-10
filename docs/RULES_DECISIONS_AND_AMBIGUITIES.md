# Rules decisions and remaining ambiguities — rules-audit2

This is the **current** rules-decision register for Onirama. It supersedes conflicting entries in earlier phase and audit documents. A choice recorded below as *unresolved* is not a publisher-verified rule, even when the game has a deterministic implementation. Do not change an unresolved policy without a new owner decision or stronger primary-source evidence.

## Confirmed project-owner rulings

1. **Cooperative duplicate Doors (accepted):** Keep the existing base-game cooperative duplicate Door policy. Without Glyphs, a second Door of the same color acquired by one player is sent to Limbo. Each player must get one Door of each base color to win.
2. **Cooperative + Glyphs + Book (accepted):** Each player must personally acquire at least one Door of **each of the four colors** to win, even when Glyphs and/or the Book of Steps is active. The team also needs all required extra Doors and shared Book Goals, when enabled.
3. **Base Doors and extra Glyph Doors (accepted):** Doors of a given base color are **identical in the game**, regardless of whether their physical copy was introduced by the base set or Glyphs. Never use source-set identity for acquisition priority, matching/trigger conditions, player choice, or UI labels. Newly generated extra Glyph Doors carry no source-set tag; old saved tagged copies still behave and render exactly like the base Doors.

## Confirmed fixes in rules-audit2

- Dreamcatcher overload releases the cards on **all** catchers, not only the sacrificed one.
- The four Locations used to explore a Mirror remain under that Mirror until its effect has resolved, even if the effect is a saved/reconnected decision or is interrupted by Dark Premonitions.
- In difficult Crossroads, a Crossroad can actually be **played only second** in a color run; engine commands, legal actions and both tabletop layouts reject the other positions.
- A Glyph Incantation with one or more revealed Doors requires the player to choose one.
- Door searches expose deck **and** Dreamcatcher sources simultaneously; successful direct catcher retrieval, deck search and search/Freeing before catcher retrieval remain distinct routes.
- A completed color run can generate an optional deck search even if no matching Door exists; searching without success can reshuffle/free a Dreamcatcher, whereas skipping does neither.
- Sphinx color declarations recognize a wild-colored Crossroad / Door to the Oniverse; symbol declarations remain symbol-specific.

## Open publisher / multi-expansion questions

| ID | Unresolved question | Current app policy, pending owner/publisher ruling |
|---|---|---|
| COOP-BOOK | Does the Book prescribe a distinct cooperative Goal ownership rule? | One **shared** ordered Goal row, with acquisition credited to the player who received each Door; personal four-color victory minimum remains mandatory. |
| COOP-SHARED | Do Dreamcatchers, Mirrors, Premonitions and Denizen effects have particular individual vs shared ownership rules in cooperative combination games? | Catchers/Mirrors/Premonitions are shared; rallied Denizens and Treasure Keeper assets belong to their acquiring player. |
| WILD-RAINBOW | Can a Crossroad count as a selected color for the hard Rainbow Mirror? | Rainbow Mirror currently requires four genuinely printed-colored Locations; wild Crossroads cannot substitute. |
| WILD-PREMONITION | Is a Crossroad removed by the `red2` Dark Premonition, given that it is all four colors? | Only printed-red Locations are removed; wild Crossroads remain. |
| WILD-HAMMER | When Hammer Bird removes a same-color Labyrinth suffix, should a Crossroad join that suffix (and with what chosen color)? | Comparison uses the printed/runtime color; wild Crossroads stop a suffix of standard colored Locations. |
| ONIVERSE-PREMONITION | Does the Oniverse Door count as red/blue/green/brown for color-specific Door-count conditions, identical pairs, or a four-color Rainbow condition? | It counts for *total* Door thresholds only, not individual colored thresholds. |
| SEARCH-CHOICE | When a searched deck has a matching Door, may a player deliberately decline it before using Freeing and claiming a Dreamcatcher-held Door? | An optional “search without taking” route is available, and search+Freeing+catcher claiming is implemented. |
| LOW-DECK | Must expansion search, inspection, and draw effects with fewer than N remaining targets complete partially, fizzle, or force a loss? | Current module-specific behavior is preserved; no cards are synthesized or recycled implicitly. |
| EFFECT-ORDER | Which of Mirror rewards, Book spells, triggered Premonitions, Denizen abilities, Freeing, and immediate victory takes precedence when multiple triggers overlap? | Engine resolves one serialized decision at a time, queued Mirror Doors sequentially, with Premonitions after each acquisition and immediate victory checks. Not certified for every possible interaction. |
| INCUBUS-COOP | Is cooperative play with optional Little Incubus effects publisher-supported, including its short-deck / anticipation timing? | Current separate appendix mode is preserved; cannot combine Little Incubus with other expansions. |
| PROMO-MIX | Do Sphinx/Diver/Confusion special draws have unique wildcard/short-deck rulings in other expansion combinations? | Effective wildcard color for Sphinx; otherwise current special-card and deck-shortage order remains as implemented. |

## References and acceptance criteria

- [Publisher base rules](https://images-cdn.zmangames.com/us-east-1/filer_public/fd/0e/fd0ef6a2-c019-47a2-910a-a556f03a3d02/zm4900_onirim_rules.pdf)
- [Publisher expansion book](https://images.zmangames.com/filer_public/7f/c7/7fc752e5-1a46-408f-b9cc-db5196be46ee/en-onirim-rules_ext-1.pdf)
- [Promotional module transcription](https://www.ultraboardgames.com/onirim/expansion.php)
- Existing background: `docs/PHASE10_RULES_MATRIX.md`, `docs/RULES_AUDIT.md`, and previous external October 9 rules audit.

Regressions are in `tests/rules-audit2.test.js`, plus the adjusted difficult-Crossroads test in `tests/phase5.test.js`. Run `npm run release:gate`. Passing automated tests verifies the covered behaviors, **not** publisher rulings for unresolved expansion combinations. Live Firebase sessions and physical device checks remain manual.
