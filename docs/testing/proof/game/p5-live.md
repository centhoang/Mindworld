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

## After the deploy
- `node scripts/join-check.mjs`: CLEAN 20/20 (`.scratch/p5/join-check-p5.txt`).
- `/api/spend`: day $0.0695 of $30; totals baseten $1.244, meta $0.0123.
