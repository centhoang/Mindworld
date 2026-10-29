# HANDOFF: Mindworld v3, stages 1-2 done, stage 3 started (2026-10-29 ~23:45 UTC+7)

**Fresh-session starting prompt (user pastes it):** "Read HANDOFF.md and docs/V3-PLAN.md (approved). Continue v3 stage 3 (grounds world) from Next actions. Follow CLAUDE.md (Normal mode, 35% context limit)."

## State
- **Deployed behind Access:** https://pets.uryto.dev/ version 0301b847 (stages 1+2). Redeploys standing-approved: `npm --prefix client run build`, then `npx wrangler deploy` in worker/ (two plain commands).
- **Tests:** client 215 (incl. life 13, mind 11, ground 4), worker 149, tsc clean, build OK (2026-10-29 late).
- **Stage 1 (591f7d9):** `client/src/life/` = clock (1 day = 12 real min), needs, 14 activities, village sim (idle -> walk -> wait/gathering -> do; late joiners; cancel after 25 s), relations. Residents at home live on it; `pixel/life-draw.ts` poses + bowl/poop/ball + day/night tint; E on poop = clean. Player sheet 6 columns (4 walk with arm swing + 2 idle) via `spriteFrame()` in `art.ts`.
- **Stage 2 (33fb9d5):** `client/src/mind/` = persona (from genes; traits bias the sim via `Env.bias`; `VILLAGERS` Elder/Mo/Ama/Pip authored), memory (log 30 + facts 6 + plan), brain (plan/choose/line/emote/reflect prompts + GBNF grammars + parsers + scripted fallbacks), scheduler (one queue per machine: priority, deadline race, duty cap 0.7, paused in battle), hub (chooser async: `undefined` = thinking; talk 2-4 lines with "..." bubble; invitations spread into the friend's plan; emotes after shared fun; reflection at sleep; save `petmind.minds.v1`). Model = whatever B loaded (native 3B or WebLLM 1B; `complete()` added to both). Inspector = I near a pet (`pixel/inspector.ts`). WebLLM load now warms up (first call ~33 s shader compile).
- **Measured in the hidden preview pane (throttled):** grammar choice 2.2 s, a talk line 6-12 s; model plan + lines verified ("I'm so happy to meet you Mallow."). Visible tabs should be faster.
- **Stage 3 started (49b216c):** `world/ground.ts` `groundFromSeed` (unique island, mainland only, no holes, theme meadow/autumn/snow, N/E/S/W gates) + tests. Not wired into the map yet.
- Credits: Meta $149.91, Modal ~$110. No paid calls this session.

## Decisions made
- V3-PLAN approved 2026-10-29, all three decisions = (a): stock 1B serves every mind in the browser + optional village LoRA for power mode (~$6, stage 5); ghost ground 10 min then slot freed; mobile + outdoor decor below the line. Backlog after the event: extra themes + real mini-games first.
- Codex ImageGen = static art only; Claude does all animation/VFX in code.
- Minds never run inside an activity: they only pick from `validChoices` (top 5 by score); every decision has a fallback, so no model = same village, less personal. Inspector labels the source honestly ("RULES (B: LOAD LLAMA)").
- Pet mind ids = pet names (party swaps keep the mind). `life/` is separate from `sim/` (combat).
- Earlier: Canvas2D + WebGL2 CRT, STYLE.md palette, browser-first, Meta models via the Worker proxy with a spend cap, repo public Nov 3.

## Pending decisions / user actions
- Play-test stages 1+2: party of 2+ pets, stand by the house, I = inspector, B = load Llama, watch them plan/talk/play ball; poop + E; night after ~9 min.
- When to go public (remove Access); make the HF coach repos public (power-mode download).

## Next actions
1. **Stage 3 (grounds world):** rework `world/layout.ts` + `pixel/tiles.ts` so your home is your own `groundFromSeed` ground (seed saved once), players' grounds sit on a ring of slots around the hub (slot = server `corner`, raise slots to 24 in `worker/src/room.ts`, send `groundSeed`/`theme` in hello/welcome/join), bridges gate-to-gate, ghost ground 10 min on leave, in-between grounds by `roll(roomSeed, slotPair, day)` (playground 30 / picnic hill 25 / fishing pond 25) with spots for soccer/picnic/fish. Themes by recolour first; Codex art batch 1 (V3-PLAN section 5). Tests for layout + room messages. Then play-test ask (two tabs).
2. **Stage 4:** networked minds per V3-PLAN 4.4 (`mind` relay, NPC host election in the room DO, handover with stored state, villagers Mo/Ama/Pip need human sprites).
3. Stage 5 (fine-tune, background) + stage 6 (polish, README, demo script, captures).

## Gotchas
- **GPU:** reloading the page while WebLLM generates can kill the D3D12 device ("DXGI_ERROR_DEVICE_REMOVED" / "object disposed"); fix = close the tab, open a new one. Stop update loops before reloading.
- Dev hook `window.__px` = {world, battleView, interior, update, keys, setCrt, state, fight, live, mindSched, webBrain}. Hidden pane: rAF stalls, drive `__px.update(dt,t)` from a setInterval; JS calls time out at 45 s, so split waits. `world.setResidents([...])` injects test pets.
- Python edits: write the script with the Write tool to `.scratch/` and run it (bash heredocs break on `'''`).
- Codex: long briefs as a file; `-Sandbox workspace-write` for ImageGen; static frames only. Muse calls: maxTokens >= 400. Never commit `.env`.

## File map
docs/{V3-PLAN,V3-BRIEF,EVENT,STYLE,DEPLOY,FINETUNE,SPIKES,CREDITS}.md · info-ref/ (GARP transcript, untracked) · client/src/life/{clock,needs,activities,village,relations}.ts · client/src/mind/{persona,memory,brain,scheduler,hub}.ts · client/src/world/{layout,ground,live,movement}.ts · client/src/pixel/{main,art,overworld,life-draw,inspector,tiles,text,battle,interior,teach,menu,monster,crt}.ts · client/src/game/{voices,instinct,grammar,...}.ts · worker/src/{room,room-do}.ts · scripts/codex.ps1 · .scratch/v3/ (prototype + edit scripts)
