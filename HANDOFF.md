SLEEP MODE ACTIVE since 2026-10-29 00:40 (UTC+7)

## Morning report
- (in progress) Checkpoint commit 9e4acc8 (T0 UI playable; 42+58 tests green, secrets scan clean).
- A+B committed 9615d96 (49+58 tests, build OK). Power-mode download path untested (only `-SkipDownload` vs `.scratch/native`). Thinking state not yet eyeballed in the browser.

## Sleep queue (director = the session the user said "sleep" in; workers do the work)
1. [done] A. Thinking animation + WebLLM grammar fallback (client UI; code + tests, no GPU run). Done: tests/tsc/build green.
2. [done] B. Power-mode script `scripts/power-mode.ps1` + README section (scripts/ + README only). Done: script runs with `-SkipDownload` against `.scratch/native`, doc written.
3. [running] C. Ghost loop T1: post memo+genes after a fight, fetch random ghost as opponent (client + worker ghosts). Done: tests green, mock-mode check via wrangler dev.
4. [pending] D. Next batch, sent to the same session as C (user rule 2026-10-29: batch tasks, one worker at a time, reuse a worker that has context left): (a) eyeball thinking state + ghost fight in the browser pane with `vite preview` + `wrangler dev LLM_MOCK=1`, fix what's broken; (b) home plot/decor MVP (T1, from PLAN.md); (c) small `npm run eval -- --live` tuning run, hard cap $0.50 logged here; (d) verification pass: tests, tsc, build, secrets scan; director commits.
Spend overnight: $0.00 of $3 cap.
Decisions needing review: (none yet)

# HANDOFF (update at every milestone; keep under ~80 lines)

Last updated: 2026-10-27 night (day 1). Phase: **2 = T0 slice (core + UI playable)**. Deadline Nov 4 9 PM ET (user is UTC+7). Nothing committed yet: the user commits (or asks Claude).

**Fresh-session starting prompt (user pastes it):** "Read HANDOFF.md, then continue from Next actions. Follow CLAUDE.md. Tell me when the context gets long and I will start a new session."
Working agreements (in CLAUDE.md): short reports, ask the user only for important decisions, long waits via `claude-queue`, Sleep mode = unattended overnight chain.

