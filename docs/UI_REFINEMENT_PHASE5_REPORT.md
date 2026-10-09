# UI/UX Refinement Phase 5 — Card interactions and inspection

## Changes
- Prophecy, Confusion, Sphinx/Diver, Incantation, Happy Dream, Tower, Denizen and spell reordering now uses **gaps** between cards. A narrow insertion rule shows the actual position; dropping after the last card is supported. The up/down buttons are removed.
- Touch and mouse alternatives: select a revealed card, then select the card it should precede; after selecting a card, a slim terminal slot moves it to the end. Keyboard: Enter/Space to select and destination, Alt+Left / Alt+Right to move one position, Escape to cancel. All ordering changes remain local until the existing Confirm action submits them to the unchanged engine.
- Right-click, 500 ms touch hold, or keyboard I / Shift+F10 on a visible card displays a small viewport-constrained card help popover. Escape, X, or clicking outside closes it. The summaries cover ordinary cards and all expansion card types. Hidden cards reveal no private identity or deck order.
- Card inspection also works inside mandatory decision dialogs. Cancelled drags or inspections never issue game actions. Existing selection/play/discard validation remains unchanged.
- Focus restoration for reordered decision cards is retained after the dialog rerenders.

## Validation
- Release gate: `npm run release:gate` (190 Node tests and Pages build).
- Browser interaction script: `python scripts/visual-refinement-phase5.py` (Chromium 390x844, 844x390, 1440x900), checking insertion-line dragging, tap-to-reorder, end insertion, right-click and long-press, including prevention of accidental selection after holding.
- Unit coverage: `tests/ui-refinement-phase5.test.js`, including immutable gap-index movements and private-card metadata.
- Limits: real-device touch behavior, live Firebase multiplayer and the remaining full expansion-state interaction matrix were not exercised; these need validation in future phases. Detailed decision-window positioning is Phase 6.
