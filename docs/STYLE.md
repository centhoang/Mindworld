# Mindworld pixel art profile

Version 1.0 · 2026-10-29 · review baseline, not a renderer migration.
Approved profile: `docs/STYLE.md`. Proof assets and reproducible local tools:
`.scratch/art/`. The task brief's dimensions take precedence over earlier proposals.

## Identity and provenance

Four pillars: **sunlit meadows; soft teal water; honey-colored timber; friendly,
readable creatures**. Use generous empty ground and rounded clusters. Warm, bright,
low-contrast scenery carries the mood; a few dark marks carry interaction and text.

Inspected the 19-image `.scratch/visuals/ref-sheet.jpg`, then
`visual-ref/house-inside.webp` separately. Inventory: 20 reference images, matching
the 20 sources in `.scratch/moodboard/palette.json`; no later additions at review.

| Evidence | Role and observed trait | Production translation |
| --- | --- | --- |
| `visual-ref/1732880538_1791102160_9254.webp` and `visual-ref/5424886402_1791102156_7105.webp` (sheet 3, 10) | Rounded buildings, warm greens, quiet teal shoreline | Broad foliage clusters, light banks, clear doorways |
| `visual-ref/6962038659_1791102139_4708.webp` and `visual-ref/9950256894_1791102141_2789.webp` (5, 19) | Sunny meadow / warm wood room | Light grass base; wood, cream and green interior furnishings |
| `visual-ref/3984968671_1791102158_8522.webp` (6) | Organized garden and walking space | Grid-aligned beds and one-tile clear routes |
| `visual-ref/101540361_1791102145_9052.webp` and `visual-ref/8567817249_ss_a20bd28a0114621e2f3a82b8b0d4c373778de.webp` (1, 16) | Cream UI, restrained framing | Cream panels with a narrow warm border; original layout and glyphs |
| `visual-ref/9197520526_1791102154_7549.webp` and `visual-ref/house-inside.webp` (18, separate) | Cream walls, timber beams, green fabrics, plants and window light | Same wood/grass/cream ramps indoors; readable furniture footprints |
| Sheet 7, 12, 13, 14, 17 | Dusk, night, orange autumn or unusually yellow grading conflict with the daytime majority | Do not average these into the default palette; seasonal variants need a separate reviewed profile |

**Observed:** mostly smooth 3D surfaces, soft light and perspective cameras. None
establishes a tile grid, pixel density or animation count. **Chosen below:** all
pixel sizes, projection, silhouettes, ramps, timings and screen layouts. Do not copy
reference characters, room arrangements, logos or recognizable building outlines.
References are aesthetic evidence only; no source pixels are redistributed.

All v1 samples are original programmatic pixel drawings, including the modular
creatures and bitmap glyphs. No ImageGen, external packs, paid calls or downloads
were used. For later tiles/props, an approved CC0 16x16 pack may supply a starting
asset: retain its local license/source record, adapt its shape and palette, then
apply this checklist. No pack license is asserted for assets not actually imported.

Change record: v1.0 establishes 384x216, 16x24 player, 32x32 portraits and the
28-color palette; these override the skill's starting proposals and the older
16x16 player note. New colors or exceptions require a versioned entry here.

## Palette

Exactly **28 unique opaque RGB colors**; transparency uses no additional slot.
The candidate extraction is a histogram, not an authoritative source palette.
Retain its cream `#F4DEC6` and muted teal `#43847C`; replace near-black `#14181C`
with softer green ink, merge duplicate greens into one light ramp, soften strong
blue/cyan into teal, and turn lemon yellows/oranges into honey and coral accents.
The following marked block is the only canonical quantization palette.

