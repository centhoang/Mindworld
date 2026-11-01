# Mindworld pixel art bible

Version **2.0** · 2026-10-31 · approved output: `docs/visual/style.md`.
Replaces v1's palette and proposed pack conventions. This is an art specification;
the current renderer and its v1 colors have not been migrated.

## Identity and provenance

Five pillars: **bright green ground; clear blue water; warm timber; oversized
heads and compact bodies; crisp colored outlines and clustered shading**. The
author's scenes use strong color separation, rounded foliage, little working
villages and open paths. Keep this cheerful contrast rather than v1's muted wash.

The sole asset source is `PACK/`, shorthand throughout this document for:

`VisualAssetPack/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_ASSET_PACK_V2.1/Sunnyside_World_Assets/`

The Gamemaker folder is outside this profile. License basis supplied in the brief:
free and commercial use, modification and style study are allowed.

References inspected in the requested order:

| Evidence | What it establishes |
| --- | --- |
| `VisualAssetPack/BuiltDemo/Screenshot 2026-10-31 111131.jpg`, then `hBwJz2.jpg` | Scene density, proportions in context, layered cliffs, bridges, farms, timber buildings and water. JPEG colors are not palette evidence. |
| `.scratch/art/pack/tileset.png` | Overview of the 16 px atlas: terrain joins, architecture, furniture, goods, foliage and icons. |
| `.scratch/art/pack/people.png` | First-frame comparison of human actions, base, six hair choices and tool layers. This is a preview, not the animation layout. |
| `.scratch/art/pack/ui_elements.png` | UI, animal, plant and crop overview; labels and preview background are not source pixels. |
| Original PNGs in `PACK/Tileset`, `Characters`, `Elements`, `UI` | Exact dimensions, opaque colors, alpha, outlines, complete strips and the gap audit. Both tilesets were inspected. |
| `PACK/Characters/_Source/**/*.aseprite` and supplied GIFs | Frame tags, durations and discrepancies in exports. |
| `client/src/pixel/monster.ts` | Existing pet slots, build ratios, layer order and front/back behavior to preserve when drawing replacements. |

**Observed** means inspected pixels or file metadata. **Chosen** means a
production rule where the pack supplies no game-specific contract. No directional
sprite set, battle layout, font or animation speed is inferred from a still.
Measurements use original resolution and zero-based pixels.

## Palette

The canonical block contains **32 unique opaque RGB colors**, all sampled exactly
from original pack PNGs at alpha 255, without quantization, averaging or JPEG
sampling. This is a curated working subset, not the author's complete palette:
the 16 px atlas alone has **338 visible RGB values** at alpha > 0. Native assets
retain their original colors. Do not quantize the whole pack to this subset; use
it to author new assets for the daytime village direction.

Rows run dark to light. Outline, rim and specular entries are available roles,
not instructions to use every entry on every material patch.

<!-- moodboard:palette:start -->
| Material | Shadow -> base -> light | Usage |
| --- | --- | --- |
| Grass | #193C3E -> #265C42 -> #3E8948 -> #53A641 -> #63C74D | Deep foliage edge -> underside -> main canopy -> lit leaf clusters -> bright tips and meadow base. |
| Grass detail | #3E8948 -> #63C74D -> #7BCF5C | Dark tufts -> meadow -> small lighter ground flecks; keep most ground flat. |
| Water | #124E89 -> #1E6DD5 -> #0099DB -> #2CE8F5 -> #FFFFFF | Deep shore band -> blue shore rim -> open-water base -> cyan pool/glint -> narrow foam or sparkle. |
| Wood | #733E39 -> #B86F50 -> #C58A63 -> #E4A672 | Seams/underside -> shaded furniture -> structural timber -> lit boards, rails and trim. |
| Stone | #262B44 -> #5A6988 -> #8B9BB4 -> #C0CBDC | Dark crevice/edge -> shadow -> stone/metal midtone -> upper face or bevel. |
| Skin/fur | #BB6D53 -> #C87F5B -> #E8AD7D | Tiny skin/fur shadow -> warm edge -> broad human skin/light tan fur. |
| UI | #171424 -> #181425 -> #262B44 -> #C0CBDC -> #FFFFFF | Human ink -> general panel ink -> blue-black icon edge -> default panel fill -> bevel/icon white. The two inks are actual distinct source colors, not a useful shading transition. |
| Pink fur | #B74851 -> #E17276 -> #FF979B | Pig-like underside -> warm pink midtone -> broad light pink; also creature cheeks. |
| Red/coral | #BE4A2F -> #E43B44 -> #FF979B | Warm red shadow -> cloth/heart/error accent -> small pink highlight. |
| Gold | #BE4A2F -> #FEAE34 -> #FEE761 | Deep orange edge -> orange crop/lamp/accent -> tiny yellow highlight. |
| Sand | #C58A63 -> #E4A672 -> #E4D572 | Bank detail/shadow -> warm path -> sand base; reuse existing wood colors. |
<!-- moodboard:palette:end -->

