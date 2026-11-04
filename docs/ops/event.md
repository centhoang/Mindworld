# Event facts (distilled 2026-10-26 from the saved CV pages + FAQ; re-verify on the live site/Discord)

Meta Global AI Developer Hackathon, hosted by Meta + Cerebral Valley (CV). Virtual. Max 20k participants, teams ≤ 4 (all members must be approved; no outsiders).

## Dates (all ET)
- Oct 26 noon: kickoff. Oct 27 – Nov 4: building period.
- Live sessions noon–1 PM: Oct 27 Agents 101 (multimodal agent), Oct 28 Agents 102 (verifiable agents), Oct 30 Fireworks: inference + training with Muse open models.
- Office hours (Meta, Discord #office-hours, text only): weekdays 10–11 AM.
- **Nov 4, 9 PM: submission deadline** (Nov 3 = last full day for questions). Judging Nov 5–8. Nov 9 noon: closing ceremony, live finals. Nov 16: community vote winner.
- Meta credit claim also due Nov 4, 9 PM.

## Problem statements (project must build toward one)
- Build for Your World: solve a problem you know firsthand.
- Push the Frontier: new capabilities for software, robotics, science, manufacturing, energy, real-world systems.

## Models
- Meta Model API (hosted): muse-spark-1.3 (recommended), 1.2, 1.1, muse-wonder-1.0 (preview), muse-image-1.0, muse-voice-transcribe-1.0, sam-3.1. Spark/Wonder: text+image+video+audio+PDF in, text out, 1M context, tool calling + structured output. Fine-tuning not stated.
- Open weights: **Muse Glimmer** = 30B multimodal (text+image), Apache 2.0, "always-on local agents", reliable tool calling, persistent state, self-managed memory, fits a single consumer GPU/Mac (HF `meta-models/Muse-Glimmer-30B`; llama.cpp, vLLM, Ollama, ExecuTorch guide listed). **Muse Spark Open** = 816B MoE, 42B active, text/image/video/audio in; has a "commentary" channel where it states intent before acting; hosted on Baseten, Modal, Fireworks, etc. Both support SFT + RL fine-tuning.
- **No Muse model is phone-sized** (smallest = Glimmer 30B). Older Meta open weights Llama 3.2 1B/3B are small enough for browser/phone, but they DO count as Meta models for Stage 1 and the tooling score (Discord ruling 2026-10-27) but not for the Open Weight bonus (Glimmer/Spark Open only).
- Muse Code = Meta's coding agent. Docs: dev.meta.ai/docs/models, github.com/meta-models/meta-model-cookbook, github.com/meta-models/meta-oss-cookbook.

## Rules
- Repo public. New work only; demo must show only what was built in the event. Existing codebase out of the repo: fresh standalone repo; open the video with one line on what pre-existed.
- Banned/avoid: medical/mental-health advice, basic RAG, simple image analyzers, generic education chatbots, job screeners, nutrition coaches, personality analyzers, sports analyzers/coaches, anything political or war-related. No unlicensed code/data/assets.
- Submission: one rep per team; 3-min demo video + public repo + all contributor names. Links must work.

## Judging
Stage 1 pass/fail: fits theme and reasonably uses Meta Model API and/or open weights. Stage 2 scores 0–10: Impact 30%, Use of Meta AI tooling 25% (go beyond basic integration), Demo 25%, Technical depth & execution 20%. Stage 3: top 5 per track, finalists' videos watched live.

## Prizes
- Indie Developer track: $150k / 100k / 75k / 50k / 25k. Startup track: $250k / 150k / 75k / 50k / 25k.
- Bonus: Most Viral $20k (X post, engagement through Nov 8; no required tag or hashtag, checked 2026-11-04), Best Build on Meta Open Weight Models $10k (Glimmer or Spark Open on own hardware/partner inference; partner verifies), Community Vote $10k, Best Agentic Use-Case $5k, Best Creative Build $5k (Muse Image or Muse Wonder).

## Credits (user must claim; each person individually)
- Meta Model API: $150, via CV claim form (ask in Discord #questions); needs a credit card; pre-auth charge is released later; set a Spend Limit notification, it doesn't auto-stop billing.
- Baseten: apply for $100 + 2M TPM (≤ 2,000 people, reviewed by use case). Use model ID `meta-models/muse-spark-open-1026`.
- Modal: $100 for the first 1,000 participants (Endpoints for Meta open-weight models, serverless GPUs, sandboxes, training). Fireworks: $25 for shortlisted teams.

## Price snapshot (2026-10-26; verify before relying on it)
- Meta Model API / Muse Spark: $1.25 in / $0.15 cached in / $4.25 out per 1M tokens (1.1 confirmed by press, 1.3 single source). Press also says new accounts get $20 free credits (unverified).
- Fireworks: Muse Spark Open serverless $1.25 / $0.15 / $4.25 per 1M. Muse Glimmer 30B serverless price not listed. Glimmer 30B SFT free via UI and Serverless Training API until 11/30, no card. Otherwise LoRA SFT ~$3/1M training tokens (16-80B tier).
- Modal: Starter $30/month free compute. Per second: L4 $0.000222, L40S $0.000542, A100-80 $0.000694, H100 $0.001097.
- Baseten: Model APIs per token (Muse prices not checked); dedicated GPU per minute: L4 $0.014, A100 $0.067, H100 $0.108. New accounts get free credits (amount not listed).

## Verified legal points (read 2026-10-27)
- Official Rules (cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver): build with "Meta AI products, including Muse Spark, Glimmer, SAM 3"; one track only; open source allowed with licenses followed; submission must be own work (IP-clean); Organizers get a perpetual non-exclusive license to the Submission, entrant keeps ownership; winners need W-9/W-8BEN, paid via Tremendous within 30 days of verification. Rules say bonus prizes announced ~Nov 10.
- Credit Terms (Meta): one account per person (no duplicates, or credits revoked); $150 doesn't expire and can be used after the event; credits are consumed before the card is charged; credits optional, spending beyond them never affects judging (§3.7, §3.8). Dashboard note: while on free credits Meta may use content for product improvement.
- Geographic Use Policy: Restricted Territories (Afghanistan, Belarus, Cambodia, China incl. HK/Macau, Cuba, Eritrea, Ethiopia, Haiti, Iran, Iraq, Libya, Myanmar, Nicaragua, North Korea, Pakistan, Russia, Somalia, Syria, Crimea/Donetsk/Luhansk, Venezuela, Western Sahara): don't serve end users there. Muse Image unavailable in India.
- API endpoints: Meta `https://api.meta.ai/v1/responses` (model `muse-spark-1.3`, Bearer key); Baseten `https://inference.baseten.co/v1/chat/completions` (model `meta-models/muse-spark-open-1026`, has `reasoning_content`). Both verified working 2026-10-27 (~1.5-1.8 s trivial call, ~120 reasoning tokens).
- Discord rulings (2026-10-27, #questions, automated reply citing organizers): (1) non-Meta models may be used alongside Meta's as long as Meta's models are a real part of what the project runs (Stage 1 + Use of Meta AI Tooling are scored on it); Muse Spark Open on Baseten counts; whether a specific setup meets the bar is the organizers' call. (2) Open-source Meta models anyone can access (Llama, SAM, Demucs) count as Meta models for Stage 1 and the tooling score; the Open Weight bonus ($10k) names only Muse Glimmer and Muse Spark Open. Post 3 (#office-hours: small on-device model / ExecuTorch) asked, answer pending.
- Organizer answers (2026-10-28, all 3 questions): (1) Llama 3.2 1B/3B count as Meta models for Stage 1 and the tooling score however they run; the Open Weight bonus names only Muse Glimmer and Muse Spark Open. (2) **Every model the project calls at runtime must be a Meta model** (local player model too); browser built-in speech (speechSynthesis) for character voices is fine, since no Meta model does TTS. (3) No official on-device recipe; a small open Meta model on device next to Muse Spark Open is fine; what matters is that Meta models are a real part of what runs.
- Submission form: cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit (user clicks).

## Channels
Website cerebralvalley.ai/e/meta-ai-developer-hackathon (/details, /discord, /live). Discord: #announcements, #questions, #intros, #team-search, #office-hours, Baseten channel. Announcements keep arriving; the saved snapshot is from Oct 26 ~noon.
