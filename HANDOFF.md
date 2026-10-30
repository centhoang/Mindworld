# HANDOFF: Mindworld v3, stage 5 done + models uploaded to HF (private); next = serve the tuned 1B privately (2026-10-30)

**Fresh-session starting prompt (user pastes it):** "Read HANDOFF.md. Continue from Next actions, starting with the private /mlc proxy. Follow CLAUDE.md (Normal mode, 35% context limit; nothing goes public before submission day)."

## Morning report
- Stage 5 done (12a45ec): one tuned Llama 3.2 1B for coach + pets + villagers. Village checks 99.5% (stock 48.5%), Teach +22.6 (old +18.4, 1 harmful). 3B: 98.5%, +21.5. Spend $4.26 data + ~$2 Modal.
- The browser build works via our own NumPy MLC converter (modal/mlc_q4.py; stock 1B matches mlc-ai's tensor for tensor).
- Uploaded (PRIVATE, keep private until submission day): kysupo/Llama-3.2-{1B,3B}-Mindworld-GGUF, kysupo/Llama-3.2-1B-Mindworld-{q4f32_1,q4f16_1}-MLC.
- Not deployed since 8611b544. The game still uses the stock 1B (`TUNED_1B.repo = ""`).

## State
- **Deployed behind Access** (only the user's email): https://pets.uryto.dev/ = Worker `pet-mind` **8611b544**. Redeploys standing-approved: `npm --prefix client run build`, then `npx wrangler deploy` **inside worker/** (two plain commands). Check the output names `pet-mind` + `pets.uryto.dev`.
- **Tests:** client 264, worker 163, tsc clean.
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
1. **Private serving of the tuned 1B (Claude decides, no public surface):**
   - Add a Worker route `/mlc/<quant>/<file>` that fetches `https://huggingface.co/kysupo/Llama-3.2-1B-Mindworld-<quant>-MLC/resolve/main/<file>` with `Authorization: Bearer ${env.HF_TOKEN}` (new Worker secret via `npx wrangler secret put HF_TOKEN` in worker/; never print it).
   - Whitelist the quant and file names, cache through the Cache API, stream the body.
   - It stays behind Access.
   - Set the client to `${location.origin}/mlc/{q}/`, test it (worker test with mocked fetch), deploy, and verify in a fresh app window (the pane's Intel iGPU hit DXGI DEVICE_HUNG last session; an app restart clears it).
   - Note: WebLLM appends `resolve/main/` only for HF-style URLs. Check `cleanModelUrl` against our URL form.
2. Power mode: switch scripts/power-mode.ps1 to the Mindworld GGUFs (size + SHA-256 pins; the private repo needs a token now, so this waits for submission day, or the script uses the local .scratch/finetune GGUFs). Update the README/DEMO numbers with the stage 5 table.
3. User play-test still owed (two windows: scene-aware chat, relay to host model, pets). Then stage 6: VFX polish, demo captures (DEMO.md).

## Gotchas
- The auto-mode classifier blocks "make public" actions. That's fine: we don't do that before submission anyway.
- Modal CLI on Windows: prefix `PYTHONUTF8=1 PYTHONIOENCODING=utf-8`. `--cap` in gen-village is the cumulative ledger total, not per run.
- **Deploy only from worker/**: a root wrangler config deploys to a different Worker.
- GPU: reloading while WebLLM generates can kill the D3D12 device; open a new tab.
- Dev hook `window.__px`. Hidden preview pane: rAF stalls; drive `__px.update(dt,t)` from setInterval.
- Python edits: script file in `.scratch/`. Codex can't run Python in its sandbox; ask it for files only. Never commit `.env`.

## File map
modal/{mlc_q4,convert_mlc,publish_coach,train_*}.py · client/src/game/voices.ts (+test) · client/src/finetune/{gen-village,village-bench}.ts · docs/{V3-PLAN,FINETUNE,EVENT,DEPLOY,DEMO}.md · client/src/{life,mind,world,pixel}/* · worker/src/{room,room-do,npc,chat}.ts · scripts/{codex,power-mode}.ps1 · .scratch/finetune/*.gguf (local copies) · .scratch/v3/{vbench,cbench}.sh