Palette provenance: grass/shore/sand and structural wood occur in
`Tileset/spr_tileset_sunnysideworld_16px.png`; skin occurs in human base strips;
pink occurs in `Elements/Animals/spr_deco_pig_01_strip4.png`; gray, ink, white and
accents also occur in UI and character exports. A scan of all **396 source PNGs**
verified every canonical RGB at full opacity. Transparency consumes no color
slot; shadow opacity is specified separately below. Warm interiors reuse wood,
stone, red cloth and gold rather than introducing a separate grade.

## Pixel grid and camera

**Observed:** the main atlas is **1024x1024**, a **64x64 grid of 16x16 cells**, with
unused transparent space and no intervening gutters. The additional
`spr_tileset_sunnysideworld_forest_32px.png` is **320x576**, a 10x18 grid of 32 px
cells for larger forest pieces; this does not change the world's 16 px base grid.
The view looks down onto tops while showing vertical front faces, with parallel
verticals and no isometric diamonds or perspective convergence.

| Role | Measured source dimensions / proportions | Production anchor or use |
| --- | --- | --- |
| Human animation | **96x64 per frame**, one horizontal action strip. First bald idle occupies x=43..53, y=23..38: **11x16 visible pixels**. With bowl hair: x=42..54, y=21..38, **13x18**. | Preserve the full action canvas and layer alignment. Chosen ground guide **(48,39)**, immediately below the first idle's feet. Do not center each trimmed frame independently. |
| Human anatomy | The bald head occupies roughly the upper 11 rows of a 16 px silhouette; torso and legs occupy about the lower 5. Hair adds height/width, not a larger body. | Large rounded rectangular head, tiny torso, short legs; 1x2 px eyes, sparse face marks. A 96 px canvas does not mean a 96 px person. |
| Small animals | Bird and duck: **16x16 cells**, 4 frames. | Keep native padding and ground point. |
| Larger animals | Chicken, cow, pig and sheep: **32x32 cells**, 4 frames. A pig's first cell including shadow occupies **18x21**, not the entire cell. | Keep the native cell, not a 32 px solid silhouette. |
| Trees | Animated broadleaf **32x34** and conifer **28x43** cells, 4 frames each; static canopy groups also exist. | Bottom trunk/root is the sorting point. Do not cut a 34/43 px sprite into a 32 px height. |
| New modular pets | **16x16, 32x32, 48x48**, each in **front and back** views. Brief/code requirements, not supplied pack assets. | Chosen guides **(8,14), (16,30), (24,45)**. Keep at least 1 clear pixel at top/sides after outlining, and a fixed guide across layers/frames. |

**Chosen:** retain the established **384x216 logical viewport**. Draw 14 terrain
rows and clip the final 8 px; do not stretch tiles to fit. Keep source pixels and
camera subtraction on integer coordinates, use nearest-neighbor sampling, scale
the complete view by a whole integer and letterbox the remainder. Judge new art
at 1x and 4x. Pet resolutions are separately drawn, never scaled versions of one
master with thicker outlines.

## Pixel size rules by asset type

Native evidence: `.scratch/art/gen/pack-metrics.json` (59 samples; frames count separately; panels are nine 3x3 slices). Width x height, padding L/T/R/B, root coordinates from top-left; body excludes identified ground shadows. Outline percentages estimate boundary-connected dark ramps; 1px is the measured typical contour, not every dark mass.

