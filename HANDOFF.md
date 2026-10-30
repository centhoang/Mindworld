# HANDOFF: Mindworld v3, tuned 1B live in the browser; next = remove power mode, lift limits, setup gate, chat privacy (2026-10-30)

**Fresh-session starting prompt (user pastes it):** "Read HANDOFF.md. Continue from Next actions, starting with removing power mode. Follow CLAUDE.md (Normal mode, 35% context limit; nothing goes public before submission day)."

## State
- **Deployed behind Access** (only the user's email): https://pets.uryto.dev/ = Worker `pet-mind` **8ee82790**. Redeploys standing-approved: `npm --prefix client run build`, then `npx wrangler deploy` **inside worker/** (two plain commands). Check the output names `pet-mind` + `pets.uryto.dev`.
- **Tests:** client 277, worker 177, tsc clean. Everything committed; `info-ref/` stays untracked (user's).
- **Tuned 1B confirmed live** (2026-10-30, user's Chrome, GTX 1050 after setting Chrome to High performance in Windows): `Llama-3.2-1B-Mindworld-q4f32_1-MLC` loaded through `/mlc`, prefill chunk 128, label "tuned by us", minds served by it.
- Conversion audit passed (docs/FINETUNE.md "Browser audit"): both MLC repos rebuild byte-identical from the stage 5 weights; WebLLM replies = decoded weights on 200/200. **Quote the browser's numbers:** 98.5% village, Teach +19.1 (6 harmful), voice 100%. GGUF: 99.5%, +22.6, 1 harmful.
- `/mlc/<q>/resolve/main/<file>` (worker/src/mlc.ts): pinned HF commits, whitelist, Cloudflare cache. Worker secret HF_TOKEN = .env HF_TOKEN_READ_ONLY.
- Runtime chains: pet/NPC mind and chat = local -> Muse Spark (`CloudMind` in voices.ts) -> rules. Combat: memo decides, local voice -> scripted. Teach = Muse Spark -> local -> scripted. Wild-pet chat and tactics = Muse Spark only, then scripted/defaults.
- Stock 1B is gone: tuned MLC or nothing. f16 only if the browser reports shader-f16, retries as f32. A weak GPU fails at warm-up (300-token prompt); a lost GPU drops to rules with a toast.
- Bubbles (pixel/bubbles.ts): speaker name, "A > B" header, never overlap, no room = wait. Tint eased by hour. Farm beds = soil on the biome tile.
- Credits: Meta ~$149.9, Modal ~$102 left (approx). Audit used under $1 of Modal.

## Decisions made
- 2026-10-30 user: nothing game-related goes public before submission day (CLAUDE.md).
- 2026-10-30 user: HF standing-approved for private repos with the .env token.
- 2026-10-30 user: **remove power mode from the game** (keep the GGUFs as published artifacts and for benches): MLC is the one local model, so the flow is simple and works without an install.
- 2026-10-30 user: **no Muse Spark limits while we work up to judging.** Cost control comes back only after the event, for real players.
- 2026-10-30 user: the game must live on after the event on the local model; Muse Spark is a bonus. Fallback order above is theirs.
- 2026-10-30 user: **a setup gate before the game opens.** The game checks the machine first. Capable: guided setup, and the game opens only when the tuned model is ready. Incapable: straight into the game (Muse Spark -> rules), no B step needed. So a judge never plays half set up.
- 2026-10-30 user: **chat privacy.** A player's chat with a villager or with another player is private to those in it. NPC-to-NPC and pet chatter is public, nearby players only. Anyone in a private chat shows a "talking" status bubble to others, and nobody can start talking with them until it ends. Shared public chat stays public.
- Earlier ones hold: shared clock, NPCs move to model holders, lines queue.

## Pending decisions (user)
- Submission day: make the GitHub repo + the 4 Mindworld HF repos public, then remove Access. The proxy keeps working either way.

## User-only actions
- Play-test, two windows (Chrome normal + incognito; incognito needs Access sign-in): grounds and clock match; villagers greet by name, E chats; B in A then chat from B answers from A's model; close A and B takes over within 15 s; pets' I panel and lines. Plus bubbles, dusk, beds in real play.
- **Look for free top-down art assets** that could replace the current visuals (more professional and consistent; check the license allows use in a public hackathon entry). Only change the visual direction if a good pack turns up. If one does, Claude uses it as the moodboard (`moodboard` skill) and carries on from it.
- Try a modern GPU and a Mac if reachable: the tuned f16 build has never finished a bench.

## Next actions (5 this time: all user-approved)
1. **Remove power mode:** in client/src/pixel/main.ts drop `nativeBrain`, the probes and `localAccessState` start-up; `switchBrain` goes straight to WebLLM. In teach.ts drop `powerMode`/`local` and the Free coach checkbox if it remains. Remove `scripts/power-mode.ps1`, the README/DEMO mentions, and in-game text. Keep `LocalCortex`/`NativeVoice` only if the benches need them (teach-bench, voice-bench use them, so move or keep them under finetune).
2. **Lift limits:** `new CloudMind(0)` or drop the 6 s gap (keep the failure back-off); raise `MAX_DAILY_USD` and `CLIENT_DAILY_USD`, and `CLIENT_PER_MINUTE` in worker/wrangler.toml so a judge never hits them, keeping the MAX_TOTAL_USD_* totals as the hard stop. Note in the code that caps return after the event.
3. **Setup gate (before the game opens):** with B gone, loading becomes this screen. Check WebGPU and the adapter before any download. Capable GPU: show size and progress, warm up, then open the game, and the tuned model stays on for the session. Dual-GPU Windows on the iGPU: a step-by-step guide (Settings > Display > Graphics > Chrome > High performance, restart) with a re-check. Incapable, or warm-up fails: a short note, straight into the game. Decide "capable" from real results: GTX 1050 yes, Intel Gen 9 no. Remember the result so a return visit is instant (the browser caches the weights); keep a skip button only for a failed download.
4. **Chat privacy + talking status:** lines addressed to a player or between players go only to those in the conversation (server side in worker/src/room.ts, not just hidden on screen). NPC/pet chatter reaches nearby players only. Add a busy state on the room, a "talking" bubble over those in a chat, and refuse new chats with them; it must clear on close, disconnect and a timeout so nobody stays stuck busy.
5. Then stage 6: VFX polish, demo captures (DEMO.md), README numbers from the stage 5 + browser tables. If the user finds an art pack, that comes before VFX.

## Gotchas
- Dual-GPU Windows: Chrome may give the Intel iGPU even for high-performance; it cannot run the model (Intel Gen 9 crashes on stock too). What a player sees: load fails, toast, game goes on with Muse Spark and rules.
- Bench pages: edits under client/ make Vite reload them; stop Vite after the page loads. After a GPU crash Chrome refuses WebGPU until restarted (.scratch/mlc/clean.sh).
- `client/mlc-bench.html` + `.scratch/mlc/serve.mjs` run the unchanged benches on WebLLM (bridge=1, chunk=128).
- WebLLM ignores a prefill_chunk_size override; `limitPrefill` sets it on the pipeline. Without it, 190+ tokens kills the GPU process.
- The app pane is not signed in to Access; the user's Chrome is. Never sign in for them.
- The auto-mode classifier blocks "make public" actions and may block secret writes; the user's explicit go-ahead clears the latter.
- Modal CLI on Windows: prefix `PYTHONUTF8=1 PYTHONIOENCODING=utf-8`. `--cap` in gen-village is the cumulative ledger total.
- **Deploy only from worker/**: a root wrangler config deploys to a different Worker.
- GPU: reloading while WebLLM generates can kill the D3D12 device; open a new tab.
- Dev hook `window.__px`. Hidden preview pane: rAF stalls; drive `__px.update(dt,t)` from setInterval.
- Python edits: script file in `.scratch/`, written with Write (long bash heredocs break). Codex can't run Python in its sandbox. Never commit `.env`.

## File map
modal/{mlc_q4,convert_mlc,verify_mlc,publish_coach,finetune_llama}.py · worker/src/{mlc,app,room,room-do,npc,chat}.ts · worker/wrangler.toml · client/src/game/voices.ts (+test) · client/src/pixel/{main,overworld,bubbles,teach,life-draw}.ts · client/src/mind/{hub,npcs,scheduler}.ts · client/src/finetune/{gen-village,village-bench,mlc-bench}.ts · docs/{V3-PLAN,FINETUNE,EVENT,DEPLOY,DEMO}.md · scripts/{codex,power-mode}.ps1 · .scratch/mlc/* (audit tools) · .scratch/finetune/*.gguf (local copies)
