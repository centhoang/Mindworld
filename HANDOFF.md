# HANDOFF: Mindworld final plan (2026-11-04, ~03:00 VN)

**Starting prompt:** "Read HANDOFF.md, then fix the play-test #1 bugs (53-60 in docs/BUGS.md), then continue docs/plan/final-plan.md from its Status section. Follow CLAUDE.md."

## Where things stand
- **The plan:** `docs/plan/final-plan.md` (approved 2026-11-03 16:20 VN). Phases P0-P8, VN timeline, cut lines, and a
  Status section at the top. Keep that Status current every session.
- Live worker 14537484 (P4). Local commits on `rework/fresh-look` (last 821289a + docs), not pushed.
- Tests: client 664, worker 221, tsc clean both. Join check on live clean after the P4 deploy.
- Spend 2026-11-03 (ledger day): $0.72 of the $30 day cap. Baseten total $1.18 of its $50 cap. Meta, Modal untouched.
- Earlier sessions' done lists: `docs/archive/HISTORY.md` (grep "2026-11-04 session" or "2026-11-03 session").

## Done this session (P4; commits 160c5b6, cbbf566, 821289a)
- **Bug 46:** every plot, taken or not, has the same small house (`village-map.ts plotHouse`: foot px+2.5, pz+4; roof
  colour by slot from `ROOFS`). Art: Codex drew `client/public/art/gen/home-small-roof.png` + `home-small-open.png`
  (80x64, one outline, brief `.scratch/brief-home-small.md`, its checks `.scratch/home-small-result.md`);
  `python scripts/art-home-small.py` recolours the roof from the tileset's matching house blocks (128 px apart) into
  `art/sunny/home-small-<roof>.png`. Inside: `game/house.ts` floor plan (picture pixels), `interior.ts` draws the open
  picture, fades my own roof (`InteriorHost.roof`), crate square east of the door lane (GX/GY), no placed furniture.
- **Plots:** a 2x3 tilled field (`bedsAt` rect: px+6..7, pz+2..4; free plots draw tilled beds via `freeBeds`), a front
  fence of pack rail tiles (tileset row 2 cols 38/39/42, decor kind `rail`, `plotFences`) with a 3-tile gate at the door,
  the name sign just inside, east of the gate. West coast moved out one tile so west houses do not stand on the shore.
- **Touch controls:** `pixel/touch.ts` (stick: walk, rim = run; E / X / T buttons send real key events), on coarse
  pointers only; proven in the pane at 375x812. Not yet tried on a real phone.
- Proof: `docs/testing/proof/visual/house-46-live.png`, `house-46-inside-live.png`. Checks added to `checks/visual.md`.
- Still open from the BuiltDemo sheet (`.scratch/p4/demo-all.png`): tree clumps toward the coast, stumps, berry bushes,
  the plaza's bare dirt (pack `statue.png` is exported, not loaded). Do after play-test #1 if time.

## Play-test #1 (user, 2026-11-04, live worker 14537484)
The user played and reported 8 problems, now bugs 53-60 in `docs/BUGS.md` (screenshots `.scratch/bugs/53-*` to `57-59-*`),
each with a line in `docs/testing/checks/{npc,pet,visual}.md`. The chat log was read (8 lines, `.scratch/p4/chat-rows.txt`):
one failure, bug 60. **The user will play once more, last, when everything is done** (that is P6's whole-game play-test).
User's words on the battle screen: redesign the layout as Claude sees fit (Codex makes art only, never layout); one pixel
size for everything, **the player's pixel size is the baseline**; rework the battle background and the pet art at that
size, asking Codex specifically for the art.

## Next actions
1. **Bugs 53-60**, quick ones first: 53 (campfire pose `warm` plays the fishing `waiting` strip: use idle, maybe doing),
   54 (centre the flames on the ring), 60 (`doingAnswer`: real label, words for the hour), 57 (keys 1-5 legend while a
   shout is open), 56 (pet parts: remove or redraw the under-eye lines; review all parts at pet size), 55 (Codex rework
   brief for `home-small-open.png`, then `scripts/art-home-small.py`, re-check `game/house.ts`), then 58 + 59 together:
   measure the pixel scale of every battle layer first (background, trainers, pets: pets are drawn from genes, so the
   fix is likely the pet part art plus the draw scale), decide the layout, then Codex briefs for the background and
   pet parts at the player's pixel size. Deploy, `node scripts/join-check.mjs`, proof per bug.
2. P4 leftovers if time (tree clumps toward the coast, stumps, berry bushes, the plaza's bare dirt, pack `statue.png`).
3. **P5** (liveliness + surprise, behind `CLOUD_LIVELY`), then P6 freeze and the user's last play-test.
4. Open pet checks to prove on live with the pane visible: villager pet looks the same in the village and on the battle
   screen; a bored villager walks up and challenges you. Optional P1 leftover: pack expression icons over pets.
5. After any user play-test: read the chat log unasked (PowerShell from `worker/`: `npx wrangler kv key list --binding
   GHOSTS --prefix "chat:<ms prefix>" --remote`, then `kv key get` each; rows are `{t, npc, player, line, reply, source}`),
   add failures to `docs/testing/checks/npc.md`, bugs to `docs/BUGS.md`. If the user says "sleep", Director mode.

## Open
- User's call, asked and not yet answered: remove Access at the freeze (Nov 4 ~18:00 VN) instead of Nov 5 morning, so
  outside joins get tested with time to fix. Ask again before P6.
- 34, 36, 37, 45, 46, 47, 48, 49-52 fixed, waiting for the user's review on live.
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
