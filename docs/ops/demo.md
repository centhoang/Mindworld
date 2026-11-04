# Demo video + submission text: Mindworld v3 (DRAFT 2026-10-31, for the user's review)

Claude drafts, the user records and submits. Track: **Build for Your World**. 3 minutes max, about 380 spoken words.
Numbers come from `docs/archive/SPIKES.md` / `docs/archive/FINETUNE.md`; re-check them before recording. Lines marked **[USER]** need your
words or your OK. Rewritten 2026-10-31: the villagers are the star; the birthday promise is the core shot, Teach gets one beat.

Setup: record https://pets.uryto.dev at 1x, 1080p. Two windows side by side: **A** (normal profile, the "laptop
with a model") and **B** (incognito or a second device, no model). The live name is generated from the pet's genes (title +
name), not typed: note A's name before recording and say it where this script says "Kai". Let A pass the setup gate
before recording so the tuned 1B is cached (first load downloads the weights). Record in daytime: the clock is shared and real
time, so night in the world is night outside too.

## Script (time / shot / voice)

**0:00-0:08. Opening line (required by the rules).** Title card "Mindworld", then the village from above.
> "Everything in this repo was built this week, October 27 to November 4. What pre-existed: open-source libraries and Meta's
> models. No code from my earlier projects." **[USER] confirm.**

