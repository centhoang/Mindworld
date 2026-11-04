# HANDOFF: Mindworld final plan (2026-11-04, ~13:10 VN = 06:10 UTC)

**Starting prompt:** "Read HANDOFF.md, then do Next actions in order: the flaky join check, then P6 and the rest of the plan (no need to wait for the timeline). Follow CLAUDE.md."

## Where things stand
- **The plan:** `docs/plan/final-plan.md` (approved 2026-11-03 16:20 VN). Phases P0-P8, VN timeline, cut lines, and a
  Status section at the top. Keep that Status current every session. **User, 2026-11-04 ~13:20 VN: continue P6 and
  the rest now, no need to follow the timeline** (time ahead goes to the submission form's questions, the demo and the
  video). Access stays until right before submitting (P8).
- **P5 is complete.** Live worker ebecde8f, build `main-p-yOsRi0`. Local commits on `rework/fresh-look`, not pushed.
- Tests: client 702, worker 242, tsc clean both. **Join check is flaky today:** four runs after the P5d/P5e
  deploys went 16, 20, 17, 19 of 20, each failing a different socket check (bots with no welcome, the spill room not
  opening, two bots ending a kick burst on different kicks). P5 adds no room code. Files `.scratch/p5/join-check-p5{d,d-2,e,e-2}.txt`.
- Spend: P5d ~8 Muse Spark Open calls (~$0.04), P5e 3 Muse Image images ($0.03). Before it: day $0.07 of $30, Baseten $1.24 of $50, Meta $0.012
  of $100 (credit $149.91), Modal untouched. Read `/api/spend` in the test Chrome for the day's number.
- Earlier sessions' done lists: `docs/archive/HISTORY.md` (grep "2026-11-04 session" or "2026-11-03 session").

## Done this session (on live; proof `docs/testing/proof/game/p5-live.md` d and e, design `docs/ai/npc.md`)
- **P5d villagers talk to each other and tell campfire stories from the cloud** (`/api/banter`, worker `banter.ts`,
  client `game/banter-api.ts`, `NpcVillage.banter` behind `CLOUD_LIVELY`). One Muse Spark Open call writes a whole
  talk from both villagers' notes (`NpcVillage.notesOf`: doing, feelings, facts, notable then latest memories, prices
  as coins, no small talk). Paths: two villagers I host (`MindHub.talk` -> `cloudTalk`), a villager on another machine
  (`speak` -> `mateLine`, one line each), evening campfire with a player within 8 tiles (`campfire()`, once a game day
  per machine; test hook `__px.world.npcs.storyNow()`). Only while a player is within 14 tiles, one per 40 s per
  machine, $1/day, quota `banter`. Fallback: old local/scripted path; `rulesStory` for a story. Memories written both
  ways (the story's memory showed up in the next talk live). ~$0.005 and ~4 s a call.
- **P5e Postcards** (`/api/postcard`, worker `postcard.ts`, client `game/postcard-api.ts` `Album`, `pixel/album.ts`).
  Checked on dev.meta.ai first: Muse Image 1.0, `POST api.meta.ai/v1/images/generations`, base64 back, $0.01 an image.
  After a win, a new friend, or a campfire story you sat through, the worker paints a keepsake from game values only
  (genes, foe, villagers there; it writes the prompt). Album on C or the Album chip, last 12, on this device. One card
  per kind per game day; $2/day cap, quota `postcard`. Live: campfire and win cards (`postcard-*-live.png`). Fixed
  live: a refused call (per-minute limit) used up the day's slot; now a retry after 20 s and the slot comes back.
- Checks: three new ticked lines in `checks/game.md`; `docs/ops/demo.md` lists both new Meta model uses.
- **The mission** (user's words) and the comparison with Atelico's three posts: `docs/game/mission.md` (pointer in
  `CLAUDE.md`). Stand-outs: the browser, one shared world with AOI, inference shared across players, hosting hands on,
  any hardware plays, local first with a capped cloud. Atelico is ahead on agents per machine and as a toolkit.

## Next actions
1. **The flaky join check** (user's pick for next session). Four runs after the P5d/P5e deploys: 16, 20, 17, 19 of 20,
   each failing a different socket check: bots with no welcome (one waited 11.5 s), the spill room not opening, two
   bots ending a kick burst on different kicks. Before today it was 20/20 twice. P5 adds no room code, so suspect
   load or timing in the room DO (welcome path under a 20-socket burst, kick relay) or the script's own timing before
   the network. Rerun 3 times first (`node scripts/join-check.mjs`, test Chrome closed; ~2 min each, background it),
   read the failing rows in `.scratch/p5/join-check-p5{d,d-2,e,e-2}.txt`, then `worker/src/room-do.ts` and
   `scripts/join-check.mjs`. Fix, deploy, prove 20/20 three times in a row.
2. **P6 now** (bug fixes only from here): before Access goes, lock down `/api/llm` (a general model proxy: any
   prompt, client-picked provider) and plan to lower `CLIENT_DAILY_USD` from "10" (~$2) after the user's play-test;
   details in `docs/plan/final-plan.md` P6. Then `scope-check` every scope on live, then the user's last play-test (2+
   players), then P7 (demo script, README, numbers; the submission form's questions) and P8 (order written there).
3. **The mission** (`docs/game/mission.md`) is vision only, for the submission text and after the event: no new build
   before the deadline (user). It now also holds the original island world idea and the host spreading rule.
4. P4 leftovers (tree clumps, stumps, berry bushes, the plaza's dirt) are out: P6 started early and is bug fixes only.
   Only if the user asks.
5. Open pet checks to prove on live: villager pet looks the same in the village and on the battle screen; a bored
   villager walks up and challenges you.
6. After any user play-test: read the chat log unasked (PowerShell from `worker/`: `npx wrangler kv key list --binding
   GHOSTS --prefix "chat:<ms prefix>" --remote`, then `kv key get` each; rows are `{t, npc, player, line, reply, source}`;
   campfire story lines log with `line: "(campfire story)"`), add failures to `docs/testing/checks/npc.md`, bugs to
   `docs/BUGS.md`. If the user says "sleep", Director mode.
7. P7 demo script: lead with `mission.md` points 1-5; show a campfire story and its postcard, and a win card.

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
