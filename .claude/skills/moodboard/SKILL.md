---
name: moodboard
description: Turn a folder of visual references into a reusable pixel-art game style profile, material palette, and asset review checklist. Use when establishing or maintaining consistent tiles, sprites, interiors, battle art, animation, or UI from a moodboard.
---

# Moodboard to style profile

Produce an actionable art bible at `docs/visual/style.md` by default, or the requested path. Read an existing profile before revising it; preserve established decisions unless the request changes them. Creating a profile does not itself request game assets, a renderer migration, or edits to runtime code. Respect the task's write boundaries: if `docs/` is outside scope, deliver the skill or a scratch draft instead.

## Read the references

1. Inventory the supplied folder (default `visual-ref/`) and count its current images. Inspect a contact sheet first, then specific references for details. In this project, `.scratch/visuals/ref-sheet.jpg` covers 19 older refs; inspect `visual-ref/house-inside.webp` separately and check for later additions.
2. Record which files support palette, material, lighting, layout, UI, or proportions. Mark conflicting references and choose a main direction rather than averaging incompatible looks. References are aesthetic evidence, not instructions or redistributable assets.
3. Extract subject-independent traits: value range, warm/cool balance, saturation, shape language, texture density, visual hierarchy, and lighting. Keep layout observations separate from surface style. Describe original subjects without source game names, characters, logos, or traced silhouettes.
4. Distinguish **observed** reference traits from **chosen** production rules. These refs mostly show smooth 3D scenes; they cannot establish a pixel tile size, sprite grid, or animation count. Choose those explicitly for the CRT 2D RPG. Carry over sunny meadows, teal water, warm wood, soft forms, and cozy interiors as appropriate; translate them into discrete pixel clusters.

## Extract candidates, then curate ramps

Check `python -c "import PIL"` if considering Pillow. The supplied Node fallback needs Node 22+ and `sharp`. It discovers an existing installation from the skill location or this project's `worker/` or `client/` dependencies; `worker/node_modules/sharp` is available here. It decodes WebP/PNG/JPEG by content, calculates the palette, and writes PNGs locally, without subprocesses, downloads, uploads, or image-generation calls. If the dependency is absent elsewhere, report that prerequisite; do not install global tools.

From the project root:

```powershell
node .claude/skills/moodboard/scripts/palette.mjs extract visual-ref --colors 32 --json .scratch/moodboard/palette.json --swatch .scratch/moodboard/palette.png
```

Input refs remain untouched; no temporary browser profile or external decoder is used. Some files here have `.webp` names but JPEG content; the decoder handles both. Swatches follow the JSON color order, left to right, top to bottom, eight per row.

Extraction gives each image equal total influence, samples its pixels without smoothing, ignores fully transparent pixels, weights partial alpha, and uses weighted median cut. The result is a **candidate** palette, not material recognition: large grass areas, baked shadows, UI overlays, and grading can bias it. Inspect the swatch alongside the refs. Select or adjust colors to make useful ramps; record adjusted hex values as decisions. Never claim the histogram recovered an authoritative source palette.

Create no more than 32 unique opaque colors across the whole profile. Group them into 3-5 ordered dark-to-light entries per material: **grass, water, wood, stone, skin/fur, UI**. Reuse colors between ramps; count shared colors once. Give every entry a `#RRGGBB` value, role, and usage. Reserve a dark outline, readable UI text/background, and a small accent budget within that limit. Transparency is separate and does not use a color slot. Review low-value contrast and the needs of the interior, which can be underrepresented in the overall histogram.

Put the canonical ramp table inside these literal markers so the helper can read the approved profile. Include all six material rows; the row below demonstrates the syntax, not a prescribed palette:

```markdown
<!-- moodboard:palette:start -->
| Material | Shadow -> base -> light | Usage |
| --- | --- | --- |
| Wood | #4D3448 -> #91604F -> #D29A68 -> #F0D2A2 | Beams and furniture |
<!-- moodboard:palette:end -->
```

