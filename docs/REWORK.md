# Mindworld rework v2 (user decision 2026-10-29 ~11:00 UTC+7): supersedes the 3D plan below

User play-tested the 3D stage A/B build ("isn't my thing") and changed direction:
- **Overall vibe and features:** like `visual-ref/` (contact sheet `.scratch/visuals/ref-sheet.jpg`; interior `visual-ref/house-inside.webp`) plus the user backlog: bigger lands that bridges connect, monster-battle view, tamed = owned (switch active pet; others chill at home doing activities), corner farm (carrot seeds, plots, water, timed growth, sell at market; shop: slower/higher-value seeds, fertilizer, pesticide, chickens + feed -> eggs), enterable A-frame house with decor inside and outside.
- **Gameplay and visuals:** a **CRT 2D monster-collecting RPG** look (pixel art, top-down overworld, classic two-platform turn-based battle screen, CRT shader: scanlines, curvature, bloom, slight chromatic aberration). Original art, names and UI only: genre style, never copied assets/characters.
- **Consistent art style:** Codex researches and writes a project skill `.claude/skills/moodboard/` that works like a Midjourney moodboard (style references -> a reusable style profile: palette, pixel grid/scale, outline rules, lighting, shading ramps, sprite sizes, tile rules, UI frame rules, example prompts), as close in quality to a real moodboard as possible. Then Codex uses that skill to produce the consistent visuals the game needs (tiles, sprites, UI, portraits), and the build follows them.
- Keep from v1: snappy fights (memo rules decide instantly), Meta-model features (teach/coach, NPC + pet chat, wild re-teach cron, tuned Llama free coach), live room/duels, babble voices (fit retro well), save compatibility where practical.
- The next session starts with research + a written plan (user reviews it) before building.

## v2 plan (user approved 2026-10-29: plain canvas + own CRT, CC0 packs snapped to palette + procedural monsters, drop 3D entirely)

**Engine: plain Canvas2D at a low fixed resolution + one small WebGL2 CRT pass. Drop three.js.**
- Why: the game is a tile grid, sprites and text boxes. A ~1 KLOC renderer we own beats learning/fighting an engine with 6 days left; bundle drops by ~600 KB (three) instead of adding ~1 MB (Phaser 3). Pixel-exact, testable (render to an offscreen canvas in tests), works on the iGPU. Phaser 3 would give tilemaps/tweens/cameras for free but costs bundle, a PostFX learning curve and a second scene system next to ours. PixiJS v8 sits in between; not needed.
- Fallback when WebGL2 is missing: same low-res canvas scaled with `image-rendering: pixelated` + CSS scanline overlay.
- Three.js files go: `world/view.ts`, `world/grass.ts`, `world/aframe.ts`, `game/scene.ts` (battle view), `game/style.ts`.

**Pixel scale and screen**
- 16x16 tiles; internal height fixed at 216 px, width from the aspect (384 at 16:9, ~24x13 tiles), integer upscale (3x on 1080p, 4x on 1440p); portrait phones get a narrower world view, same 216 px height.
- Sprites: overworld player/pets 16x16 (pets up to 24x24), battle monsters 64x64 (front) and 48x48 (back), portraits 32x32 in text boxes, pixel font ~6x8/8x8 (CC0 or OFL).
- CRT pass (one fragment shader, toggle in settings, "off" = clean pixels): barrel curvature, scanlines at the internal row pitch, aperture mask, soft bloom (one blurred mip), vignette, slight RGB offset (<=1 px). Tunable strength so text stays readable; capture screenshots for the demo with it on.

**Scenes** (one tiny scene stack: overworld, battle, interior, menus as overlays)
- Overworld: top-down tile map built from `world/layout.ts` (big lands = islands of grass/path/flowers on water, bridges as tiles between them); wild pets wander and start fights on touch; other players' corners and live presence from `world/live.ts`; follow camera with pixel snapping; tall-grass/water/flower animated tiles.
- Battle: classic two-platform screen (foe top-right front sprite, own pet bottom-left back sprite), HP bars, bottom text box with the move menu (Fight / Teach / Swap / Run). Turn logic unchanged: `sim/battle.ts` + memo rules decide at once; animations = sprite shake/flash/slide, 2-3 frame hit effects. "Teach" opens the coach drawer (Meta model) as a text-box dialog.
- Interior: enter the A-frame by its door tile; a one-room 12x9 tile interior after `visual-ref/house-inside.webp` (warm wood, rug, plants, window light); decor placed on a grid (inside + the plot outside), saved per player.
- Owned pets: tamed = owned (party of up to 4, one active; the others idle at home doing small activities: sleep, eat, play).
- Farm: plots on the corner, carrot seeds, water, timed growth (real time, short), sell at the market; shop tiers (slower/higher-value seeds, fertilizer, pesticide, chickens + feed -> eggs). Pure logic module with tests first.
- UI: in-canvas text boxes and menus with a 9-slice frame (the style profile defines it); DOM only for text input (chat/teach) styled to match, so the CRT applies to everything that matters.

**Carries over unchanged** (no three.js imports): `sim/*` (battle, memo, cortex DSL, duel, ghost, boss, eval), `game/` logic (instinct, genes, grammar, chatter, npc-chat, pet-chat, voices, voice-input, babble, home, decor data, shop, onboard steps), `world/layout.ts`, `world/movement.ts`, `world/live.ts`, the Worker, spend caps, finetune + eval. `main.ts` (1.1 KLOC) gets split: game state/wiring stays, rendering calls move to the new renderer. Save format: keep keys, add `owned[]`, `farm`, `interior` with defaults.

