# HANDOFF: Mindworld final plan (2026-11-04, ~16:40 VN = 09:40 UTC)

**Starting prompt:** "Read HANDOFF.md, then do Next actions in order: the /api/llm lock-down (P6), then the rest of P6, P7 and P8. Follow CLAUDE.md."

## Where things stand
- **The plan:** `docs/plan/final-plan.md` (approved 2026-11-03 16:20 VN). Phases P0-P8, cut lines, and a Status section
  at the top. Keep that Status current every session. User, 2026-11-04 ~13:20 VN: no need to follow the timeline
  (time ahead goes to the submission form's questions, the demo and the video). Access stays until right before submitting (P8).
- **P5 complete; the flaky join check and the P4 visual leftovers are done.** Live worker 0b4d6bf9, build
  `main-czFxq799`. Local commits on `rework/fresh-look` (last `b0ec50d`), not pushed.
- Tests: client 704, worker 242, tsc clean both. Join check 20/20 x3 after the deploy.
- Spend this session: none (no model calls). Before it: day ~$0.14 of $30, Baseten ~$1.28 of $50, Meta $0.012 of
  $100 (credit $149.91), Modal untouched. Read `/api/spend` in the test Chrome for the day's number.
- Earlier sessions' done lists: `docs/archive/HISTORY.md` (grep "2026-11-04 session" or "2026-11-03 session").

## Done this session (on live)
- **Join check steady** (proof `docs/testing/proof/network/join-live.md`, 2026-11-04 ~16:30). Cause: the link, not the
  room. From home a socket takes 1-2.5 s to open under a burst; all the bad runs came straight after deploys (Durable
  Objects restart). Script (`scripts/join-check.mjs`): each try logs start/open/close; a try with no welcome in 6 s is
  dropped and retried; single joins wait 15 s; a quit bot's retry timer no longer brings it back; the kick burst waits
  up to 4 s to settle. Rule (`docs/ops/tooling.md`): run it a minute after `/` serves the new build. Game
  (`client/src/world/live.ts`): `WELCOME_WAIT_MS` 10 s connect watchdog, per-socket keepalive (tests in `live.test.ts`).
- **P4 leftovers** (proof `docs/testing/proof/visual/p4-{village,square,clump-nw,clump-east}-live.png`, ticked in
  `checks/visual.md`; rules in `docs/visual/visual.md`): 52 trees in clumps toward the coast plus small inland groups
  (villagers still chop near the square), stumps (`s`), berry bushes (`B` = kind `bush-big`, art `bush-berry`), the
  pack's statue on the square (`STATUE` in `world/village-map.ts`, landmark with a plinth-only footprint), three square
  corners rounded. Layout scripts: `.scratch/p6/layout.py` (trees/bushes/stumps lists), `.scratch/p6/plaza.py`.
- **P6 lock-down researched, not built:** the table of callers and the build plan are in `docs/plan/final-plan.md` P6.

## Next actions
1. **Lock down `/api/llm`** (P6, before Access goes): follow the plan in `docs/plan/final-plan.md` P6 ("Research
   done"). Measure real prompt sizes first. Deploy, join check (a minute after `/` shows the new build), then prove on
   live that one coach reflect, one Teach, one cloud villager line and one cloud move still answer (~$0.02).
2. Plan to lower `CLIENT_DAILY_USD` from "10" (~$2) after the user's play-test (P6).
3. `scope-check` every scope on live, then the user's last play-test (2+ players), then P7 (demo script, README,
   numbers; the submission form's questions) and P8 (order written there).
4. **The mission** (`docs/game/mission.md`) is vision only, for the submission text and after the event: no new build
   before the deadline (user). It also holds the original island world idea and the host spreading rule.
5. Open pet checks to prove on live: villager pet looks the same in the village and on the battle screen; a bored
   villager walks up and challenges you.
6. After any user play-test: read the chat log unasked (PowerShell from `worker/`: `npx wrangler kv key list --binding
   GHOSTS --prefix "chat:<ms prefix>" --remote`, then `kv key get` each; rows are `{t, npc, player, line, reply, source}`;
   campfire story lines log with `line: "(campfire story)"`), add failures to `docs/testing/checks/npc.md`, bugs to
   `docs/BUGS.md`. If the user says "sleep", Director mode.
7. P7 demo script: lead with `mission.md` points 1-5; show a campfire story and its postcard, and a win card; the new
   village look (clumps, statue) is a good opening shot.

## Open
- Gazette weak spot: plain `remember()` notes live only in the host's tab, so a reload or host hand-over mid-day
  loses that day's everyday notes (promises, duels, trades, bonds are relayed and survive). Fine for the demo.
- Play-test #1 (2026-11-04) bugs 53-60 are fixed on live; the user plays once more, last, at P6.
- Decided (user): Access goes right before submitting. Leave an hour between that and the submit button for the
  outside join check (P8). Earlier outside testing without going public: the user may add a friend's email to the
  Access policy (the user's change).
- 34, 36, 37, 45, 46, 47, 48, 49-52, 53-60 fixed, waiting for the user's review on live.
- Not done by a person: a 2-person play, the stranger test. P3 real-tab checks were all tabs on this machine.
- Not run live: joining while someone is indoors (same away rule as fighting); a host leaving mid-conversation (earlier
  proof `proof/network/5c5d-live.md` covers hand-over with bonds intact).
- A player's own dance pose reaches a late joiner only on their next move (8 s dance); villagers' dances show at once.
- Rival plan latency: 13-15 s for a new memo; say so in the demo script (P7).
- P5e: a campfire postcard comes only on the storyteller's host machine (a guest at the fire on another machine gets
  none); the "friends" card is unit-tested only. Postcards stay on the device (not in the room, not on the server).
- P5d not run live: two villagers hosted on different machines talking (unit test only). The campfire is lit only in
  the evening or while a gathering runs; `storyNow()` with forced sitters shows an unlit fire.

## Decisions (standing)
- NPCs are the star: a player cannot tell them from a human. The sim reasons; the model picks among valid options and speaks.
  Rivals follow this: Muse Spark proposes a plan, the sim's rehearsal decides.
- The game must still work free after the event. Local prompts are frozen at af455c4: a text change needs a retrain. Cloud `VILLAGER_STYLE` is not frozen.
- `LOCAL_ONLY` is off since 2026-11-03 (user). Cloud extras go behind `CLOUD_LIVELY`; off must leave the game playable.
- Combat keeps the 5 moves and the memo DSL, so no retrain.
- Submission day (user): make GitHub and the 4 HF repos public, remove Access. Remove `/api/chatlog`, its client call and the KV rows (P8, last).
- Pack rules (user): a human activity with no matching pack animation is dropped. Everything is top-down, front side only, never iso (`docs/visual/visual.md`).
- Test bots never join `main`: they would take plots and host the real village's villagers. Use `check`.
- Deadline: Nov 4, 9 PM ET = Nov 5, 9 AM Vietnam.

## Gotchas
- **Whole-map or tile-box shots:** live, test Chrome: `node .scratch/p6/cdp-map.mjs "all"|"i0,j0,i1,j1" <out.png> [scale]`
  (daylight, 1 art pixel per pixel). In the dev pane: `world.view.draw(scene, g, sw, sh, t)` on your own canvas with
  `scene = world.buildScene()` and `scene.cam` on the box centre; the pane's screenshot can lag a frame, take two.
- Roads draw a tile wider than their `=` tiles (`sunny-terrain.ts` `isRoad`): nothing small goes next to a road.
- **Resource timing is full** in game tabs (1000+ assets): `performance.getEntriesByType` misses API calls. Read
  `__px.gazette.paper` or hook `fetch` instead.
- Banter by hand (test Chrome, room `check`): drivers `.scratch/p5/live-banter-{api,chat,story,story-read}.js` (hook
  `npcs.banter` and `npcs.out.line`, reset `npcs.cloudAt = -1e9`, `npcs.hub.talk(a, b)` or `npcs.storyNow()`).
- Postcards by hand: `__px.album.cards`, `__px.albumView.toggle()`; drivers `.scratch/p5/live-postcard-{api,story,fight}.js`
  (clear `localStorage["petmind.album.v1"]` first: one card per kind a game day). Each real image costs $0.01.
- Gazette by hand: `__px.gazette.paper`; a new paper needs a reload or the next game day (12 min). Cheer: put
  `__px.world.player` beside a villager, `__px.fight(__px.world.wilds[0])`, drive `battleView` (driver
  `.scratch/p5/live-cheer.js`: on a menu whose first label is not Fight press escape then enter).
- **The Browser pane, hidden, throttles frames to ~1/s and does NOT set `document.hidden`;** background tabs in the pane
  also report visible. The game now steps the world when frames stop, so live tabs keep running. To test the `bg` hand-over,
  override `document.hidden` and fire `visibilitychange`. Screenshots on a hidden pane: call
  `__px.update(0.01, performance.now() / 1000)` first.
- **Seeing a far villager on screen:** wrap `w.update` to set `w.cam` to the villager after each update (read the target from
  `window`, not a closure from an earlier script).
- A deploy takes a minute to show: poll `fetch("/")` for the new `main-` name before reloading test tabs.
- Live proof shots without the pane: test Chrome + `node scripts/cdp-tab.mjs "pets.uryto.dev" <js file>` then
  `node scripts/cdp-shot.mjs "pets.uryto.dev" <out.png>`; drivers `.scratch/p4/live-{battle,camp,house}.js`. Close it via CDP
  `Browser.close` (port 9333).
- Close the test Chrome before `join-check`: its tab in `check` hosts the villagers and fails four checks.
- **Ball debugging:** `__px.world.ballNow`, `.ball.seq`, `.ball.pitch`. Hook `world.ballKicked` to log kicks per tab.
- **Headless village bench** (`.scratch/p2-watch.mts`): chats wait real seconds per line; the bench runs timers at once.
- A Vite HMR reload (any client edit while the dev tab is open) resets `alwaysDay`, `ui.map` and forced states.
- Drive by hand: `__px.world.update(0.05, new Set(["arrowdown"]))`. A fight: `__px.fight(__px.world.wilds[0])`, then
  `__px.battleView.update(0.05)`; `battleView.cmdKey("enter")` picks Fight. A player duel: `__px.live.challenge(peerId,
  __px.state.memo, __px.state.genes)`, the other tab dispatches keydown "Enter". A rival duel: player next to the villager,
  keydown "e", `#chat input` "wanna duel?", `requestSubmit()`, wait ~6 s. Hook `battleView.onLine` to read lines.
- Emote keys: 1 wave, 2 heart, 3 dance, 4 laugh (`dispatchEvent(new KeyboardEvent("keydown", { key: "3" }))`).
- Game clock: a day is 12 real minutes; night (22:00-06:00) is 4 minutes, villagers refuse duels then. Hour =
  `(npcs.v.t / 30 + 8) % 24`. Villager hosts: `Object.fromEntries(__px.world.npcs.hosts)`.
- `__px.blocked()` shows what holds the keys (mode, door, menus, teach, chat).
- Deploy: `npm --prefix client run build`, then `npx wrangler deploy` inside `worker/` (PowerShell: `Set-Location` there
  first; a Bash `cd` moves the PowerShell cwd too, use absolute paths). If `wrangler.jsonc` appears at the root, delete it.
- `/api/spend` shows the day's spend and caps.
- pets.uryto.dev answers 200 from this home network only. Local dev: `.claude/launch.json` `client-dev` (no worker).
- Test Chrome: `bash .scratch/mlc/chrome.sh "<url>"` (port 9333). Slow-link timing: `.scratch/chk/slow-net.mjs <kbps> <ms>`.
- Trying a prompt on Baseten: `.scratch/rival-prompt-try.mts` with `client/node_modules/.bin/tsx`.
- Shell edits with backticks or `${}` break Bash heredocs: write a Python patch script to `.scratch/` with the Write tool.
- Live tests change the profile's save (`localStorage["petmind.v1"]`): keep the memo first, write it back after. `?p=N` = another save.
- Villagers work mornings ("I'm working right now"); try each of Ama, Elder, Mo.
- The untracked `info-ref/` folder is the user's; never commit or touch it.
- Code: client/src/{sim,life,mind,world,game,pixel,finetune}/ · worker/src/{room,room-do,npc,app,rival}.ts. Seams: `game/ports.ts`, Overworld.buildScene, `pixel/pixel-view.ts`.
- Tool how-to: `docs/ops/tooling.md`.
