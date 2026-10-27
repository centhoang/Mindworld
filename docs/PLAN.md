# Game plan: "Pet Mind" (working title). v2, 2026-10-27. Browser-first approved by user

## One-line pitch
Raise a pet that thinks for itself, on a floating home you decorate and can link to other players' homes. A small model on your device plays the pet's moment-to-moment choices; a Meta model (Muse Spark Open) coaches it between rounds, so the pet visibly learns and develops a personality.

## Rules fit (verified against Official Rules, Credit Terms, Geographic Use Policy on 2026-10-27)
- Official Rules: participants "build with Meta AI products, including Muse Spark, Glimmer, SAM 3"; nothing bans other models/tools/engines; open source allowed if licenses are followed; submission must be our own work; Organizers get a non-exclusive license to the Submission (we keep ownership).
- Stage 1 and the 25% "Meta tooling" score need Meta models to be load-bearing. Discord ruling (2026-10-27): non-Meta models are allowed alongside Meta's if Meta's are a real part of what runs, and open Meta models like Llama count as Meta models for Stage 1 and the tooling score. So the Instinct defaults to Llama 3.2 1B/3B (whole stack Meta), Gemma-class only as a fallback if quality is poor; Meta's Spark Open stays the coach in the loop (design below).
- Credit Terms: one Meta account per person (never create a second account), credits don't expire, spend beyond credits never required and never affects judging. While on free credits Meta "may use your content for product improvement": the game must show a notice and never send personal data.
- Geographic Use Policy: no serving end users in restricted territories (China, Russia, Iran, Pakistan, etc.). Geo-block in the Worker (CF-IPCountry).
- Targets: Indie track + Best Build on Open Weights ($10k) + Best Agentic ($5k) + Most Viral ($20k) + Community Vote ($10k); Best Creative ($5k) only if Muse Image/Wonder is used.

## Two-tier pet brain
1. **Instinct = guarded chooser + voice (decided 2026-10-27 after spike B, docs/SPIKES.md)**: the memo rules compute the *allowed* moves (veto bad or memo-violating ones; the deterministic `memoPolicy` is the fallback and what the eval measures). The local Llama 3.2 1B (WebGPU; ~1.6 s with a long prompt on a GTX 1050, so keep prompts short) picks among the allowed moves by personality/mood with grammar-constrained decoding and writes short voice lines (emotes, taunts, reactions). Timeout ~1.5 s, device loss or no WebGPU → rules-only with canned voice lines. Optional power mode: native Ollama/llama.cpp.
2. **Cortex (Meta, async)**: after each fight/chat/visit, Muse Spark Open reads the replay and writes a compact *memo* (strategy, grudges, friends, personality shifts) that is injected into the Instinct prompt. Player can teach in plain language. Cortex writes pet-to-pet dialogue; stretch: merges two pets' memos when breeding.
- Measured (smoke test 2026-10-27): both endpoints work; a trivial call took ~1.5–1.8 s and ~115–135 reasoning tokens (reasoning is on by default). So Cortex = async only; a cloud Instinct fallback is acceptable only for turn-based moments.
- Evidence for judges: coached vs uncoached win-rate over N rounds, latency, tokens/cost per round, replayable decision logs (verifiable agent).

## World (user's addition) and loop
- **Home plot**: each player owns a floating platform with an A-frame house; decorate with placeable items; the pet roams and interacts using Instinct (alive, shows the local model).
- **Neighborhood**: when online, your plot links by bridges to other players' plots (live players, or ghosts), with seeded filler plots between them (biome ground, market, event, arena). Visit, discover, fight, befriend.
- **Pets** are procedural modular parts (genes → body, ears, tail, colors): zero art dependency; breeding = gene crossover + merged memo (stretch). Muse Image only for optional portraits.
- Loop: hatch → feed/teach → explore neighborhood → arena fight (turn-based, 3–5 actions) → Cortex reflection → pet changes → social visit → decorate.

## Tech
- TypeScript + Vite + three.js (orthographic low-poly, procedural meshes). Local model via WebLLM/transformers.js (WebGPU).
- Cloudflare (user's uryto.dev is on Cloudflare): Pages for the client, Workers for API, Durable Objects/KV for lobby, signaling and **ghost snapshots** (traits + memo). All paid LLM calls go through a Worker proxy (keys never in the browser; server-side `MAX_DAILY_USD`, per-IP/session limits, geo-block, decision cache).
- Live visits/fights (T2): WebSocket rooms on a Durable Object (serverless, free tier; tiny turn messages). WebRTC P2P only as a stretch, because STUN can't guarantee connectivity and a Worker relay would be a separate transport (Codex review). Ghost opponents run on the challenger's device using the ghost's memo, so no server inference.
- Storage: ghost snapshots in KV (eventual consistency is fine); lobby and **spend counters in Durable Object transactional storage** (KV is unsafe for counters). Before every paid call the Worker atomically reserves worst-case cost (input + max reasoning/output tokens) and refuses over the daily/event budget; retries and output length bounded. Note Meta's $150 and Baseten's $100 are separate budgets.

## Network decision log
- Meta Horizon networking rejected (Quest-oriented, gated, no rubric payoff).
- Epic Online Services (user has experience; free relay/lobbies/P2P) has native SDKs only (to my knowledge no browser SDK), so it doesn't fit a browser client; revisit only if we ship a Unity build.
- Multi-hop relay through other players: out of scope (high risk, invisible in a 3-min demo).

## Signature moment: "Teach → Prove" (from Codex review)
Player types an instruction ("stop charging at bigger enemies") → Cortex (Muse Spark Open) produces a validated memo/policy change → the app replays the same seeded fight before vs after with success numbers side by side. Makes Meta's causal contribution and player control instantly judgeable; also the eval harness (paired seeds, held-out scenarios).

## Where each model runs
- **Instinct**: on the player's own device. Default = in the browser tab (WebGPU, weights cached locally, no server calls) so judges need no install; optional "power mode" = native runtime on the same machine (Ollama/llama.cpp on localhost, or a Unity/Android build) for bigger models. Not on our servers.
- **Cortex**: cloud, Meta models only (Muse Spark Open via Baseten key; Muse Spark API via Meta key), always through the Worker proxy.
- **Ghost pets**: their memo is stored in KV; the challenger's device runs the ghost's Instinct.

## Scope tiers (cut from the bottom; Codex warned 8 solo days is tight)
T0 pet + Instinct + arena fight vs ghost + Cortex memo + Teach→Prove + eval numbers, deployed and stranger-playable by Oct 29-30. T1 one attractive home plot + a few decor items + neighborhood strip + persistence. T2 live visits over WebSocket rooms. T3 WebRTC, breeding/portraits, voice teaching, fine-tune.

## Timeline (ET; today Oct 27, deadline Nov 4 9 PM, submit early; user is UTC+7)
- Oct 27: decisions; repo scaffold; spikes (local model quality/latency; Worker proxy + cost guard).
- Oct 28–29: T0 vertical slice with coaching loop and eval harness.
- Oct 30: T1 home plot + neighborhood + ghosts deployed to a uryto.dev subdomain; Fireworks session (optional).
- Oct 31: social chat, persistence, T2 WebRTC visit if stable.
- Nov 1: UX for strangers (30-second onboarding), polish, rate limits, privacy notice.
- Nov 2: record 3-min demo (open with what pre-existed vs built this week), README, X post draft.
- Nov 3: bug bash, freeze. Nov 4: submit early afternoon ET (user clicks).
