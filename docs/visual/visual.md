# Visual scope

**Goal:** small, compact, cozy, cute, focused. Draw only what `../game/design.md` needs, so effort goes to game quality.

## Must be drawn
- Ground, path, water, bridge. A house (outside, inside), farm plot with 4 growth stages.
- Player, 4 villagers, pet (from genes), wild pet.
- Market stall, dance floor, fishing spot, board.
- Bubbles, thought bubble, name tags, inspector, chat box, minimap, day and night tint.

## Not needed
Windmills, cliffs detail, beaches, sea life, clouds, terraces, streams. Each is a cost in rules and bugs.
**Changed for P4 (2026-11-04, the user asked for map polish from BuiltDemo):** fences and more decor are in. Each plot has
the same small house (roof colour by slot: blue, red, green, orange, purple), a 2x3 tilled field and a front fence of the
pack's rail tiles (tileset row 2: col 38 west end, 39 middle, 42 east end) with a 3-tile gate at the door, whether anyone
holds it or not. A run of one tile is left out (it would show a rail to nowhere).

## Look options
**Decided (user, 2026-11-03):** compact Sunnyside. It loads about 60 of the 141 art files and draws no clouds, sea life or farm animals. Compare: `../testing/proof/visual/looks-compare.jpg`. The mosaic stays in the code, set aside, at `?look=mosaic`; labs still use it.

**Angle (user, every asset, every Codex brief):** the pack is top-down, showing the front side only. Never iso or three-quarter. New art that breaks this goes back for rework.

**Humans:** only the pack's own strips. A dance is a routine of jump, roll and doing; soccer is the run after the real ball (standing, idle). Hauling walks with the carry strip; repairs use the hammering strip (the pack's file says "hamering"), the quarry mining, the campfire idle and waiting, feeding doing, a swim the swimming strip a tile out in the water with no shadow. Villagers sleep and eat at home, unseen.
**P2 places (2026-11-04):** the dance floor is 6x4 of the art/gen dance tiles on the square's centre, lit tiles blinking in a checker while anyone dances. The campfire is the pack's stone ring on the green, with three pack flames in the evening or while someone sits by it; it blocks its tile. The farm animals (chicken, sheep, pig, cow strips; no duck, which would bring back the sea life) amble in a 5x3 yard on the Elder's lawn, no fence. The quarry is three pack rocks north-east of the pond. Map rocks use the pack's `rock-big` stamp (there is no small one loaded). No string lights: the only lights art is the old props sheet. An activity with no matching strip is dropped. No other person art is ever drawn: while a strip loads or retries, the same look stands in its idle strip, else nothing (bug 44).
Battle screen (2026-11-03): each trainer stands beside its pet at 2x (half the pet's height), the player left facing right, the foe's trainer right facing left, drawn before the pets. Idle; a shout is the attack strip without the tools layer (no sword); a hard hit is hurt; the winner jumps. Wild pets have no trainer.
Battle bars: the pack's `greenbar`/`redbar` for HP (red at or under 40%) and `bluebar` for the signature charge, each stretched from its 15x7 art (caps + middle column, trough filled with the full bar's colour, `packBar` in `pixel/sunny.ts`). Crits and signatures pop three pack glints (2x) around the pet hit.

**Pets:** shading follows the shape, round on a round head. No marks too small to read at pet size.

Earlier: the mosaic, Tile skin (2026-11-02), spike `client/spike-compare.html`.

Earlier pick, replaced: A, glyph look, after judging the spike's image and clip. If 5c runs late: B, compact Sunnyside. Spike: `client/glyph-spike.html`, proof in `../testing/proof/visual/glyph-spike*`.

| | Option | Good | Bad |
|---|---|---|---|
| **A (spike first)** | **Low-res glyph art:** tile-grid map drawn with a small bitmap font and a small warm palette, chunky coloured glyphs on soft blocks, animated by swapping glyphs | Unique, memorable in a demo, one font replaces thousands of tile rules, no art pipeline, fits a small world | Needs real care to look cute, not like a terminal. Genes must map to glyph faces. Needs a look test before committing |
| B | Keep Sunnyside, cut to a compact village | Already works, looks polished at once | Generic pack look, rule upkeep stays, many review bugs came from it |
| C | Sunnyside world with glyph people | Medium work | Two styles can clash |

**Time check:** just under 3 days to submission (Nov 5, 9 AM in Vietnam). A half-day spike on one screen (a villager, a pet, a farm, a chat) decides it. If the spike isn't clearly better, take B.

## Rules that survive any look
- Draw order bands and foot sorting (`layers.md`).
- Everything on the tile grid. One art pixel is a whole number of screen pixels.
- `view` only reads game state: no rules live in drawing code.

## Old rule docs
`layers.md`, `tile-rules.md`, `style.md`. If A wins, archive the last two and write a one-page glyph sheet. If B wins, cut `tile-rules.md` to what is still used.
