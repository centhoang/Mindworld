# HANDOFF: Mindworld final stretch (2026-11-04, ~19:50 VN = 12:50 UTC)

**Starting prompt:** "Read HANDOFF.md, then do Next actions in order: the domain move once the user confirms Access,
scope-check every scope on live, the user's last play-test, then P8. Follow CLAUDE.md."

## State
- **The plan:** `docs/plan/final-plan.md` (Status at the top is current). Deadline Nov 4, 9 PM ET = Nov 5, 09:00 VN.
- **P6 `/api/llm` lock-down done and live** (worker 950958dc, client `main-czFxq799` unchanged). Codex built it,
  Claude reviewed: `worker/src/llm-policy.ts` fixes provider, output cap, prompt cap and system text per kind; low
  effort forced. Live proof `docs/testing/proof/network/llm-lockdown-live.md` ($0.016).
- **Join check after it:** 19/20 from an empty room; the only miss is a ghost from a close lost on the home link,
  cleared by the room's 90 s reaper. New `scripts/room-probe.mjs` shows who is in a room. Rule in `docs/ops/tooling.md`.
- **P7 drafts done:** `docs/ops/submission.md` (every form field, read from the user's signed-in Chrome; draft
  answers A-D; X post draft), `docs/ops/demo.md` (script for this build), README rewritten by Codex and reviewed.
- Tests: client 710, worker 288, tsc clean both. Commits on `rework/fresh-look`: e408276, 0852852 (local, not pushed).
- Spend this session: ~$0.025 (proof calls). Read `/api/spend` in the test Chrome for the day's number.

## Decisions (standing)
- **Codex (user, 2026-11-04):** may also take non-visual tasks with a clear brief; Claude keeps visual work, the demo
  video, the final check and the submission form, and reviews every Codex output (`CLAUDE.md`). Briefs in `.scratch/brief-*.md`.
- **Domain (user, 2026-11-04): move to `mindworld.uryto.dev`.** Code hard-codes nothing; only `worker/wrangler.toml`
  `routes`, the default URLs in `scripts/{join-check,net-bots,net-check,room-probe}.mjs`, and docs name the host.
  Saves, postcards and the cached model are per origin: everyone starts fresh on the new host.
- Bug 61 left in the freeze (Claude): the cloud mind stand-in truncates at 400 tokens; fixing it risks the shared cap.
- NPCs are the star: the sim reasons; the model picks among valid options and speaks. Rivals: Muse Spark proposes, the sim rehearses.
- The game must still work free after the event. Local prompts are frozen at af455c4 (a text change needs a retrain).
  The `/api/llm` policy copies those frozen prompts exactly, so any change there must change both (client test guards it).
- `LOCAL_ONLY` off; cloud extras behind `CLOUD_LIVELY`. Combat keeps the 5 moves and the memo DSL.
- Submission day (user): GitHub and the 4 HF repos public, Access removed, right before submitting (P8).
- Pack rules: no human activity without a pack animation; top-down, front side only (`docs/visual/visual.md`).
- Test bots never join `main`: use `check`.

## Pending decisions (user)
- The user checks `https://mindworld.uryto.dev` on a phone on mobile data (Wi-Fi off): it must show the Access login.
- Submission form fields marked **[USER]** in `docs/ops/submission.md` (team name, opinions, consent box, X link, video link).

## Next actions
1. **Domain move done** (worker 0b90b603, 2026-11-04 ~20:10 VN): the Access app "pets" (read in the TEMP profile)
   lists `pets.uryto.dev` and `mindworld.uryto.dev` under the policy "Owner home only"; `wrangler.toml` routes both
   (pets kept until P8; at P8 drop the pets route); scripts and docs default to mindworld. From home both answer 200 with
   the same build. Left: the user's phone check (Pending), the join check result on the new host (`.scratch/p6/join-mindworld.txt`).
2. `scope-check` every scope on live (skill; checklists in `docs/testing/checks/`), proof in `docs/testing/proof/<scope>/`.
   Open pet checks: villager pet looks the same in the village and on the battle screen; a bored villager challenges you.
3. The user's last play-test (2+ players). After it: read the chat log unasked (Gotchas), add failures to
   `docs/testing/checks/npc.md`, bugs to `docs/BUGS.md`.
4. P7 leftovers: re-check the numbers in `demo.md` / README against the inspector on camera; confirm the first commit
   (Oct 26 23:14 VN = 12:14 ET, after kickoff) is fine; event tags for the X post (`sync-event`).
5. P8 (order in `final-plan.md`): remove `/api/chatlog`, its client call and KV rows; lower `CLIENT_DAILY_USD` "10" -> "2"
   in `worker/wrangler.toml` (and the README "Cost safety" line); deploy; the user makes repos public and removes Access;
   an hour of outside join checks (phone on mobile data + a second machine + a 30-bot burst for 2 minutes, watch
   `/api/spend`); the user records/uploads the video, posts on X, fills the [USER] fields and submits.
6. If the user says "sleep", Director mode (`docs/ops/director.md`).

## Open
- Bug 61 (`docs/BUGS.md` NPC): no-model hosts run villager decisions on rules; README "Honest limits" says so.
- Gazette weak spot: plain `remember()` notes live only in the host's tab (a reload loses that day's everyday notes).
- Play-test #1 bugs 53-60 fixed on live; 34, 36, 37, 45-60 wait for the user's review on live.
- Not done by a person: a 2-person play, the stranger test. Not run live: joining while someone is indoors; a host
  leaving mid-conversation. A player's own dance pose reaches a late joiner only on their next move.
