# Spikes

## Spike B: local model as the pet's Instinct (WebGPU in the browser). Status: DONE on the GTX 1050 (2026-10-27); iGPU numbers below are the earlier partial run

**Instrument**: `client/spike-b.html` (+ `client/src/spike/`). Loads a model with WebLLM 0.2.86, runs a fixed set of 32 pet-action prompts (20 plain, 12 where a memo rule contradicts the naive move) at temperature 0, `max_tokens` 8, and reports: cold load (download included), warm load, first-decision time (shader JIT), per-decision latency p50/p95, valid-reply rate (strict one-word / lenient), sane-move rate (plain), memo-compliance rate (memo prompts), decode tok/s, with an optional grammar-constrained mode (`root ::= "attack" | ...`). Models offered: Llama 3.2 1B / 3B (Meta), Gemma 3 1B, Gemma 2 2B (1k ctx), Gemma 4 E2B; q4f16 when the GPU has `shader-f16`, else q4f32 (Gemma 3 1B has only q4f16). Library VRAM figures: Llama 1B 0.88 GB, Gemma 3 1B 0.71 GB, Llama 3B 2.26 GB, Gemma 2 2B 1.58 GB (1k), Gemma 4 E2B 3.39 GB.

**What was measurable here**: the Claude desktop browser pane exposes only the **Intel gen-9 integrated GPU** (Chromium ignores `powerPreference` on Windows, crbug 369219127; the GTX 1050 is not selected). So these are weak-hardware numbers, not GTX 1050 numbers.

| Llama 3.2 1B q4f16 on Intel gen-9 iGPU | |
|---|---|
| Download + load (664 MB, first visit) | 29.6 s (16.8 s on a faster second download) |
| Warm load (weights cached) | 3.5 to 4.3 s |
| First decision (shader compile) | 38.6 to 41.9 s |
| Steady decision (about 180-token prompt, 1-2 token answer) | about 10 to 17 s |
| Stability | WebGPU device lost (`DXGI_ERROR_DEVICE_REMOVED`) after 4 to 21 decisions and again at the first decision on retries; the pane's GPU stayed unusable afterwards |

Conclusion for weak integrated GPUs: **not viable** as a real-time Instinct (prefill of a long prompt takes seconds and can trip the Windows GPU watchdog). The validity, sanity and memo-compliance numbers were **not obtained** (runs died before the summary). Treat the model-quality question as open.

**Design consequences already applied or to apply**
- The game must never depend on the local model: every decision has the rule/reflex fallback (`baselinePolicy`, `memoPolicy`), and a lost device or a timeout (budget about 1.5 s per decision) switches the pet to it for the rest of the fight.
- Keep the Instinct prompt short (about 60 tokens of observation, the system prompt shared so its KV cache is reused); the 180-token spike prompt is the worst case. Use grammar-constrained decoding so the reply is always a valid action.
- Decide on a turn-based clock (the fight waits for the answer), never per frame; ghost opponents are the same.
- Offer "power mode" (native Ollama/llama.cpp) and the reflex mode as first-class choices; the tab can detect `adapter.info` and pick.

**GTX 1050 results (run by Claude, 2026-10-27)**: the user's normal Chrome and the Claude pane both expose only the Intel iGPU for every `powerPreference`. A second Chrome started with `--force_high_performance_gpu --remote-debugging-port=9222 --user-data-dir=.scratch/chrome-gpu` (driven by `scripts/cdp-eval.mjs`) selects the NVIDIA Pascal adapter (no `shader-f16`, 2 GB max buffer, so q4f32 builds). Windows settings untouched; the throwaway profile and server were removed afterwards.

| Model (q4f32) | Result on GTX 1050 |
|---|---|
| Llama 3.2 1B (1.13 GB) | stable. Cold load 29.0 s incl. download, warm 3.3 s, first decision 31.0 s (shader JIT). Decision p50/p95 1.62/1.64 s free, 1.60/1.61 s grammar (180-token worst-case prompt; prefill ~97 tok/s, decode ~27 tok/s). Valid reply 90.6% free, 100% grammar. Sane move on plain scenarios 40% / 45% (random = 20%). Follows memo 50% free, 25% grammar. |
| Llama 3.2 3B (2.95 GB) | downloaded in 67 s, then WebGPU device lost. Not viable on 4 GB. |
| Gemma 2 2B 1k (1.88 GB) | download 56 s, first decision 6.5 s, device lost at decision ~23/32. Not stable. After a lost device the next model cannot create a device until Chrome restarts. |
| Gemma 3 1B / Gemma 4 E2B | skipped (no `shader-f16`; 3.4 GB too large). |

**Verdict against the decision rule** (valid >= 95% or grammar, memo >= 70%, p95 <= 1.5 s): no model passes. Llama 3.2 1B is the only stable one but follows a memo only 50% of the time (grammar made it worse: 25%) and its long prompt costs 1.6 s (prefill-bound; a ~60-token prompt should cut that roughly 3x, unverified). Consequence: the deterministic memo-rule executor (`memoPolicy`) is the shipped default Instinct; the local LLM is either a guarded chooser plus pet "voice" (rules veto invalid or memo-violating moves) or an optional power mode, never the sole decider. Native runtimes (Ollama/llama.cpp with CUDA/Vulkan) were not tested and could fit a 3B on this card.

