DIRECTOR MODE ACTIVE since 2026-10-30 night (user asleep; no feedback given, so play-test items wait)

## Morning report
- W1 done + committed 0453db6 (decor, NPC->pet lines, sit pose); not deployed yet.
- W2 done: autumn/snow grass x3 + trees (Codex PNGs, recolour fallback); client tests 249.

## Queue (director runs these one worker at a time)
1. [x] W1 world polish (commit 0453db6, client tests 248): props-decor/props-grounds sheet decor on grounds (bushes, rocks, fence, party lights), seeded + paths kept clear; NPCs greet/talk to pets near them (scripted/mind line, rate-limited); human sit pose fix (no 3 px crop). Done = visible in build, tests added, all tests + tsc pass.
2. [x] W2 Codex batch 2 art: autumn + snow ground tiles and tree variants (STYLE.md), wired to themes by the theme key. Done = PNGs in client/public/art, themes use them, build OK.
3. [ ] W3 stage 5 prep (no training tonight): village-mind data-gen script through the cost wrapper (ledger, hard row/cost cap), mocked tests, a 40-row sample run <= $0.50; FINETUNE.md updated with the exact run commands. Training (~$2 Modal) waits for the user.
4. [ ] W4 stage 6 docs: README (what it is, how to play, Meta models used, pre-existing vs built this week, credits), docs/DEMO.md 3-min script draft for v3. No public actions.
5. [ ] Verify: client + worker tests, tsc, build, secrets scan; commit; deploy (standing-approved) if green.

## Decisions needing review
- Stray Worker deletion: still the user's (not touched).
- API spend tonight: $0 so far (cap $3).

# HANDOFF: Mindworld v3, stages 1-4 done + talk/relay polish; user play-test + review pending (2026-10-30 night)

**Fresh-session starting prompt (user pastes it):** "Read HANDOFF.md and docs/V3-PLAN.md (approved). I tested and reviewed: <feedback>. Apply it, then continue from Next actions. Follow CLAUDE.md (Normal mode, 35% context limit)."

## State
- **Deployed behind Access:** https://pets.uryto.dev/ = Worker `pet-mind` version **0f654d12** (everything below). Redeploys standing-approved: `npm --prefix client run build`, then `npx wrangler deploy` **inside worker/** (two plain commands). Check the output names `pet-mind` + `pets.uryto.dev`.
- **Tests:** client 237, worker 162, tsc clean, build OK (at 850f8b1; no code change since).
- **Stage 1 sim** `client/src/life/` (clock, needs, 14 activities, village sim, relations), poses in `pixel/life-draw.ts`. **Stage 2 minds** `client/src/mind/` (persona, memory, brain prompts+GBNF, scheduler one queue/machine, hub; inspector = I). **Stage 3 grounds** `world/{ground,layout}.ts` (seeded grounds on a 24-slot ring, in-between playground/picnic/pond per room+day, ghosts 10 min), minimap, gate name signs.
- **Stage 4 networked minds:** server `worker/src/npc.ts` NpcBoard elects NPC hosts (Elder/Mo/Ama/Pip); **model holders first**: once any player reports tps > 0 (`cap`, every 10 s), NPCs leave hosts without a model; balance only among model holders; quiet 15 s -> moved; NPC memory log in DO storage -> `npcState` to the new host. Room `mind {who, act?, say?, to?, emote?, invite?, mem?}` (owner/host only, 1 say / 3 s / mind) and `ask {npc,text}` -> host's `ask` (if its tps > 0) else `askNo`.
- Client `mind/npcs.ts` NpcVillage: the NPC sim runs on every machine; the host runs their minds (MindHub) and sends act/say/mem, others replay acts. Offline = minds run locally. `social()`: hosted NPCs **greet players** within 3 tiles (by name, 180 s per pair) and **chat with NPCs hosted elsewhere** (answers over the room via `to`, 3 turns). Player chat (E by any villager, `villagerAnswer` in main.ts): own mind here -> relayed to host's local model (15 s) -> Muse Spark `/api/chat` (event credits, server cap) -> scripted. `LiveLink.mind` queues spoken lines 3.1 s apart per mind (no more drops).
- Pets walk over bridges (`world/route.ts` BFS waypoints) to in-between grounds next to home; NPCs roam to any reachable one (Mo fishes at far ponds). **Shared clock**: `worldSeconds()` (wall time since Oct 27 UTC) drives day/night for all players.
- Art: Codex villager sheets `client/public/art/npc-{mo,ama,pip}.png` (walk frames drawn in code).
- Credits: Meta $149.91, Modal ~$110. No paid calls this session (chat goes through the existing capped /api/chat).

