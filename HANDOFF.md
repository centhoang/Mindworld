# HANDOFF: Mindworld rework v2 (2026-10-29 ~14:00 UTC+7)

**Fresh-session starting prompt (user pastes it):** "Read HANDOFF.md and docs/REWORK.md. Do Next actions 1-3: integrate Codex ImageGen pass 2, finish the v1 port, then make pixel.html the index and drop three.js. Follow CLAUDE.md (Normal mode, 35% context limit)."

## State
- Pixel build (`client/pixel.html`, `client/src/pixel/`) now has the approved art bible (docs/STYLE.md) plus ImageGen art. Tests: client 192 pass, tsc clean. Deployed privately (Access) at https://pets.uryto.dev/pixel.html, version ad4e6e1f. The user was asked to play-test it; no feedback yet.
- Commits this session: 16714c9 art bible applied (STYLE.md tiles with shore/path masks, A-frame, trees, 6x8 bitmap font, 9-slice frame, monster palette ramps) + battle menu Fight/Teach/Swap/Run · 7731b2b farm (`game/farm.ts`) + A-frame interior (`game/room.ts`, `pixel/interior.ts`: Tab = decorate, crate = ship harvest / buy seeds) · 33e2378 babble (M = mute), wild re-teach memos, talk to wild pets (E, /api/chat), pet-to-pet chatter at home · 4ea84a6 boss The Reader + Elder NPC · 41f9bd6 ghost stone (event island) + auto-share ghost + live-room peers/room chat · 21393bc pet brain (Instinct; B = local Llama 1B WebGPU / 3B power mode; ?cloudmoves) · ece0443 ImageGen player walk (4 frames), furniture props, wheat/carrot/tomato crops.
- Codex ImageGen WORKS from `scripts/codex.ps1` (pass 1: 7 calls; assets in `.scratch/art/gen/`, contact sheet `contact-4x.png`). Pass 2 RUNNING in the background (brief `.scratch/codex-imagegen2-brief.md`, report -> `.scratch/imagegen2-codex.md`, finals -> `.scratch/art/gen2/`): empty cabin background on the 16 px floor grid, Mallow/Sprig back views, market stall, Elder sprite.
- Art in game: `client/public/art/*.png` (copied from `.scratch/art` and `.scratch/art/gen`). `pixel/art.ts` loads them (`loadArt` runs before the first frame); sprites that need art are created lazily (player getter) because scenes are built before the load finishes.
- Credits: Meta $149.91, Modal ~$110, Baseten ~$0.15 used. No paid calls this session beyond normal play.

## Decisions made
- v2 = plain Canvas2D + WebGL2 CRT; 3D dropped (user approved docs/REWORK.md). STYLE.md palette (28 colors) is canonical; new colors need a versioned entry there.
- Battle: Fight = watch the pet play its memo (memo rule first, then local Llama if loaded, else reflex); Teach opens the Teach screen mid-battle; Swap = next party member; Run.
- Farm: 6 beds, one watering per stage, real-time growth (wheat 45 s, carrot 90 s, tomato 180 s per stage), the shipping crate inside the A-frame sells crops and seeds.
- Room: 12x6 floor cells, rugs walkable/under furniture, door + crate cells always clear.
- Earlier decisions stand (see git history of this file): browser-first, Meta models via Worker proxy with spend cap, eval uses deterministic memoPolicy, no Unity, repo public Nov 3.

## Pending decisions (user)
- Play-test feedback on the v2 pixel build (art, battle menu, farm, interior).
- When to go public (remove Access) and make pixel the main page.

## Next actions
1. When pass 2 lands: read `.scratch/imagegen2-codex.md` + `gen2/contact-4x.png`; use `interior-empty.png` as the room background in `pixel/interior.ts` (replace `drawRoom()`, floor rect FX 96 / FY 104), back views for the player's pet in battle when the genes look like Mallow/Sprig (or as the starter pet), the market stall on the market island (shop decor + seeds there too), the Elder sprite instead of the monster stand-in.
2. Finish the v1 port: live duels (pet vs pet with a shared seed, `sim/duel.ts`, LiveLink challenge/accept), onboarding (hatch + first hints + goals card from `game/onboard.ts`), voice input for Teach (`game/voice-input.ts`), outdoor plot decor/market (`game/decor.ts`, `game/shop.ts`), emotes.
3. Make `pixel.html` the index (vite input + Worker routes), delete the three.js files (`src/main.ts`, `world/view.ts`, `grass.ts`, `aframe.ts`, `game/scene.ts`, `style.ts`) and the `three` dependency; keep tests green; redeploy behind Access.

## Gotchas
- Codex: pass long briefs as a file ("Read .scratch/x.md and do it"); run from the PowerShell tool with `-Sandbox workspace-write` for ImageGen; its output can be truncated (rerun once).
- Python edits through bash heredocs can fail on `'''` strings: write the script with Write into the scratchpad and run it.
- Dev hook `window.__px` = {world, battleView, interior, update, keys, setCrt, state, fight}. Hidden pane: screenshots are stale; call `__px.update(dt,t)` (and `await 0` in loops) before a screenshot. Editing a pixel file full-reloads vite and resets the run.
- `/api` needs the Worker on 8787 (`client-dev` proxies); without it chat/ghosts use offline fallbacks (fine for UI checks).
- Small Muse calls burn reasoning tokens: maxTokens >= 400. Bulk teacher runs: see git history of this file. Never commit `.env`.

## File map
docs/{EVENT,PLAN,REWORK,STYLE,DEPLOY,...}.md · client/pixel.html · client/src/pixel/{main,art,tiles,text,overworld,battle,interior,teach,menu,monster,crt}.ts · client/src/game/{farm,room,party,save,coach,instinct,voices,npc-chat,pet-chat,babble,ghost-api}.ts · client/public/art/ · worker/ · scripts/codex.ps1 · .scratch/art/{,gen,gen2}/
