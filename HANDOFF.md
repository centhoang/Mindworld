# HANDOFF (update at every milestone; keep under ~80 lines)

Last updated: 2026-10-26 (kickoff day, before the building period). Phase: **0 = setup + concept decision**.

## State
- Project folder has only setup files: CLAUDE.md, HANDOFF.md, docs/EVENT.md, .gitignore, plus the user's raw event snapshots (gitignored). No code yet, not a git repo yet.
- User: solo, 6 yrs multiplayer dev, has a private game with the same "AI-driven pet" idea (that code must NOT go into this repo; see CLAUDE.md compliance).
- Credit applications: user drafted Baseten/Modal/Fireworks answers (framed as local-model + cloud fallback + distillation + synthetic data). Keep the concept consistent with that.

## Key finding (changes the original idea)
No Meta model runs on a phone: smallest is Muse Glimmer 30B (single GPU/Mac), the other is Spark Open 816B MoE. The literal "local model on mobile per player" cannot use Meta models, and Stage 1 requires meaningful Meta model use.

## Proposed concept (awaiting user OK): "Pet Mind"
- Each player owns a pet whose brain is a persistent agent: **Muse Glimmer** (open weights; built for tool calling, persistent state, self-managed memory) served via Baseten/Modal/Fireworks; **Muse Spark API** or Spark Open for heavy/rare reasoning (and its "commentary" channel makes visible reasoning for the demo).
- Pet acts through validated tool calls (attack/guard/flee/emote/befriend/trade/gift) checked by an authoritative game server. Every decision logged and replayable = "verifiable agent" (matches Oct 28 Agents 102 session; hits Best Agentic).
- Per-player pet personality + memory (+ optional per-player LoRA via SFT/RL on open weights; Fireworks session Oct 30) = technical depth + "Best Build on Open Weights".
- On-device: tiny reflex policy distilled from Glimmer's decisions runs on the phone/browser for zero-latency combat frames; Glimmer handles strategy and social in the cloud. Keeps the "local brain" story honest.
- Multiplayer: pets of different players meet, fight, befriend, remember grudges across sessions. Demo target: playable in a browser link with no install (judges assess live product), 3-min video.
- Risk: Impact is 30% and games read as lower-impact. Mitigation: pitch as a reusable "player-owned persistent agent" framework for games, with verifiable decision logs; show real measured results (latency, win-rate vs baseline, memory recall).

## Pending decisions (user)
1. Approve concept direction above (or redirect).
2. Chrome access for Discord/website catch-up: Claude recommends yes, read-only, on demand.
3. Client platform: Claude recommends browser-playable (WebSocket server) over a Unity mobile build, because judges and voters must open it instantly and X virality needs a link. User knows their strengths; confirm.
4. Solo vs team (teammates must already be approved participants; find in #team-search). Default: solo, Indie Developer track.
5. User confirmed what "Meta's network" meant? Assumed = Meta models/API; if a Meta networking SDK was meant, tell Claude.

## Budget plan (cost-capped; partner credits are NOT guaranteed, so assume only Meta $150)
- Meta's $150 is promised to every accepted participant (claim form); partner credits are discretionary. Prices in docs/EVENT.md.
- A pet decision (~600 in / 80 out tokens) on Spark-class pricing ≈ $0.001, so $150 ≈ 130k decisions. Split: $50 dev/test, $10 demo recording, $60 live public demo (hard-capped), $30 reserve.
- Free paths that don't depend on credits: Fireworks Muse Glimmer 30B SFT is free until 11/30 (no card); Modal Starter gives $30/month free compute; Baseten new accounts get some free credits (amount unverified).
- Local run is not viable: user PC = GTX 1050 4 GB, 32 GB RAM, i5-8300H (Glimmer 30B would be CPU-only, ~1-3 tok/s). Local only for tests with mocked LLM.
- Design rules: LLM called only at decision points (not per frame); on-device reflex policy for the rest; decision cache + replay mode; every call logs tokens/cost; env `MAX_DAILY_USD` kill switch that falls back to the reflex policy; per-session rate limits on the public demo.
- Consider a virtual/prepaid card with a low limit for the Meta billing page (Spend Limit notification does not stop billing).

## User-only actions (Claude cannot do: card, forms, rules)
- Claim Meta $150 credits (form via CV; needs card; deadline Nov 4 9 PM ET). Modal $100 is first-1,000: apply now. Baseten $100 + 2M TPM: apply (done?). Accept official rules if prompted.

## Next actions (after decisions)
1. Verify which provider serves Muse Glimmer (Baseten model ID? Modal Endpoints? Fireworks?) and its latency; read meta-oss-cookbook `muse-glimmer/` folder; Spark Open ID on Baseten = `meta-models/muse-spark-open-1026`.
2. Create fresh public repo skeleton (git init, README, LICENSE, .env.example); first vertical slice: 2 pets, 1 combat round decided by Glimmer via tool calls, logged.
3. Draft 3-min demo storyline (opening line on what pre-existed) so the build targets the video.

## Gotchas
- Re-verify dates/rules on Discord #announcements; CV posts corrections (e.g. "building period officially starts after kickoff").
- Meta credits need a card; Spend Limit notification does not auto-stop billing: watch usage.
- Most Viral prize needs an X post with the demo; engagement counts through Nov 8.

## File map
- CLAUDE.md rules · docs/EVENT.md event facts · HANDOFF.md this file · EventDetails/, EventFrontPage/, Event_CURRENT_F&Qs.txt raw snapshots (don't read; gitignored)
