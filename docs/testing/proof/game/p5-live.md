# P5 on live (2026-11-04 ~11:40-12:20 VN; worker 051d8ab7, build `main-BOsI1_9N`; commits cfa6a77 + the next)

## a. Village Gazette (Muse Spark 1.3, Meta Model API)
- API, room `check`, day 979, five real-shaped notes: `source: model`, `model: muse-spark-1.3`, $0.0060, headlines
  "Ama Joins Kai's Cozy Birthday Party" / "Mo's Ripple Beats Kai's Pet in a Duel" / "Pip Scores a Joyful Goal at the
  Pitch". A second reader with no notes got the same paper, `source: cache`, no new call.
- Real tab, room `main`, day 980, before the look-back fix: yesterday nobody was online, so no notes; the rules paper
  (`gazette-rules-live.png`, footer "By the villagers' own notes (rules)").
- Real tab after the fix (the latest lived day stands in): host's notes "Elder: fixed things up", "Elder: sold 2 herbs
  at the market for 14c", "Mo: mined stone at the quarry", ... -> Muse Spark 1.3 paper on the town board, footer
  "By Muse Spark 1.3 (Meta Model API)" (`gazette-model-live.png`). Plan notes ("planned: ...") are filtered since.
- Shown as a toast once per day (queued behind the hints). Cloud off: tests (`game/gazette-api.test.ts`) prove the
  rules paper with no call; worker: cap, busy lock, upstream error, bad reply all answer 200 with no headlines.

## b. A watching villager comments once per fight (Muse Spark Open, Baseten)
- API: Pip, "Kai's pet Bolt vs a wild Brute": win "Kai! Bolt crushed it! Rematch for soccer right now!", loss "Aww tough
  one Kai! Dance it off then soccer rematch?", friends "Whoa they became friends! ..." ($0.0025, one call, all endings).
- Real tab: player beside the Elder, wild fight vs a Bully, lost. End lines: `Elder: "Tough lesson, dear. Next time
  teach guard for heavy hits."` tagged Muse Spark Open, then the coach review. The Elder's log: "watched Brave Maple's
  pet Mochi lose to a wild Bully" (imp 4), which the Gazette reads back ("... loses to a wild Bully as Elder watches").
- No villager within 16 tiles, awake and outdoors: no watcher, no call. Cloud off / late (1.5 s at the end) / bad: the
  villager's own line (`game/cheer-api.test.ts`).

## c. The service behind each line
- Mind inspector (I): `LAST LINE: from the cloud (Muse Spark Open)` / `thought on your computer (Llama 3.2 1B, tuned)` /
  `the village rules (no model)` (`pixel/inspector.test.ts`). Battle lines carry the tag; the Gazette names its writer.

## d. Villagers talk to each other and tell campfire stories (Muse Spark Open, Baseten)
Worker d82cfc08, build `main-C2rhNIcQ`, room `check`, test Chrome (2026-11-04 ~11:35 VN local clock).
- API, real-shaped notes: a chat (Elder and Mo at the pond, 4 lines) "Saw Bolt best that Brute near noon, Kai must be
  proud." / "I heard about it, strong little Bolt has true heart." / ... ($0.0050); a story (Elder telling, Mo
  reacting, Pip on another machine so silent) "I remember watching Kai and brave Bolt chase off that wild Brute
  together." / ... / Mo: "Steady heart like that, calm water wins." ($0.0049). One call per talk.
- Real tab, all four villagers hosted here, player beside the Elder: one cloud call (4.2 s) wrote the whole talk from
  both minds' notes; lines 2.5-3.5 s apart, each villager's `source` "Muse Spark Open"; both remember the other's
  line (`talked with Mo: "Yes, sold fish and finally saved enough"`). Elder: "Heard you bought a better fishing rod
  today"; Mo: "Yes, sold fish and finally saved enough" (Mo's real purchase that day).
- Real tab, Elder, Mo and Ama at the campfire, player 2 tiles away, `storyNow()`: one call (3.9 s), the Elder tells,
  Mo and Ama react; the Elder remembers `told Sleepy Nori a campfire story: "..."` (imp 4, Gazette news), the others
  `heard Elder's campfire story with Sleepy Nori` (`campfire-story-live.png`). Fixed after this run: the notes carried
  the villager's own clipped lines to players ("I said to ...") and "18c" (read as cents); now events only, "18 coins".
- Re-run on the fixed build: Ama and Pip's talk opened with "Could not sleep after Elder story by campfire" (the
  story's memory), Pip's notes read "sold 2 wood at the market for 10 coins".
- Not live: two villagers hosted on different machines (each host asks for its own villager's next line, the talk so
  far attached): unit test `mind/banter.test.ts`. Cloud off, failing, nobody within 14 tiles, or within 40 s of the
  last cloud talk on that machine: the local mind or scripted lines (tests). Story with the cloud off: the opener,
  "Today I watched Kai's pet Bolt beat a wild Brute.", the others' reactions (tests).

- Join check after the P5d deploy: run 1 16/20 (one bot without a welcome for 11.5 s, so "no socket stuck", "20
  within 10 s", "101st told full" and "room empty" failed; `.scratch/p5/join-check-p5d.txt`), run 2 CLEAN 20/20
  (`.scratch/p5/join-check-p5d-2.txt`). P5d adds no room code.

## e. Postcards (Muse Image 1.0, Meta Model API)
Checked first (dev.meta.ai docs and pricing page, 2026-11-04): `POST https://api.meta.ai/v1/images/generations`,
`{model: "muse-image-1.0", prompt, n, size}` (OpenAI Images shape), answers `data[0].b64_json`; $0.01 per generated
image, billed only when one comes back; 150 RPM. Worker ebecde8f, build `main-p-yOsRi0`, room `check`, test Chrome.
- API from the live tab (campfire ask): `source: model`, 22.2 s, webp 1920x1280 (530 KB, 707 KB as base64), $0.01.
  Shrunk in the tab to 480x320 webp, about 65-72 KB a card.
- Campfire story with the Elder and Mo, player 2 tiles away: the story's talk call, then the postcard 27 s later,
  31 s in all; card "Elder's campfire story" (`postcard-album-live.png`: the Elder telling, the pet from its genes,
  the trainer, Mo with a fishing rod).
- A real wild fight next to the Elder: "Pal fainted. Mochi wins!", the Elder's cheer, then card "Mochi beat a wild
  Pal, Elder cheering" (`postcard-win-live.png`). C opens the album, left/right flip; the Album chip does the same.
- Found live: the first story's postcard never came, and that day's campfire slot was used up. The worker's ledger
  allows 10 calls a minute per client and the story's talk call comes just before (the reply was not captured; the
  retry run went through). Now one more try after 20 s on `rate_limit`, and a moment with no card gives the day's
  slot back (`game/postcard-api.test.ts`).
- Join check after the P5e deploy: 17/20 (2 bots without a welcome, spill room not opening), then 19/20 (a kick
  burst ended on 2 different kicks); with P5d's 16/20 and 20/20, failures move between runs. Open for P6.
- Not live: a new friend's card ("friends", same path as a win; unit tests on the worker prompt and the album). Cloud
  off: no call, no card (tests).

## After the deploy
- `node scripts/join-check.mjs`: CLEAN 20/20 (`.scratch/p5/join-check-p5.txt`).
- `/api/spend`: day $0.0695 of $30; totals baseten $1.244, meta $0.0123.
