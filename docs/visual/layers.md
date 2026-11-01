# Layer rule (bug 23)

One fixed draw order, read off Room1 (`docs/visual/tile-rules.md`). Every visual change is held to it. A thing belongs to exactly one band.

## Bands, bottom to top
| # | Band | What | Sort |
|---|---|---|---|
| 1 | Sea | Sea repeat, glints. Runs past the map edge: the world has no edge line, and no sky shows | none |
| 2 | Ground | Grass, cliffs, foam, beaches, pond water, roads, soil, ground flowers | none |
| 3 | Sea life | Islets, boats, ducks: on water only | none |
| 4 | Under bridge | Shadow, then posts, on the cells south of a horizontal bridge | none |
| 5 | Deck | Bridge planks | none |
| 6 | Farm | Bed soil and crops | none |
| 7 | Standing | People, pets, trees, houses, fences, rails, props, signs | by foot z |
| 8 | Top | High cloud shadows, high clouds, then name tags, bubbles and UI | none |

## Rules
- Water, cliffs and coast are always drawn as if nothing stood on them. A bridge or pier lies on top. Never change a cliff, a foam line or land to fit a bridge.
- All clouds are band 8. Nothing cloud-like goes under land.
- Standing things sort by the y of the foot on the ground, and the sprite's foot is its own: a tree's trunk, a fence post's base.
- A wide shape with a stepped south edge has several feet. A house is cut into columns by its lowest opaque pixel, and each run of columns sorts on its own foot (`footRuns` in sunny.ts).
- A long east-west fence is one standing item. A north-south fence is one item per tile, because people pass along it.
- Everything standing sits on the tile grid: x and z on tile centres or whole tile edges. Only people, pets and critters move freely.
- Indoors the house and the player are on the interior's layer, and the world is drawn around them (`drawAround`).
- A new band needs a line here first.