| Type (manifest key) | Canvas px | Allowed visible W x H px | Padding px | Outline px; native share | Smallest detail px | Colours/sprite | Scale beside 11x16 human; root guide |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Human (`human`) | 96x64 | 11-14 x 15-16, bald standing/carry | 43/23-24/39-42/25 | 1; 27-29% | 1, e.g. eye | 3-20 (native 18-20) | 1 human; (48,39), preserve action alignment |
| Small animal (`small-animal`) | 16x16 | 14-15 x 10-14 | 0-2/0-3/0-2/2-3 | 1 coloured; 26-35% | 1 | 3-10 (native 9-10) | bird/duck about 0.6-0.9 human tall; (8,14) |
| Large animal (`large-animal`) | 32x32 | 16-23 x 16-20 | 4-7/3-7/5-9/8-10 | 1 coloured; 17-32% | 1 | 3-9 (native 7-9) | cow/pig/sheep 1-1.25 humans tall; (16,24) |
| Tree (`tree`) | 32x34 or 28x43 | 18-26 x 30-33 | 3-5/0-5/3-5/3-5 | 1 coloured; 13-21% | 1; broad leaf clusters | 3-12 (native 9-57) | about 2 humans tall; (16,31)/(14,38) |
| Crop (`crop`) | native 12x14,16x13,10x13,13x19; new 16x16/24 | 10-16 x 13-19 | 0-5 (native 0) | 1 coloured; 2-18% | 1 seeds, 2+ leaves | 3-11 (native 8-11) | mature plants 0.8-1.2 humans tall; stem base |
| Building prop (`building-prop`) | 16x16/24/32,32x16/32,48x32 | 10-48 x 8-32 | 0-11; retain footprint | 1 coloured/ink; 9-34% | 1 grain, 2+ trim | 3-12 (native 5-6) | table top 10-16px above ground; door opening 13-16x18-24; goal opening 32-38x18-24; bottom of supports |
| Floor/terrain tile (`floor-or-terrain-tile`) | 16x16 | 16 x 16 | 0 all sides | 0 ink; 1px material seams; 0% | 1 fleck, 2+ textile strokes | 1-12 (native 1-5) | 1 tile spans about 1.5 body widths; (0,0), repeat seamless at 1x |
| Carried item/food (`carried-item-or-food`) | native 10x11/12,11x11,12x11; new 16x16 | 8-12 x 8-15 | 0-7 (native 0) | 1 coloured; 0-40% | 1 accent, 2+ main patch | 3-11 (native 4-6) | ball 8x8, about half human height; cake incl. candle <=15 high; bottom centre |
| UI icon (`UI-icon`) | native 11x12,15x13,12x12,12x11,13x13; new 16x16 | 11-15 x 11-14 | 0-3 (native 0) | 1; 30-37% | 1 mark | 3-9 (native 4-9) | screen space; centre |
| UI panel (`UI-panel`) | 3x3 native slices; assembled 9-384 x 9-216 | assembled full canvas | 0 outer; 4 inner content | 1 ink + 1 bevel; slices 0-50% | 1; fixed 3x3 corners | 2-4 (native slices 1-3) | screen space; top-left |
| Speech/emotion icon (`speech-or-emotion-icon`) | native 9x9,4x9,7x10,9x8,7x7; new 16x16 | 4-9 x 7-10 | 0-9 (native 0) | 1; 38-73% | 1 mark | 3-4 | screen space, 9px chat; lower pointer |
| Pet at 16 (`pet-16`) | 16x16 | 10-14 x 9-13 | 1-3/1-5/1-3/2 | 1, coloured seams | 1 eyes, 2+ fur | 3-8 | 0.6-0.8 humans tall; (8,14) |
| Pet at 32 (`pet-32`) | 32x32 | 16-26 x 16-26 | 1-8/4-14/1-8/2 | 1, not doubled | 1 eyes, 2+ fur | 3-10 | 1-1.6 humans tall; (16,30) |
| Pet at 48 (`pet-48`) | 48x48 | 26-40 x 26-40 | 1-11/5-19/1-11/3 | 1, not tripled | 1 eyes, 2+ fur | 3-12 | 1.6-2.5 humans tall; (24,45) |
| Wild pet (`wild-pet`) | 16x16/32x32/48x48 | same respective pet envelope | same respective pet | 1 | same respective pet | 3-8/10/12 | same size tier; same root; redraw at each size |
| Market stall (`market-stall`) | 48x48 or 64x48 | 40-60 x 32-44 | 1-8 | 1 coloured; no thick ink frame | 1 grain, 2+ cloth | 3-12 | 3.6-5.5 body widths; counter 10-16px high, canopy clears 18-24px doorway; bottom support centre |
| Bubble container (`bubble-container`) | 24x16 or 32x24 | 24-32 x 16-21 | 0/0/0/0-3; 4 inner content | 1 ink + 1 bevel | 1 mark; 3x3 corners | 3-4 | screen space; thought (2,16), plan (9,21) pointer |
Chosen, not measured: new canvas/padding envelopes, commissioned pet/stall/bubble dimensions and roots, door/goal/table/ball scales, extended colour budgets and reduced new-tree palette, noise limits in `scripts/check-art.mjs`; source-only ranges and outline/detail metrics above are measured. Checker gates dimensions/padding/palette/alpha/colour/noise; assess contour weight, main detail clusters and world scale by eye at 1x beside native art.

