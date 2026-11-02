# Visual scope

**Goal:** small, compact, cozy, cute, focused. Draw only what `../game/design.md` needs, so effort goes to game quality.

## Must be drawn
- Ground, path, water, bridge. A house (outside, inside), farm plot with 4 growth stages.
- Player, 4 villagers, pet (from genes), wild pet.
- Market stall, dance floor, fishing spot, board.
- Bubbles, thought bubble, name tags, inspector, chat box, minimap, day and night tint.

## Not needed
Windmills, cliffs detail, beaches, sea life, clouds, terraces, streams, decor density, fences. Each is a cost in rules and bugs.

## Look options
**Decided (user, 2026-11-02):** spike A first. The user judges an image and a clip (`../RESTRUCTURE.md` step 2). No: B, compact Sunnyside.

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
