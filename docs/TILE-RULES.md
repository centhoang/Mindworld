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
| Fill | 3.1, about 7% 2.1-2.6 | 7.12, 7.20, 7.21, 8.20, 8.21 |

- The light road family is the grass table moved down 4 rows (3.k becomes 7.k, 4.k becomes 8.k). Not used yet.
- Roads are 3 tiles wide and stay on land.
- Outlines are octagonal: every outer corner is a 45 degree cut. Right-angle concave corners are fine.

## Cliffs, foam, sea shadow
Only south edges have a face, worked out per column. Cells below the land, from the top:
- S edge: cliff, cliff, foam 2.20. Cliff alternates 3.11 and 4.11 by (i + j) parity.
- SW corner: 4.10, 2.19m, 6.19m.
- SE corner: 4.10m, 2.19, 6.19.
- A corner standing alone gets a foam lip in the next column, top to bottom. West: 6.19mF, 2.20, 6.19m. East: 6.19F, 2.20F, 6.19.
- Sea shadow 1.12 covers the foam row and one row below, drawn under bridge decks. The room also has end pieces (1.13, 1.14) that we do not use yet.
- Foam animates: tileset animation pairs such as 147/150 and 148/151, about 2 flips per second (`anims` in sunny.json).

## Water
- Sea: a 4 x 4 repeat of rows 18-21, cols 11-14. The tiles do not animate; life comes from foam and glint sprites.
- Pond and river: fill 7.22. The bank is drawn on the land cells around the water, not on water cells. Names are by where the land ends: N 8.26, S 7.25, W 8.24, E 7.27, NW 8.22, NE 7.26, SW 7.24, SE 7.23, inner SE 7.29, inner SW 8.25, inner NW 8.28. Inner NE 8.29 is a guess, not read from the room.

## Bridges
The ends lie one tile up on the land.
- Vertical, 3 wide: deck 12.39 / 12.40 / 12.41; top cap 11.39-41; bottom cap 11.41mF / 11.40mF / 11.39mF. Rails on the two outer columns: 1.40 top, 3.40 middle, 4.40 bottom.
- Horizontal, 3 tall: rows 11 / 12 / 13, deck col 40 (alternate m), ends col 39 and 39m. Top rail 2.39 with ends 2.42m and 2.42; bottom rail 0.39 with ends 0.38 and 0.38m. Posts under it (5.37) are not drawn yet.

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

## Interiors
Rim 9.8 / 9.4 / 9.8m, side walls 9.6 / 9.6m, plank floor 9.1, front wall 10.6 / 10.5 / 10.6m, outer wall 10.8, door 11.12. The room in Room1 is cut off by the map edge, so it is composed in art-sunny.py rather than stamped.

## Rules for changes
- Use pack pixels. Make new art only for real gaps, and only by the rules in docs/STYLE.md.
- Do not recolour tiles with palette swaps: they gave broken checker grass. Seasonal looks need real art.
- After a visual change, compare a daytime shot with BuiltDemo (`__px.world.alwaysDay = true`).
