# HANDOFF: Mindworld v3, stages 1-3 done, stage 4 next (2026-10-29 late)

**Fresh-session starting prompt (user pastes it):** "Read HANDOFF.md and docs/V3-PLAN.md (approved). Continue v3 stage 4 (networked minds) from Next actions. Follow CLAUDE.md (Normal mode, 35% context limit)."

## State
- **Deployed behind Access:** https://pets.uryto.dev/ version cc30d421 (stages 1-3). Redeploys standing-approved: `npm --prefix client run build`, then `npx wrangler deploy` in worker/ (two plain commands).
- **Tests:** client 218, worker 152, tsc clean, build OK.
- **Stage 1 (591f7d9):** `client/src/life/` = clock (1 day = 12 real min), needs, 14 activities, village sim (idle -> walk -> wait/gathering -> do; late joiners; cancel after 25 s), relations. Residents at home live on it; `pixel/life-draw.ts` poses + bowl/poop/ball + day/night tint; E on poop = clean. Player sheet 6 columns (4 walk with arm swing + 2 idle) via `spriteFrame()` in `art.ts`.
- **Stage 2 (33fb9d5):** `client/src/mind/` = persona (from genes; traits bias the sim via `Env.bias`; `VILLAGERS` Elder/Mo/Ama/Pip authored), memory (log 30 + facts 6 + plan), brain (plan/choose/line/emote/reflect prompts + GBNF grammars + parsers + scripted fallbacks), scheduler (one queue per machine: priority, deadline race, duty cap 0.7, paused in battle), hub (chooser async: `undefined` = thinking; talk 2-4 lines with "..." bubble; invitations spread into the friend's plan; emotes after shared fun; reflection at sleep; save `petmind.minds.v1`). Model = whatever B loaded (native 3B or WebLLM 1B; `complete()` added to both). Inspector = I near a pet (`pixel/inspector.ts`). WebLLM load now warms up (first call ~33 s shader compile).
- **Measured in the hidden preview pane (throttled):** grammar choice 2.2 s, a talk line 6-12 s; model plan + lines verified ("I'm so happy to meet you Mallow."). Visible tabs should be faster.
- **Stage 3 (ae974b3):** `world/ground.ts` seeded 26x20 grounds (fixed oval yard for house/beds). `world/layout.ts`: hub ring 0-1 (plaza centre, event N, wild E, market S, npc W, boss NE, 3 wild diagonals); `SLOTS` = 24 cells ring>=2 with i+j odd (checkerboard: grounds never touch); gap cells next to 2+ grounds get `rollBetween(roomSeed, cell, worldDay)` playground/picnic/pond (with `spots`); BFS stepping chain (in-betweens/islets) keeps all bridged; bridges gate-to-gate on centre line +0.5. `tiles.ts` stamps per platform, `look` = theme|AWAY. `art.ts themed()` palette-swaps greens (autumn/snow); ghost grounds dimmed. Overworld `relayout()` moves home stuff + pets by the slot delta. Server: `CORNERS` 24, hello `groundSeed`, `away` msg + welcome `aways` (ttl), ghosts 10 min in DO storage, same seed reclaims its slot. Codex props sheet `props-grounds.png` (+ `grounds-props.ts` rects; unused: dock, bushes, rocks, fence, sign, lights).
- Credits: Meta $149.91, Modal ~$110. No paid calls this session.

## Decisions made
- V3-PLAN approved 2026-10-29, all three decisions = (a): stock 1B serves every mind in the browser + optional village LoRA for power mode (~$6, stage 5); ghost ground 10 min then slot freed; mobile + outdoor decor below the line. Backlog after the event: extra themes + real mini-games first.
- Codex ImageGen = static art only; Claude does all animation/VFX in code.
- Minds never run inside an activity: they only pick from `validChoices` (top 5 by score); every decision has a fallback, so no model = same village, less personal. Inspector labels the source honestly ("RULES (B: LOAD LLAMA)").
- Pet mind ids = pet names (party swaps keep the mind). `life/` is separate from `sim/` (combat).
- Earlier: Canvas2D + WebGL2 CRT, STYLE.md palette, browser-first, Meta models via the Worker proxy with a spend cap, repo public Nov 3.

## Pending decisions / user actions
- **Play-test stage 3:** two different saves (normal + incognito window, same save = hidden), both on https://pets.uryto.dev/: each spawns on its own ground on the ring; walk via the square to the other's; close one -> its ground dims "(away)" for 10 min; reopen -> same slot back. In-between grounds appear between neighbours.
- Play-test stages 1+2: party of 2+ pets, stand by the house, I = inspector, B = load Llama, watch them plan/talk/play ball; poop + E; night after ~9 min.
- When to go public (remove Access); make the HF coach repos public (power-mode download).

## Next actions
1. **Stage 4:** networked minds per V3-PLAN 4.4 (`mind` relay, NPC host election in the room DO, handover with stored state, villagers Mo/Ama/Pip need human sprites).
2. Stage 3 leftovers: decor from the props sheet (bushes/rocks/sign with owner name/fence/lights), autumn/snow tree art (Codex batch 2), minimap.
3. Stage 5 (fine-tune, background) + stage 6 (polish, README, demo script, captures).

## Gotchas
- **GPU:** reloading the page while WebLLM generates can kill the D3D12 device ("DXGI_ERROR_DEVICE_REMOVED" / "object disposed"); fix = close the tab, open a new one. Stop update loops before reloading.
- Dev hook `window.__px` = {world, battleView, interior, update, keys, setCrt, state, fight, live, mindSched, webBrain}. Hidden pane: rAF stalls, drive `__px.update(dt,t)` from a setInterval; JS calls time out at 45 s, so split waits. `world.setResidents([...])` injects test pets.
- Layout changes rebuild the whole map (`relayout`); positions are global world coords (|x|,|z| <= 160). Wrangler deploy can fail once with code 10013: just retry.
- Python edits: write the script with the Write tool to `.scratch/` and run it (bash heredocs break on `'''`).
- Codex: long briefs as a file; `-Sandbox workspace-write` for ImageGen; static frames only. Muse calls: maxTokens >= 400. Never commit `.env`.

## File map
docs/{V3-PLAN,V3-BRIEF,EVENT,STYLE,DEPLOY,FINETUNE,SPIKES,CREDITS}.md · info-ref/ (GARP transcript, untracked) · client/src/life/{clock,needs,activities,village,relations}.ts · client/src/mind/{persona,memory,brain,scheduler,hub}.ts · client/src/world/{layout,ground,live,movement}.ts · client/src/pixel/{main,art,overworld,life-draw,inspector,tiles,text,battle,interior,teach,menu,monster,crt}.ts · client/src/game/{voices,instinct,grammar,...}.ts · worker/src/{room,room-do}.ts · scripts/codex.ps1 · .scratch/v3/ (prototype + edit scripts)
