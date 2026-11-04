# Demo video: Mindworld (rewritten 2026-11-04 for the final build)

Claude drafts and checks; the user records, uploads and submits. Track: **Indie, Build for Your World**. 3 minutes max,
about 380 spoken words. Lines marked **[USER]** need the user's words or OK. Submission form answers: `submission.md`.
Order of the story (HANDOFF, `game/mission.md`): lead with what is new (browser, shared village, shared local AI,
hand-over, free on any hardware), then show the villagers being alive, then the pet, then the close.

## Setup
- Record https://mindworld.uryto.dev (the move from pets.uryto.dev is in progress; use whichever is live) at 1080p, 1x.
- Two windows side by side: **A** = the user's normal profile with the tuned 1B loaded (B key or the setup screen; let
  it finish the download before recording). **B** = a second machine or an incognito window with no model (press B
  to unload if it loaded). Note A's and B's generated names; say A's name where the script says "Kai".
- Record in daytime: the game clock is shared (a day is 12 real minutes, night 22:00-06:00 is 4 minutes; villagers
  refuse duels at night). Campfire stories happen only in the evening.
- Takes that wait: a rival's new plan takes 13-15 s (cut the wait); a postcard takes a few seconds to paint; a Gazette
  paper comes once per game day (reload for a new one).

## Script (time / shot / voice)
**0:00-0:10. Opening line (required by the rules).** The village from above: tree clumps, the statue on the square.
> "Everything here was built this week, October 27 to November 4. What pre-existed: open-source libraries, a licensed
> pixel-art pack, and Meta's models." **[USER] confirm.**

**0:10-0:35. A village anyone joins from a link.** Window A walks out of their house; B joins from the same link and
appears next to A. Press I on Mo: `MIND` shows the tuned Llama, `RUNS ON` names A's machine.
> "Mindworld is a free browser village. The villagers think with a Llama 3.2 1B we fine-tuned from Muse Spark, running
> right in the player's tab. And the room shares it: the fastest machines think for everyone."

**0:35-1:10. The promise (the star shot).** A tells Pip: "my birthday party is this evening at the dance floor, come?".
Pip accepts; the inspector shows `PROMISED`. Cut (time card): Pip turns down the wood shift, "Time to go, I promised
Kai!", walks to the dance floor, and Kai isn't there.
> "Pip decided to come, put it in a calendar and skipped work for it. Nobody scripted this. And I didn't show up."

**1:10-1:30. Consequences.** Kai meets Pip: "you stood me up". "why are you mad?" gives the real reason. At Ama's stall:
refused, because Pip told Ama. "sorry", and the stall opens.
> "The game reasons from real state, what they own, promised and heard, and the model only picks among the valid
> options and speaks. So a villager can't promise what the world forbids."

**1:30-2:00. A rival who adapts.** A duels Mo ("wanna duel?") and wins. Duel again: Mo has a new plan and beats the same
memo; Mo says why. The coach review proposes a lesson; "Teach it"; the Prove bars show the lift on unseen fights.
> "Mo asks Muse Spark for a plan, and our sim rehearses it against my pet before Mo uses it. Lose, and the coach finds
> the lesson, and the game proves it on fights it never saw."

**2:00-2:25. The village lives without you.** Quick cuts: the Village Gazette toast and board ("today Mo beat Kai..."),
two villagers talking, the evening campfire story, then the postcard it painted (C opens the album). B and A kick the
ball and dance (emote 3).
> "Muse Spark writes the village paper from the day's real events, villagers tell stories from their memories, and Muse
> Image paints a postcard of the moment."

**2:25-2:48. Hand-over.** B (no model) asks Mo something; the answer comes from A's machine ("talking..." on A). Close
window A. Within ~15 s Mo is hosted by B and still remembers Kai.
> "No GPU? Your question goes to whoever hosts that villager. When a host leaves, the minds move on, memories included,
> so the village stays alive to the last person."

**2:48-3:00. Close.** The village at dusk, the URL.
> "Free on any hardware: a player's machine, a capped cloud call, or rules. Next: home servers lending bigger models to
> the room. Mindworld, at mindworld.uryto.dev."

## Shot list and prep
| # | Time | Shot | Prep |
|---|------|------|------|
| 1 | 0:00-0:10 | Village from above | A daylight take; `cdp-map.mjs` style overview or zoom out |
| 2 | 0:10-0:35 | B joins next to A; inspector on Mo | A hosts Mo (check `Object.fromEntries(__px.world.npcs.hosts)`) |
| 3 | 0:35-1:10 | Invite, PROMISED, Pip leaves work, empty dance floor | Morning take + evening take |
| 4 | 1:10-1:30 | "stood me up", why, stall refused, sorry | Next game day, stall open (Ama works mornings) |
| 5 | 1:30-2:00 | Mo duel x2, loss explanation, review, Teach it, Prove | Daytime; cut the 13-15 s plan wait |
| 6 | 2:00-2:25 | Gazette, banter, campfire story, postcard, ball and dance | Evening for the fire; clear the album's card of the day first if testing |
| 7 | 2:25-2:48 | B asks Mo, close A, Mo moves to B | Both online; wait ~15 s |
| 8 | 2:48-3:00 | Dusk + URL | |

## Every Meta model use (for the voice-over, README and form; check against the code before recording)
- **Llama 3.2 1B Instruct, fine-tuned** (LoRA on Modal, distilled from Muse Spark Open; WebLLM in the tab): every
  villager's and pet's mind: plan, choose (grammar-constrained to the sim's options), lines, emotes, reflection.
  97.0% valid decisions on 300 held-out cases (`ai/npc.md`).
- **Muse Spark Open** (Baseten `meta-models/muse-spark-open-1026`): villager chat when no nearby player has a model;
  villagers talking to each other and campfire stories (`/api/banter`); a watching villager's line after a fight
  (`/api/cheer`); rival plans (`/api/rival`); Teach (lesson to rule memo); the teacher for all training data. On Modal: the
  optional cloud move chooser (`?cloudmoves`).
- **Muse Spark 1.3** (Meta Model API): the Village Gazette (`/api/gazette`, one paper per room and game day); the coach
  reflect ("learn from my fights").
- **Muse Image 1.0** (Meta Model API): postcards (`/api/postcard`, $0.01 each, $2/day cap, album on C).
- **Muse Voice Transcribe** (Meta Model API): teaching by voice (`/api/transcribe`).
- Numbers: Prove lift +29.0 pts held-out on the combat bench (`ai/pet.md`); tuned 1B 97.0% valid.

## Before recording (checklist)
- [ ] **[USER]** Confirm the opening line and the motivation lines.
- [ ] Every beat run once on live the same day (Claude, `scope-check`), so the takes are known to work.
- [ ] A has the model loaded and hosts the villagers in the shot; B has none.
- [ ] Re-check the numbers above against `ai/npc.md`, `ai/pet.md` and the inspector's labels on camera.
- [ ] After Access goes (P8): record or re-check the join from outside so the URL in the close works for a stranger.
