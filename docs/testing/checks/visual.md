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
- [x] Every generated art file is top-down, front side only, never at an angle. [audit](../proof/visual/gen-art-audit.md)