**Art pipeline** (moodboard skill, Codex): refs -> `docs/STYLE.md` profile (palette ramps, grid, outline, light, UI frame) -> assets. Sources in order: CC0 16x16 packs that fit the profile (Kenney Tiny Town / Tiny Dungeon / Micro Roguelike, all CC0; credit in README anyway) snapped to our palette by the skill's quantizer; procedural modular monsters from `genes.ts` (body + ears + tail + pattern layers drawn as pixel parts, so every hatch is unique and on-palette); hand-checked by the user before the build relies on them. Refs are 3D cozy (warm greens, golden hour, soft light): the profile translates that into a bright, warm, low-contrast pixel palette, not a dark retro one.

**Stages** (each ends with a play-test ask)
- S1 (day 1): renderer core: low-res canvas, CRT pass + toggle, tile map from layout, player + active pet walking, camera, pixel font text box. Placeholder tiles from a CC0 pack. Play-test: walk around, CRT look on/off.
- S2 (day 1-2): battle screen wired to the existing sim and memo/teach; wild encounters; tame -> owned party; swap pet. Play-test: fight, teach, tame.
- S3 (day 2-3): art bible applied: final tiles, procedural monsters, UI frame, portraits; NPC + pet chat bubbles/text boxes; babble voices. Play-test: first-sight look (screenshot to the user first).
- S4 (day 3-4): A-frame interior + decor grid inside/outside; farm loop + shop + market; pets idling at home. Play-test: farm a carrot, decorate.
- S5 (day 4-5): live room (presence, other corners, duels) on the new renderer, mobile controls, perf pass, deploy privately, then demo capture (Nov 3). Buffer day for fixes before Nov 4 9 PM ET.
- Cut order if late: farm extras (chickens, pesticide) -> interior decor outside -> idle activities at home -> live duels (keep presence).

**Open questions for the user**: (1) Engine: plain canvas + own CRT shader (recommended) vs Phaser 3. (2) Art source: CC0 packs snapped to our palette + procedural monsters (recommended) vs fully generated/hand art (slower, riskier consistency). (3) OK to drop the 3D view entirely (no 3D toggle).

---

# Mindworld rework (user play-test 2026-10-29 morning)

Feedback: too much text/UI; combat lags each turn and sometimes freezes; art "ok, not stunning"; wants an enterable A-frame interior (ref `visual-ref/house-inside.webp`); decor feels AI slop; voices not friendly. Plus the user backlog (bigger lands, monster-battle view, tamed = owned, farm). Refs: contact sheet `.scratch/visuals/ref-sheet.jpg` (19 shots, regenerate with the script in this doc's history if lost).

## What the refs have in common (vibe targets)
- Lush, saturated yellow-green meadows with dense grass and white/yellow flower carpets; big round soft trees; warm golden light, long soft shadows; strong atmospheric fog to a pale horizon (depth).
- Low third-person camera close behind a chibi character: the land feels big. Not a top-down board.
- Seasonal palettes per area (spring green, autumn orange/red, golden sunset, night with stars).
- Almost no HUD: a thin compass on top, small round icons in corners, cards/menus only when used.
- Interiors: cutaway room on a raised wooden platform, cream walls, warm wood, green textiles, many plants, candles/stove glow, rugs; stairs in front.

## Smart, cheap ways to get there (three.js, no heavy assets)
1. Camera: low over-the-shoulder follow (lerped), slight FOV 50, fog near 25/far 110. Biggest single change.
2. Instanced grass: 1 blade geometry, ~40-60k instances via InstancedMesh, wind in the vertex shader, color gradient root->tip, density map per island; flowers = instanced quads in clusters. One draw call each.
3. Lighting: hemisphere + warm directional sun, ACES tone mapping, sRGB, gentle bloom on lights only; color grade (lift greens/yellows) in one cheap final pass.
4. Big islands (radius ~3x), gentle noise-height terrain, bridges become short links between lands; areas get palettes (meadow spring, boss autumn, elder golden, market sunset).
5. Trees/bushes: clusters of noise-displaced icosahedrons with a toon/gradient material, instanced.
6. Furniture + props: Kenney Furniture Kit and Nature Kit (CC0, glTF) for interior/decor if procedural looks cheap; credit in README.
7. Voices: cute "babble" synthesized per character with WebAudio (pitch/timbre from genes), browser TTS optional off by default.

## Stages (each ends with a play-test ask)
A. Perf + UI cut: rules-first chooser (model only when no rule fires, 1.5 s cap, runs during the tell animation), dispose meshes, precompile shaders, no per-frame layout reads; compact HUD with icon buttons, logs/brain/teach in drawers.
B. World vibe: camera, big lands, grass/flowers/trees, light/fog/grade, babble voices.
C. House: walk in the door -> cutaway interior scene; decor mode (grid place/rotate/remove real furniture inside, props outside), catalog with 3D thumbnails.
D. Battle: monster-battle layout (two platforms, info boxes, bottom action/teach bar), still the pet decides from its memo.
E. Tamed = owned (switch active pet; others chill at home with activities) + farm (plots, carrot seeds, water, timed growth, sell; shop: seeds with longer time/higher value, fertilizer, pesticide, chickens + feed -> eggs).
