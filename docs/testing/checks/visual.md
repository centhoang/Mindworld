# Visual checks

Run on `/`, Sunnyside (decided). `/lab/visual` is still the mosaic. Live proof: [sunny-live.md](../proof/game/sunny-live.md).

- [ ] The first screen feels small, cozy and cute, and you know where to look. (user judges: [first screen](../proof/visual/sunny-first.jpg))
- [x] Everyone stands on the grid, and nothing looks cut off. [live](../proof/visual/sunny-chatbox.jpg)
- [x] People pass in front of and behind things correctly. [behind](../proof/visual/sunny-behind-tree.jpg) [front](../proof/visual/sunny-front-of-tree.jpg)
- [x] You can tell each villager from the others at a glance. [live](../proof/visual/sunny-chatbox.jpg)
- [x] Your pet looks like yours: genes show. [proof](../proof/pet/teach-unchanged.png)
- [x] The farm reads as plots, with 4 clear stages. [live](../proof/visual/sunny-farm-stages.jpg)
- [x] Bubbles and names are readable at normal zoom. [live](../proof/visual/sunny-bubble-over-goals.jpg) A bubble can cover the Goals panel: bug 34.
- [x] Entering the house feels smooth. [proof](../proof/game/sunny-live.md) [inside](../proof/visual/sunny-inside.jpg)
- [x] Day and night look different, and stay readable. [night](../proof/visual/sunny-night-square.jpg) [evening](../proof/visual/sunny-evening.jpg)
- [x] Pixels stay even at any window size. [proof](../proof/game/sunny-live.md)
- [x] Mosaic only, not on Sunnyside: the whole screen is one grid of cells at rest: nothing is drawn above or below it, in every screen. [proof](../proof/visual/walk-slide.md) [live](../proof/visual/5c-live.jpg)
- [x] Mosaic only, Sunnyside has no Grid chip: the Grid button turns the faint cell lines on and off, and it is remembered. Outlines stay. [proof](../proof/visual/outlines-grid-off.jpg)
- [x] Mosaic only: every thing has an outline (path, tree, person, pet, clock, map), and from the outlines you can tell which is in front. [proof](../proof/visual/outlines-lab.jpg)
- [x] Walking scrolls the view smoothly, with no cell-sized jumps, and your character glides. Other movers still step by cell. [proof](../proof/game/walk-steady.md) [first hold](../proof/game/sunny-live.md)
- [x] Every roof is whole pack roof: no smoke, rocks or branches cut in, no patched shingle blocks, no shadow blotches; the lower roof is even rows of the pack's blue shingle (bug 38). [live](../proof/visual/roof-38-live.png) [all houses](../proof/visual/roof-38-art.png)
- [x] A fishing rod shows only in a fisher's hands, never lying on the pier (bug 39). [live](../proof/visual/pond-39-40-live.png)
- [x] Paths join cleanly: every road is 3+ tiles across with square ends, stays off the coast's edge tiles, and the pond lane meets the pier's whole foot (bug 40). [live](../proof/visual/pond-39-40-live.png) Unit test: `village-look.test.ts`.
- [x] Nobody walks on the pond or the sea: only the pier and land are ground. Unit test: `village-walk.test.ts`, which also proves every bed can be reached and faced.
- [x] Only the pack's Sunnyside people are drawn, for you, other players and villagers, in every pose, activity and direction, even while art loads or after a failed load (bug 44). Unit test: `humans.test.ts`. [live day](../proof/visual/old-sprite-44.md)
- [x] No land a tile wide, so no loose cliff piece on the coast. Unit test: `village-look.test.ts`.
- [x] A farm is the pack's field: light dirt with an edge all round, one tilled mound per bed, each crop growing out of its mound at every stage; the field stays inside its plot and off the road's edge (bug 41). [live](../proof/visual/farm-41-live.png)
- [x] Every generated art file is top-down, front side only, never at an angle. [audit](../proof/visual/gen-art-audit.md)
- [ ] Every player has the same small house (only the roof colour differs), on every plot, whoever holds it; going in lifts
  the roof in place and shows a small room (bed, shelf, table, stool, the crate by the door) you and your pet walk in (bug 46).
  Unit tests: `house.test.ts`, `village-map.test.ts`. Dev pane only so far.
- [x] [village](../proof/visual/p4-village-live.png) [north-west](../proof/visual/p4-clump-nw-live.png) [east](../proof/visual/p4-clump-east-live.png) Trees grow in clumps toward the coast, not one by one across the middle; stumps and berry bushes stand among them (P4).
- [x] [square](../proof/visual/p4-square-live.png) The square has the pack's statue, and it is not one bare slab of dirt (P4).
- [ ] Every plot has a tilled 2x3 field beside its house and a front fence of the pack's rails with a gate at the door. Dev pane only so far.
- [x] [proof](../proof/visual/campfire-53-54-live.png) The campfire's flames burn inside its stone ring (bug 54).
- [x] [proof](../proof/visual/house-55-inside-live.png) Inside the small house every piece of furniture is whole and the windows are on the walls, none on the floor (bug 55).
