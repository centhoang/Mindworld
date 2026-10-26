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
- **No Meta model is phone-sized** (smallest = 30B). On-device phone inference of a Meta model is not realistic.
- Muse Code = Meta's coding agent. Docs: dev.meta.ai/docs/models, github.com/meta-models/meta-model-cookbook, github.com/meta-models/meta-oss-cookbook.

## Rules
- Repo public. New work only; demo must show only what was built in the event. Existing codebase out of the repo: fresh standalone repo; open the video with one line on what pre-existed.
- Banned/avoid: medical/mental-health advice, basic RAG, simple image analyzers, generic education chatbots, job screeners, nutrition coaches, personality analyzers, sports analyzers/coaches, anything political or war-related. No unlicensed code/data/assets.
- Submission: one rep per team; 3-min demo video + public repo + all contributor names. Links must work.

## Judging
Stage 1 pass/fail: fits theme and reasonably uses Meta Model API and/or open weights. Stage 2 scores 0–10: Impact 30%, Use of Meta AI tooling 25% (go beyond basic integration), Demo 25%, Technical depth & execution 20%. Stage 3: top 5 per track, finalists' videos watched live.

## Prizes
- Indie Developer track: $150k / 100k / 75k / 50k / 25k. Startup track: $250k / 150k / 75k / 50k / 25k.
- Bonus: Most Viral $20k (X post, engagement through Nov 8), Best Build on Meta Open Weight Models $10k (Glimmer or Spark Open on own hardware/partner inference; partner verifies), Community Vote $10k, Best Agentic Use-Case $5k, Best Creative Build $5k (Muse Image or Muse Wonder).

## Credits (user must claim; each person individually)
- Meta Model API: $150, via CV claim form (ask in Discord #questions); needs a credit card; pre-auth charge is released later; set a Spend Limit notification, it doesn't auto-stop billing.
- Baseten: apply for $100 + 2M TPM (≤ 2,000 people, reviewed by use case). Use model ID `meta-models/muse-spark-open-1026`.
- Modal: $100 for the first 1,000 participants (Endpoints for Meta open-weight models, serverless GPUs, sandboxes, training). Fireworks: $25 for shortlisted teams.

## Channels
Website cerebralvalley.ai/e/meta-ai-developer-hackathon (/details, /discord, /live). Discord: #announcements, #questions, #intros, #team-search, #office-hours, Baseten channel. Announcements keep arriving; the saved snapshot is from Oct 26 ~noon.
