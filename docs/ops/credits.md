# Credits and where each one goes (checked 2026-10-28, dashboards read via Claude in Chrome)

## Ledger
| Provider | Granted | Left | Expires | Safety | Used for now |
|---|---|---|---|---|---|
| Meta Model API (dev.meta.ai) | $150 | **$149.91** (10 requests, 5.5k in / 17.7k out tokens) | never (Credit Terms §3.7: usable after the event); credits are consumed before the Visa ···0167 on file | card = overspend path, keep `MAX_TOTAL_USD_META` | Reflect on `muse-spark-1.3` (effort low) |
| Baseten | $100 + 2M TPM (if approved) | **Not visible**: the credit is bound to the hackathon API key, the dashboard shows none (user checked 2026-10-28). Measure by the Worker ledger (about $0.14 spent) | unknown | Worker `MAX_TOTAL_USD_BASETEN=50` | Teach on `meta-models/muse-spark-open-1026` |
| Modal | $100 grant + $1/month Starter | **$101.00** (grant $100/$100 active, "Meta Global AI Developer Hackathon") | **Oct 31 2027** per dashboard (the email said "duration of the hackathon": plan as if Nov 4, treat 2027 as bonus) | **No card on file: hard stop at the $101 usage limit.** A card unlocks H100/A100/L40S/H200 (see result below) | shared Spark Open endpoint `spark-open` (live) |
| Fireworks | $25, shortlisted teams only | not eligible yet | n/a | | Glimmer 30B SFT is free until 11/30 (no card) |
| Cloudflare | free tier | n/a | n/a | | Worker, DO ledger, KV |

Total LLM spend so far: **$0.21** (Worker ledger 0.2148). Credits are not the constraint; time and score are. Spend them on things that raise the score, but keep Meta's $150 as the judging-window bank (it does not expire).

## What Modal offers (docs read 2026-10-28)
- **Shared Endpoint, Muse Spark Open** (text, image, audio): per token, $1.25 in / $0.15 cached / $4.25 out per 1M. Same price and same model as Baseten. About $0.008 per Teach, so $100 is roughly 12,000 Teaches.
- **Dedicated Endpoint, Muse Glimmer 30B** (BF16 and NVFP4 recipes): billed at standard GPU/CPU/RAM rates, scales to zero (idle = $0), min/max/buffer containers from the dashboard, OpenAI-compatible `/v1/chat/completions`, auth by Modal proxy token (`Authorization: Bearer wk-<id>.ws-<secret>`). Custom weights (HF repo or Modal Volume) are served with the same recipe, so a fine-tuned Glimmer can be hosted.
- Snapshot GPU rates (verify at creation): L4 $0.80/h, L40S $1.95/h, A100-80 $2.50/h, H100 $3.95/h. Always-on for a day: L40S $47, A100 $60, H100 $95. So never leave a big GPU warm for days; warm it only for benchmarks, the demo recording and the judge window.

## Result of the first Modal session (2026-10-28)
- **Card gate:** on a workspace with no payment method Modal refuses H200 (the Glimmer endpoint recipe), H100, A100-80GB and L40S ("Please add a payment method to use <GPU> GPU functions"). So dedicated Glimmer 30B (needs >= 48 GB even in FP8) cannot run until a card is added; if it is, set the usage limit to $100 at once (the dashboard counts credit use against that limit). `modal/glimmer_server.py` (own vLLM app, scale to zero, proxy-token auth) is written and untested for that case.
- **Shared Spark Open works without a card:** endpoint `spark-open` (`ep-DWE3Fny8Zd36VuNFKMbv4E`), model `meta-models/Muse-Spark-Open-816B-A42B`, OpenAI-compatible, proxy token. Measured: 1.6-2.6 s for 430-750 output tokens (about 280 tok/s, mostly reasoning), 0.7 s trivial call; one cold first call took 28 s. Baseten Teach was 7-10 s for 1600-1900 tokens. Cost per call about $0.001-0.003.
- Worker now has providers `modal` (this endpoint) and `glimmer` (dedicated, optional); live check through `wrangler dev` passed ($0.0012). Caps: `MAX_TOTAL_USD_MODAL=20`, `MAX_TOTAL_USD_GLIMMER=30`. Tests 99.
- Secrets in `.env` only: `MODAL_PROXY_TOKEN`, `MODAL_BASE_URL`, `MODAL_MODEL`. Set `MODAL_PROXY_TOKEN` and `MODAL_BASE_URL` as Worker secrets at deploy.
- Baseten: its $100 credit is tied to the hackathon API key and does not show in the dashboard; only the Worker ledger measures it.
- Open idea (user decision): at ~280 tok/s a cloud chooser on Modal Spark Open is viable (~$0.006 per 10-move fight), which would give strangers a real Meta-model Instinct without Glimmer or a card.