## Outlines and pixel clusters

**Observed:** human silhouettes primarily use near-black purple **#171424**;
general UI and many small objects use **#181425**. Animals, pale icons and stone
often use blue-black **#262B44**. Main silhouettes are generally **1 logical px**,
with locally thicker corners, hair masses or contact edges. Do not turn those
filled masses into a uniform 2 px contour.

Foliage uses its dark green/teal ramp at the lower perimeter; beams, fences and
furniture use brown seams. Terrain has colored lips and banks rather than a
universal black border. Lit upper foliage and timber edges can meet neighboring
colors without an ink line. Internal marks are material shadows except facial
features, icon marks and the darkest recesses.

**Chosen:** use one silhouette outline on the assembled pet, with colored
internal seams. Merge attachment masks before outlining so there is no black
join across an ear/head attachment. Curves use deliberate 1-3 px steps;
highlights form connected blocks. Reserve isolated pixels for eyes, seeds,
sparkles and tiny surface details. Never smooth or antialias an outline.

## Lighting and ramps

**Observed:** top and upper-left surfaces carry the brightest clusters; lower
and right faces are darker. Leaves have lobed patches, rocks have broad planes,
wood has short horizontal grain/seam marks, and roofs have repeated little tile
clusters. Shade a form, not every individual pixel.

| Material | Observed tones, excluding tiny near-duplicate RGB variations | Rule for new assets |
| --- | --- | --- |
| Meadow | One broad base plus 1-2 lighter fleck colors; darker edge/tuft patches. | Flat base with sparse clustered details; avoid filling empty ground with texture. |
| Foliage | About 4-5 main green shading levels, a deep colored edge and occasional extra bright tips. | Use the grass ramp; place light clusters high/left and dark clusters below. |
| Water | One broad blue surface with 2 subtle ripple tints in the atlas; banks have distinct dark-blue, blue and white bands. | Keep ripples low contrast; reserve white for narrow foam and isolated glints. The working palette deliberately consolidates the subtle source tints. |
| Wood | Usually 3-4 broad brown tones, with optional extra light trim on larger furniture. | Shadow/seam, base and lit face; use a fourth tone only for a distinct plane or grain. |
| Stone / metal | About 3 face tones plus a dark edge; occasional white speculars. | Broad cool planes, one small top/left highlight, dark underside; no smooth shine gradient. |
| Human skin / fur | Human skin is mostly one broad light fill plus tiny edge shades. Pink animals use about 3-5 fill shades plus outline. | New pets start with 3 material tones; add a shared tone only for a distinct feature or plane. Keep faces simple. |
| Cloth / UI | Cloth commonly has 2-3 fills plus an edge; UI has flat centers with stepped bevel/outline bands. | Separate flat clusters and an explicit focus mark, never a soft bevel filter. |

**Chosen:** keep a single upper-left daylight convention for new assets,
consistent between independently drawn front and back views. Interior lamp/fire
animation may use gold locally; it does not recolor every neighboring sprite or
introduce a new material palette.

### Shadows

The pack **does bake contact shadows into some sprites**. Pig, cow and chicken
strips contain hard-edged, flattened **#262B44 at alpha 74/255** ellipses beneath
the feet, spreading a little down/right. The broadleaf animation has a native
dark-teal shadow at alpha 49/255. These are translucent pixel shapes, not blurred
drop shadows. Cliff faces use opaque warm bands, with dark shore bands below.

The windmill has separate `spr_deco_windmill_strip9.png`,
`spr_deco_windmillshadow_strip9.png` and
`spr_deco_windmill_withshadow_strip9.png`; its shadow uses **#181425 at alpha
79/255**. Use either the combined strip or the sprite plus its shadow, once.

