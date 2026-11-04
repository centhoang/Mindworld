# HANDOFF: Mindworld final plan (2026-11-04, ~11:55 VN = 04:55 UTC)

**Starting prompt:** "Read HANDOFF.md, then do P5e from docs/plan/final-plan.md (Next actions 1). Follow CLAUDE.md."

## Where things stand
- **The plan:** `docs/plan/final-plan.md` (approved 2026-11-03 16:20 VN). Phases P0-P8, VN timeline, cut lines, and a
  Status section at the top. Keep that Status current every session. P5 window 13:00-17:00 (we are ahead), freeze (P6)
  18:00 VN. Earlier HANDOFF times said ~12:25 VN for the last session; the real clock was ~11:20 VN then.
- Live worker d82cfc08, build `main-C2rhNIcQ`. Local commits on `rework/fresh-look`, not pushed.
- Tests: client 697, worker 237, tsc clean both. Join check after this deploy: run 1 16/20 (one bot got
  no welcome for 11.5 s, which also broke the "room full" and "room empty" counts), run 2 **CLEAN 20/20**. Watch for it.
- Spend: P5d used ~6 Muse Spark Open calls (~$0.03). Before it: day $0.07 of $30, Baseten $1.24 of $50, Meta $0.012
  of $100 (credit $149.91), Modal untouched. Read `/api/spend` in the test Chrome for the day's number.
- Earlier sessions' done lists: `docs/archive/HISTORY.md` (grep "2026-11-04 session" or "2026-11-03 session").

## Done this session (on live; proof `docs/testing/proof/game/p5-live.md` d, design `docs/ai/npc.md` "Villagers talk")
- **P5d villagers talk to each other and tell campfire stories from the cloud** (`/api/banter`, worker `banter.ts`,
  client `game/banter-api.ts`, `NpcVillage.banter` behind `CLOUD_LIVELY`). One Muse Spark Open call writes a whole
  talk from both villagers' notes (`NpcVillage.notesOf`: doing, feelings, facts, notable then latest memories, prices
  as coins, no small talk). Paths: two villagers I host (`MindHub.talk` -> `cloudTalk`), a villager on another machine
  (`speak` -> `mateLine`, one line each), evening campfire with a player within 8 tiles (`campfire()`, once a game day
  per machine; test hook `__px.world.npcs.storyNow()`). Only while a player is within 14 tiles, one per 40 s per
  machine, $1/day, quota `banter`. Fallback: old local/scripted path; `rulesStory` for a story. Memories written both
  ways (the story's memory showed up in the next talk live). ~$0.005 and ~4 s a call.
- Checks: two new ticked lines in `checks/game.md`; `docs/ops/demo.md` lists the new Meta model use.

## Next actions
1. **P5e** surprise, cut first if late: Postcards (`muse-image-1.0`): verify the API and price on dev.meta.ai docs
   first, hard cap $2/day, skip if unavailable. Same shape as `banter.ts`/`cheer.ts` (worker route, ledger, cap,
   quota, mocked tests, client fetch behind `CLOUD_LIVELY`, free fallback).
2. P6 freeze 18:00 VN: bug fixes only, `scope-check` every scope on live, then the user's last play-test (2+ players).
   Ask before P6: remove Access at the freeze instead of Nov 5 morning (Open, below).
3. P4 leftovers only if time: tree clumps toward the coast, stumps, berry bushes, the plaza's bare dirt (pack `statue.png`).
4. Open pet checks to prove on live: villager pet looks the same in the village and on the battle screen; a bored
   villager walks up and challenges you.
5. After any user play-test: read the chat log unasked (PowerShell from `worker/`: `npx wrangler kv key list --binding
   GHOSTS --prefix "chat:<ms prefix>" --remote`, then `kv key get` each; rows are `{t, npc, player, line, reply, source}`;
   campfire story lines log with `line: "(campfire story)"`), add failures to `docs/testing/checks/npc.md`, bugs to
   `docs/BUGS.md`. If the user says "sleep", Director mode.

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
- **Resource timing is full** in game tabs (1000+ assets): `performance.getEntriesByType` misses API calls. Read
  `__px.gazette.paper` or hook `fetch` instead.
- Banter by hand (test Chrome, room `check`): drivers `.scratch/p5/live-banter-{api,chat,story,story-read}.js` (hook
  `npcs.banter` and `npcs.out.line`, reset `npcs.cloudAt = -1e9`, `npcs.hub.talk(a, b)` or `npcs.storyNow()`).
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