## Decisions made
- V3-PLAN approved 2026-10-29 (stock 1B for every mind in the browser, optional village LoRA ~$6 in stage 5; ghost ground 10 min; mobile + outdoor decor below the line).
- 2026-10-30 user: time must be shared by all players (done); villager chat may use cloud credits while event credits are free, otherwise local model; NPCs should move to a host that has a model (done); lines must queue, not drop (done).
- Minds only pick from `validChoices`; every decision has a fallback; inspector labels the source honestly. Codex = static art only.

## Pending decisions (user)
- **Stray Worker `eta-lobal---eveloper-ackathon-roject`:** created by accident on 2026-10-30 00:13 (a `wrangler deploy` picked up an auto-generated root `wrangler.jsonc`, now deleted). It serves the `client/` folder (source, no secrets found) and is probably public on workers.dev without Access. Recommend deleting it (`npx wrangler delete --name eta-lobal---eveloper-ackathon-roject` in worker/). Needs the user's OK.
- When to go public (remove Access); make the HF coach repos public.

## User-only actions (morning test plan, two windows: normal + incognito, both on https://pets.uryto.dev/)
1. Each spawns on its own ground; day/night and clock match in both windows.
2. Walk to the square: villagers greet you by name; E = chat with any villager.
3. Press B (load Llama) in window A, wait ~10 s: A hosts all villagers (I by one shows its mind). Chat from window B: the answer comes from A's model.
4. Close A: within ~15 s B takes over (memory kept). Pets: 2+ at home plan/talk/picnic; invites show in the other window.

## Next actions
1. Apply the user's play-test feedback and decisions (stray Worker, wording, bugs).
2. Stage 3 leftovers: props-sheet decor (bushes/rocks/fence/lights), autumn/snow trees (Codex batch 2). Known limits: NPCs don't talk to pets; human sit pose = 3 px crop; far-pond fishing not yet seen live.
3. Stage 5 (village LoRA, background, ~$6) + stage 6 (polish, README, 3-min demo script, captures; repo public Nov 3).

## Gotchas
- **Deploy only from worker/** and read the output: a root wrangler config sends deploys to a different Worker (see above). PowerShell cwd persists between calls.
- GPU: reloading while WebLLM generates can kill the D3D12 device; close the tab, open a new one.
- Dev hook `window.__px` = {world, update, live, mindSched, ...}. Hidden preview pane: rAF stalls, drive `__px.update(dt,t)` from setInterval; JS calls time out at 45 s. Shared clock = real time, so night in the preview is real night.
- Relayout rebuilds the whole map (~100 ms with 3 neighbours: NPC route checks). Wrangler 10013 error: retry.
- Python edits: script file in `.scratch/` or heredoc without `'''`. Codex: briefs as files, `-Sandbox workspace-write` for ImageGen. Never commit `.env`.

## File map
docs/{V3-PLAN,V3-BRIEF,EVENT,STYLE,DEPLOY,FINETUNE,SPIKES,CREDITS}.md · client/src/life/* · client/src/mind/{persona,memory,brain,scheduler,hub,npcs}.ts · client/src/world/{layout,ground,live,movement,route}.ts · client/src/pixel/{main,overworld,art,life-draw,inspector,tiles,grounds-draw,grounds-props}.ts · client/src/game/{npc-chat,chatter,voices}.ts · worker/src/{room,room-do,npc,chat}.ts · worker/test/npc.test.ts · scripts/codex.ps1 · .scratch/v3/ (briefs, previews)