**How the run was done (steps kept for reproducing)**: start Chrome so it uses the NVIDIA GPU (either Windows Settings > System > Display > Graphics > add Chrome > High performance, or launch `chrome.exe --force_high_performance_gpu`), then
```
cd client && npm run build && npm run preview -- --port 4173
```
and open `http://localhost:4173/spike-b.html?auto=1&models=llama1b,gemma3-1b,llama3b,gemma2-2b&modes=free,grammar`. Check `chrome://gpu` shows the NVIDIA adapter. When "done" appears, copy the JSON in the bottom box (or let Claude read it via Claude in Chrome) into this file. `shader-f16` may be missing on Pascal, in which case the page picks q4f32 (Gemma 3 1B is then skipped). Expect about 0.7 GB, 1.7 GB, 1.3 GB downloads on first load.

**Decision rule once numbers exist**: Instinct = the smallest model with strict-valid >= 95% (or grammar mode), memo-compliance >= 70%, p95 decision <= 1.5 s on the GTX 1050; otherwise the shipped default stays reflex + memo rules in-browser and the local model is the optional "power mode" (still Meta Llama 3.2 for the open-weights story).

## Spike A: Worker proxy and spend guard. Status: DONE
Live check on 2026-10-27 through `wrangler dev` with the real keys: Baseten `muse-spark-open-1026` one-word reply 2.7 s, $0.0007 (155 in / 156 out incl. reasoning); Meta `muse-spark-1.3` 3.5 s, $0.0013 (22 in / 289 out). Reasoning tokens dominate small calls, so Cortex calls need `max_tokens` >= 400, and a typical memo call is on the order of $0.003 to $0.01. Ghost KV and static assets verified locally. Unit tests: `worker/test` (58). Codex review fixed five issues (token bound by UTF-8 bytes, release only on explicit HTTP errors, usage required, body-read timeout, fail-closed geo for XX/T1/UA).

## Spike B-native (2026-10-27, GTX 1050 4 GB, llama.cpp b11934 CUDA 12.4, `-ngl 99`)
Same 32 scenarios and scoring via `client/src/spike/native.ts` against `llama-server` (temperature 0, max 8 tokens, no prompt cache). Models: bartowski Llama-3.2-{1B,3B}-Instruct Q4_K_M GGUF.

| model | valid | sane (plain) | follows memo | p50 / p95 | prefill / decode tok/s | VRAM |
|---|---|---|---|---|---|---|
| 1B free / grammar | 100 / 100% | 30 / 30% | 50 / 50% | 0.19 / 0.21-0.22 s | ~1080 / 56 | <1 GB |
| 3B free / grammar | 100 / 100% | 70 / 70% | **100 / 91.7%** | **0.49 / 0.57-0.59 s** | ~380 / 24 | ~2.3 GB |

Voice-line check (3B, `buildVoicePrompt` in `client/src/game/instinct.ts`, grammar `move: line`, temp 0.7, 20 turns of real fights): 20/20 valid, p50 0.54 s, p95 0.77 s, lines in character ("guard: Protect my coach, not myself").

**Verdict**: native 3B passes the decision rule (valid 100%, memo >= 70%, p95 <= 1.5 s); 1B native is 8x faster than WebGPU but just as weak (quality = weights, not runtime). So: browser stays the default (no install; 1B or rules-only), and **power mode = the same browser game talking to a local `llama-server` with Llama 3.2 3B** on 127.0.0.1:8080. No Unity port needed to get native inference. llama-server answers CORS preflight for any origin; it does not send `Access-Control-Allow-Private-Network`, so an https page calling 127.0.0.1 must be verified in Chrome at deploy (Local Network Access prompt).

## Live eval (2026-10-28, Baseten `muse-spark-open-1026` via `wrangler dev`, ledger cap forced to $0.50/day)
`npm run eval -- --live`: one Teach ("Be gentle with hurt enemies and guard when they wind up a heavy hit.") from an empty memo, then Reflect on the taught pet's own fights. Paired seeded fights; heldout = 1000 fights on seeds the coach never saw. Scripted coach (free double) for reference: heldout 60.5% -> 88.0% (+27.5 pts).

| run | change | Teach result | Reflect |
|---|---|---|---|
| 0 | original prompt, max 1500 tokens | cut off (reasoning used the budget). Same prompt at 2000: 1633 output tokens; memo = guard heavy, emote when enemy <40%: **heldout 60.5% -> 20.0%** (emote never wins) | not reached |
| 1 | prompt: plain befriend/emote facts ("befriend a hurt/scared enemy, never emote at it"), "keep reasoning brief"; max 4000 (worker cap raised from 2000) | 3 rules, **60.5% -> 88.0% (+27.5 pts, 95% CI 24.7..30.4, p=6e-73)**, $0.0078 | cut off at 4000 |
| 2 | Reflect prompt: 2 replays instead of 4, "change at most two rules, else return unchanged" | **60.5% -> 88.9% (+28.4 pts, CI 25.5..31.4, p=1.5e-75)**; brute 21->98, bully 6->54; $0.0084 | still cut off at 4000 |

Spend for this eval: $0.075 (ledger 0.0066 -> 0.0814). Cost per Teach ~ $0.008 (~530 in incl. 512 cached, ~1600-1900 out, mostly reasoning), 7-10 s.
Open: Reflect ("Learn from my fights") still exceeds 4000 output tokens, so the game falls back to the offline coach there. Next ideas (untested): Meta `muse-spark-1.3` for Reflect, a reasoning-effort parameter if Baseten exposes one, or summarize replays to per-enemy outcome lines instead of turn logs.
