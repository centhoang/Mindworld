# Demo video + submission text: Mindworld v3 (DRAFT 2026-10-30, for the user's review)

Claude drafts, the user records and submits. Track: **Build for Your World**. 3 minutes max, about 380 spoken words.
Numbers come from `docs/SPIKES.md` / `docs/FINETUNE.md`; re-check them before recording. Lines marked **[USER]** need your
words or your OK. The earlier v2 script (battle-first) is replaced: v3 leads with the living village; battles and Teach get one beat.

Setup: record https://pets.uryto.dev at 1x, 1080p, CRT on. Two windows side by side: **A** (normal profile, the "laptop
with a model") and **B** (incognito or a second device, no model). The live name is generated from the pet's genes (title +
name), not typed: note A's name before recording and say it where this script says "Kai". In A, press B once
before recording so WebLLM's 1B is cached (first load downloads ~0.9 GB). Record in daytime: the clock is shared and real
time, so night in the world is night outside too.

## Script (time / shot / voice)

**0:00-0:08. Opening line (required by the rules).** Title card "Mindworld", then the village from above.
> "Everything in this repo was built this week, October 27 to November 4. What pre-existed: open-source libraries and Meta's
> models. No code from my earlier projects." **[USER] confirm.**

**0:08-0:25. Your own ground.** Window A: Kai (A's generated name) spawns on their own island ground (house, farm beds, bushes and rocks); the pet
follows. Pan to the bridge and the minimap.
> **[USER]** "I wanted a world where the pets and villagers aren't scripts: each one decides its own day. Every player gets
> their own island, and the islands join up when you meet."

**0:25-0:50. Minds, not scripts (Llama 3.2 1B in the tab).** Press B in A: "Llama 3.2 1B runs in this tab now". Walk to the
square: Mo greets Kai by name; Ama says a line to the pet. Press I next to Mo: the inspector shows `MIND: <the 1B label>`, `RUNS ON:
this computer, for all`, the day plan (AM / NOON / PM), friends and memories.
> "Each villager has a persona, a memory and a plan. A small Llama runs right in my browser and picks what they do, only
> from moves the game allows, so a bad answer can't break anything. And it runs here, on Kai's laptop, for everyone in the
> room."

**0:50-1:20. Talk to them.** In window B, walk up to Mo, press E, type "where is the best fishing spot?". The answer comes
from A's model over the room (B has no model). Cut to A: the same bubble.
> "My friend in the other window has no GPU. Their question goes over the room to whichever player hosts Mo's mind, and
> the answer comes back in Mo's voice. If nobody has a model, the cloud answers with Muse Spark Open, and if that's
> over budget, a scripted line does. The inspector always says which one it was."

**1:20-1:45. A picnic spreads.** Two of A's pets at home plan a picnic: the invite bubble shows in both windows; pets walk
over the bridge to picnic hill (party lights, blanket) and sit.
> "Minds invite each other. The invitation travels through the room, so both screens see the same village, and the same
> day: the clock is shared by everyone."

**1:45-2:05. Hand-over.** Close window A. In B, within about 15 s, villagers keep walking; B presses B to load the model,
then I next to Mo shows `RUNS ON: this computer, for all` and the same memories.
> "Close the host's tab and the villagers' minds move to another player, memories included; the room stores them. Players
> with a model are always preferred."

**2:05-2:35. Teach your pet to fight (Muse Spark Open + tuned Llama).** Bump a wild pet, lose once, press T: "when the
big one winds up, guard". Proof panel: win-rate lift on fights the coach never saw. Quick cut: power mode, Free coach.
> "You can also teach your own pet in plain words. Muse Spark Open turns the lesson into a few checked rules, and the game
> proves it on fights it never saw. I distilled that coach into a fine-tuned Llama 3.2 that runs on your own GPU for free."

**2:35-2:50. Honest costs.** Show the inspector line `MIND: RULES (B: LOAD LLAMA)` on a pet with no model, then the model
label after B.
> "Live play costs about nothing: the minds run on the players' devices. Every cloud call is capped, and every fallback is
> labelled."

**2:50-3:00. Close.**
> "Mindworld: a village of minds, run by Meta's Llama on your own devices. Play at pets.uryto.dev."

## Shot list
| # | Time | Shot | Prep |
|---|------|------|------|
| 1 | 0:00-0:08 | Title card over the village | Zoom out |
| 2 | 0:08-0:25 | Kai's ground, decor, bridge, minimap | Window A, daytime |
| 3 | 0:25-0:50 | B loads the 1B; greeting; pet line; inspector on Mo | 1B cached in A beforehand |
| 4 | 0:50-1:20 | Window B asks Mo; answer from A's model; same bubble in A | Both windows online, side by side |
| 5 | 1:20-1:45 | Picnic invite in both windows; walk over the bridge; sitting on the blanket | 2+ pets at home in A; a picnic hill next to A's ground (it is rolled per day: check the minimap) |
| 6 | 1:45-2:05 | Close A; B keeps the villagers; B loads the model; inspector shows the same memories | Wait ~15 s for the hand-over |
| 7 | 2:05-2:35 | Battle, Teach, Proof bars; power mode Free coach cut | Power mode running for the cut |
| 8 | 2:35-2:50 | Inspector `RULES` vs model label | |
| 9 | 2:50-3:00 | Close on the village + URL | |

## Every Meta model use (call it out on screen or in voice)
- **Llama 3.2 1B Instruct** (WebLLM, in the tab): every pet's and villager's mind (plan, choose, lines, emotes, reflection)
  and the pet's fight voice; villagers run on the room's elected host.
- **Muse Spark Open** (Baseten `meta-models/muse-spark-open-1026`, via the Worker): villager chat when no player has a model
  loaded (capped per player and per day, scripted fallback); Teach (lesson to validated rule memo); teacher for the coach
  fine-tune and the village data set (Modal).
- **Muse Spark 1.3** (Meta Model API): "Learn from my fights" review.
- **Muse Voice Transcribe** (Meta Model API): teaching by voice.
- **Llama 3.2 3B / 1B, fine-tuned** (LoRA on Modal, distilled from Muse Spark Open): free local coach in power mode; 3B
  +23.8 pts held-out lift (teacher +21.6, untuned 3B -3.0).

## Submission text
**Name:** Mindworld
**Tagline:** A cozy pixel village where every pet and villager has a mind, run by Meta's Llama on the players' own devices.
**Track:** Build for Your World.

**What it does.** Each player gets their own island ground; players online together share one world, with playgrounds,
picnic hills and ponds between the grounds and one shared clock. Pets and villagers live a day of their own: they plan, pick
activities, invite each other, talk to players and pets, and remember. A Llama 3.2 1B running in the browser decides for
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
- [ ] Re-check the numbers (`docs/SPIKES.md`) and the inspector labels on camera.
- [ ] Repo public + HF coach repos public (user's call, default Nov 3); README quick start works for a stranger.