**Chosen:** deliver new pet contact shadows separately using the animal shadow
color/opacity, so modular parts do not stack shadows. Use a crisp stepped ellipse
beneath the feet, without an outline; keep its anchor stable while the body bobs.
Do not add a second ellipse beneath a native asset with a baked shadow.

## Dithering and alpha

**No regular checkerboard dithering** for new assets. The references use flat
connected shading clusters, ground flecks, grain and roof patterns; these are
intentional shapes rather than gradient dithering. Avoid random pixel noise.

Use alpha **0/255 on new sprite silhouettes and UI edges**. Explicit exceptions:
the shadow layers above and supplied VFX with native opacity. Preserve original
PNGs, including occasional translucent foliage pixels; the pack is not uniformly
binary-alpha. Translucent source pixels do not permit antialiasing a new sprite's
perimeter. Ignore RGB under alpha 0 when checking palette membership.

## Tiles and seams

**Observed:** the atlas supplies grass/path transitions, beach and cliff shore
edges, outer and inner corners, repeated cliff faces, bridge/fence parts, soil,
roof modules and furniture. Grass has irregular stepped lips; water banks use
crisp colored bands. Bridges have separate planked decks, posts and rails.
Buildings use timber fronts and blue, green, orange, red or purple tiled roofs.

**Chosen:** map supplied pieces by explicit atlas rectangles. Their arrangement
is not v1's numeric 16-mask order, and no machine-readable autotile map was found.
Keep each source corner/endcap with its matching edge family. For a new terrain
family, deliver straight N/E/S/W edges, four convex corners, four concave corner
patches, an interior, an isolated patch and required endcaps; document the lookup
rather than inventing an atlas index convention.

Repeat 16 px cliff-face modules to make height; never stretch the texture. Keep
the top lip, face and water rim on separate map layers. Preserve bridge deck
width and rail endcaps when extending a bridge. Preview every new tile in a 3x3
repeat, a straight join, an inside corner and an outside corner, including
against the supplied tiles.

Crop files are **static states**, not an animation: `_00` is the seed item,
`_01.._04` are plant stages, and `_05` is the harvested item. Keep a 16 px planting
grid but allow plants to overhang it: `sunflower_04.png` is **13x19**. Soil images
are **16x12**; their footprint and native offsets must not grow with the crop.

## UI and text

**Observed:** `UI/9slice_box_white/` has **three sets of nine 3x3 pieces**, prefixed
`w_`, `lt_`, `dt_`. A set assembles into a **9x9 minimum source**, with **3 px
corner and edge-slice spans**, replacing v1's 12x12 source and 4 px corners.
The white set's straight edge is **1 px #181425 ink + 1 px white bevel**, then
**#C0CBDC fill**; the third pixel in an edge slice already belongs to the fill.
The other sets are warm light/dark variants. Corners are sharp and stepped.

The pack supplies **15x7** state bars, **4x13 / 16x13 / 4x13** label
left/middle/right pieces, hands, arrows, selection corners, emotion icons and
tools. Preserve native icon proportions and bar borders. Use supplied fill
states or redraw only the interior; do not stretch an entire icon or bar.

**Chosen:** use the white set for new dialogue/menu panels. Fix 3x3 corners;
repeat edge spans and the center, clipping the final repeat. Keep 4 px clear
padding inside the border. Use ink on gray for text; focus gets a pointer or
corner bracket plus a color change. Disabled/error/health states need a symbol,
label or number as well as color. The canonical ink on the default fill measures
**11:1 contrast** before display effects; keep normal text at least 7:1.

No font was found in the allowed pack. Retain the project's original **5x7
glyphs in 6x8 cells**, **10 px line spacing**, as a chosen UI convention. At
384x216, the existing dialogue rectangle **(8,160), 368x48** remains the baseline:
**32x32** portrait at **(16,168)**, text at **(56,168)**, at most **52 cells per
line / 3 lines**. Wrap before overflow, hard-break oversized words and paginate
longer text; never shrink the font. Keep important world targets above y=152
while this box is open. These are project choices, not pack measurements.

`UI/expression_chat.png` is an existing **9x9 ellipsis speech icon** for generic
chatter. A larger thought/plan bubble must reuse the panel vocabulary and add an
intentional tail/state symbol; the tiny icon is not a full text box.

## Scene grammar