<!-- moodboard:palette:start -->
| Material | Shadow -> base -> light | Usage |
| --- | --- | --- |
| Grass | #537D59 -> #78A05D -> #9FC66A -> #BFDA82 -> #DDE8A3 | Shadow under foliage -> lower foliage -> meadow/base leaves -> upper-left leaves -> small sunlit tips. Terrain uses the middle three most often. |
| Water | #43847C -> #519F95 -> #6CBAB2 -> #9ED7CA -> #D4EADD | Recess/leaf stem -> deep channel -> surface base -> short ripple -> rare glint/window reflection. Never fill a whole river with the darkest tone. |
| Wood | #795849 -> #A57954 -> #C69A67 -> #E0BC85 -> #F4DEC6 | Recess/structural line -> endgrain -> plank/furniture base -> lit plank/path -> cream trim and wall. Wood stays warm indoors and outdoors. |
| Stone | #7A8F89 -> #9CAC9B -> #BFC7AF -> #DDE1C6 | Cool crevice/disabled text -> shaded rock -> rock base -> lit top. Reuse for quiet UI borders and pale banks. |
| Skin/fur | #B88163 -> #D8A67A -> #EBC796 -> #F7E5BA | Fur underside/skin shadow -> cheek or fur base -> lit fur -> muzzle/belly/tiny highlight. Grass or water ramps may color alternate creature bodies. |
| UI | #39463F -> #7A8F89 -> #BFC7AF -> #F4DEC6 -> #FFF3D8 | Shared ink/normal text/silhouette -> disabled text -> inner keyline -> border -> opaque panel background. No dark panel fill. |
| Accents | #BC756B -> #E69B86 -> #EDC76A | Muted coral shadow/error marker -> blush/coral flower -> honey flower, selection badge or lamp core. A role list, not a shading ramp. |
<!-- moodboard:palette:end -->

Six material ramps contain 3-5 ordered tones each; the accent row is a three-color
budget. Reuse entries rather than adding colors per asset. Use at most 4 tones in
one small material region (5 permitted for large foliage/water). Keep ink below 3%
of non-UI scenery when practical; avoid continuous ink terrain borders. Accents
should occupy at most 5% of the scene outside UI. A sprite may use more of its own
coral/gold marks when these identify its anatomy.

Normal text is ink on the UI cream, with a measured contrast ratio recorded in
`verification.json` (target >=7:1). Disabled text remains secondary, never the only
way to communicate state. HP/focus/error states include a number, pointer or label
as well as color. Warm interiors reuse wood/cream, grass upholstery, teal glass,
and gold lamp cores; they introduce zero new colors.

## Pixel grid and camera

Plain Canvas2D composition, **16x16 tiles**, **384x216 logical pixels** at 16:9:
24 columns by 13.5 rows. Draw 14 tile rows, clip the last 8 px; do not stretch the
tile grid to fit. Camera is top-down with visible front faces on trees, walls and
furniture. Parallel verticals, no vanishing point or isometric diamonds. Scroll
and place sprites at integer logical coordinates, including camera subtraction.

| Role | Cell size | Anchor / padding / facing |
| --- | --- | --- |
| Player | 16x24 | (8,23); bottom-center contact, one clear pixel at top/sides. Directions down/left/right/up. Height includes headwear. |
| Overworld pet | 16x16 | (8,15); one clear pixel top/sides, feet may touch anchor row. Larger species use a fixed 24x24 cell and (12,23), never per-frame resizing. |
| Battle front | 64x64 | (32,59); one clear pixel sides/top, four transparent rows below ground row. Faces down-left toward opposing platform. |
| Battle back | 48x48 | (24,43); four transparent rows below ground row. Faces up-right; show ears/tail/pattern rather than a second face. |
| Portrait | 32x32 | (16,31); head/upper-body crop, 1 px side/top margin; no implied ground contact. |
| Tree | 32x48 | (16,47); canopy within x=1..30, y=1..32; trunk/root reaches contact row. Ground collision 16x16. |
| A-frame exterior | 48x48 | (24,47); 3x3 visual tiles; 48x32 blocked footprint in bottom two tile rows, with center 16x16 doorway override. Ground row is the bottom stair. |
| Text frame source | 12x12 | 4x4 corner cells; cut coordinates 0,4,8,12 on both axes. |

Scale the final framebuffer by the largest fitting **integer** (e.g. 5x on a
1920x1080 area, 3x on 1366x768); center and letterbox remaining pixels. Review
exports are exactly 4x = **1536x864**. If a portrait viewport is supported, crop
the world width in whole tiles and reflow UI; do not squeeze the 384-wide UI.
The supplied mockups prove only the 384-wide layout.

## Outlines and pixel clusters

Use a 1 px ink silhouette on small characters and key interactive prop bases;
use wood shadow on warm structural edges and grass shadow on leaf silhouettes.
Break the dark edge on upper-left foliage and long sunlit roof edges in favor of
the material's midtone. Never add a second outline at joins. Interior separators
use the material shadow rather than universal ink.

