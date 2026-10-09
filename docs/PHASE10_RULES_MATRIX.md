# Phase 10: rules, actions, timing, and verification matrix

This is an **implementation audit and regression index**, not a claim of publisher certification. Source rules are paraphrased. See `RULES_AUDIT.md` for edition/source links and source limitations.

## Core lifecycle (solo and cooperative)

| Event | Required behavior | Implementation/testing focus |
|---|---|---|
| Setup | Separate Location opening hand from Dream/Door cards, replace non-Locations, reshuffle them before play; two-player face-up draft gives 3 private each plus 2 shared | Setup simulations, unique-card invariant |
| Turn action | Exactly one normal action: play, discard, Tower, Escape, Mirror pair, etc.; optional activation of eligible abilities/spells only in permitted windows | Server validates action; UI exposes action choice |
| Color run | Adjacent symbols differ; 3 successive equal-color Locations generate a Door search; 4th begins new run; Crossroads wildcard restrictions | Goal/door and wildcard tests |
| Door acquired | Validate *physical* Door, required Goal, owner and victory immediately; if multiple Doors awarded, process sequentially and interrupt for Premonitions | Mirror/Premonition regression |
| Refill | Draw until required Location resources restored; normal Door permits eligible Key or Limbo; Dream resolves; Nightmare pauses with penalty | 23 decision views and engine effects |
| Redraw | Nightmare/Escape/Confusion use special replacement procedure; Dreams/Doors skipped into Limbo and not independently activated | Redraw/special card tests |
| Limbo | End-of-turn shuffle or assign to Dreamcatcher, including overload choice; preserve unclaimed Door and Dream identities | Conservation + Dreamcatcher tests |
| End game | Check mandatory objectives and deck-loss under each active module; no automatic discard reshuffle | Seeded complete games |
| Multiplayer | Server owns state; current player only chooses, two private hands masked, two shared face-up; personal Labyrinths and Door sets | Hidden-data tests; room authorization |
| Persistence | Interrupted effect and queued Door grants, exposed choices, card identities and RNG order survive restart | Snapshot/migration tests |

## Active expansions and difficulty branches

| Module | Setup/cards | Solo actions and variants | Cooperative ownership / verification |
|---|---|---|---|
| Book of Steps | Ordered Goals; costs from discard | Next Goal, rollback after Door loss, spell bottom five, Goal swap, Nightmare cancellation; normal and hard costs | One shared Goal row is an **application adjudication** |
| Glyphs | 8 Glyph Locations, +4 Doors | Fourth symbol, Incantation five-card reveal and one Door; 12-Door objective | Extra four Doors are a team objective: **application adjudication** |
| Dreamcatchers | 4 Lost Dreams, 4 catcher zones, 2 Failsafes | Free, store Limbo, overload selection, catcher search, no-Failsafe hard variant | Catchers shared: **application adjudication** |
| Towers | 12 Tower cards, separate Alignment | Play left/right, 3/4/5 deck peek on discard, legal Tower loss or false destruction after Nightmare, protected/unprotected complete Alignment | Shared Alignment supported by expansion wording; **physical 12-card edge markings provisional** |
| Premonitions | 4 Happy Dreams and 8 separate Premonitions | 4/5/6 starting visible, timed triggers, choose trigger order, cancel/reveal/search choices | Team-wide triggers: **application adjudication** |
| Crossroads/Dead Ends | 6 wild-color Crossroads, 10 Dead Ends | Escape; max 1 Crossroad per Door trio, hard mode only center | Shared Escape resources; multi-expansion wildcard interpretation open |
| Door to Oniverse | One additional Door, random 8 of 16 Denizens | Rally costs and 8 abilities, including stored protected card, Nightmare cancellation, deck reveal/search | Denizens assigned to acquiring player: **application adjudication** |
| Mirrors promo | Up to 9 external Mirror objectives | Choose exactly two Locations per action, Mirror rewards; hard Rainbow victory; conditional Glyph Mirror | Shared board: **application adjudication** |
| Sphinx/Diver/Confusion promo | Four of each +2 Nightmares | Bottom reveal, selected aspect, keep/reorder/continue, reshuffle-hand variants | Resolved by active player; scarce-card outcome pending publisher clarification |
| Little Incubus | Separate pawn, no expansion | Easy, Apprentice, True; store 0/1/2 Locations and penalty timing | Non-combinable official setup: enforced |

## UI decision coverage

`public/app.js:decision()` is the single rendering gateway for all server-provided mandatory choices. **All choices are server-validated.**

