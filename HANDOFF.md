# HANDOFF: Mindworld final plan (2026-11-04, ~11:00 VN)

**Starting prompt:** "Read HANDOFF.md, then fix the join-check talk failure (Next actions 1), then do P5 from docs/plan/final-plan.md. Follow CLAUDE.md."

## Where things stand
- **The plan:** `docs/plan/final-plan.md` (approved 2026-11-03 16:20 VN). Phases P0-P8, VN timeline, cut lines, and a
  Status section at the top. Keep that Status current every session. Now ahead of the timeline: P5 window is 13:00-17:00,
  the freeze (P6) 18:00 VN.
- Live worker c25d5953, build `main-Aj3mXOIh`. Local commits on `rework/fresh-look` (last 413b5a2 + docs), not pushed.
- Tests: client 672, worker 221 (unchanged), tsc clean. **Join check on live: 19/20, one real failure (Next actions 1).**
- Spend 2026-11-04 (ledger day): $0.04 of the $30 day cap. Baseten total $1.23 of its $50 cap. Meta ($100 cap in the
  ledger, $149.91 credit) and Modal untouched.
- Earlier sessions' done lists: `docs/archive/HISTORY.md` (grep "2026-11-04 session" or "2026-11-03 session").

## Done this session (play-test #1 bugs 53-60, all on live; commits dcfbe7c, 413b5a2)
Proof table: `docs/testing/proof/pet/playtest1-fixes-live.md`; checks ticked in `checks/{pet,visual,npc}.md`.
- 53 campfire pose `warm` = idle + `doing` (no fishing strips). 54 one pack `spr_deco_fire_02` flame at the ring's pit
  (pack Room1 placement; `pixel-view.ts`, `sunny.ts` STRIPS). 60 `doingAnswer` takes the phase and mates: "Not much. Just
  taking it easy tonight.", "We sit by the campfire." (`mind/directions.ts`, `npcs.ts grounded`).
- 55 Codex redrew `gen/home-small-open.png` (3 briefs: `.scratch/brief-home-room*.md`; takes 1-2 refused, the room is
  too small for table + stool + crate square). Now: back wall rows 4-15 with one window, bed, shelf, table, no stool.
  `game/house.ts` FLOORS/BUILT_IN from Codex's measured plan; `python scripts/art-home-small.py` copied it to `art/sunny/`.
- 56 Codex redrew `stripes`, `nubs`, `floppy` (90 files; brief `.scratch/brief-pet-marks.md`, preview
  `.scratch/pet-marks-preview.png`, generator `.scratch/pet-marks-generator.mjs`).
- 57-59 battle screen (`pixel/battle.ts`): `battleLayout(sw, sh)` (pure, tested at 5 sizes); the whole scene draws on a
  half-size canvas (`SCENE = 2`) at 1 art px and is doubled, so trainers, pets (now `drawMonster(..., 32, ...)` in
  `fight-flow.ts` and `main.ts side()`) and the background share the trainer's pixel. Codex art `art/gen/battle/`
  (backdrop 128x40 tiled at the horizon, ground 32x32, pad-far 56x14, pad-near 72x18; brief `.scratch/brief-battle-bg.md`),
  code fallback if not loaded (retry on error). HP panels: a top bar, mine left, foe's right. The text box portrait is
  the pet's head (`headOf`, 16x16 of the 32 px front, doubled). While shouts are open the command box shows
  `SHOUTS: n` + 1 GO! .. 5 FRIENDS!, the called one lit; `shoutAt` makes them tappable (wired in `main.ts` pointer).
  Panels and text keep the UI pixel size (say so if the user asks: "one pixel size" applied to the scene art).
- Codex note: its sandbox has no Python (PIL); it uses Node + pngjs for checks. Briefs that are too strict get refused:
  give exact coordinates and "move up to 3 px, never stop without writing".