Build curves with stair steps of 1-3 px; use 2x2 or larger highlight clusters.
One-pixel exceptions: eyes, mouth, glyph strokes, flower centers, roof seams and
leaf veins. Creature eyes are 2x2 at battle scale and 1 px at overworld scale.
Avoid checker texture, isolated random noise and hair-thin diagonals. Terrain has
no ink silhouette. Use 1-3 small grass/stone clusters per 16x16 tile with at least
the outer 2 px free of random detail; combined detail coverage <=12% of a flat tile.
No antialiasing, smoothed brushes, fractional placement or outline filters.

## Lighting and ramps

World light comes from upper-left (screen NW). Cluster highlights on upper/left
surfaces and shadows on lower/right. Cast contact shadows separately in the scene,
offset (+3,+2) logical px; use a solid material shadow, never translucent black.
Tree shadows are flattened green shapes, creature shadows are small green/teal
ellipses. Shadows do not belong in sprite images.

Use discrete ramp steps: shadow, base and light, plus a small optional brightest
cluster. Cool green/teal shadows sit beside warm yellow-green or cream highlights;
keep timber shadows warm to preserve its material. No gradients, baked AO/glow,
specular noise, fog overlays or per-asset color grading. Interior lamps may light
the nearest 16 px with wood light and gold; maximum two sources per room, with no
new hue and no softened sprite edges. This is a local exception to NW lighting.

## Dithering and alpha

**No dithering in v1**, including terrain, characters, UI and effects. Shade with
connected flat clusters instead. All PNGs are RGBA with **binary alpha 0/255**;
opaque backgrounds for mockups, transparent backgrounds for sprites/frame/glyphs.
No partially transparent edge or effect exception in this profile. Transparent
pixels use ink RGB for strict palette checks (the quantizer's zeroed invisible
RGB is normalized to ink afterward). All visible RGB is canonical without exception.

## Tiles and seams

Use **16 N/E/S/W edge masks plus 4 inner-corner patches**, not a 47-blob mixture.
Mask bits N=1, E=2, S=4, W=8. In a shore mask a bit means neighboring **water**;
in a path mask it means a **connected path**. Atlas cell index equals the mask,
left-to-right then top-to-bottom in a 4x4 sheet. Inner-corner patch order is
NW/NE/SE/SW in one row, alpha over a grass tile; apply when the two cardinal
neighbors are land but the diagonal is water. Compute these from the map, not
from hand-selected scene-specific tile IDs.

Bank cross section, measured inward from an open edge: 3 px water, 1 px honey
bank, 1 px grass lip, then grass base. N/W lips use grass light; S/E lips use grass
shadow. Orthogonal joins use the union of exposed edge strips; the four concave
5x5 corner patches (a 3x3 water cut plus bank/lip) close diagonal holes. Straight water borders use surface base,
with no edge decoration, so neighbors meet. Only interior ripples move.

Paths have a 12 px dirt center on a single tile, 2 px grass margins on
disconnected sides, and a 12 px connection to the border on connected sides.
The four 2x2 corner pixels remain grass under this 16-mask grammar. A 1 px inner dirt
line separates open margins. For every side join, the touching edge pixels must
match. Bridges are 16 px modules, 12 px walking deck with 2 px rail bands, wood
planks every 4 px, plus explicit land endcaps. No diagonal bridge. Future cliffs:
one 16 px rise; 8 px visible front face below a top rim; no walk across a face.

Maintain 3 base variants and 2 optional detail overlays per grass/path terrain;
detail overlays cover <=12% and avoid the outer 2 px. Water: 4 animation cells,
same edge pixels and bank geometry. Samples include 3 grass variants, path/shore
mask atlases, four inner corners, two detail overlays and four water frames.
`tile-patch-3x3.png` is 48x48: each row is vertical path / east shoreline / water.
It proves one straight bank orientation, not the complete runtime tile system.
The verifier checks connected borders in all 16 masks and water animation borders.

Farms use 16x16 cells with a 12x12 inset bed, one-tile walking aisles between groups
of at most 3x2 beds. Dry soil uses wood shadow/base; wet soil uses wood shadow plus
teal corner marker; 4 static crop stages: seed mark, two leaves, leafy plant, ripe
root with gold tip. Shape changes as well as color. No automatic growth animation.

## UI and text

`ui-frame-12.png` is a **12x12 9-slice**, cuts at 4 and 8. Corners stay exactly 4x4;
tile the 4 px edge spans/center and clip the final repeat as needed. Minimum box
12x12. Border uses stone/wood/cream, background opaque UI cream, 1 px stepped
outside corners with alpha. Do not stretch corners or apply a fuzzy shadow.

