# Visuals: cozy look for Mindworld (research 2026-10-29)

Goal: cozy, cute, beautiful at first sight (judges, X clips), fine on an iGPU, small bundle.

## Pick: procedural, in code (no downloaded assets for now)
All world and pet meshes are already procedural three.js. Keep it that way: zero asset weight, no license risk,
one consistent style. Assets only if a specific prop (A-frame house decor, furniture) looks too plain in code.

## Techniques chosen (all in `client/src/world/view.ts`, `client/src/game/scene.ts`)
| Technique | How | Why |
|---|---|---|
| Warm pastel palette | One shared palette (cream, peach, mint, lilac, sky blue, honey) | Cohesion matters more than detail |
| Gradient sky | Big back-side sphere with a 2-color vertical gradient shader (+ matching `Fog`) | Instant mood, 1 draw call |
| Toon shading | `MeshToonMaterial` with a 3-step `gradientMap` (DataTexture, NearestFilter) | Soft "cel" look, cheap |
| Rounded shapes | Islands = low-segment cylinders with a bevelled grass cap + rocky cone underside; bridges = planks + rope posts | Floating-island read, cute silhouettes |
| Soft shadows | One directional light, `PCFSoftShadowMap`, 1024 map, tight frustum around the world | Grounds characters; one shadow map is iGPU-safe |
| Hemisphere light | Warm sky / cool ground | Fills shadows with colour instead of grey |
| Clouds under islands | Instanced puffy spheres (few dozen), slow drift | Sells "floating" without water shaders |
| Idle motion | Sine bob/breathing scale on pets, NPCs, avatar; bob for floating islands | Life at zero cost |
| Ambient particles | `Points` fireflies/petals with a soft round sprite drawn on a canvas, additive blend | Sparkle in screenshots, 1 draw call |
| Labels | Canvas-sprite labels with rounded pill background | Readable on any background |
| Perf caps | `setPixelRatio(min(dpr, 1.5))`, no post-processing (bloom skipped), antialias on | iGPU target |

Skipped: bloom/SSAO post-processing (EffectComposer costs a full-screen pass each, risky on iGPU); outline
pass (inverted-hull outlines can be added per mesh later if wanted).

## Free asset packs (if ever needed; verify the license on the official page before downloading)
| Source | License | Notes / credit line |
|---|---|---|
| Kenney (kenney.nl) | CC0 | Huge, consistent low poly. Credit (optional): "Assets by Kenney (kenney.nl), CC0" |
| KayKit (kaylousberg.itch.io) | CC0 for free packs | Cute chunky style, fits best. Credit (optional): "KayKit by Kay Lousberg, CC0" |
| Quaternius (quaternius.com) | Older packs CC0; site now has a "Quaternius Asset Licence" for new assets | Check per pack; prefer older CC0 packs |
| Poly Pizza (poly.pizza) | Per model: CC0 or CC-BY | Only take CC0; CC-BY needs a credit line |
Rule: CC0 only, each pack in its own new folder (e.g. `client/public/assets/<pack>/`), glTF/GLB, small.

## Tools
SearchSkills: none. SearchPlugins: `parallax-threejs` (three.js debugging, not installed; not needed).

## Implemented (2026-10-29)
- `client/src/game/style.ts`: palette `PAL`, `toon()`, `skyTexture()`, `setupRenderer()` (pixel ratio <= 1.5, PCF soft shadows),
  `addLights()`, `makeIsland()`, `Clouds` (instanced), `Motes` (fireflies/petals), `labelSprite()`, `mergeStatic()`.
- World: static meshes merged per material after `build()` (draw calls ~1.3k -> ~310 incl. shadow pass; ~14 ms/frame in the pane).
  Anything added to `root` after `build()` stays unmerged; add new static props inside `build()`/`furnish()` to get merged.
- UI: light cream panels, Nunito from Google Fonts (external request; falls back to Trebuchet/system).
