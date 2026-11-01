# Tile rules (living document)

Covers every visual asset that is not a creature or an animated character: terrain, water, bridges, clouds, buildings, props, crops, furniture, interiors. Read this before touching world visuals, and update it when a rule is added, corrected or found wrong. Humans and pets are not covered here (docs/STYLE.md).

Target look: `VisualAssetPack/BuiltDemo` and the pack's `Sunnyside_World_ExampleScene.png`.

## Where things live
- Source of truth: the pack's GameMaker room `Sunnyside_World_Gamemaker/rooms/Room1/Room1.yy`, 86 x 48 tiles of 16 px. It holds the real layers, so read a rule off it instead of guessing.
- Layers, bottom to top: sea, clouds_02, land, paths, shadows, decoration_01, forest (32 px tiles), Assets_2, building, walls, decoration_02, decoration_03, Assets_1, cloud_shadow, clouds_01.
- Export: `python scripts/art-sunny.py` writes client/public/art/sunny (tiles.png, stamps, strips, sunny.json, interior.png). The pack stays gitignored; never hand-edit the output.
- Rules in code: `client/src/pixel/sunny-terrain.ts` (pure tile choice), `client/src/pixel/sunny.ts` (drawing).
- Decoding: tile id = row * 64 + col in the 16 px sheet. Room values: bit 28 mirror, bit 29 flip, bit 30 rotate, bit 31 empty. Mask the id with 0x7ffff. The `sea` layer is uncompressed (`TileSerialiseData`); the others are run-length encoded.
- Notation below: `r.c` = row.col, `m` = mirrored, `F` = flipped.

## Terrain
Decide each tile from the land shape alone, with 4 neighbours and then diagonals (`edgeOf`). No land strip may be 1 tile wide: edge tiles need a body behind them.

| Case | Grass | Dark road |
|---|---|---|
| NW / NE corner | 3.8 / 4.4 | 7.19 / 8.15 |
| SW / SE corner | 4.6 / 4.7 | 8.17 / 8.18 |
| N / S edge | 3.4 / 4.5 | 7.15 / 8.16 |
| W / E edge | 3.6 / 4.3 | 7.17 / 8.14 |
| Inner NW / NE | 3.2 / 3.3 | 7.13 / 7.14 |
| Inner SW / SE | 3.5 / 4.1 | 7.16 / 8.12 |
| Fill | 1.1 / 1.2 by (i + j) parity, about 7% 2.1-2.6 | 7.12, 7.20, 7.21, 8.20, 8.21 |

- Fill: nothing in the game scales; the pack's 3.1 is an 8 px checker, so one 16 px thing covered four squares. The user wants one square per tree or farm spot, so the fill is the same two greens, flat, one per tile.
- The light road family is the grass table moved down 4 rows (3.k becomes 7.k, 4.k becomes 8.k). Not used yet.
- Roads are 3 tiles wide and stay on land.
- Island outlines are straight edges with stepped corners, never slants or circles: coast, cliff and foam tiles only join on those. Grounds are stepped rectangles (world/ground.ts), other places squares with corner notches (`inBlock` in world/layout.ts). Roads run along one axis, then the other.
- Trees stay inland (`SHORE` in overworld.ts: 2 tiles from water, 3 to the south, so a canopy never hangs over a cliff) and grow in tight clumps, about 2 tiles apart. Try 8-9 clumps per player ground and 3-4 elsewhere (previously 5-6 / 2-3); larger compact patches use available clear grass before starting another clump. Clearance takes priority over the density target. Four seed residues in five draw the round `tree_01` strip; one draws a pine. The pack's `tree_02` strip is also a conifer, not a second round tree.
- Fence rows run on the grass row just north of a straight road of 6+ tiles: segments 3-6 tiles, gaps 2+, kept 2 tiles clear of junctions, gates and bridges (grounds-decor.ts).

## Cliffs, foam, sea shadow
Only south edges have a face, worked out per column. Cells below the land, from the top:
- S edge: cliff, cliff, foam 2.20. Cliff alternates 3.11 and 4.11 by (i + j) parity.
- SW corner: 4.10, 2.19m, 6.19m.
- SE corner: 4.10m, 2.19, 6.19.
- No foam lip beside a corner: the room's lip only joins its own coast shapes, and on ours it floated as a loose dash.
- No sea shadow under cliffs: 1.12 and its end pieces 1.13/1.14 only read right on the room's own coast; on ours they showed as hard blocks.
- Foam animates: tileset animation pairs such as 147/150 and 148/151, about 2 flips per second (`anims` in sunny.json).

