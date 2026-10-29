# HANDOFF: Mindworld rework v2 (2026-10-29 ~19:30 UTC+7)

**Fresh-session starting prompt (user pastes it):** "Read HANDOFF.md and docs/V3-BRIEF.md. Do Next action 1: research and write docs/V3-PLAN.md, then stop for my review. Follow CLAUDE.md (Normal mode, 35% context limit)."

## State
- The pixel build IS the game now: `client/index.html` -> `src/pixel/main.ts`. three.js and the 3D view are deleted; `/pixel.html` 301-redirects to `/` (Worker). Bundle: main 112 KB (44 KB gz); the 6 MB `lib-*.js` is WebLLM, lazy-loaded only on B.
- Tests: client 187 (6 grass tests went with grass.ts), worker 149, tsc clean. Build OK.
- Deployed behind Access: https://pets.uryto.dev/ = the pixel game, version 8f84b901 (2026-10-29, play-test fixes). Redeploys are standing-approved (CLAUDE.md "Decide vs. ask"): run `npm --prefix client run build`, then `npx wrangler deploy` in worker/, as two plain commands.
- Commits this session: f6f6492 ImageGen pass 2 (cabin background `interior-empty.png`, Elder 2-frame idle, market stall on the Market island with E = buy/sell menu; player walk rebuilt in code) · d22590e v1 port (live duels, emotes 1-4, voice lessons in Teach, first-run hatch line + hints, goals card G) · 64df3db index swap + three.js removed.
- Credits: Meta $149.91, Modal ~$110, Baseten ~$0.15. No paid calls this session.

## Decisions made
- **Art: Codex ImageGen = static art only** (user feedback 2026-10-29: the style looks great, but Codex animation is wrong). Claude does every animation, VFX and lighting in code. Example: the player walk uses only frame 0 of each `player-walk.png` row; `makePlayer()` in `pixel/art.ts` builds the 4-frame cycle (1 px bob, one leg lifted, the other planted).
- Play-test 1 fixes (c9f7b93): E order = door, bed, Elder, stall, player, wild (hint over your head matches). Live presence + duels use the ACTIVE pet (LiveLink.rejoin on swap); peers with your own genes (your other tabs) are hidden. Player legs are drawn per frame in `art.ts` (frontLegs/sideLegs); only hat-to-hips comes from the ImageGen sheet. Hidden preview tabs join the local room as idle players: close them after live tests.
- Mallow/Sprig back views (`monster-*-back.png`) are copied but NOT used: pets are procedural from genes, so a fixed back sprite would not match the pet's front/overworld look. Use them only if a fixed starter species with front + overworld art is added.
- Duels: E next to an online player opens Duel / Wave / Heart / Dance / Laugh / Say. The invite is an Accept/Decline box (20 s timeout). The shared-seed `duelView` plays on the battle screen; coins come from `duelCoins`. Emotes show as speech bubbles ("*waves*", "<3 <3"), because the bitmap font has no emoji.
- Onboarding: the first run shows the hatch line plus 3 `PIXEL_HINTS` (6 s each, Esc skips), marked seen afterwards. Goals card top-left (`pixelGoals`: teach, befriend, grow+sell, boss; `steps.shipped` added to the save), hidden while a menu is open or when all are done.
- Outdoor plot decor (`game/decor.ts` porch/plot slots) NOT ported: next in the cut order, and it needs static ImageGen art for the outdoor items (sunflower, pond, birdhouse).
- Earlier decisions stand: Canvas2D + WebGL2 CRT, STYLE.md palette canonical, browser-first, Meta models via the Worker proxy with a spend cap, repo goes public Nov 3.

## Pending decisions (user)
- Play-test the new build (cabin, market stall, Elder, walk cycle, duel in two tabs, goals card, Speak button in Teach).
- When to go public (remove Access).

## Next actions
1. **v3 research + plan (user request 2026-10-29 evening):** follow `docs/V3-BRIEF.md`: players' grounds that join into one world (unique shapes, rare in-between grounds, themes), real-time mind-to-mind chat on the local model, GARP-style minds (personality, hobbies, daily plan, memory, relationships, emotes), an NPC mind model plus hosting NPC minds on players' machines with handover, needs-driven activities for pets and humans, arm swing + still idle, Codex static map art per theme. Output: `docs/V3-PLAN.md` with scope, a cut line for the Nov 3 demo, architecture, costs, stages and at most 3 user decisions. Then STOP for the user's review; build nothing before the OK.
2. After the plan is approved: build stage 1 (likely needs/activities sim + the limb rig with arm swing/idle, both pure-code and safe), then follow the plan's stages, each ending with a play-test ask.
3. Still open from v2 (fold into the plan's ranking): mobile controls (touch D-pad + A/B), VFX polish, demo prep (README credits, 3-min script, CRT-on captures).

## Gotchas
- Codex: pass long briefs as a file; `-Sandbox workspace-write` for ImageGen; output can be truncated (rerun once). Ask for static frames only.
- Dev hook `window.__px` = {world, battleView, interior, update, keys, setCrt, state, fight, live}. In a hidden pane rAF stalls: call `__px.update(dt,t)` (plus `await 0`) before screenshots. Two-tab duel test: preview tabs share localStorage (same pet); live needs the Worker on 8787 (`worker-live` in launch.json).
- Python edits: write the script to `.scratch/` and run it (heredoc quoting breaks on `'''`).
- Small Muse calls burn reasoning tokens: maxTokens >= 400. Never commit `.env`.

## File map
docs/{EVENT,PLAN,REWORK,V3-BRIEF,STYLE,DEPLOY,FINETUNE}.md · info-ref/ (GARP transcript) · client/index.html · client/src/pixel/{main,art,tiles,text,overworld,battle,interior,teach,menu,monster,crt}.ts · client/src/game/{farm,room,party,save,onboard,coach,instinct,voices,voice-input,npc-chat,pet-chat,babble,ghost-api}.ts · client/src/sim/duel.ts · client/src/world/live.ts · client/public/art/ · worker/ · scripts/codex.ps1 · .scratch/art/{,gen,gen2}/