- Rival plan latency 13-15 s (in `demo.md`). Campfire postcards only on the storyteller's host machine.

## Gotchas
- **Join check:** close the test Chrome first; after a deploy wait until `/` serves the new `main-` name and a minute
  more; wait 2 minutes between runs and `node scripts/room-probe.mjs check` first (must say `peers: 0`). A socket
  open from home sometimes stalls 20 s: run the probe again.
- **Two Chromes.** The **TEMP profile** is the user's own Chrome profile named "TEMP", reached with Claude in Chrome
  (`mcp__claude-in-chrome__*`); it is signed in to Cloudflare (dashboard, Zero Trust account ff6b999f...), Cerebral
  Valley and the other services. Use it for dashboards and the form (read only). The "test Chrome" below
  (`.scratch/mlc/chrome.sh`, CDP port 9333) is a separate bench profile signed in to nothing (the game opens from home without a login); never
  open it for a dashboard (user, 2026-11-04).
- **The submission form** is a dialog at cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit (TEMP profile). Read only.
- Access app: Cloudflare One > Access controls > Applications > "pets" (self-hosted, destinations pets + mindworld).
- Live proof calls by hand: `client/node_modules/.bin/tsx .scratch/p6/live-llm-proof.mts` (real prompts, ~$0.016).
  tsx scripts with top-level await need the `.mts` extension.
- **Whole-map or tile-box shots:** live, test Chrome: `node .scratch/p6/cdp-map.mjs "all"|"i0,j0,i1,j1" <out.png> [scale]`.
- Roads draw a tile wider than their `=` tiles (`sunny-terrain.ts` `isRoad`): nothing small goes next to a road.
- **Resource timing is full** in game tabs: `performance.getEntriesByType` misses API calls; hook `fetch` instead.
- Banter by hand (test Chrome, room `check`): `.scratch/p5/live-banter-{api,chat,story,story-read}.js`.
- Postcards by hand: `__px.album.cards`, `__px.albumView.toggle()`; `.scratch/p5/live-postcard-{api,story,fight}.js`
  (clear `localStorage["petmind.album.v1"]` first). Each real image costs $0.01.
- Gazette by hand: `__px.gazette.paper`. Cheer: `.scratch/p5/live-cheer.js`.
- **The Browser pane, hidden, throttles frames to ~1/s and does NOT set `document.hidden`.** Screenshots on a hidden
  pane: call `__px.update(0.01, performance.now() / 1000)` first.
- Seeing a far villager: wrap `w.update` to set `w.cam` to the villager after each update.
- Live proof shots: test Chrome + `node scripts/cdp-tab.mjs "uryto.dev" <js>` then `node scripts/cdp-shot.mjs
  "uryto.dev" <out.png>`; close it via CDP `Browser.close` (port 9333).
- Ball debugging: `__px.world.ballNow`, `.ball.seq`, `.ball.pitch`.
- A Vite HMR reload resets `alwaysDay`, `ui.map` and forced states.
- Drive by hand: `__px.world.update(0.05, new Set(["arrowdown"]))`. A fight: `__px.fight(__px.world.wilds[0])`, then
  `__px.battleView.update(0.05)`. A rival duel: player next to the villager, keydown "e", `#chat input` "wanna duel?",
  `requestSubmit()`, wait ~6 s. Emote keys 1-4. `__px.blocked()` shows what holds the keys.
- Game clock: a day is 12 real minutes; night (22:00-06:00) is 4 minutes. Villager hosts:
  `Object.fromEntries(__px.world.npcs.hosts)`. Villagers work mornings; try each of Ama, Elder, Mo.
- Deploy: `npm --prefix client run build`, then `npx wrangler deploy` inside `worker/` (PowerShell `Set-Location worker`).
  If `wrangler.jsonc` appears at the root, delete it. `/api/spend` shows the day's spend and caps.
- mindworld.uryto.dev (and pets.uryto.dev until P8) answer 200 from this home network only (Access policy "Owner home only"). Local dev: `.claude/launch.json` `client-dev` (no worker).
- Test Chrome: `bash .scratch/mlc/chrome.sh "<url>"` (port 9333).
- Shell edits with backticks or `${}` break Bash heredocs: write a Python patch script to `.scratch/` with the Write tool.
- Live tests change the profile's save (`localStorage["petmind.v1"]`): keep the memo first, write it back after.
- After a play-test, the chat log (PowerShell from `worker/`): `npx wrangler kv key list --binding GHOSTS --prefix
  "chat:<ms prefix>" --remote`, then `kv key get` each; rows `{t, npc, player, line, reply, source}`.
- The untracked `info-ref/` folder is the user's; never commit or touch it.

## File map
- Code: client/src/{sim,life,mind,world,game,pixel,finetune}/ · worker/src/{room,room-do,npc,app,llm-policy,rival,chat,banter,cheer,gazette}.ts.
  Seams: `game/ports.ts`, Overworld.buildScene, `pixel/pixel-view.ts`. Entry: `client/src/pixel/main.ts`.
- Docs: index `docs/README.md`; submission `docs/ops/submission.md`; demo `docs/ops/demo.md`; tools `docs/ops/tooling.md`.
- Earlier sessions: `docs/archive/HISTORY.md` (grep "2026-11-04 session").
