# HANDOFF: Mindworld final plan (2026-11-03, 18:35 VN)

**Starting prompt:** "Read HANDOFF.md, then continue docs/plan/final-plan.md from its Status section (P1: trainer sprites next). Follow CLAUDE.md."

## Where things stand
- **The plan:** `docs/plan/final-plan.md` (approved 2026-11-03 16:20 VN). Phases P0-P8, VN timeline, cut lines, and a
  Status section at the top. Keep that Status current every session.
- Live `main-CKR3gYL-` (worker version 973186f7). Local commits on `rework/fresh-look`, not pushed.
- Tests: client 641, worker 214, tsc clean both.
- Spend 2026-11-03: $0.39 of the $30 day cap. Baseten total $0.85 of its $50 cap. Meta ~$149.9, Modal ~$100 untouched.
- Earlier sessions' done lists: `docs/archive/HISTORY.md` (grep "2026-11-03 session").

## Done this session (P1 coach review)
- `client/src/sim/review.ts` (pure): `coachReview(replay, memo, {pet, foe, def})` finds reasons in the replay (heavy hits
  unguarded, hits into a guard, missed counters, hurt foe never befriended), rehearses each missing lesson against the
  same foe (`winRate`, 32 seeds) and keeps the best one with +2 wins that also `passesGate`. `LESSONS` = words + rule.
- `pixel/fight-flow.ts` `review()` after wild fights and rival duels (rival loss: `whyLost.why`, then the review, else the
  old tip). `BattleView.ask(text, labels)` reuses the 2x2 menu (no portrait). `TeachScreen.show(lesson)` pre-fills.
- `sim/cortex.ts` ScriptedCortex learns "attack after a block" (`R.counter`); prompts untouched.
- Live proof: Mo duel -> "Coach: Mochi blocked a hit but did not strike back once." -> counter lesson (0% -> 28%) ->
  Teach it -> Muse Spark taught it, Prove +14.3. `docs/testing/proof/pet/coach-review-live.md`.

## Done earlier today (P1 NPC rivals)
- `client/src/sim/rivals.ts` (pure): 4 villager pets (Sage, Ripple, Honey, Zip) with fixed genes and persona memos;
  `duelAsked`, `duelRefusal` (no pet, grudge, night, work, 3 a day); `rehearse` spars plans against the player's memo
  and aims for a 40% player chance (`FAIR`), taking the cloud plan when within `CLOUD_SLACK` 0.1; `rivalDef` logs the rule
  per turn; `whyLost` + `nextLesson` (guard heavy -> befriend below 40% -> emote at a guard -> use shouts).
- `mind/npcs.ts`: Elder/Mo/Ama `hasPet` from day 1; `duelTalk` (runs before the hosting check, settles on the asker's
  machine), `challenge` (bored villager, 35%, once a day), `duelDone` (memory, `outfought`/`sparred` beats in
  `mind/bonds.ts`, belief to every other hosted mind). `reply()` returns `duel` -> `chat-flow` -> `main.startRival`.
- `pixel/fight-flow.ts`: shared `play()` loop for wild and rival fights; `rival()` waits up to 10 s for the cloud plan.
  `pixel/battle.ts` `end(..., "friends")` says "X and Y are friends now!" (live duels too). Villager pets drawn from genes.
- Worker `src/rival.ts`, `POST /api/rival`: Muse Spark counter-rules, KV cache per (villager, memo hash), $1/day,
  quota 20/client 400/day, 3200 max tokens, "think briefly" (without it the model ran past 2400 tokens and was cut).
  Client `game/rival-api.ts` asks when a chat with a villager who has a pet opens.
- Docs: `docs/ai/pet.md` "Village rivals" (design + bench), `checks/pet.md` (rival line ticked, 3 new open lines),
  proof `docs/testing/proof/pet/rivals-live.md`.

## Next actions
1. P1 rest, in order: trainer sprites on the battle screen (`attack`, `hurt`, `jump`, `idle` strips from the pack into
   `client/public/art/humans/` via `scripts/art-sunny.py`; read `docs/visual/visual.md` and `layers.md` first) -> pack
   bars (`redbar`/`greenbar`/`bluebar`) and `glint` on crits. Do not edit the coach prompt text in `sim/cortex.ts` (frozen).
2. Open pet checks to prove on live with the pane visible: villager pet looks the same in the village and on the battle
   screen; a bored villager walks up and challenges you.
