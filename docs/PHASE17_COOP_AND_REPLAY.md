# Phase 17 — cooperative board, Doors, and replay

- Standard-color Doors require a matching ordinary Key. Official exceptions: wild Crossroad Key, wild Door to the Oniverse, and spending a rallied Chromatic Chaos Denizen. In particular, a Crossroad Key never requires Chromatic Chaos to be spent.
- Both players' collected Doors share one divided row. Each player's Labyrinth runs directly above that player's Denizens; the two private hands appear at the bottom on either side of the shared cards. The partner's private hand remains face down.
- Rallied Denizens and Treasure Keeper cards are projected into the owning player's area. Cards use their printed names, with tap-to-inspect details; no decorative tile surrounding each Denizen.
- Winning shows **You escaped the dream!** in the bottom action dock, with **Exit** and **Play again**. Replay preserves the current configuration and named players. In co-op online, either room member may restart only a completed game, and both receive the new game via the synchronized room state. The Firestore security rules must be published separately.
- Card reveal and flight animations are longer, newly revealed targets are concealed until their movement completes, and reduced-motion preferences still skip animations.
- Automated tests cover the engine exceptions, privacy, DOM ordering, named Denizens, and synchronized room replay. Real-device visual/interaction checks and live Firebase tests remain required.