Draw ground, low decor, feet-sorted actors/tall props, then UI. Sort trees by
trunk contact and buildings by ground footprint, not canopy or roof top. Choose
at least one 16 px tile clear for routes, widening to 32 px at doors, markets and
junctions. Group detail around farms and buildings, with quiet ground between.
Preserve front-facing doors, timber bands and steep tiled roofs rather than
forcing every building into v1's small A-frame.

Interiors reuse timber, red rugs/cloth, gray stone and existing small furniture.
Choose 16 px collision footprints independently from overhanging art. Hide an
obstructing roof/front wall when inside and keep the exit readable. These are
layout choices; no complete interior map was supplied in the brief.

For battle, place the opponent's front view above/right and the player's back
view below/left, each on a quiet shallow ground patch. Use the chosen 32/48 px
pet cells and fixed ground guides. Reserve the bottom 48 px for decisions and
keep effects out of text. This is a project convention, not a second camera
style demonstrated by the pack.

## Animation

**Measured character timing:** all **211 frames** in each supplied human source
file and the goblin source have **75 ms** durations (**13⅓ fps**), with forward
tags. Human base/hair/tool PNGs share **96x64** cells, frame 0 at the left, with no
direction rows or gutters. Keep layers on the same frame index. Six hair exports
are bowl, curly, long, mop, short and spikey. Actions can pose the character
differently; they do not supply four complete travel views.

| Human source tag / exported action | Frames | One cycle at the measured 75 ms |
| --- | --- | --- |
| walk, run, carry, doing, hurt | 8 each | 600 ms |
| idle, jump, waiting | 9 each | 675 ms |
| watering | 5 | 375 ms |
| axe, mining, attack, caught, roll | 10 each | 750 ms |
| death, dig, reeling | 13 each | 975 ms |
| swimming | 12 | 900 ms |
| casting | 15 | 1125 ms |
| hamering (source spelling; folder `HAMMERING`) | 23 | 1725 ms |

Goblin GIFs confirm these counts but store **70 ms** delays. Some goblin PNGs
have inconsistent names/dimensions: `spr_attack_strip10.png` is **864x64**, only
nine 96 px cells, while its GIF/source has ten frames; some longer exports wrap
onto extra rows. Resolve from Aseprite/GIF before use, rather than trusting the
suffix. Skeleton GIFs have idle **6**, walk **8**, attack/hurt **7**,
jump/death **10**, all at **70 ms**, with 96x64 frames. Do not conflate these
with the human counts.

| Environment strip / state family | Measured frame/cell count | Playback rule |
| --- | --- | --- |
| Bird, duck; chicken, cow, pig, sheep | 4; 16x16 or 32x32 as above | **Chosen:** 150 ms/frame, loop (600 ms cycle). |
| `spr_deco_blinking_strip12` | 12, 16x16 | **Chosen:** 75 ms/frame once, then wait 2-4 seconds before the next blink. |
| Mushrooms | 4, 16x16 | **Chosen:** 200 ms/frame, loop. |
| Broadleaf / conifer | 4, 32x34 / 28x43 | **Chosen:** 250 ms/frame, loop, unchanged trunk anchor. |
| Coracle | 4, 48x37; separate land sprite 32x30 | **Chosen:** 150 ms/frame, loop; the land sprite is not a water frame. |
| Windmill and matching shadow | 9, 112x112 | **Chosen:** 100 ms/frame, loop in lockstep. |
| Chimney smoke 01..05 | 30 each; cells 15x37, 10x30, 18x21, 20x32, 24x19 | **Measured GIF:** 100 ms/frame, 3 second loop. |
| Fire 01 / 02 | 4; 5x10 / 8x12 | **Chosen:** 100 ms/frame, loop. |
| Glint 01 / 02 | 6 / 4; 7x7 | **Chosen:** 100 ms/frame once, then hide until retriggered. |
| Water tiles | Static atlas artwork; no water animation strip found | Keep static. If ripple animation is later commissioned, choose 4 frames at 250 ms with unchanged bank edges. |
| Crops `_00.._05` | 6 static states, not 6 growth-animation frames | Select by seed/growth/harvest state; never time-loop. |

PNG-only environment strips do not encode timing. The chosen rates are not
claims about the demo executable. For gameplay, loop locomotion, idle and
repeated work; play hurt, death, jump, roll and individual actions once when
triggered. This behavior is chosen even though preview GIFs loop.

