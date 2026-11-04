# HANDOFF: Mindworld final plan (2026-11-04, ~12:25 VN)

**Starting prompt:** "Read HANDOFF.md, then do P5d from docs/plan/final-plan.md (Next actions 1). Follow CLAUDE.md."

## Where things stand
- **The plan:** `docs/plan/final-plan.md` (approved 2026-11-03 16:20 VN). Phases P0-P8, VN timeline, cut lines, and a
  Status section at the top. Keep that Status current every session. P5 window 13:00-17:00 (ahead), freeze (P6) 18:00 VN.
- Live worker 051d8ab7, build `main-BOsI1_9N`. Local commits on `rework/fresh-look` (last cfa6a77 + docs), not pushed.
- Tests: client 686, worker 232, tsc clean both. **Join check on live: CLEAN 20/20** after the last deploy.
- Spend 2026-11-04 (ledger day): $0.07 of the $30 day cap. Baseten total $1.24 of $50, Meta $0.012 of $100 (credit
  $149.91), Modal untouched.
- Earlier sessions' done lists: `docs/archive/HISTORY.md` (grep "2026-11-04 session" or "2026-11-03 session").

## Done this session (all on live; proof `docs/testing/proof/game/p5-live.md`, design `docs/ai/npc.md` "Village Gazette")
- Join check "a late joiner sees who is talking": the script's fault, not the room's. Talkers were burst slots 2 and 3,
  but the refresh steps quit whichever bots got plots first (plots go by arrival), so a talker could be a closed socket.
  Now any two bots still in the room; the note says what the talker got (commit c7a8ba4). 20/20 twice.
- **P5a Village Gazette**: `/api/gazette` (worker `gazette.ts`), first real use of the Meta Model API (`muse-spark-1.3`,
  provider `meta`; default provider if no Meta key). Host client sends notable villager memories (`mind/gazette.ts`
  `gazetteNotes`, via `npcs.gazetteNotes(day)`, which falls back to the latest lived day) + prices; three headlines,
  cached per room and game day; a reader with no notes waits for the host's paper; rules headlines otherwise. Town board
  rows (`main.ts boardRows`, footer names the writer), toast once per day. Soccer goals are now villager memories
  (`npcs.noteGoal`). `__px.gazette`, `__px.openBoard()` for tests.
- **P5b watching villager**: `/api/cheer` (worker `cheer.ts`, Muse Spark Open): one call at fight start writes the
  watcher's line for win/loss/friends; `fight-flow.ts cheer()` says it at the end (wild, rival, live duel) and the
  villager remembers it. Watcher = `Overworld.watcher()` (16 tiles, awake, outdoors, not the rival's owner).
- **P5c**: the mind inspector (I) shows `LAST LINE: <service>` (`pixel/inspector.ts serviceLabel`).
- `docs/ops/demo.md` lists the two new Meta model uses; `checks/game.md` has three new ticked lines.

## Next actions
1. **P5d** (`docs/plan/final-plan.md` P5): evening campfire stories / NPC-to-NPC talk from the cloud with memories.
   Look at `game/chatter.ts` and `mind/hub.ts` (NPC-to-NPC talk, `speak()` in `mind/npcs.ts` ~line 274 uses the local
   model or `scriptedLine`; `CloudMind` in `game/voices.ts` is the Muse Spark mind backend). Behind `CLOUD_LIVELY`,
   through the worker ledger with a cap and quota, mocked in tests, rules fallback. Deploy, join check, proof.
2. P5e surprise, cut first if late: Postcards (`muse-image-1.0`): verify the API and price on dev.meta.ai docs first,
   hard cap $2/day, skip if unavailable.
3. P6 freeze 18:00 VN: bug fixes only, `scope-check` every scope on live, then the user's last play-test (2+ players).
   Ask before P6: remove Access at the freeze instead of Nov 5 morning (Open, below).
4. P4 leftovers only if time: tree clumps toward the coast, stumps, berry bushes, the plaza's bare dirt (pack `statue.png`).
5. Open pet checks to prove on live: villager pet looks the same in the village and on the battle screen; a bored
   villager walks up and challenges you.
6. After any user play-test: read the chat log unasked (PowerShell from `worker/`: `npx wrangler kv key list --binding
   GHOSTS --prefix "chat:<ms prefix>" --remote`, then `kv key get` each; rows are `{t, npc, player, line, reply, source}`),
   add failures to `docs/testing/checks/npc.md`, bugs to `docs/BUGS.md`. If the user says "sleep", Director mode.

## Open
- Gazette weak spot: plain `remember()` notes live only in the host's tab, so a reload or host hand-over mid-day
  loses that day's everyday notes (promises, duels, trades, bonds are relayed and survive). Fine for the demo.
- Play-test #1 (2026-11-04) bugs 53-60 are fixed on live; the user plays once more, last, at P6.
- User's call, asked and not yet answered: remove Access at the freeze (Nov 4 ~18:00 VN) instead of Nov 5 morning, so
  outside joins get tested with time to fix. Ask again before P6.
- 34, 36, 37, 45, 46, 47, 48, 49-52, 53-60 fixed, waiting for the user's review on live.
- Not done by a person: a 2-person play, the stranger test. P3 real-tab checks were all tabs on this machine.
- Not run live: joining while someone is indoors (same away rule as fighting); a host leaving mid-conversation (earlier
  proof `proof/network/5c5d-live.md` covers hand-over with bonds intact).
- A player's own dance pose reaches a late joiner only on their next move (8 s dance); villagers' dances show at once.
- Rival plan latency: 13-15 s for a new memo; say so in the demo script (P7).

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
- **Resource timing is full** in game tabs (1000+ assets): `performance.getEntriesByType` misses API calls. Read
  `__px.gazette.paper` or hook `fetch` instead.
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