Use original uppercase **5x7 marks in 6x8 cells**, 8 px nominal height, **10 px
line height**, 4 px panel padding. `font-6x8.png`: ASCII 32-95, 16 columns x 4 rows,
96x32; index = codepoint-32. Unsupported lowercase is uppercased; unsupported
symbols become `?`. Atlas glyph RGB is ink; selection adds a pointer and pale
grass fill, disabled text uses stone shadow plus a state label.

Dialogue box: **(8,160), 368x48**. Portrait at **(16,168), 32x32**, text at
**(56,168)**, content width 312 px = **52 cells**, max 3 lines at y=168,178,188.
Word-wrap before overflow; hard-break a token longer than 52 cells; paginate
beyond 3 lines, with a 3 px advance marker at (366,198). Never shrink the font or
let text enter the border. Without a portrait, text starts x=16 and gains 6 cells.
World controls and important targets stay above y=152 while dialogue is open.

Battle scene: top-left enemy panel **(16,20), 132x36**, lower-right own panel
**(230,114), 146x38**. HP is numeric and a 3 px filled bar; character name and level
share a row. Bottom prompt **(8,160), 216x48** with 32x32 portrait; text width
160 px (26 cells), max 3 lines. Menu **(228,160), 148x48** holds 2x2 choices:
Fight / Teach / Swap / Run, 70x18 hit regions. Keep names <=12 glyphs in HP panels;
truncate long display names with `...`, never silently overflow. UI readable at 1x
and with CRT disabled is an acceptance requirement.

## Scene grammar

Overworld: grass/path/water layers, then beds/low props, depth-sorted actors and
tall props by ground-anchor y, then dialogue. One-tile routes are minimum; use
two tiles near houses and junctions. Bridge decks override water collision only
on their center 12 px. Keep about two-thirds of walkable ground free of decor.
Trees occupy a 1x1 collision tile while their 2x3 canopy can occlude; draw actors
in front once their feet pass the trunk contact. No overlay card over the player.

A-frame: 3x3 visual footprint, triangular front and two narrow roof slopes,
12 px door centered on the bottom tile, 2 px stair treads at the front. Transition
through the central 16x16 entry tile. Interior is a separate **12x9 tile room**,
192x144 at (96,8), with a bottom-center two-tile entrance; NW warm ambient light.
Furniture footprints: stool/plant 1x1, table/bed 2x1, sofa 2x1. Hide the roof and
front wall entirely inside; decor above the player's feet occludes consistently,
never place a front wall across the exit. Leave a full one-tile loop from entry
to bed/table; dialogue uses the same bottom 48 px. No interior proof is supplied.

Battle: two opposing shallow platforms. Enemy front cell at **(240,38)** with
ground anchor **(272,97)**; own back cell at **(80,98)**, ground **(104,141)**.
Platform extents roughly (224,92)-(320,116) and (48,132)-(160,154). Enemy panel
stays left of the enemy; own panel right of the player. Background is quiet pale
teal/green flat layers, not a perspective stage. Reserve y=160..207 for decisions;
no sprite/effect enters it. Portraits retain the same creature's ears/pattern.

Farm states retain their bed footprint. Other owned pets may rest in open home
ground; use a static pose until activity frames are authored, not size changes.
Sample layouts are original compositions for checking style and legibility.

## Animation

Cells never change size or anchors. Sheets contain no gutters/extruded pixels.
Frame numbers below begin at 0; all times are chosen production rules, not facts
inferred from the refs. Samples contain **static poses only** except water cells.

| Sheet / row order | Columns and exact timing | Loop / behavior |
| --- | --- | --- |
| Player/pet idle; rows down, left, right, up | 2 columns; 500 ms each (2 fps) | Loop; only upper body moves 1 px, feet fixed |
| Player/pet walk; same direction rows | 4 columns; 125 ms each (8 fps) | Loop 0,1,2,3; stop on idle cell 0 |
| Battle front/back idle, separate files | 2 columns; 400 ms each (2.5 fps) | Loop; squash at most 1 px, contact fixed |
| Battle attack | 4 columns; 100 ms each (10 fps) | Once; anticipation, lunge, contact, recover; runtime translation <=4 px |
| Battle hit | 2 columns; 80 ms each (12.5 fps) | Once; normal / material-light flash, no alpha fade |
| Battle faint | 4 columns; 140 ms each | Once, hold last until removal; shrink upper body downward, anchor remains fixed |
| Water | 4 columns; 250 ms each (4 fps) | Loop 0..3; move interior ripple clusters only |
| Crop growth | 4 columns; static state IDs 0..3 | Switch by simulation state; never time-loop |

