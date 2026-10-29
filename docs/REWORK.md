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
