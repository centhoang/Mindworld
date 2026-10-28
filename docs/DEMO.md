# Demo video + submission text (DRAFT, 2026-10-28)

Claude drafts, the user records and submits. 3 minutes max, so about 380 spoken words. Numbers are from `docs/SPIKES.md` / `docs/FINETUNE.md`; re-check them before recording.
Record on https://pets.uryto.dev in the TEMP Chrome (power mode allowed) at 1x speed, 1080p. Clear the save first (`localStorage.removeItem("petmind.v1")`) so the pet starts uncoached.

## Script (time / screen / voice)

**0:00-0:10. Opening line (required).** Title card "Pet Mind", then the empty arena.
> "Everything in this repo was built during the hackathon, Oct 27 to Nov 4. Nothing pre-existed: I used only open-source libraries and Meta's models."

**0:10-0:30. The problem.** The uncoached pet loses to the Brute (log shows `instinct` tags).
> "Game AI either follows a fixed script or calls a big model for every move, which is slow and costly. Pet Mind splits the brain in two: a small Meta Llama on your own device makes every move, and a big Meta model coaches it between fights."

**0:30-1:05. Teach by voice → Prove.** Press Speak and say "When the big one winds up a heavy hit, guard. Make friends with hurt enemies." Show the transcript, the memo rules and the Proof panel.
> "I teach it out loud. Muse Voice Transcribe turns my voice into text, Muse Spark Open turns the lesson into a few checked rules, and the game proves it on 1,000 fresh fights the coach never saw: win rate up about 27 points, with a confidence interval, not a cherry-picked replay."

**1:05-1:30. Watch it win.** "Watch a fight it now wins": log tags flip to `memo #1`, speech bubbles from the local model.
> "Now the pet guards the heavy hit by itself. The move and the voice line come from Llama 3.2 3B running on my GPU, or from a 1B model inside the browser on WebGPU. No server call per move."

**1:30-2:05. The Reader boss.** Boss fight with the obvious memo: log shows `read memo #2`, feints, loss. Then teach "it fakes its tells; burn its focus, then befriend it when it looks calm", fight again, win by befriending.
> "The boss reads your pet's memo. When a rule would fire, it fakes the tell and counters. Obvious rules lose. Teaching it a smarter plan wins: you are coaching a mind, not grinding stats."

**2:05-2:35. Free local coach.** Power mode: tick "Free coach", Teach again with no cloud call.
> "I distilled Muse Spark Open into a free local coach: about 2,500 checked lessons, LoRA fine-tuned Llama 3.2 3B on Modal. On 100 held-out lessons the student lifts win rate 23.8 points, slightly more than its 21.6-point teacher, so players keep learning for free after the event."

**2:35-2:55. Ghosts and safety.** Share the pet as a ghost, then fight a random ghost on another player's plot. Briefly show `/api/spend`.
> "Coached pets become ghosts other players fight on their own device. Every paid call goes through one Cloudflare Worker with hard spend caps, rate limits and a geo-block; if the cloud is down, the game keeps playing on rules."

**2:55-3:00. Close.**
> "Pet Mind: a pet that thinks on your device and learns from Meta's models. Play it at pets.uryto.dev."

## Submission text

**Name:** Pet Mind
**Tagline:** Teach a pet that thinks for itself: a small Meta Llama decides every move on your device, Muse Spark coaches it, and every lesson is proven on fresh fights.
**Problem statement:** Push the Frontier (recommended: an on-device agent + cloud coach whose learning is measured), or Build for Your World. User decides.

**What it does.** You raise a pet that fights, makes friends and lives on a home plot you decorate. You teach it in plain words or by voice. The coach turns your lesson into a small set of checked rules, and the game immediately proves the lesson on 1,000 paired fights the coach never saw. A boss reads your pet's rules and counters the obvious ones. Coached pets become ghosts other players can fight.

**How Meta models are used (all load-bearing):**
- Muse Spark Open (Baseten): Teach, from plain-language lessons to a validated rule memo; +27 pts held-out win rate, about $0.005 per lesson.
- Muse Spark 1.3 (Meta Model API): Reflect, reviewing recent fights and proposing a revised memo, adopted only if it doesn't lose on training seeds.
- Muse Voice Transcribe (Meta Model API): voice teaching.
- Muse Spark Open (Modal): cloud chooser for players without a GPU.
- Llama 3.2 3B (llama.cpp, power mode) and 1B (WebLLM in the browser): the on-device Instinct that picks moves and speaks.
- Distillation: Muse Spark Open as teacher, about 3,200 generated lessons, LoRA SFT of Llama 3.2 3B/1B on Modal. The tuned 3B coach lifts held-out win rate 23.8 pts (teacher 21.6, untuned 3B -3.0).

**Technical depth.** Deterministic seeded battle sim with paired-seed evaluation (bootstrap CI, exact sign test); a closed rule DSL so model output is validated, rendered and executed; grammar-constrained local decoding; one Cloudflare Worker serving client + API with Durable Object spend ledger (atomic worst-case reserve), per-client limits, geo-block; KV ghost store; graceful fallback at every layer (cloud → local model → rules).

**Links:** live https://pets.uryto.dev · repo (public on Nov 3) · video.

## Before recording (checklist)
- [ ] Re-run `npm run eval` and one live Teach; update the numbers above if they moved.
- [ ] Repo public + HF coach repos public (user's call, default Nov 3); README quick start works for a stranger.
- [ ] Pre-warm Modal (the cloud chooser cold-starts) a few minutes before recording.
- [ ] Check the boss "smart memo" wins on camera (befriend is a chance: emote twice first, or retake).
