# HANDOFF: Mindworld v3, NPCs are now the star; power mode gone, setup gate + private chats live (2026-10-31)

**Fresh-session starting prompt (user pastes it):** "Read HANDOFF.md and docs/NPC-PLAN.md. Continue from Next actions. Follow CLAUDE.md (Normal mode, 35% context limit; nothing goes public before submission day)."

## State
- **Deployed behind Access** (only the user's email): https://pets.uryto.dev/ = Worker `pet-mind` **e02624d8**. Redeploys standing-approved: `npm --prefix client run build`, then `npx wrangler deploy` **inside worker/** (two plain commands). Check the output names `pet-mind` + `pets.uryto.dev`.
- **Tests:** client 449 (164 are promises.test.ts), worker 189, tsc clean. `info-ref/` stays untracked (user's); `VisualAssetPack/` gitignored (only used sprites get copied to client/public/art).
- **Done 2026-10-31:** power mode removed (`finetune/native-voice.ts` keeps the bench client, GGUFs stay). Limits lifted: CloudMind gap 0, MAX_DAILY_USD 30, CLIENT_DAILY_USD 10, CLIENT_PER_MINUTE 120; MAX_TOTAL_USD_* stay the hard stop. Caps come back down after the event.
- **Setup gate** (pixel/setup.ts, #setup in index.html): checks the adapter first. capable = download + warm-up, then the game; weak Intel on Windows = steps + re-check; none/mobile = straight in. Remembered per GPU in `mindworld.setup.v1`; a return visit opens at once and loads in the background. Dev: `?gpu=switch|capable|none|skip`. Checked in the pane on a real Intel Gen 9 (guide, exit, remembered). The capable path with a real download has NOT been run: user's GTX 1050 is the first test.
- **Private chats** (worker/src/room.ts): lines to a player reach that player only; other mind lines reach players within HEAR_DIST 14 tiles plus the host of the NPC spoken to; room chat stays public. `talk` = busy state, "talking..." bubble, new chats refused, ends on close, disconnect or 45 s silence (clients renew every 15 s). Checked on the real Durable Object with 3 sockets (worker-mock on port 8799).
- **N1 Promises live** (mind/promises.ts, wired in mind/npcs.ts `invited` + `keepPromises`): chat line -> extract (model, keyword fallback) -> decide from persona + relationship -> Commitment in `mem.promises` -> at the time the NPC announces and goes -> player within 7 tiles = kept (+affinity, fact, "Happy birthday"); NPC there and player absent = broken (-affinity by personality, fact "stood me up", shows in later replies through memory); NPC never got there = cancelled, no blame. No spot on the map = says so, no promise. Inspector shows PROMISED. Open promises travel to the next host as `promise|...` lines in the room log. Tested by unit tests + the real game objects; not yet played by hand, and the model path (extract/decide) has not run on the tuned 1B or Muse Spark in the browser.
- Known gaps in N1: an invite to an NPC hosted by another player with no model goes to the cloud chat and makes no promise; the place named by the player is ignored (each activity uses its own spot, so tell the player where); other machines replay `do` only when a start event arrives.
- Tuned 1B: `Llama-3.2-1B-Mindworld-q4f32_1-MLC` via `/mlc`, chunk 128. **Quote the browser's numbers:** 98.5% village, Teach +19.1 (6 harmful), voice 100%. GGUF: 99.5%, +22.6, 1 harmful.
- Runtime chains: mind and chat = local -> Muse Spark (`CloudMind`) -> rules. Combat: memo decides, local voice -> scripted. Teach = Muse Spark -> local -> scripted.
- Credits: Meta ~$149.9, Modal ~$102 left (approx).
- Claude weekly quota 74% (resets Nov 1 17:00 UTC): push isolated work to Codex.

## Decisions made
- 2026-10-31 user: **NPCs are the star for judges; a player can't tell them from a human.** Plan and backlog: docs/NPC-PLAN.md. Pets go deep only after the star work.
- 2026-10-31 user: must fit a local model so the game runs free after the event. Approach: the sim reasons, the model decides among valid options and speaks.
- 2026-10-31 user: Sunnyside pack = the art direction (free + commercial, credit optional). Use only what we need; Codex makes the gaps (modular pets etc.) after learning the style once; Claude reviews.
- 2026-10-30 user: nothing goes public before submission day; HF private repos standing-approved; no Muse Spark limits until judging; game must outlive the event on local; setup gate; chat privacy. Earlier: shared clock, NPCs move to model holders, lines queue.

## Pending decisions (user)
- Submission day: make the GitHub repo + the 4 Mindworld HF repos public, then remove Access. The proxy keeps working either way.

## User-only actions
- Play-test: setup gate on the GTX 1050; two windows for private chat (E on a player > Say something; a third party sees "talking..." only).
- Try a modern GPU and a Mac if reachable: the tuned f16 build has never finished a bench.

## Next actions
1. **Art:** batch 1 accepted and committed (14 PNGs in client/public/art/gen, not used in-game yet; generator .scratch/art/gen/batch1.mjs). Next batches through Codex: market stall, modular pets, wild pets (same brief shape: .scratch/brief-art1.md). Then the art swap: Sunnyside tiles + layered humans so NPCs share the player's sprites.
2. **N2 memory + relationships with reasons;** inspector "why" trail; thought bubbles; NPC tells the place when accepting; gossip of broken promises.
3. **N3 verbs** (NPC farm, wallet, market, town board, trade). **N4 retrain by Nov 2 night:** add extract + decide (and N2/N3 prompts) to gen-village, freeze prompts first. N5, then demo captures and README numbers (credit the Sunnyside pack in README).

## Gotchas
- Codex: `scripts/codex.ps1` by absolute path (the shell cwd drifts), from the PowerShell tool only (bash has no `powershell`), and a brief with double quotes breaks argument passing: put the brief in `.scratch/brief-*.md` and pass "Read .scratch/brief-x.md and carry it out exactly."
- worker-mock preview runs on port 8799; raw WebSockets from the page test the room cheaply (`/api/room`, hello first).
- Dual-GPU Windows: Chrome may give the Intel iGPU even for high-performance; it cannot run the model.
- Bench pages: edits under client/ make Vite reload them; stop Vite after the page loads. After a GPU crash Chrome refuses WebGPU until restarted (.scratch/mlc/clean.sh).
- `client/mlc-bench.html` + `.scratch/mlc/serve.mjs` run the benches on WebLLM (bridge=1, chunk=128).
- WebLLM ignores a prefill_chunk_size override; `limitPrefill` sets it on the pipeline. Without it, 190+ tokens kills the GPU process.
- The app pane is not signed in to Access; the user's Chrome is. Never sign in for them.
- The auto-mode classifier blocks "make public" actions and may block secret writes; the user's explicit go-ahead clears the latter.
- Modal CLI on Windows: prefix `PYTHONUTF8=1 PYTHONIOENCODING=utf-8`. `--cap` in gen-village is the cumulative ledger total.
- **Deploy only from worker/**: a root wrangler config deploys to a different Worker.
- GPU: reloading while WebLLM generates can kill the D3D12 device; open a new tab.
- Dev hook `window.__px`. Hidden preview pane: rAF stalls; drive `__px.update(dt,t)` from setInterval.
- Python edits: script file in `.scratch/`. Codex can't run Python in its sandbox. Never commit `.env`.
- Aseprite headless: see VisualAssetPack/HowToUseAsepriteFile.txt. Contact-sheet tool: `.scratch/art/pack_sheet.py` (sheets in .scratch/art/pack/).

## File map
docs/{NPC-PLAN,V3-PLAN,FINETUNE,EVENT,DEPLOY,DEMO,STYLE}.md · modal/{mlc_q4,convert_mlc,verify_mlc,publish_coach,finetune_llama}.py · worker/src/{mlc,app,room,room-do,npc,chat}.ts · worker/wrangler.toml · client/src/game/voices.ts · client/src/pixel/{main,setup,overworld,bubbles,teach,life-draw}.ts · client/src/mind/{brain,hub,npcs,memory,persona,scheduler}.ts · client/src/life/ · client/src/finetune/{gen-village,village-bench,mlc-bench,native-voice}.ts · scripts/codex.ps1