**Chosen new-pet baseline:** idle **4 x 150 ms**, walk **8 x 75 ms**, attack
**6 x 75 ms**, hit **2 x 75 ms**, faint **6 x 100 ms**; idle/walk loop, the rest
play once. Author matching front/back cells and every layer needed by that action.
Keep the root guide fixed; allow a 1 px body bob without moving detached parts.
These are new deliverables, not animations already present in the pack or code.

## Modular pet contract

Preserve the anatomy and gene vocabulary in `monster.ts` while repainting in
pack style. Its old ramps and header's old size examples are not the v2 palette
or the brief's 16/32/48 size contract.

| Slot / control | Required variants and behavior |
| --- | --- |
| Body/build | `pal`, `brute`, `skitter`, `turtle`, `bully`; shared feet, body and head. Gene `size` scales within the fixed cell. |
| Main / accent hue | `hue` selects a body ramp; `accentHue` selects a coordinated accent ramp. Use canonical material colors, not arbitrary HSL colors. |
| Ears | `pointy`, `round`, `floppy`, `bunny`, `tuft`, attached at common head landmarks. |
| Tail | `puff`, `nub`, `curl`, `fox`; root behind the body. The absent state adds no pixels. |
| Horns | `nubs`, `unicorn`, `antlers`; absent state does not alter head placement. |
| Pattern | Unpatterned state, `belly`, `stripes`, `spots`; belly only in front, stripes/spots on the back too. |
| Face | Front only: eyes, optional cheeks and a catchlight only if the eye has space. Back has no second face. Simplify at 16 px. |

Code proportions are relative to `k = cell size * look.size`: full body
width/height and head radius respectively: `pal` **0.62/0.50/0.24**, `brute`
**0.78/0.60/0.20**, `skitter` **0.50/0.36/0.22**, `turtle` **0.80/0.44/0.17**,
`bully` **0.70/0.56/0.22**. Use these attachment guides, then hand-clean clusters
rather than reproducing smooth ellipses at larger resolution.

Composition follows the existing model: **tail -> feet/body/head -> ears and
horns -> body pattern -> front face -> shared exterior outline**. Keep the
contact shadow separate. Render the same gene identity at all three sizes and
both views, retaining ear, horn, tail and pattern landmarks; never horizontally
flip a front view to manufacture a back view.

## Rendering and delivery

Deliver sRGB **PNG RGBA at logical resolution**, with source-sized pixels, no
gutters unless an explicit manifest requests them, and one constant cell/anchor
per strip. Suggested naming:
`pet-<build>-<slot>-<variant>-<16|32|48>-<front|back>-<action>.png`.
Record frame size/count/duration, layer order, pivot, collision footprint and
shadow inclusion in the manifest when assets are commissioned. Keep native
file names and source copies unchanged.

No baked scanlines, glow, vignette, chromatic fringes or smoothing. Any CRT effect
belongs to final scene composition and must be removable. Review text/edges with
effects off first; reduce effects that erase 1 px details. Do not run the v1
`.scratch/art/build.mjs` and treat its procedural samples as v2 proofs: they were
authored against the replaced profile.

## Creating new assets

The acceptance test is a side-by-side comparison with native pack art on native
ground, without a visible change in drawing technique.

- [ ] Pick a real pack reference: human base/hair for people, pig/cow for rounded pets, tileset foliage for leaves, white UI set for panels. Inspect at 1x and integer zoom before drawing.
- [ ] Specify logical cell, world footprint, root guide, view, action and shadow inclusion. Use 16 px terrain modules; preserve supplied action canvases/padding.
- [ ] Block the silhouette with the same large-head/short-body proportions or required pet build. Reserve outline space, including the longest ear, horn and tail combination.
- [ ] Select a small subset of the canonical 32 colors. Match the material ramp and colored outline; introduce no averaged or invented RGB values.
- [ ] Paint broad flat bases, upper-left highlight clusters and lower/right shadows with the stated tone count. Use short wood grain, lobed leaves or planar stone marks rather than generic noise.
- [ ] Use a 1 px silhouette where the reference uses ink, material edges for foliage/timber, and no black contour around ground tiles. Merge modular masks before outlining.
- [ ] Keep edges binary-alpha, omit checkerboard dithering/gradients and put the permitted translucent contact shadow on its own layer. Never duplicate a supplied shadow.
- [ ] For pets, verify every slot, gene size extremes, patterns, both views and 16/32/48 cells. Check body/ear/horn/tail joins and the 16 px face by eye; palette checks cannot detect a bad attachment.
- [ ] Animate on fixed cells/root guides at the stated counts/holds. Preview the composite so hair, tools and pet parts never lag or jitter. Author the back; do not mirror the front.
- [ ] Test tiles in 3x3 repeats and all required joins against native neighbors. For UI, preserve 3 px corners, text padding, wrapping and a visible focus shape.
- [ ] Compare beside two native assets on grass, a path and the default panel background, at 1x and 4x. Reject art that looks more blurred, noisy, outlined or finely modeled than its neighbors.
- [ ] Verify dimensions, frame layout, visible RGB membership and permitted alpha. Record necessary profile exceptions before accepting; preserve an editable layered source and export without resampling.