## Update after the card was added (2026-10-28, later)
- User added a card (no funds on it, so charges would fail rather than bill). Credits now **$129.98** = $100 grant (to Oct 31 2027) + $30/month Starter credit; usage limit $142.50 (includes credits; "Lower usage limit" in the dashboard if a tighter stop is wanted).
- **Glimmer 30B deployed** (`glimmer-instinct`, H100, vLLM 0.32.0, FP8 online quantization of the official BF16 weights, 32 GiB, scale to zero, 5 min scaledown, proxy-token auth, `modal/glimmer_server.py`). vLLM recognises the architecture. Measured: **cold start 7.7 min**, ~70 tok/s decode, chooser prompt 2.7-4.4 s; raw output carries channel markers ("to=self") because no reasoning parser is set, so it needs a parser/chat-template flag before it is usable for text. Verdict: fine as "Glimmer on partner inference" evidence and for non-blocking voice/NPC lines, **too slow and too cold for the per-move chooser**. Keeping it warm costs ~$3.95/h (~$95/day): only for a recording or the judge window.
- **Cloud chooser on Spark Open (Modal)** benchmarked with the real prompt: 0.9-2.8 s per move, reasoning 140-300 tokens, so `maxTokens` must be 600 (300 returned empty content half the time). Real UI fight (Worker with real keys): moves tagged "Muse Spark Open", 5 moves cost $0.008 (~$0.0016 per move, ~$0.016 per ten-move fight).
- Bug found only in the browser: `CloudVoice` stored bare `fetch` and called it as a method ("Illegal invocation", swallowed by the probe's catch). Fixed with a wrapper plus a regression test. Lesson: mocked-fetch unit tests cannot catch this; verify new network code in the pane.

## Plan (Modal $100), original
1. **Muse Glimmer 30B dedicated endpoint as the hosted Instinct (~$50).** Every stranger gets a real Meta open-weight chooser with no install (the 1B in the browser is too weak, native 3B needs an install). Counts toward "Best Build on Meta Open Weight Models" ($10k, partner inference, partner verifies). Worker adds `provider: "modal-glimmer"`; the game keeps its guarded fallback to `memoPolicy` on timeout or cold start. Report its numbers separately from the proxy eval, as for the local model.
2. **`modal` shared Muse Spark Open as third Cortex provider (<= $10).** Baseten -> Modal failover; resilience if the X post goes viral. Same pricing as Baseten, so only the `Provider` type, a price row and one fetch branch in `worker/src/{pricing,providers}.ts`; add `MAX_TOTAL_USD_MODAL`.
3. **Stretch (~$30): SFT of Glimmer on Muse-taught battle moves, served as a custom-weights Modal endpoint.** Try Fireworks' free Glimmer SFT first (Oct 30 session). Only if 1 is verified by Nov 1.
4. Reserve $10.

Per-second GPU spend cannot be counted by the Worker ledger (it counts tokens). Control it with scale-to-zero, a short scaledown window, and the $101 hard stop.

## Unverified / to check
- Baseten balance and expiry (user).
- GPU and rate Modal picks for Glimmer 30B BF16 vs NVFP4, cold-start time, per-move latency warm (target <= 1 s, else keep it a "voice" and not a chooser).
- dev.meta.ai now lists Muse Wonder / Wonder Full (agentic coding model) and a Muse Code CLI subscription; API availability and price not checked. Do not buy a subscription.
- How Modal verifies the open-weights bonus (ask generically in the hackathon Discord #modal).