**0:08-0:25. Your own ground.** Window A: Kai (A's generated name) spawns on their own island ground (house, farm beds, bushes and rocks); the pet
follows. Pan to the bridge and the minimap.
> **[USER]** "I wanted a world where the pets and villagers aren't scripts: each one decides its own day. Every player gets
> their own island, and the islands join up when you meet."

**0:25-0:50. They run on your machine.** Inspector on Pip (I): `MIND` shows the tuned 1B, `RUNS ON: this computer`, then HAS, GOAL, FEELS.
> "These villagers aren't scripted. A small Llama, tuned on Muse Spark Open, runs right in my browser. The game does the
> reasoning from real state, what they own, promised, heard, and the model picks and speaks."

**0:50-1:30. The promise (the star shot).** Chat to Pip: "my birthday party is this evening at the dance floor, come?". Pip
accepts; inspector shows `PROMISED`. Then two takes joined by a time card: Pip turns down the wood shift, says "Time to go, I
promised Kai!", walks over, and Kai isn't there: "Kai never came...".
> "Pip decided to come, put it in a calendar, and skipped work for it. Nobody scripted this. I didn't show up."

**1:30-2:00. Consequences.** Kai meets Pip: "you stood me up". Ask "why are you mad?": the real reason. Walk to Ama: "Pip told me:
you stood Pip up. Is that true?" At the stall, E: refused. Say "sorry", E works. Inspector WHY shows the chain.
> "Now Pip tells Ama, and Ama tells the next person, with the source. Ama won't sell to me until I make it up. Every
> reason on this panel is real state, with no invented memories."

**2:00-2:20. Their own lives.** Pip: "Kai, I am saving for a pet of my own. 7 coins for my wood?". The town board with prices that
moved; a later take: "At last! I bought a pet of my own!"
> "They hold jobs, plant what sells, set prices through real trades, and save for things over days."

**2:20-2:40. Private and shared.** Window B (no GPU) asks Mo something; the answer comes from A's model; A shows "talking...". Close A: minds and
memories move to B.
> "No GPU? Your question goes to the player hosting that villager. A host leaves, and the minds move on, memories included."

**2:40-2:52. Teach your pet.** One Teach and Proof shot.
> "You can teach your pet in plain words too, and the game proves the lesson on fights it never saw."

**2:52-3:00. Close.**
> "Mindworld: a town of minds, on Meta's models, free on your own device. Play at pets.uryto.dev."

## Shot list
| # | Time | Shot | Prep |
|---|------|------|------|
| 1 | 0:00-0:08 | Title card over the village | Zoom out |
| 2 | 0:08-0:25 | Kai's ground, bridge, minimap | Window A, daytime |
| 3 | 0:25-0:50 | Inspector on Pip | Model warmed up in A |
| 4 | 0:50-1:30 | Invite, PROMISED, leaving work, waiting | Morning take + evening take; the dance floor needs an event island (from 2 players) |
| 5 | 1:30-2:00 | "stood me up", Ama's line, stall refused, sorry | Ama hosted in A, stall open: morning or noon of the next day |
| 6 | 2:00-2:20 | Pip's offer, board, bought line | Pip carrying wood; set up a later take for the purchase |
| 7 | 2:20-2:40 | B asks Mo; close A; minds move | Both windows online; wait ~15 s |
| 8 | 2:40-2:52 | Teach, Proof bars | |
| 9 | 2:52-3:00 | Close on the village + URL | |

## Every Meta model use (call it out on screen or in voice)
- **Llama 3.2 1B Instruct** (WebLLM, in the tab): every pet's and villager's mind (plan, choose, lines, emotes, reflection)
  and the pet's fight voice; villagers run on the room's elected host.
- **Muse Spark Open** (Baseten `meta-models/muse-spark-open-1026`, via the Worker): villager chat when no player has a model
  loaded (capped per player and per day, scripted fallback); Teach (lesson to validated rule memo); teacher for the coach
  fine-tune and the village data set (Modal).
- **Muse Spark 1.3** (Meta Model API): "Learn from my fights" review.
- **Muse Spark 1.3** (Meta Model API): the Village Gazette on the town board (`/api/gazette`, one paper per room and game day).
- **Muse Spark Open** (Baseten): a watching villager's line at the end of a fight (`/api/cheer`).
- **Muse Spark Open** (Baseten): villagers talking to each other, and evening campfire stories, from their memories
  (`/api/banter`, one call per talk, only while a player is close enough to hear).
- **Muse Voice Transcribe** (Meta Model API): teaching by voice.
- **Llama 3.2 1B, fine-tuned** (LoRA on Modal, distilled from Muse Spark Open): free coach and minds in the tab; browser
  bench (N4, GTX 1050): 97.0% valid across 300 held-out decisions, Teach +18.9 pts held-out lift.

## Submission text
**Name:** Mindworld
**Tagline:** A cozy pixel village where every pet and villager has a mind, run by Meta's Llama on the players' own devices.
**Track:** Build for Your World.

**What it does.** Each player gets their own island ground; players online together share one world, with playgrounds,
picnic hills and ponds between the grounds and one shared clock. Villagers keep jobs, make and break promises, hold grudges with real reasons, pass
news on with its source, trade at prices set by real deals, and save up for things over days. A Llama 3.2 1B running in the browser decides for
them; the villagers' minds run on the players who have a model loaded and move to another player, memories included, when
one leaves. Players can also teach their pet to fight in plain words, and the game proves each lesson on fights it never saw.

**Technical depth.** A deterministic village sim with the model limited to the sim's valid choices (grammar-constrained,
parsed, with a fallback for every decision); a priority scheduler with timeouts and a duty cap per machine; seeded world
generation, so every client builds the same map and decor from a few numbers; NPC host election and hand-over on a Cloudflare
Durable Object room (validated, rate-limited messages, memories in DO storage); a capped spend ledger for every cloud call;
distillation of Muse Spark Open into Llama 3.2 with a held-out bench.

**Links:** live https://pets.uryto.dev · repo (public on Nov 3, the user's call) · video.

## Before recording (checklist)
- [ ] **[USER]** Confirm the opening line and write the firsthand motivation in your own words.
- [ ] Remove the access gate (user's call) and test both windows on the deployed site.
- [ ] Check that a picnic hill is next to A's ground today (in-between grounds are rolled per room and day).
- [ ] Re-check the numbers (`docs/archive/SPIKES.md`) and the inspector labels on camera.
- [ ] Repo public + HF coach repos public (user's call, default Nov 3); README quick start works for a stranger.