Do keep broad cheerful shapes, warm wood, blue water, purposeful clusters and
consistent roots. Do not copy a whole demo layout, add a palette per sprite,
blur edges, thicken every contour or disguise incompatible art with grading.

## Asset gap list

Audit scope: **396 PNGs, 31 GIFs and 3 Aseprite sources** under `PACK`, both
tileset atlases, the overview sheets and both demo images. The table keeps only
missing complete assets or missing variants. Sizes are **chosen commissions**,
not dimensions claimed for nonexistent pack files.

| Remaining gap | Check result / reusable assets | Minimum new work |
| --- | --- | --- |
| Modular pet body and parts | Human base/hair/tools are modular, but animals are flattened strips; no gene-compatible pet kit or paired front/back parts exist. | Full slot contract at **16/32/48**, both views, common guides and separate shadows. |
| Distinctive wild pet species | Bird, duck, chicken, cow, pig and sheep exist; so do goblin/skeleton characters. They do not supply fictional pet families or their gene/back-view variants. | Only missing fictional species and required views/parts; reuse native fauna for ordinary animals. |
| Soccer ball and goal | Neither found in atlases, elements or UI. UI discs/selectors are not soccer balls; fences are not netted goals. | **8x8 ball in a 16x16 cell**; **48x32 goal**, readable net and separate ground footprint. |
| Dance floor | Red patterned rugs and ordinary floor/deck pieces exist; no dedicated dance tiles or lit states found. | Repeatable **16x16** floor family with inactive/active states using existing ramps. |
| Birthday bunting, cake and balloons | Flowers, tables, rugs and food crops are reusable. None of the three birthday assets was found; the round white-faced furniture object is a clock. | **32x16 bunting**, **16x16 cake**, **16x24 balloon** variants, without baked words. |
| Public notice board | Crates, timber, furniture, framed interior pictures and roofed well/architecture pieces exist; no complete posting board found. | **32x32 board** with posts and a distinct posting surface; reuse timber for its frame. |
| Complete market stall | Goods exist: crops, fish, milk, egg, crates, tables and baskets. Roof/counter ingredients exist, but no complete merchandise stall/canopy was found. | Assemble a **48x48** stall from native pieces; author missing canopy/support joins and arrange existing goods. No new goods drawing needed. |
| Trade icon | Individual arrows and a basket exist, but no two-way exchange glyph was found. | **16x16** exchange icon using the supplied arrow vocabulary, with two opposing directions. |
| Thought and plan bubble variants | **9x9 ellipsis speech icon** and panel slices exist. `expression_confused-1.png` is a purple confusion swirl; `UI/plan alt.png` is a **plant sprout**, not a planning icon. No thought-tail/plan-state container was found. | **24x16 or 32x24** container using native panel parts, a thought trail and explicit plan/state mark. Reuse chat/emotion symbols as appropriate. |

Removed from drawing gaps after checking:

- **Fishing spot:** water/shore and wooden deck/bridge pieces, `UI/rod.png` and
  `rod alt.png`, the fish item, and human `waiting`, `reeling`, `caught` animations
  already supply the art for a marked fishing location. Scene assembly and an
  interaction hotspot remain implementation work; no new fishing art is required.
- **Duel icon:** reuse the existing **14x14 `UI/sword.png`** in a 16x16 slot.
- **Ordinary fauna, market goods and generic chat icon:** reuse the files above;
  only distinct species, stall structure and thought/plan variants remain.

Audit limit: unnamed atlas objects were judged visually. A dedicated market
canopy or notice-board export was not found; generic furniture can be adapted,
but that is an assembly commission rather than a verified ready-made asset.
Environment PNG playback rates, new-pet animation, layout and gap dimensions are
chosen rules. This document creates no sprites or code changes.
