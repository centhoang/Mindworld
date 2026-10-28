# Demo video + submission text: Mindworld (DRAFT 2026-10-29, for the user's review)

Claude drafts, the user records and submits. Track: **Build for Your World**. 3 minutes max, about 380 spoken words.
Numbers come from `docs/SPIKES.md` / `docs/FINETUNE.md`; re-check them before recording. Lines marked **[USER]** need your words or your OK.

Setup: record https://pets.uryto.dev at 1x, 1080p, in the TEMP Chrome (power mode allowed). Use two browser profiles (or a second device) signed in to nothing, so two players are online. Clear the save in profile A first (`localStorage.removeItem("petmind.v1")`) so it hatches a fresh pet and starts uncoached.

## Script (time / shot / voice)

**0:00-0:08. Opening line (required by the rules).** Title card "Mindworld", then the floating islands.
> "Everything in this repo was built this week, October 27 to November 4. What pre-existed: only open-source libraries and Meta's models. No code from my earlier projects."

**0:08-0:25. The problem, firsthand.** Profile A walks from the A-frame cabin; a freshly hatched random pet follows.
> **[USER]** "I love games with pets, but their 'AI' is a script: they never learn from you. I wanted a world where every pet has a mind its owner actually teaches, and where you meet other people's pets."

**0:25-0:45. The world talks back (Muse Spark).** Walk to Elder Moss, press E: Muse greeting in a bubble. Type "how do I beat the big one?" and get an in-character tip. Walk to a wild Bully and ask "why so grumpy?".
> "The elder and the wild pets answer in character through Muse Spark, behind a capped, cached Cloudflare Worker. If the budget runs out, they fall back to scripted lines, so the world never goes silent."

**0:45-1:20. Teach by voice, then prove it (Muse Voice Transcribe + Muse Spark Open).** Lose to the Brute first (log shows `instinct`). Press Speak: "When the big one winds up a heavy hit, guard." Show the memo rules and the Proof panel. Watch a fight it now wins (log flips to `memo #1`).
> "I teach out loud. Muse Voice Transcribe turns my voice into text, Muse Spark Open turns the lesson into a few checked rules, and the game proves it on 1,000 fresh fights the coach never saw: about plus 27 points win rate, with a confidence interval."

**1:20-1:45. A free coach on your own GPU (tuned Llama 3.2).** Power mode on, tick "Free coach", Teach again: no cloud call; bubbles from the local model.
> "I distilled Muse Spark Open into a free local coach: LoRA-tuned Llama 3.2 3B. On 100 held-out lessons it lifts win rate 23.8 points, slightly beating its 21.6-point teacher, so players keep learning for free after the event."

**1:45-2:30. Your world, together (live layer).** Split screen, profiles A and B. B appears on A's island with name tag and pet; B waves (emote), types "hi! duel?" (bubble + room log). A walks up, presses "Duel": the invite pops on B, Accept. Both screens show the same fight, mirror-imaged: each pet follows its owner's rules. The winner gets coins.
> "This is a shared world. Players online right now walk on the same islands, chat and emote. And you can challenge another player's pet: both pets fight with the rules their owners taught, and both screens run the same seeded fight, so the result is identical for both."

**2:30-2:50. Cozy loop.** Coins buy decor at the market; place a pond on the A-frame porch; sit on the porch with the pet. Quick cut of the Reader boss reading a memo (`read memo #2`).
> "Wins buy decor for your cabin. The boss reads your pet's rules and counters the obvious ones, so you coach a mind, not grind stats. Offline? Other players' coached pets still visit as ghosts."

**2:50-3:00. Close.**
> "Mindworld: pets that think, taught by you, powered by Meta's models. Play at pets.uryto.dev."

