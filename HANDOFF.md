# HANDOFF: Mindworld v3, conversion audited + private /mlc proxy live; waits on the user's play-test (2026-10-30)

**Fresh-session starting prompt (user pastes it):** "Read HANDOFF.md. Continue from Next actions. Follow CLAUDE.md (Normal mode, 35% context limit; nothing goes public before submission day)."

## Morning report
- Conversion audit passed (docs/FINETUNE.md "Browser audit"): both MLC repos rebuild byte-identical from the stage 5 merged weights; WebLLM replies = decoded weights on 200/200.
- Quote the browser's own numbers: WebLLM 1B 98.5% village, Teach +19.1 (6 harmful), 100% voice; GGUF stays +22.6 (1 harmful). Model cards fixed.
- Fixed: the 190+ token prefill GPU crash (`limitPrefill`, chunk 128; stock weights crash too). Browser 1B is now a Teach coach (it never was before).
- Private proxy `/mlc/<q>/resolve/main/<file>` is in the Worker (pinned commits, whitelist, cache); client uses it. HF_TOKEN is set from .env HF_TOKEN_READ_ONLY (user-provided, read-only). Same Worker code run locally with it: all files byte-identical to HF, both formats; cache and 404s fine. The site itself is untested: only the user's Access session can reach it.
- Rules check clean: all 8 HF repos and the GitHub repo answer 401/404 anonymously; no secrets in git.

- 2026-10-30 evening: **/mlc confirmed live** in the user's signed-in Chrome (200, Cloudflare cache HIT, whitelist 404s). Stock 1B removed: tuned MLC or nothing (f16 retries as f32; a weak GPU now fails during warm-up; a lost GPU drops to rules with a toast). Chains per user: minds/chat = local -> Muse Spark (CloudMind, spaced 6 s, Worker caps) -> rules. Bubbles never overlap (bubbles.ts: held bubbles wait), names and "A > B" header. Smooth tint by hour. Farm beds = plain soil on the biome tile.
- **The user's Chrome picks the Intel iGPU, which cannot run the model.** For their play-test: Windows Settings > Display > Graphics > Chrome = High performance. Dual-GPU players get the same.

## State
- **Deployed behind Access** (only the user's email): https://pets.uryto.dev/ = Worker `pet-mind` **9ccc597a** (2026-10-30, proxy + browser coach; HF_TOKEN set after it). Redeploys standing-approved: `npm --prefix client run build`, then `npx wrangler deploy` **inside worker/** (two plain commands). Check the output names `pet-mind` + `pets.uryto.dev`.
- **Tests:** client + worker green, tsc clean.
- v3 stages 1-4 (life sim, minds, grounds, networked NPC hosts, scene awareness, coach chain Muse Spark -> tuned local -> scripted) are all in. Details: docs/V3-PLAN.md, docs/FINETUNE.md (stage 5 + browser unblock).
- **Browser model loading** (client/src/game/voices.ts): `tunedRecord(list, repo, f16)` builds a WebLLM model_list entry that reuses the stock 1B wasm with our weights. `repo` = "user/name" (HF; appends `-{q}-MLC`) or a full URL template with `{q}`. It picks f16 when the GPU has shader-f16, and falls back to the stock 1B if the tuned load fails. Dev override: `?tuned=<url with {q}>`.
- Credits: Meta ~$149.9, Modal ~$102 left (approx).

## Decisions made
- 2026-10-30 user: **nothing game-related goes public before submission day.** This covers the game (Access, only the user's email), the GitHub repo, HF repos and posts. Recorded in CLAUDE.md.
- 2026-10-30 user: HF is standing-approved for private repos (create/upload/update/delete) with the .env token.
- Power mode (llama.cpp) is now optional: the in-browser tuned 1B is the main local mind (it beats the 3B on village checks). Keep power mode as an extra for no-WebGPU machines, and don't pitch it.
- Earlier ones still hold: shared clock, villager chat may use event cloud credits, NPCs move to model holders, lines queue.

## Pending decisions (user)
- Submission day: make the GitHub repo + the 4 HF repos public, then remove Access. Switch `TUNED_1B.repo` to `kysupo/Llama-3.2-1B-Mindworld` at the same time, or keep the proxy below.

## Next actions
1. User play-test on the live site (signed in to Access): B key, label says "tuned by us", then Teach. Claude cannot sign in to Access, so this is the only live check.
   Open question for the user: remove power mode from the game (recommended; keep the GGUFs as published artifacts and for benches)?
2. Power mode: switch scripts/power-mode.ps1 to the Mindworld GGUFs (size + SHA-256 pins; the private repo needs a token now, so this waits for submission day, or the script uses the local .scratch/finetune GGUFs). Update the README/DEMO numbers with the stage 5 table.
3. User play-test still owed (two windows: scene-aware chat, relay to host model, pets). Then stage 6: VFX polish, demo captures (DEMO.md).

## Gotchas
- Bench pages: edits under client/ make Vite reload them; stop Vite after the page loads. After a GPU crash Chrome refuses WebGPU until restarted (.scratch/mlc/clean.sh).
- A real shader-f16 GPU has never finished a bench of the tuned f16 build (GTX 1050 has none; Intel Gen 9 crashes on stock too). Decoded in torch it scores 98.5%. If play-tests on a newer GPU look wrong, force f32.
- `client/mlc-bench.html` + `.scratch/mlc/serve.mjs` run the unchanged benches on WebLLM (bridge=1).
- The auto-mode classifier blocks "make public" actions. That's fine: we don't do that before submission anyway.
- Modal CLI on Windows: prefix `PYTHONUTF8=1 PYTHONIOENCODING=utf-8`. `--cap` in gen-village is the cumulative ledger total, not per run.
- **Deploy only from worker/**: a root wrangler config deploys to a different Worker.
- GPU: reloading while WebLLM generates can kill the D3D12 device; open a new tab.
- Dev hook `window.__px`. Hidden preview pane: rAF stalls; drive `__px.update(dt,t)` from setInterval.
- Python edits: script file in `.scratch/`. Codex can't run Python in its sandbox; ask it for files only. Never commit `.env`.

## File map
modal/{mlc_q4,convert_mlc,verify_mlc,publish_coach,finetune_llama}.py · worker/src/mlc.ts · client/src/game/voices.ts (+test) · client/src/finetune/{gen-village,village-bench}.ts · docs/{V3-PLAN,FINETUNE,EVENT,DEPLOY,DEMO}.md · client/src/{life,mind,world,pixel}/* · worker/src/{room,room-do,npc,chat}.ts · scripts/{codex,power-mode}.ps1 · .scratch/finetune/*.gguf (local copies) · .scratch/v3/{vbench,cbench}.sh
