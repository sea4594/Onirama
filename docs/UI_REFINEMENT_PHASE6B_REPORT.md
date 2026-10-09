# Phase 6 action-workspace refinement

This hotfix follows Phase 6. It leaves the action-workspace footprint fixed (126/132px portrait, 194/234px landscape, with the existing short-viewport adjustment) and preserves game rules except for removing the strategically redundant choice of *which empty* Dreamcatcher receives Limbo. The first free catcher is used automatically; choosing which occupied catcher to free on overload remains mandatory.

- Replaced verbose workspace sentences with compact state labels and centered controls. Nightmares present four persistent penalties, with unavailable Key/Door choices disabled; subsequent Key/Door selection happens on the existing tabletop.
- Reused visible cards for Door payment, Denizen rally, premonition Door sacrifice, Tower penalties, Mirror pairs, and cooperative swap choices. Book-of-Steps parallel-spell goals are selected on their actual tiles.
- Prophecy has a distinct discard slot. Drag any revealed card into it (or select then tap the slot), then reorder the remaining cards. Dragging another into the slot replaces the prior discard.
- Paginated long deck-search, reward, spell-cost, and card-order choices. No workspace vertical scrollbar or variable-height panel is introduced.
- Replaced text-only pile inventory rows with card-face thumbnails plus current/original counts. Location card faces no longer print color/symbol names; accessible card descriptions remain.
- Prevented text selection and native touch callouts throughout gameplay.

Verification: the complete release gate; 64 existing responsive-fixture checks; 132 additional decision/viewport containment checks (22 effect states × 6 viewports); and Chromium mouse drag plus tap-to-discard interactions. Live Firebase and physical-device touch tests were not available.