## Shot list (timings)
| # | Time | Shot | Prep |
|---|------|------|------|
| 1 | 0:00-0:08 | Title card over the island grid | Zoom out with the wheel |
| 2 | 0:08-0:25 | Hatch: fresh random pet follows avatar from the cabin | Cleared save in profile A |
| 3 | 0:25-0:45 | Elder greeting + one question; wild Bully reply | Live Worker (Muse), voices on |
| 4 | 0:45-1:20 | Lose to Brute, Speak lesson, memo, Proof bars, win replay | Mic allowed |
| 5 | 1:20-1:45 | Power mode, Free coach Teach | llama-server running (power-mode script) |
| 6 | 1:45-2:30 | Two players: emote, room chat, duel invite, mirrored fight, coins | Profiles A + B side by side |
| 7 | 2:30-2:50 | Market buy, porch decor + chill, boss read | Coins from shot 4/6 |
| 8 | 2:50-3:00 | Close on the islands + URL | |

## Every Meta model use (call it out on screen or in voice)
- **Muse Spark Open** (Baseten `meta-models/muse-spark-open-1026`): NPC chat for the elder and wild pets (Worker `/api/chat`, capped per player and per day, cached greetings, scripted fallback); Teach (lesson to validated rule memo); cloud move chooser (Modal deployment) for players without a GPU.
- **Muse Spark 1.3** (Meta Model API): Reflect, reviewing recent fights and proposing a revised memo (kept only if it does not lose on training seeds).
- **Muse Voice Transcribe** (Meta Model API): voice teaching.
- **Llama 3.2 3B / 1B, fine-tuned** (LoRA on Modal, distilled from Muse Spark Open, about 2,500 checked lessons): free local coach; 3B +23.8 pts held-out (teacher +21.6, untuned 3B -3.0). Also the on-device Instinct and pet voice (llama.cpp power mode, WebLLM 1B in the browser).
- Not a model call: duels, ghosts and the boss run the pets' memo rules in a deterministic sim; say so if asked.

## Submission text
**Name:** Mindworld
**Tagline:** A cozy shared world of floating islands where every pet has a mind its owner teaches, by voice, and proves, powered by Meta's models.
**Track:** Build for Your World.

**What it does.** Each player hatches a pet with a random look and gets an A-frame cabin corner on a world of floating islands. You walk around, talk to the elder and wild pets (Muse Spark answers in character), fight or befriend wild pets, and teach your pet in plain words or by voice. The coach turns each lesson into a few checked rules, and the game proves the lesson on 1,000 fights it never saw. Players online at the same time see each other, chat, emote and duel pet against pet; both screens run the same seeded fight from each owner's rules. Coins from wins buy cabin decor. Offline, other players' pets visit as ghosts.

**How Meta models are used:** see the list above (all load-bearing: no Meta model, no coaching, no talking world, no free coach).

**Technical depth.** Deterministic seeded battle sim with paired-seed evaluation (bootstrap CI, exact sign test); a closed rule DSL so model output is validated, rendered and executed; distillation of Muse Spark Open into Llama 3.2 with a held-out bench; one Cloudflare Worker serving client + API with a Durable Object spend ledger (atomic worst-case reserve, per-player and per-feature quotas), geo-block, KV ghost store; a live world room on a Durable Object with WebSocket hibernation (validated, rate-limited messages; positions only while moving, at most 10 per second); graceful fallback everywhere (cloud, then local model, then rules; live, then ghosts).

**Links:** live https://pets.uryto.dev · repo (public on Nov 3, the user's call) · video.

## Before recording (checklist)
- [ ] **[USER]** Confirm the opening line (pre-existed vs built this week) and write the firsthand problem in your own words.
- [ ] Re-run `npm run eval` and one live Teach; update the numbers if they moved.
- [ ] Two players online: second profile or device; check the duel and room chat on the deployed site (not just `wrangler dev`).
- [ ] Repo public + HF coach repos public (user's call, default Nov 3); README quick start works for a stranger.
- [ ] Pre-warm Modal (the cloud chooser cold-starts) a few minutes before recording.
- [ ] Check the boss "smart memo" wins on camera (befriend is a chance: emote twice first, or retake).