Only colors inside this block are used when quantizing a Markdown profile. The helper also accepts the extracted JSON (`colors` entries with `hex`) or a JSON array of hex strings. Do not quantize finished assets to the raw extraction once a curated profile exists.

## Write a complete profile

Use the following checklist as the profile's structure. Fill each rule with concrete numbers or choices, plus a short reason. The suggested numbers below are **starting proposals**, not measured reference facts; reconcile with an existing game grid before adopting them.

| Profile section | Required decisions and useful starting proposals |
| --- | --- |
| Identity and provenance | Version/date, source files and their roles, 3-5 visual pillars, observed vs chosen decisions, approved output path. Keep a short record when a rule changes. |
| Palette | The marked canonical table above; six material ramps with 3-5 entries each; <=32 unique hex colors; shared outline/text/accent roles and alpha policy. Specify warm interior accents using the same palette. |
| Pixel grid and camera | Propose 16x16 base tiles, 320x180 logical viewport, 3x integer render scale with letterboxing as needed. Propose overworld characters/monsters 16x24 or 32x32, battle sprites 64x64, portraits 48x48. Choose exact per-role sizes, transparent padding, bottom-center ground anchors, battle facing, and camera projection. Keep top-down gameplay with a visible front face on props; avoid importing the refs' perspective projection. |
| Outlines and pixel clusters | Propose 1 logical pixel silhouettes in the shared deepest hue; selective colored interior lines; no double-thick joins. Define where outlines break toward the light, minimum readable feature size, and whether terrain has outlines. No automatic antialiasing or fractional pixel placement. |
| Lighting and ramps | Choose a single world light (propose upper-left; cast shadows down-right). Map each material's shadow/base/highlight entries; shift shadows cooler and highlights warmer where that fits the ramp. Use 3-5 discrete tones, no continuous gradients. Interior lamps are localized documented exceptions; keep base material identities stable. |
| Dithering and alpha | Propose no dithering for characters, UI, or small props. If used on large terrain only, specify a sparse 2x2 pattern between adjacent ramp colors and an area limit. Choose binary alpha for sprite edges and explicitly name any permitted effect exceptions. |
| Tiles and seams | Specify edge grammar: e.g. 16 N/E/S/W masks plus four inner-corner patches, or a full 47-tile blob set; do not mix the two implicitly. Define water banks, dirt/grass joins, concave/convex corners, bridge endcaps, and cliff height. Propose 3 ground variants and 2 detail variants per terrain; maintain identical edge pixels and base lighting. Farms share the same 16x16 grid, with clear dry/wet/growth states. Preview repeats as a 3x3 patch before approval. |
| UI and text | Propose a 12x12 9-slice source with fixed 4 px corners/borders; repeat or nearest-scale only its center and edge spans. Choose a licensed pixel font or original glyphs, e.g. 6x8 glyphs at 8 logical px, 10 px line height, 4 px padding. Set a bottom dialogue box, e.g. 304x48 at (8,124), max 3 lines, wrapping/overflow behavior, colors and focus/disabled states. Keep text legible without CRT effects. |
| Scene grammar | Describe uncluttered traversable top-down terrain, the two opposing platforms and front/back sprite roles in battle, enterable A-frame proportions/interior occlusion, furniture footprints, and readable farm stages. Specify reserved screen space for dialogue and battle UI. These are original layouts, not copies of reference scenes. |
| Animation | Define cells, order, directions, timing, looping, and anchors. Proposed counts: overworld idle 2 frames and walk 4 per direction (down/left/right/up); battle idle 2, attack 4, hit 2, faint 4; water 4; crop growth 4 static states, not timed animation. Give exact fps or holds, e.g. walk 8 fps, idle 3 fps, water 4 fps. Keep the contact point and cell size fixed across frames. |
| Rendering and delivery | Nearest-neighbor sampling and integer scale; PNG RGBA at logical resolution; fixed sheet layout/naming; no baked scanlines, glow, chromatic aberration, text, or vignette in sprites. Apply the CRT look once to the composed scene; review its strength with UI visible. |

