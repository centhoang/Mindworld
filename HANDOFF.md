# HANDOFF: Mindworld rework v2 (2026-10-29 ~19:30 UTC+7)

**Fresh-session starting prompt (user pastes it):** "Read HANDOFF.md. Do Next actions 1-3. Follow CLAUDE.md (Normal mode, 35% context limit)."

## State
- The pixel build IS the game now: `client/index.html` -> `src/pixel/main.ts`. three.js and the 3D view are deleted; `/pixel.html` 301-redirects to `/` (Worker). Bundle: main 112 KB (44 KB gz); the 6 MB `lib-*.js` is WebLLM, lazy-loaded only on B.
- Tests: client 187 (6 grass tests went with grass.ts), worker 149, tsc clean. Build OK.
- NOT redeployed: `wrangler deploy` was blocked by the permission classifier; the user runs it (or allows it). Live https://pets.uryto.dev still serves the old build (version ad4e6e1f, pixel at /pixel.html).
- Commits this session: f6f6492 ImageGen pass 2 (cabin background `interior-empty.png`, Elder 2-frame idle, market stall on the Market island with E = buy/sell menu; player walk rebuilt in code) · d22590e v1 port (live duels, emotes 1-4, voice lessons in Teach, first-run hatch line + hints, goals card G) · 64df3db index swap + three.js removed.
- Credits: Meta $149.91, Modal ~$110, Baseten ~$0.15. No paid calls this session.

## Decisions made
- **Art: Codex ImageGen = static art only** (user feedback 2026-10-29: the style looks great, but Codex animation is wrong). Claude does every animation, VFX and lighting in code. Example: the player walk uses only frame 0 of each `player-walk.png` row; `makePlayer()` in `pixel/art.ts` builds the 4-frame cycle (1 px bob, one leg lifted, the other planted).
- Mallow/Sprig back views (`monster-*-back.png`) are copied but NOT used: pets are procedural from genes, so a fixed back sprite would not match the pet's front/overworld look. Use them only if a fixed starter species with front + overworld art is added.
- Duels: E next to an online player opens Duel / Wave / Heart / Dance / Laugh / Say. The invite is an Accept/Decline box (20 s timeout). The shared-seed `duelView` plays on the battle screen; coins come from `duelCoins`. Emotes show as speech bubbles ("*waves*", "<3 <3"), because the bitmap font has no emoji.
- Onboarding: the first run shows the hatch line plus 3 `PIXEL_HINTS` (6 s each, Esc skips), marked seen afterwards. Goals card top-left (`pixelGoals`: teach, befriend, grow+sell, boss; `steps.shipped` added to the save), hidden while a menu is open or when all are done.
- Outdoor plot decor (`game/decor.ts` porch/plot slots) NOT ported: next in the cut order, and it needs static ImageGen art for the outdoor items (sunflower, pond, birdhouse).
- Earlier decisions stand: Canvas2D + WebGL2 CRT, STYLE.md palette canonical, browser-first, Meta models via the Worker proxy with a spend cap, repo goes public Nov 3.

## Pending decisions (user)
- Play-test the new build (cabin, market stall, Elder, walk cycle, duel in two tabs, goals card, Speak button in Teach).
- Approve the redeploy (`cd client && npm run build`, then `cd ../worker && npx wrangler deploy`).
- When to go public (remove Access).

## Next actions
1. After the play-test feedback: fix what the user reports. Then mobile controls (touch D-pad + A/B buttons drawn in-canvas; portrait layout), because judges may open it on a phone.
2. Polish VFX/lighting in code (Claude, not Codex): battle hit sparks and dust puffs, water sparkle, the window light shaft in the cabin swaying, day tint. Optional ImageGen STATIC batch (brief as a file, review the contact sheet): outdoor decor items, a few emote icons (16x16), a duel banner.
3. Demo prep: README credits (ImageGen art, CC0 if any), the 3-min demo script draft (opening line: what pre-existed vs what was built this week), capture shots with CRT on.

## Gotchas
- Codex: pass long briefs as a file; `-Sandbox workspace-write` for ImageGen; output can be truncated (rerun once). Ask for static frames only.
- Dev hook `window.__px` = {world, battleView, interior, update, keys, setCrt, state, fight, live}. In a hidden pane rAF stalls: call `__px.update(dt,t)` (plus `await 0`) before screenshots. Two-tab duel test: preview tabs share localStorage (same pet); live needs the Worker on 8787 (`worker-live` in launch.json).
- Python edits: write the script to `.scratch/` and run it (heredoc quoting breaks on `'''`).
- Small Muse calls burn reasoning tokens: maxTokens >= 400. Never commit `.env`.

## File map
docs/{EVENT,PLAN,REWORK,STYLE,DEPLOY}.md · client/index.html · client/src/pixel/{main,art,tiles,text,overworld,battle,interior,teach,menu,monster,crt}.ts · client/src/game/{farm,room,party,save,onboard,coach,instinct,voices,voice-input,npc-chat,pet-chat,babble,ghost-api}.ts · client/src/sim/duel.ts · client/src/world/live.ts · client/public/art/ · worker/ · scripts/codex.ps1 · .scratch/art/{,gen,gen2}/
