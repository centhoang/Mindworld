# HANDOFF: Mindworld final plan (2026-11-04, 00:58 VN)

**Starting prompt:** "Read HANDOFF.md, then continue docs/plan/final-plan.md from its Status section (P2 and P3 done; start P4). Follow CLAUDE.md."

## Where things stand
- **The plan:** `docs/plan/final-plan.md` (approved 2026-11-03 16:20 VN). Phases P0-P8, VN timeline, cut lines, and a
  Status section at the top. Keep that Status current every session.
- Live `main-26ntqsHn` (worker 82897677). Local commits on `rework/fresh-look` (last d5ad3ed), not pushed.
- Tests: client 661, worker 221, tsc clean both.
- Spend 2026-11-03 (ledger day): $0.72 of the $30 day cap. Baseten total $1.18 of its $50 cap. Meta, Modal untouched.
- Earlier sessions' done lists: `docs/archive/HISTORY.md` (grep "2026-11-04 session" or "2026-11-03 session").

## Done this session (P2 finish, P3; commits 289c996, d5ad3ed)
- **P2 live watch:** 19 min on live, all activities but soccer/farm started unforced; haul's carry strip seen; swim was drawn
  on the pond's cliff edge: fixed (`Overworld.waterReach`, swim spots need open water on their own row, test fails on old code).
- **`scripts/join-check.mjs`** (bots in the live `check` room, hard limits, one line per check, exit 1 on a FAIL). Run it
  after every deploy: `node scripts/join-check.mjs` (about 40 s; `--big 0` skips the 100-player part).
- **Rooms:** `/api/room?room=` = `main`, `main-2`..`main-9`, `check`, `check-2`..`check-9` (`room.ts roomName`). A client
  told `full` moves to the next (`live.ts spillUrl`, `roomNo`). `?room=check` in the page address = a test tab in the
  bots' room (`roomQuery`). A lost room retries forever (backoff to 30 s). Toasts: Guest yard, spill village, lost connection.
- **Bugs fixed (49-52, `docs/BUGS.md`):** refresh keeps its plot for 60 s (`REFRESH_HOLD_MS`); the welcome carries farms in
  view; a hidden, fighting or indoor tab sends `bg` in its cap at once and the room hosts villagers on a visible free player
  (`npc.ts elect`, `room-flow.ts beat`); frame-throttled views step the world (`pixel/main.ts`); phone-size windows keep
  360 art columns (`pixel/low-size.ts`).
- Proof: `docs/testing/proof/network/join-live.md`, `docs/testing/proof/game/activities.md` "P2 live watch".

## P4 in progress (2026-11-04 ~02:00 VN, commit 160c5b6, NOT deployed)
- Done, local: every plot (taken or not) has the same small house (`village-map.ts plotHouse`, roof by slot from
  `ROOFS`), a 2x3 field (`bedsAt` rect branch, cols px+6..7, rows pz+2..4; free plots draw tilled beds, `freeBeds`), a
  front fence of pack rail tiles row 2 cols 38/39/42 with a 3-tile gate at the door (`plotFences`, decor kind `rail`).
  Name sign inside the fence east of the gate. Touch controls: `pixel/touch.ts` (stick + E/X/T, shown on coarse pointers),
  proven in the pane at 375x812 (keys sent, player walks).
- **Waiting on Codex:** `.scratch/brief-home-small.md` -> `client/public/art/gen/home-small-roof.png` +
  `home-small-open.png` (80x64, same outline) and `.scratch/home-small-result.md` (FLOOR, BUILT_IN, DOOR, EXIT_Y, CHIMNEY).
  Until then houses are invisible (art names `home-small-<roof>` / `home-small-open` load from `art/sunny/`).
- **Next steps:** check the art (contact sheet, pack style, front only); write `scripts/art-home-small.py` that copies the
  open picture and recolours the roof into 5 colours (map blue shingle colours to the other roof blocks in `tiles.png`,
  same offsets) into `client/public/art/sunny/home-small-<roof>.png`; rewrite `game/house.ts` (FLOORS, BUILT_IN,
  BUILT_IN_PIECES, HOME_FOOT {40,64}, HOME_ROOF {80,64}, HOUSE_DOOR, HOUSE_EXIT_Y, HOME_CHIMNEY is PROVISIONAL) and
  `interior.ts` (draw `home-small-open`, fade the own roof art, GX/GY so CRATE {11,3} lands on the crate square, sitters
  on the new floor, `pieces()` -> [] since the house comes furnished); then render, tests, deploy, join-check, play-test.
- Map polish still open (from the BuiltDemo sheet `.scratch/p4/demo-all.png`): tree clumps toward the coast, stumps /
  berry bushes / flowers, the plaza's big bare dirt (pack statue `statue.png` is exported, not loaded). Update
  `docs/visual/visual.md` ("Not needed: decor density, fences" no longer holds: the user asked for BuiltDemo polish).
- Debug render of any area: in the dev tab define `__region(cx, cz, scale)` (`docs/ops/tooling.md` "Seeing any part of the map") or draw
  `world.view.draw({...world.buildScene(), cam, panels: []}, g, w, h, t)` into a big canvas.

## Next actions
1. **P4** (above), then deploy, run `node scripts/join-check.mjs`, then ask the user for play-test #1.
2. Touch controls are in (P4); say in the demo script that phones work.
3. Open pet checks to prove on live with the pane visible: villager pet looks the same in the village and on the battle
   screen; a bored villager walks up and challenges you. Optional P1 leftover: pack expression icons over pets.
4. After any user play-test: read the chat log unasked, add failures to `docs/testing/checks/npc.md`, bugs to `docs/BUGS.md`.
   If the user says "sleep", Director mode (`docs/ops/director.md`) with the plan as the queue.

## Open
- User's call, asked and not yet answered: remove Access at the freeze (Nov 4 ~18:00 VN) instead of Nov 5 morning, so
  outside joins get tested with time to fix. Ask again before P6.
- 46: same small house for every player, with an interior (P4).
- 34, 36, 37, 45, 47, 48, 49-52 fixed, waiting for the user's review on live.
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
- **The Browser pane, hidden, throttles frames to ~1/s and does NOT set `document.hidden`;** background tabs in the pane
  also report visible. The game now steps the world when frames stop, so live tabs keep running. To test the `bg` hand-over,
  override `document.hidden` and fire `visibilitychange`. Screenshots on a hidden pane: call
  `__px.update(0.01, performance.now() / 1000)` first.
- **Seeing a far villager on screen:** wrap `w.update` to set `w.cam` to the villager after each update (read the target from
  `window`, not a closure from an earlier script).
- A deploy takes a minute to show: poll `fetch("/")` for the new `main-` name before reloading test tabs.
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