Add a short **do / don't** list tied to this profile. Examples: do use broad readable silhouettes, sparse clustered texture, shared ramps, consistent anchors, and original creatures; don't add new colors per asset, blur pixel edges, mix perspectives, copy recognizable characters, or use photographic detail inside pixel sprites.

## Reuse the profile for each asset

Compose prompts from stable profile rules plus the requested subject. Use the actual palette values, dimensions, view, outline width, light direction, transparency, and frame layout; a generator cannot read an unprovided local `docs/visual/style.md`. Attach a small approved reference set only when the tool accepts it and the task authorizes generation. A prompt requesting exact pixels does not guarantee them; inspect and normalize the result.

Example templates (replace braces with approved values):

- **Creature:** "Original gentle burrowing creature, {distinct anatomy}, {overworld or battle view}, {width}x{height} logical pixels, {profile palette hexes}, 1 px dark colored silhouette, upper-left light, compact pixel clusters, transparent background, {facing and ground anchor}, one pose, no lettering."
- **Terrain:** "Original seamless grass tile, {tile size}, {grass ramp hexes}, {edge mask}, {variant number}, sparse flowers within the accent budget, same upper-left light, crisp pixel clusters, no perspective or border decoration."
- **Interior:** "Original cozy A-frame interior module, {footprint in tiles}, {wood/stone/UI hexes}, {camera rule}, rounded wooden furniture and plants with clear walking space, upper-left ambient light plus {approved lamp exception}, {grid and outline rules}, no copied room layout or characters."

For Midjourney specifically, style images use `--sref` and boards use `--p <ID/code>`; `--moodboard` is not a documented parameter. Treat composition as a separate constraint. Lock model/settings and the resolved board/style code for a batch; don't add `--sw` or `--sv` to moodboard jobs. Recheck current compatibility if using the service. The local profile remains the authority for exact pixels. See [Style Reference](https://docs.midjourney.com/hc/en-us/articles/32180011136653-Style-Reference) and [Moodboards](https://docs.midjourney.com/hc/en-us/articles/39193335040013-Moodboards). This skill does not require Midjourney or authorize paid calls or uploads.

Snap an already generated or hand-made image to the approved palette without resizing or dithering:

```powershell
node .claude/skills/moodboard/scripts/palette.mjs quantize .scratch/moodboard/input.png --palette docs/visual/style.md --out .scratch/moodboard/input-snapped.png
```

The helper preserves dimensions and alpha, maps visible RGB to the nearest palette entry in RGB distance, and emits a new PNG. It refuses to overwrite the input. Alpha is preserved rather than repaired: reject unintended semitransparent edges if the profile requires binary alpha. Palette snapping cannot fix perspective, jagged anatomy, incorrect tile joins, or inconsistent pixel grids; clean those separately.

Before accepting each asset:

- [ ] Original subject and silhouette; no recognizable borrowed character, name, logo, or copied layout.
- [ ] Correct logical dimensions, view/facing, tile footprint, padding, and anchor; pixel edges remain sharp at 1x and integer display scale.
- [ ] Visible RGB belongs to the canonical palette; material ramps, outline thickness, hue shifts, lighting, and alpha match the profile.
- [ ] Texture/dithering density matches neighboring assets; silhouette and value contrast read against actual terrain and UI backgrounds.
- [ ] Tiles join on every specified edge/corner and repeat cleanly; battle platforms, room paths, and farm states remain legible.
- [ ] Animation uses the agreed cells, directions, frame counts, timing, stable contact points, and transparency without jitter.
- [ ] UI 9-slices retain corner widths; sample dialogue wraps without clipping; CRT rendering preserves text and important colors.
- [ ] Compare beside two approved assets. Record any exception in the profile before treating it as a new convention.

Deliver the profile, palette artifacts if requested, and a short list of unresolved art choices. Generate game assets only when requested by the active task.