Atlas layout is `[frame x direction]` for walkers, `[frame x 1]` for battle/water
and crops. Independently mirror neither lighting nor asymmetric creature marks;
author opposite-facing cells with consistent NW highlights.

## Rendering and delivery

PNG RGBA, exact logical sizes, sRGB entries, binary alpha. Sample naming is
`tile-*`, `prop-*`, `monster-mallow-{front,back,overworld,portrait}.png`,
`ui-*`, `mock-*`; atlases and cut/anchor metadata are in `manifest.json`.
Future animated names: `<subject>-<view>-<action>.png` with the row convention
above. Keep gene slots body / ears / tail / pattern independent; render the same
gene record separately at each resolution, not a blurred/downscaled battle sprite.
The sample generator includes two choices per slot and two example gene records;
it is an art proof, not integration with the existing runtime genetics or a
guarantee that future hatches can never share a visual combination.

Canvas image smoothing off, integer source/destination rectangles. Apply CRT
scanlines, curvature, bloom and optional RGB offset **once after scene + UI
composition**, never in an asset or these mockups. Start renderer review at
scanline darkening <=8%, bloom contribution <=5%, barrel edge displacement <=2
logical px and RGB shift <=0.25 logical px. CRT off is required. Inspect both
states with all UI visible, preserving >=7:1 effective normal-text contrast and
no cropped edge text; reduce effects if this fails. These are review limits,
not implemented shader settings.

Sprites contain no scanlines, glow, vignette, chromatic fringes or baked words.
Mockups may contain the sample bitmap text; 4x previews use nearest neighbor only.

Local reproduction (from project root, no install/network):

```powershell
node .scratch/art/build.mjs
node .scratch/art/verify.mjs
```

The build draws raw RGBA in memory, saves a temporary input inside `.scratch/art/`,
runs `.claude/skills/moodboard/scripts/palette.mjs quantize` against this profile
for every PNG, normalizes invisible RGB, then removes its temporary inputs. The
verifier scans every PNG recursively, checks exact palette membership including
invisible RGB, binary alpha, dimensions, mask joins, corner composition, 9-slice
reuse and byte-exact 4x pixel replication. It writes `verification.json` locally.
No existing files outside the brief's write scope are modified.

## Asset review checklist

- [ ] Original anatomy/layout; no borrowed recognizable creature, name or logo.
- [ ] Correct logical size, view, padding, ground anchor, footprint and crop.
- [ ] Canonical RGB only; binary alpha; shared ramps and NW lighting.
- [ ] 1 px/selective silhouettes, connected clusters, sparse texture; no blur.
- [ ] Compare beside the approved tree, house and Mallow on actual scene ground.
- [ ] Every required edge/corner joins, water borders stay stable and 3x3 repeat reads.
- [ ] Animation cells/contact do not jitter; review timing at the stated rates.
- [ ] Frame corners stay 4 px, text wraps/paginates, focus and HP have shape/number cues.
- [ ] Review at 1x and integer upscale; CRT on/off with UI before runtime approval.
- [ ] Record any exception here before using it as a new rule.

## Do / don't

- **Do:** favor large friendly silhouettes, cream negative space, sparse leaf
  clusters, shared material ramps, consistent anchors and original modular anatomy.
- **Do:** keep sunny meadow and teal water dominant; use gold/coral in small marks.
- **Do:** redraw tiny creature faces for their size; retain ear/tail/pattern identity.
- **Don't:** add a custom palette per asset, photographic detail, dither, blurred
  edges, two-pixel outlines or smooth gradients.
- **Don't:** import 3D perspective, dark night grading, copied character shapes,
  baked text/CRT effects, moving tile seams or crowded walking routes.

## Scope and remaining review

This baseline proves palette, logical sizing and two still compositions. The
32x32 portrait, 48x48 back, original font and tile masks are supporting samples.
It does not prove a full walk/battle animation set, interior/decor art, all bridge
orientations, runtime collision, live CRT behavior, touch UI or hatch diversity.
The straight bridge and four water cells are visual samples. Validate corner
combinations on runtime maps and compare more independent monster families before
approving the full procedural catalog. The small house/window and 16 px face are
the first details to revisit after 1x play-testing. Keep these limits explicit.