## Terraces
One raised block per player ground where it fits (about 4 grounds in 5), chosen after roads and streams on plain grass (`raiseTerrace` in tiles.ts): 8-10 wide, 4-5 deep. The top's border is `T.ledge` (not walkable) with grass edge tiles on the road layer over grass fill; two rows of plain cliff below it (`m.high` marks the top). A 3-wide dirt ramp through the middle of the south side is the only way up. Never use the corner cliff tiles (4.10, 2.19) here: they carry sea and foam. The ramp counts as road, so it keeps two dry rows from water. Trees and decor keep off ledges.

## Water
- Sea: a 4 x 4 repeat of rows 18-21, cols 11-14. The tiles do not animate; life comes from foam and glint sprites.
- Pond and river are the sea: same 4 x 4 repeat, glints, grass edge tiles, cliff and animated foam. The inland drop is one row shorter than the coast's when 3+ rows of water lie below, and only the foam line shows on a narrower stream. The old bank family (7.22-8.29) gave flat water with cyan corners: do not use it.
- Player-ground streams are chosen after roads, by a separate RNG seeded from `ground.seed`: every ground tries, with at most one course. Channels are two tiles wide, take 6-10 axis steps with square stepped turns, and end in a 4 x 3 pool. All water stays outside a two-tile buffer around roads, bridges, gates, both yard ovals and the largest house stamp; reject courses that narrow land to one tile or disconnect a gate from the centre. Pools remain unwalkable, and existing trees/decor reject them.
- Closed-stream fallback: the existing tiles have no combined pond-bank/sea-coast mouth, and the renderer gives coast edges priority over banks. Leave two full land tiles between the channel and sea (also around the other banks), rather than draw a broken mouth. If the whole course cannot fit, carve nothing. Player grounds are 36 x 28 on a 40-tile grid: 26 x 20 had no fitting course, 34 x 26 fit one ground in five.

## Sea islets
Sand and green islets are whole pictures from the tileset (`isle-sand` 28.4, `isle-green` 28.0 in `FURNITURE`), placed with boats and ducks in `placeSeaLife`: 4-7 per map, 5 clear sea tiles around each. Decoration only: the tiles under them stay water, so nobody walks there. They cover the sea, never land or bridges. After art-sunny.py run art-interior.py, or interior.png reverts.

### Sand coast audit (2026-11-01)
Room1's `land` layer uses sand fill **1.5**, with accents **1.7-1.9**. Sea edges use the following pieces (GameMaker mirror/flip/rotate flags are essential):

| Piece | Native cell | Example room position (x,y), flags |
|---|---|---|
| Diagonal sand edge | 5.19 | (20,3), none |
| Pointed sand edge | 5.20 | (26,2), mirror + flip; (24,4), rotate |
| Outer foam/corner | 6.19 | (20,1), mirror + flip; (23,2), mirror + flip + rotate |
| Extra corner joins | 5.21, 6.21 | Seen on the large eastern sand area |

These are sloping/pointed coast pieces, not a complete straight N/E/W edge family for our orthogonal islands. Room1's sand sits below cliffs and uses diagonal outlines. Do not substitute its foam corners for straight shore edges or repaint grass edges yellow. Walkable 6-12 by 2-3 rectangular beaches are therefore **skipped**, pending a clean orthogonal sand/sea and sand/grass family; `T.sand` is unchanged.

## Bridges
The ends lie one tile up on the land.
- Vertical, 3 wide: deck 12.39 / 12.40 / 12.41; top cap 11.39-41; bottom cap 11.41mF / 11.40mF / 11.39mF. Rails on the two outer columns: 1.40 top, 3.40 middle, 4.40 bottom.
- Horizontal, 3 tall: rows 11 / 12 / 13, deck col 40 (alternate m), ends col 39 and 39m. Top rail 2.39 with ends 2.42m and 2.42; bottom rail 0.39 with ends 0.38 and 0.38m. Posts under it (5.37) are not drawn yet.

- Rails are solid and sort with people by feet (`drawRail`, `railBlocks`). Outer rows of a bridge 3+ wide keep only the 0.45 of the cell towards the deck, and the end posts on land block the same way, so routes use the middle lane.