| Decision ID | Required player controls |
|---|---|
| `door` | Choose eligible Key or Limbo |
| `doorSearch` | Choose available Door from deck/catcher or skip; optionally free a *different* catcher |
| `nightmare` | Choose a Key, collected Door, reveal 5, or full-hand redraw; eligible Denizen/Incubus cancel |
| `prophecy` | Discard exactly one of up to five and reorder the rest |
| `incantation` | Select one eligible Door, if any; arrange remaining cards on bottom |
| `towerLook` | Reorder all inspected top cards |
| `towerPenalty` | Choose removable Tower (legal neighbors) or false destruction |
| `catchChoose` | Assign current Limbo pile to an available catcher |
| `catchOverload` | Select the catcher to sacrifice |
| `spellPeek` | Choose one bottom-card to move to top, order the rest |
| `moduleDecision` | Choose one queued registered module option |
| `happyDream` | Remove Premonition, inspect seven, or fetch card |
| `happyPeek` | Choose cards to discard, reorder survivors |
| `happyFetch` | Select card from deck; optional catcher freeing |
| `rally` | Choose eligible rally cost or discard Denizen |
| `premonitionPick` | Select next triggered Premonition |
| `premonitionDoor` | Select Door to sacrifice |
| `denizenPeek` | Reorder inspected cards |
| `sphinxName` | Select permitted color/Moon/Key/conditional Glyph, not Sun |
| `sphinxResolve` | Choose top card when matched, arrange remaining bottom |
| `diver` | Stop and reorder, continue, or forced Nightmare |
| `confusion` | Reorder whole hand onto bottom then special redraw |
| `mirrorReward` | Select actual cards for card-specific reward, conditional Door color and catcher freeing |

**Phase 1 non-dialog controls:** play/discard Location, play/discard Tower, choose left/right, Escape, activate Incubus, select color for a Crossroad through engine legality, pay spell cards and reorder Goals, play Mirror pair with explicit two-card chooser, Cyclobot trade selector, cooperative optional discard swap selector, Denizen activation and Dreamcatcher Failsafe. **No browser `prompt()` should be required for gameplay.**

## Cross-expansion triggers and precedence

1. A Door from a Key, Labyrinth trio, Glyph Incantation, Denizen or Mirror runs through common acquisition validation. The Book of Steps rejects non-next Goals, using real physical Door identities.
2. Each Door in a multi-Door reward is resolved **one at a time**. Dark Premonitions may interrupt the sequence; the pending remaining Doors must remain in a conserved zone and resume after the decision.
3. A Nightmare is resolved before its Tower penalty; the player may use False Destruction, transferring the resolved Nightmare to Limbo. Tower loss must reconnect legal edges, including two symbols printed on one side.
4. A Dreamcatcher search can claim a caught Door and free a **different** catcher; it must never free the same catcher holding the target Door during the same action.
5. Special full-hand redraws do not replay the normal Dream/Door resolution handlers.
6. Crossroads remain physical wild Locations; their temporary assignment cannot mutate their printed card metadata or bypass difficult placement rules.
7. Unselected Oniverse Denizens remain hidden in the removed zone, not publicly listed; opponent personal hands remain masked in cooperative snapshots.
8. A malformed action, stale turn, or player reconnect must not duplicate cards or apply an effect more than once.
9. The official Little Incubus does not combine with expansion modes; reject invalid configuration even when forged directly against API.
10. When an inspected set is smaller than expected or a searched type is absent, the current deterministic behavior is **provisional** unless explicitly supported by the card/rule text.

## Remaining authoritative/real-device gates (not claimed complete)

| ID | Missing authoritative evidence / validation | Next step |
|---|---|---|
| TOW-PRINT-12 | Exact left/right Sun/Moon marks **for each of 12 physical Towers**, including any side with both symbols; code currently uses provisional metadata | Supply high-resolution photographs of all 12 Tower faces or verifiable publisher card inventory; transcribe/test all |
| COOP-OWN | Publisher-endorsed ownership and victory for all additional expansion objectives in two-player mode | Gather explicit publisher clarifications; label current shared-zone rulings as *app-specific* until proven |
| RAINBOW-WILD | Whether wild Crossroads satisfy Rainbow Mirror as distinct colors | Publisher ruling or explicitly labeled house interpretation |
| SCARCITY | Exhausted/short deck cases during bottom/top inspection, repeated searching and nested decisions | Source-verified case-by-case rulings; regression fixtures per missing target |
| PROMO-EDGE | Diver stopped with zero remaining deck and interactions with special redraw and Nightmare/Tower | Source-verified deterministic tests |
| UI-DEVICE | Touch, keyboard, screenreader, two physical browsers, reconnect and server restart | Phase 11 acceptance checklist + manual test run |

## Release policy

- Automated seeded runs test engine safety and reachability; **they are not proofs of exact publisher rules**.
- Official-vs-app-adjudicated rule claims must remain differentiated in UI and documentation.
- Changes to previously persisted game decisions require a documented version migration and fresh card-conservation assertions.
- Do not remove any remaining open rulings from the audit solely because tests are green.