## Play-test #1 (user, 2026-11-04, live worker 14537484)
The user played and reported 8 problems, now bugs 53-60 in `docs/BUGS.md` (screenshots `.scratch/bugs/53-*` to `57-59-*`),
each with a line in `docs/testing/checks/{npc,pet,visual}.md`. The chat log was read (8 lines, `.scratch/p4/chat-rows.txt`):
one failure, bug 60. **The user will play once more, last, when everything is done** (that is P6's whole-game play-test).
User's words on the battle screen: redesign the layout as Claude sees fit (Codex makes art only, never layout); one pixel
size for everything, **the player's pixel size is the baseline**; rework the battle background and the pet art at that
size, asking Codex specifically for the art. All 8 are fixed on live now (above).

## Next actions
1. **Join check: "a late joiner sees who is talking" FAILS** on live, twice in a row (11:00 VN, full run 19/20, then
   `--big 0` 17/18; outputs `.scratch/p4/join-check-55.txt`, `-55b.txt`). No worker code changed since the P4 deploy,
   when it passed. The check: `scripts/join-check.mjs` ~line 120 sends `{t:"talk", with: talkB.id}` from talkA (burst
   bots 2 and 3), then a late bot's `welcome.talks` must hold `[talkA, talkB]`. Room side: `worker/src/room.ts` `talk()`
   (~line 317: `talkNo` if `busy`), `expireTalks`, welcome at ~line 408. Suspects: a stale talk or leftover peers in the
   `check` DO from an earlier run (bots spilled to `check-2`, so talkA/talkB/late sit in different rooms), or `talkNo`.
   Log what talkA receives (`talk`/`talkNo`) and each bot's room. Fix, deploy, rerun until 20/20.
2. **P5** (`docs/plan/final-plan.md` P5; everything behind `CLOUD_LIVELY` in `client/src/game/test-mode.ts`, off = free
   rules fallback; every call through the worker ledger with caps; mock the LLM in tests). Order:
   a. **Village Gazette** (Meta Model API `muse-spark-1.3`, provider `meta` in `worker/src/providers.ts`, never used yet):
      new worker route `/api/gazette` (copy `rival.ts`/`handleRival` shape), cached per room and game day so every
      client gets the same three headlines; the villagers' host client posts the day's real events (promises kept or
      broken, duels, goals, prices from `npcs.board()`); shown at the top of the town board (`main.ts` `board`,
      `showMenu("Town board", ...)`) and as a toast. Rules fallback makes headlines from the same events.
   b. A watching villager comments once per fight (Baseten Spark Open, prefetched at fight start in `fight-flow.ts`;
      shown in `battleView.say` at the end). Rules fallback.
   c. Brain panel names which service answered each line (bug 36 wording).
   d. Evening campfire stories / NPC-to-NPC talk from the cloud with memories (look at `game/chatter.ts` first).
   e. Surprise, cut first if late: Postcards (`muse-image-1.0`): verify the API and price on dev.meta.ai docs first,
      hard cap $2/day, skip if unavailable.
   Deploy, join check, proof per item in `docs/testing/proof/`, spend from `/api/spend`.
3. P6 freeze 18:00 VN: bug fixes only, `scope-check` every scope on live, then the user's last play-test (2+ players).
   Ask before P6: remove Access at the freeze instead of Nov 5 morning (Open, below).
4. P4 leftovers only if time: tree clumps toward the coast, stumps, berry bushes, the plaza's bare dirt (pack `statue.png`).
5. Open pet checks to prove on live: villager pet looks the same in the village and on the battle screen (the rival
   duel draws `drawMonster(petLook(base.genes), 32, "front")` with no build: check against the village look); a bored
   villager walks up and challenges you.
6. After any user play-test: read the chat log unasked (PowerShell from `worker/`: `npx wrangler kv key list --binding
   GHOSTS --prefix "chat:<ms prefix>" --remote`, then `kv key get` each; rows are `{t, npc, player, line, reply, source}`),
   add failures to `docs/testing/checks/npc.md`, bugs to `docs/BUGS.md`. If the user says "sleep", Director mode.

## Open
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