## State
- Local git repo, 2 commits + much uncommitted (rules, docs, scripts, `worker/`, `client/`). No remote. `.env` has both keys (gitignored; secrets scan of all new files clean). Smoke test `python -I scripts/smoke_llm.py` passes both. Reasoning always on.
- **`worker/` done (58 tests, `npm run build` dry-run OK)**: one Cloudflare Worker serves the client (`[assets]`, run_worker_first) + API. `POST /api/llm` (Baseten `muse-spark-open-1026` default; Meta `muse-spark-1.3` via `provider`), `SpendCounter` Durable Object ledger (atomic worst-case reserve, settle, books worst case when the outcome is unknown), per-client limits, geo-block 451 (restricted list, fail-closed on XX/T1/UA without region), ghost KV stub (`/api/ghosts`, `/random`), mock mode `LLM_MOCK=1`. Live check through `wrangler dev` with real keys: 2 calls, $0.002. Codex review: 5 issues fixed. Deploy steps: `docs/DEPLOY.md`.
- **`client/` builds, 42 tests**: Vite 8 + TS + three.js. **T0 UI playable** (`index.html` + `src/main.ts` + `src/game/{instinct,voices,scene}.ts`): procedural pet + 5 enemy meshes, tweened moves, speech bubbles, HP bars, battle log with source tags (memo #n / model / instinct), Teach + "Learn from my fights" (live Muse via Worker, falls back to ScriptedCortex labelled "offline coach"), Proof panel (held-out bars, per-enemy, CI, watch before/after replay), memo+recent fights in localStorage, privacy footer, stacked layout <=1100px. Verified in the pane: live Muse Spark Open teach took 19 s, valid 2-rule memo, +27.7 pts held-out; power mode fight used 3B picks + memo rule. WebLLM 1B path NOT yet verified in the UI (needs the GPU Chrome). `spike-b.html` = local-model benchmark (WebLLM). `npm run eval` prints paired-seed numbers (scripted coach, offline); `-- --live http://127.0.0.1:8787` uses the real Meta model via the Worker.
- **T0 core done, no UI**: `sim/battle.ts` (turn-based, 5 actions, 5 enemy archetypes with learnable patterns, stateless seeded luck so paired seeds are fair), `memo.ts` (rule DSL: validate/render/extract JSON), `policy.ts` (`baselinePolicy` = uncoached; `memoPolicy` = deterministic proxy of the Instinct), `cortex.ts` (prompts, `LlmCortex` over `/api/llm`, `ScriptedCortex` offline double, `CortexUnavailable`), `evaluate.ts` (paired arms, bootstrap CI, exact sign test), `proof.ts` (Teach -> Prove: 40 train seeds + 200 held-out seeds x 5 enemies). Scripted numbers (after Codex review #2 fixes: per-enemy luck, log-space sign test, one-line `why`, no threshold rounding): held-out win 60.5% -> 88.0% (95% CI +24.7..+30.4 pts, 1000 paired fights); brute 21->100, bully 6->47, pal/skitter near ceiling.
- **Spike B DONE on the GTX 1050** (`docs/SPIKES.md`; Claude ran it via a separate Chrome with `--force_high_performance_gpu`, user's normal Chrome only sees the Intel iGPU). Llama 3.2 1B q4f32 is the only stable model: p50 1.6 s (180-token prompt), valid 90.6% (100% grammar), sane 40-45%, follows memo 50% (25% grammar). Llama 3B and Gemma 2 2B lose the WebGPU device on 4 GB. No model meets the decision rule, so `memoPolicy` (deterministic memo rules) is the default Instinct; the local LLM is a guarded chooser/voice or optional power mode. **Spike B-native done**: llama.cpp CUDA, Llama 3.2 3B Q4_K_M = valid 100%, memo 100%/92%, sane 70%, p95 0.57 s, 2.3 GB VRAM (passes the rule); 1B native 0.2 s but as weak as in browser. Voice prompt on 3B: 20/20 valid, p50 0.54 s.
- Claude in Chrome works in the user's temp profile (Discord, CV, dev.meta.ai logged in); Discord = personal account, hackathon server only, never DMs. Codex works via `scripts/codex.ps1`.

## Decisions made
- Browser-first "Pet Mind": local Instinct + cloud Cortex (Meta via Worker proxy) + home plot/neighborhood + ghost arena; signature Teach -> Prove. docs/PLAN.md v2. Hostname `pets.uryto.dev` approved (DNS at deploy).
- Codex plan review adopted: T0 first, WebSocket rooms on DOs (WebRTC stretch), spend counters in DO storage, paired-seed eval. Meta Horizon rejected; EOS no browser SDK.
- Repo: private GitHub repo from Oct 27 (evidence), secrets scan of history, make public Nov 3.
- Eval's Instinct = deterministic proxy (rules executed directly); live local-model results are reported separately, never passed off as the proxy's. Say so in the demo.
- Cortex output = closed rule DSL (<= 8 rules, <= 3 conds): validated, rendered into the Instinct prompt, executed by the proxy.
- Instinct model: Llama-class counts as Meta models (Discord ruling). Spike B: Llama 3.2 1B is the only model stable on 4 GB but too weak to be sole decider. The game never depends on the local model: reflex/memo fallback on timeout (~1.5 s) or device loss.
- Local model role (user, 2026-10-27): guarded chooser + pet voice; the eval/Teach->Prove numbers still use the deterministic `memoPolicy`. `allowedMoves()[0]` == memoPolicy (tested), so rules-only mode is exactly the measured policy.
- No Unity switch (user confirmed 2026-10-28, after native spike): native 3B is reached from the browser game as "power mode" (`NativeVoice` -> llama-server on 127.0.0.1:8080, auto-probed at load). Default stays no-install browser.

## Pending decisions / user actions
1. Create private GitHub repo `pet-mind` and commit (user's call).
2. (decided 2026-10-27) Local model role = guarded chooser + pet voice, rules-only fallback.
3. Discord post 3 answered (no on-device guidance; see DISCORD_DRAFTS). Future posts generic.
4. (resolved) Unity: no; native 3B = browser power mode. Details docs/SPIKES.md.

## Next actions
1. Verify the WebLLM 1B path in the UI on the GPU Chrome (grammar `move: line` with `{1,60}` repetition may not compile in xgrammar; fall back to `[a-zA-Z ,.!?']+` and max_tokens). Add a "thinking" animation for the ~19 s Muse call; keep prompts short.
2. Power-mode setup doc + script (`scripts/power-mode.ps1`: download llama.cpp CUDA/Vulkan + 3B GGUF, run llama-server) and README section; verify https page -> 127.0.0.1 (Chrome Local Network Access) at deploy.
3. Ghost loop: store memo+genes after a fight (`/api/ghosts`), fetch a random ghost as opponent (T1); then home plot/decor. Then commit (secrets scan) and the eval `--live` tuning run.

## Gotchas
- GPU browser tests: Claude can launch a separate Chrome (`--force_high_performance_gpu --remote-debugging-port=9222 --user-data-dir=.scratch/chrome-gpu`) and drive it with `scripts/cdp-eval.mjs`; stop it and delete `.scratch/chrome-gpu` (~5 GB of weights cache) afterwards. A lost WebGPU device needs a Chrome restart.
- Free-credit content may be used by Meta: notice + no personal data. Geo-block list: `worker/src/geo.ts`.
- Small Muse calls burn 150-290 reasoning tokens: `maxTokens` >= 400 (memo 1500) or the reply is empty/`truncated`.
- Chromium ignores `powerPreference` on Windows: pane/Chrome use the iGPU unless Windows Graphics settings or `--force_high_performance_gpu`.
- Browser benchmarks: use `vite preview` (static). `vite dev` full-reloads on any file change and restarts auto-runs.
- Native spike files live in `.scratch/native/` (bin/, two GGUF ~2.8 GB, results json). `client/src/spike/native.ts` reruns the 32 prompts against any llama-server.
- Codex wrapper: absolute `scripts/codex.ps1` path when cwd is `client/` or `worker/`; from bash use the PowerShell tool. Output file can come back truncated: rerun once.
- `wrangler dev --env-file ../.env` loads keys; `WRANGLER_SEND_METRICS=false` silences telemetry. npm resolved TS 7, Vite 8, Vitest 5: all work. `@cloudflare/workers-types`: use the bare package.
- Fresh repo rule: only work from Oct 27; demo opens with pre-existing vs new. Never commit `.env`. Unread Discord: use the `sync-event` skill.

## File map
CLAUDE.md, AGENTS.md · docs/{EVENT,PLAN,SPIKES,DEPLOY,DISCORD_DRAFTS}.md · worker/{wrangler.toml,src/{app,ledger,spend-do,providers,geo,pricing,ghosts,mock,index}.ts,test} · client/{index.html,spike-b.html,src/{main.ts,game/,spike/,sim/,eval/cli.ts}} · scripts/{smoke_llm.py,codex.ps1} · .claude/{skills,launch.json}