## Clouds and sky
- White rows 18-19, grey underside rows 21-22 (+3), shadow rows 24-25 (+6), cols 1-7. Solid sky 18.1.
- Low clouds go over the sea and under the land. High clouds go over everything, with a soft shadow on the ground.
- Past the map edge the world ends in sky, hidden by a bank of cloud along the edge. Keep high clouds sparse so they never hide play.

## Buildings, props, crops, furniture
- Stamps are cut from room rects in `STAMPS` in art-sunny.py and keep only the largest connected blob, because rects catch neighbours. Add a name to `LOOSE` when the stamp has several pieces on purpose.
- Tile rects are easy to misread on a labelled sheet: column = first + (x - 24) / cell width. Check the output on a review sheet.
- Anchor: bottom centre at the foot (`stand`). Draw with people, sorted by foot z. Solid area comes from `footprint`: half width, depth about half the height plus 0.6.
- Crops: pack art has 6 stages; farm stages 0-3 map to 1, 2, 3, 5. Wheat comes from the GameMaker sprites. Tomato uses radish art.
- Furniture: rows 33-37 of the tileset, listed in `FURNITURE`. Big rug is at 35.40, table at 35.50.

### Ground dressing (2026-11-01)
- Small decor targets 60-79 pieces per player ground (previously 30-39), with roughly double the targets on shared grounds. Reuse bushes, berry bushes, rocks, stumps, jars and crate stacks. Grass tufts and flowers form compact groups of 3-6, using existing tiles **2.27** and **3.35** at native 16px. Plants are walk-through; every solid keeps a clear detour. Never place on water, roads, bridges, ledges, or within two tiles of a ground gate. Random dressing stays out of activity spots and the working yard.
- Windmills: a separate ground-seed RNG selects roughly half of player grounds, and the Elder's island always tries. The existing `spr_deco_windmill_withshadow_strip9` plays its nine native 112x112 frames about eight times per second. Only the support foot is solid; its surrounding 3x3 area must be clear grass away from roads. No random source is used for placement.
- Decorative fields: a separate ground-seed RNG selects roughly half of player grounds. Choose a 5-7 by 3-4 grass rectangle away from the house, real beds, gates, water, ledges, roads and activity spots. Dirt uses **the existing `T.path` family**; mature wheat/carrot art fills every tile in alternating rows and remains walk-through. Fence the north and south sides only, leave both ends open, and preserve an outer grass detour. Field fences are centred on their collision footprint, as are roadside fences.
- Fields and mill yards take priority over trees: clear their footprints and a two-tile canopy buffer before recording final tree collision tiles. Other props retain the scene's tree reservations. If a feature cannot fit safely, skip it without changing terrain. Planning itself does not mutate the map; the scene applies field dirt and rebuilds terrain once placement is complete.
- Verification sample: 40 player seeds, with real trees and beds reserved: 19 fields, 23 player windmills, 40 Elder windmills, about 75 small pieces and 38 trees per player ground. Safety-limited tree density is below the nominal target in crowded grounds. Flood-fill checks preserve every previously reachable walkable tile other than the new solid footprints.
- No new bitmap exports were made in this pass: `python` is unavailable in the sandbox shell, so the requested art-sunny.py / art-interior.py export part was stopped. All dressing uses already-exported native pack assets.

## Interiors
The house is BuiltDemo/Interior.gif at 1x: `python scripts/art-interior.py` (after art-sunny.py) writes interior.png and interior-roof.png, the people removed. The roof fades out over 0.7 s on entry. Where feet can go is game/house.ts, in pixels of that picture: change it together with the art. The road carries on past the picture (`extendBand`).

## Chimney smoke
The smoke's mouth is per house: `CHIMNEY` in overworld.ts, pixels from the stamp's top left. A house with no chimney on its stamp has no smoke.

## Rules for changes
- Use pack pixels. Make new art only for real gaps, and only by the rules in docs/STYLE.md.
- Do not recolour tiles with palette swaps: they gave broken checker grass. Seasonal looks need real art.
- After a visual change, compare a daytime shot with BuiltDemo (`__px.world.alwaysDay = true`).
- One art pixel is always a whole number of screen pixels (`lowSize` in main.ts). Never scale the picture by a fraction.