3. Then P2-P8 per the plan. **P3 is a loop** (user: "make sure (test, update, repeat) so on live, many players can join
   without issues"): build `scripts/join-check.mjs` first, run on live, log failures in `docs/BUGS.md`, fix, deploy,
   repeat until one full run is clean; again after every later deploy. If the user says "sleep", Director mode
   (`docs/ops/director.md`) with the plan as the queue.
4. After any user play-test: read the chat log unasked, add failures to `docs/testing/checks/npc.md`, bugs to `docs/BUGS.md`.

## Open
- User's call, asked and not yet answered: remove Access at the freeze (Nov 4 ~18:00 VN) instead of Nov 5 morning, so
  outside joins get tested with time to fix. Ask again before P6.
- 46: same small house for every player, with an interior (P4). 37: dance never chosen unforced (P2).
- 34, 36 and 45, 47, 48 fixed, waiting for the user's review on live.
- Not done by a person: a 2-person play, the stranger test. 100 bots not proven (89 held) (P3).
- Rival plan latency: 13-15 s for a new memo. Prefetch at chat open covers a human typing; a fast "duel?" may fight on the
  bundled plan. Fine, but say so in the demo script (P7).

## Decisions (standing)
- NPCs are the star: a player cannot tell them from a human. The sim reasons; the model picks among valid options and speaks.
  Rivals follow this: Muse Spark proposes a plan, the sim's rehearsal decides.
- The game must still work free after the event. Local prompts are frozen at af455c4: a text change needs a retrain. Cloud `VILLAGER_STYLE` is not frozen.
- `LOCAL_ONLY` is off since 2026-11-03 (user). Cloud extras go behind `CLOUD_LIVELY`; off must leave the game playable.
- Combat keeps the 5 moves and the memo DSL, so no retrain.
- Submission day (user): make GitHub and the 4 HF repos public, remove Access. Remove `/api/chatlog`, its client call and the KV rows (P8, last).
- Pack rules (user): a human activity with no matching pack animation is dropped. Everything is top-down, front side only, never iso (`docs/visual/visual.md`).
- Deadline: Nov 4, 9 PM ET = Nov 5, 9 AM Vietnam.

## Gotchas
- **A hidden Browser pane stalls requestAnimationFrame**: the game looks frozen, keys do nothing, the overworld does not
  re-render (screenshots are stale). Drive by hand: `__px.world.update(0.05, new Set(["arrowdown"]))`. A fight:
  `__px.fight(__px.world.wilds[0])`, then loop `__px.battleView.update(0.05)`; `battleView.cmdKey("enter")` picks Fight.
  A rival duel: put `__px.world.player` next to the villager, dispatch keydown "e", fill `#chat input` with "wanna duel?",
  `requestSubmit()`, wait ~6 s, then drive `battleView.update`. Hook `battleView.onLine` to read lines. Leave real time for
  the 10 s plan wait (await small sleeps inside the loop).
- Game clock: a day is 12 real minutes; night (22:00-06:00) is 4 minutes, and villagers refuse duels then. Hour =
  `(npcs.v.t / 30 + 8) % 24` after a few `world.update` calls.
- `__px.blocked()` shows what holds the keys (mode, door, menus, teach, chat).
- A deploy can take minutes to show on the site while wrangler says it is active. Check the `main-` file in `/`; do not redeploy for that.
- Deploy: `npm --prefix client run build`, then `npx wrangler deploy` inside `worker/`, check it says `pet-mind`. If `wrangler.jsonc` appears at the root, delete it.
- `/api/spend` shows the day's spend and caps.
- pets.uryto.dev answers 200 from this home network only. Local dev: `.claude/launch.json` `client-dev` (no worker: /api 502s, fine for movement and rival duels on bundled plans).
- Trying a prompt on Baseten without deploying: `.scratch/rival-prompt-try.mts` (reads `.env`, prints usage and reply, never the key); run with `client/node_modules/.bin/tsx`. ESM needs `.mts` for top-level await.
- Shell edits with backticks or `${}` break Bash heredocs: write a Python patch script to `.scratch/` with the Write tool.
- The dev GPU gate asks on first load in a clean profile: pick "This computer only has this graphics chip".
- Tool how-to (test Chrome, tab driving, chat log): `docs/ops/tooling.md`. Benches: `.scratch/combat/bench.ts` (wild),
  `rival-bench.ts`, `tip-bench.ts`, `review-bench.ts` (gitignored; recreate from `docs/ai/pet.md` if gone).
- Live tests change the profile's save (`localStorage["petmind.v1"]`): keep the memo first, write it back after.
- A fight on a hidden pane: after the result, `battleView.choosing` with labels "Teach it"/"Done" is the coach review;
  `cmdKey("enter")` = Teach it, then `#teach` `requestSubmit()` teaches the typed lesson.
- `cd` inside a Bash call moves the session's working folder: use absolute paths.
- The untracked `info-ref/` folder is the user's; never commit or touch it.
- Code: client/src/{sim,life,mind,world,game,pixel,finetune}/ · worker/src/{room,room-do,npc,app,rival}.ts. Seams: `game/ports.ts`, Overworld.buildScene, `pixel/pixel-view.ts`.
