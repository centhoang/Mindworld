# HANDOFF: Mindworld final plan (2026-11-03, 23:55 VN)

**Starting prompt:** "Read HANDOFF.md, then continue docs/plan/final-plan.md from its Status section (P2 mostly done; finish its live watch, then P3). Follow CLAUDE.md."

## Where things stand
- **The plan:** `docs/plan/final-plan.md` (approved 2026-11-03 16:20 VN). Phases P0-P8, VN timeline, cut lines, and a
  Status section at the top. Keep that Status current every session.
- Live `main-CrFuSOoI` (worker version f42a02af). Local commits on `rework/fresh-look`, not pushed.
- Tests: client 657, worker 217, tsc clean both.
- Spend 2026-11-03: $0.46 of the $30 day cap. Baseten total $0.92 of its $50 cap. Meta ~$149.9, Modal ~$100 untouched.
- Earlier sessions' done lists: `docs/archive/HISTORY.md` (grep "2026-11-03 session").

## Done this session (P2, commit 57b6461 + docs)
- **One shared ball:** `client/src/life/ball.ts` (pure; state = last kick, fixed 1/30 s steps, walls, goal, reset). Room
  `kick` -> numbered `ball` to everyone incl. kicker; welcome carries the last kick + age; DO stores it (`worker/src/room.ts`
  `kick()`, `room-do.ts`). Client: `world/live.ts` `kick()`/`parseKick`, `room-flow.ts`, `Overworld.stepBall/kickBall/
  ballKicked/playBall/nudgeBall`. Protocol: `docs/network/network.md` "The ball". Pitch cleared of trees (village rows).
- **Open groups:** `ActivityDef.open` + `isGroup()`: soccer and dance may start alone, others join (bug 37). Dance on
  `DANCE_FLOOR` (6x4 gen tiles on the square, lit while dancing), evening `peak`; a dancing player (Dance emote = 8 s dance)
  pulls villagers (`NpcVillage.dancing`).
- **New activities** (`life/activities.ts`, pack strips copied by `scripts/art-sunny.py`): campfire (green), haul (`after`
  chop/farm/mine, carry strip walking), repair (stall/board/well), mine (3 quarry rocks NE of the pond), feed (animal yard,
  `PEN`, on the Elder's lawn), swim (pond's far shore, drawn in the water). Places in `world/village-map.ts`; spots in
  `Overworld.npcSpots`; drawing in `pixel-view.ts`. Worker `MIND_ACTS` extended; `life.test.ts` keeps both lists equal.
- **Fixes found:** map rocks were invisible blockers (`rock-small` never loaded -> `rock-big`); LiveLink's welcome dropped
  the open talks; pets eat at home (old bowl spot gone).
- Proof: `docs/testing/proof/game/activities.md` P2 (live: Pip's unforced kickabout and goal; two live tabs on the same
  kick numbers; local two-tab exact match; headless watch counts).

## Next actions
1. **Finish P2:** a 12-min live watch (pane visible) and note each activity seen unforced in `proof/game/activities.md`;
   look for swim (drawn in the water) and haul's carry strip on screen. Bench: `client/node_modules/.bin/tsx .scratch/p2-watch.mts 4`.
2. **P3 is a loop** (user: "make sure (test, update, repeat) so on live, many players can join without issues"): build
   `scripts/join-check.mjs` first, run on live, log failures in `docs/BUGS.md`, fix, deploy, repeat until one full run is
   clean; again after every later deploy. Bots may ignore `ball` messages; add a kick burst to the check.
3. Open pet checks to prove on live with the pane visible: villager pet looks the same in the village and on the battle
   screen; a bored villager walks up and challenges you. Optional P1 leftover: pack expression icons over pets.
4. After any user play-test: read the chat log unasked, add failures to `docs/testing/checks/npc.md`, bugs to `docs/BUGS.md`.
   If the user says "sleep", Director mode (`docs/ops/director.md`) with the plan as the queue.

## Open
- User's call, asked and not yet answered: remove Access at the freeze (Nov 4 ~18:00 VN) instead of Nov 5 morning, so
  outside joins get tested with time to fix. Ask again before P6.
- 46: same small house for every player, with an interior (P4; the player hammering to upgrade it was moved here from P2).
- 34, 36, 37 and 45, 47, 48 fixed, waiting for the user's review on live (37 also waits for the P2 live watch).
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
- **Ball debugging:** `__px.world.ballNow` (where it is), `.ball.seq` (last room kick number), `.ball.pitch`. Hook
  `world.ballKicked` to log kicks per tab. A tab's ball only matches another's once both have the same `seq`.
- **Headless village bench** (`.scratch/p2-watch.mts`): villager chats wait real seconds per line; without the bench's
  instant `setTimeout` they hold everyone idle forever (looked like a night freeze; it is not a game bug).
- A Vite HMR reload (any client edit while the dev tab is open) resets `alwaysDay`, `ui.map` and forced states.
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
- **Screenshots on a hidden pane are stale frames.** Call `__px.update(0.01, performance.now() / 1000)` right before
  each screenshot to draw a fresh one (`tabs_context` says whether the pane is hidden).
- Villagers work mornings ("I'm working right now"); try each of Ama, Elder, Mo. Local dev starts at game night: set
  `world.npcs.v.t` forward is not enough (the sim re-syncs); test rivals on live, or the visuals via a wild fight.
- A fight on a hidden pane: after the result, `battleView.choosing` with labels "Teach it"/"Done" is the coach review;
  `cmdKey("enter")` = Teach it, then `#teach` `requestSubmit()` teaches the typed lesson.
- `cd` inside a Bash call moves the session's working folder: use absolute paths.
- The untracked `info-ref/` folder is the user's; never commit or touch it.
- Code: client/src/{sim,life,mind,world,game,pixel,finetune}/ · worker/src/{room,room-do,npc,app,rival}.ts. Seams: `game/ports.ts`, Overworld.buildScene, `pixel/pixel-view.ts`.
