# HANDOFF: Mindworld final stretch (2026-11-04, ~22:50 VN = 15:50 UTC; deadline Nov 5 09:00 VN = 02:00 UTC)

**Starting prompt:** "Read HANDOFF.md, then do Next actions in order: wait for the user's last play-test and read its
chat log, then P8 from `.scratch/p8/p8.patch`. Follow CLAUDE.md."

## State
- **The plan:** `docs/plan/final-plan.md` (Status at the top). Deadline Nov 4, 9 PM ET = Nov 5, 09:00 VN.
- **Live:** `https://mindworld.uryto.dev` (and pets.uryto.dev until P8), worker **24fb26ae**, client `main-Bn5TVW1j`,
  behind Access (home network only).
- **Scope checks on live done (2026-11-04 evening).** Every list is clear except lines that need a person or P8:
  game "a stranger plays" and "one ball, a real second person"; network "phone + second machine after going public";
  visual "the first screen feels cozy" (the user judges). Proof: `docs/testing/proof/{pet,game}/scope-check-live-2026-11-04.md`.
- **Fixed and live this session:** bug 63 (user: the room's table had no left edge), bug 64 (a host on the Teach
  screen froze its villagers for everyone), bug 65 (the inspector said "rules" right after Muse Spark answered you).
  All three proven on live; they stay in `docs/BUGS.md` until the user's review.
- **P8 is ready as a patch, not applied:** `.scratch/p8/p8.patch` removes `/api/chatlog` (route, handler, client call,
  test becomes "is gone"), sets `CLIENT_DAILY_USD = "2"`, drops the pets.uryto.dev route, README "$2/day per client".
  Tested with it applied: worker 288/288, tsc clean both. `git apply --check` passes on 45427c1.
- **P7 leftovers done:** demo numbers and on-screen labels match (`docs/ops/demo.md` checklist); first commit Oct 26
  12:14 ET holds only rules and notes, first code Oct 27 11:47 ET (`docs/ops/submission.md`); the X post needs no tag or
  hashtag (details page, #faqs, #announcements; `event.md`).
- Tests: client 710, worker 288, tsc clean both. Commits on `rework/fresh-look` up to 45427c1 (local, not pushed).
- Spend this session: under $0.10 (Teach and chat calls on live).
- Join check after the last deploy: 19/20, the known ghost only.

## Decisions (standing)
- **Codex (user, 2026-11-04):** may take non-visual tasks with a clear brief; Claude keeps visual work, the demo video,
  the final check and the submission form, and reviews every Codex output (`CLAUDE.md`).
- **Domain (user): `mindworld.uryto.dev`.** Saves, postcards and the cached model are per origin.
- Bugs 61 and 62 left in the freeze (Claude): 61 cloud mind stand-in truncates at 400 tokens; 62 a late joiner sometimes
  misses who is talking.
- NPCs are the star: the sim reasons; the model picks among valid options and speaks.
- The game must still work free after the event. Local prompts are frozen at af455c4; `/api/llm` policy copies them.
- `LOCAL_ONLY` off; cloud extras behind `CLOUD_LIVELY`. Combat keeps the 5 moves and the memo DSL.
- Submission day (user): GitHub and the 4 HF repos public, Access removed, right before submitting (P8).
- Pack rules: no human activity without a pack animation; top-down, front side only (`docs/visual/visual.md`).
- Test bots never join `main`: use `check`.

## Pending decisions (user)
- The user's last play-test (2+ players) on live. Bugs 34, 36, 37, 45-60, 63-65 wait for that review.
- Submission form fields marked **[USER]** in `docs/ops/submission.md` (team name, opinions, consent box, X link, video link).

## Next actions
1. Done: join check after deploy 24fb26ae, **19/20** (`.scratch/chk7/join-check-after-65.txt`); the one miss is the
   known ghost (Bot19 left behind after a close lost on the home link; the 90 s reaper clears it).
2. **The user's last play-test.** After it: read the chat log unasked (Gotchas), add failures to
   `docs/testing/checks/npc.md`, bugs to `docs/BUGS.md`; remove bugs the user saw fixed.
3. **P8** (order in `final-plan.md`, planned Nov 5 06:00-08:00 VN), only after step 2: `git apply .scratch/p8/p8.patch`,
   run worker tests and both tsc, commit, build, deploy (two plain commands), check `/api/chatlog` POST gives 404 on live.
   Then delete the `chat:` KV rows (PowerShell from `worker/`: list with `--prefix "chat:"`, `kv key delete` each; about
   200 rows). The user makes the repo and 4 HF repos public and removes Access; an hour of outside join checks (phone on
   mobile data + a second machine + a 30-bot burst for 2 minutes, watch `/api/spend`); the user records/uploads the video,
   posts on X, fills the [USER] fields and submits.
4. If the user says "sleep", Director mode (`docs/ops/director.md`).

## Open
- Bug 61 (`docs/BUGS.md` NPC): no-model hosts run some villager decisions on rules; README "Honest limits" says so.
- Minds' memories live in the hosting tab: when the last host leaves and someone reloads, villagers start with no
  friends (seen on live: "Friends: none yet"). Gazette notes likewise.
- Not done by a person: a 2-person play, the stranger test. A player's own dance pose reaches a late joiner only on
  their next move. Rival plan latency 13-15 s (in `demo.md`).
- Seen, not logged as bugs: Ama, the Elder and the default player share the orange-ponytail look; Ama sold at the
  stall at 04:19; the dance only runs at noon and in the evening (so the Dance emote draws nobody in the morning).

## Gotchas
- **Join check:** close the test Chrome first; after a deploy wait until `/` serves the new `main-` name and a minute
  more; wait 2 minutes between runs and `node scripts/room-probe.mjs check` first (must say `peers: 0`).
- **Deploy:** `npm --prefix client run build`, then `npx wrangler deploy` inside `worker/`. If it exits 255 without the
  "Deployed pet-mind triggers" line, run `npx wrangler triggers deploy` there (it put back both domains and the cron).
  If `wrangler.jsonc` appears at the root, delete it. `/api/spend` shows the day's spend and caps.
- **Client tests under load** (game Chromes and the model running) time out at 5 s in random files: use
  `npx vitest run --testTimeout=30000` (710 pass).
- **Two Chromes.** The **TEMP profile** (user's own Chrome, Claude in Chrome tools) is signed in to Cloudflare, Cerebral
  Valley and Discord: dashboards, the form (read only), Discord (read only). The **test Chrome**
  (`bash .scratch/mlc/chrome.sh "<url>"`, CDP 9333) is a bench profile signed in to nothing. A **no-GPU bench Chrome**:
  `chrome.exe --user-data-dir=.scratch/chk7/nogpu-profile --remote-debugging-port=9334 --disable-gpu
  --disable-features=WebGPU,Vulkan ...`, driven with `.scratch/chk7/cdp-{tab,shot}2.mjs`. Close each via CDP `Browser.close`.
- Live drivers from this session in `.scratch/chk7/`: `teach2.js` (open Teach and teach), `fight.js` (wild fight,
  `window.__arch`, `window.__stopOn`), `bored.js` (a bored villager's own duel ask), `yes.js`/`rematch.js` (answer in
  chat), `dance.js`, `nogpu-chat.js` (`window.__line`), `go-home.js` (into the house). Live tests change the bench save
  (`localStorage["petmind.v1.p1"]`): keep the memo first and write it back.
- **The Teach screen pauses nothing now (bug 64)**, but a Teach screen left open in a driver still covers the game: close
  it with Escape before reading the clock or villagers.
- **The submission form** is a dialog at cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit (TEMP profile). Read only.
- Access app: Cloudflare One > Access controls > Applications > "pets" (destinations pets + mindworld).
- **Whole-map or tile-box shots:** live, test Chrome: `node .scratch/p6/cdp-map.mjs "all"|"i0,j0,i1,j1" <out.png> [scale]`
  (forces daylight; the HUD covers the top right of small boxes, so use a box of 20+ tiles).
- **The Browser pane, hidden, throttles frames to ~1/s and does NOT set `document.hidden`.** Screenshots on a hidden
  pane: call `__px.update(0.01, performance.now() / 1000)` first.
- Game clock: a day is 12 real minutes, 30 s per game hour; night 22:00-06:00. Hour from a tab:
  `(((__px.world.npcs.v.t / 30) + 8) % 24)`. Villager hosts: `Object.fromEntries(__px.world.npcs.hosts)`.
- Drive by hand: `__px.world.update(0.05, new Set(["arrowdown"]))`. Emote keys 1-4 (3 = dance). `__px.blocked()` shows
  what holds the keys. Inside the house: `__px.interior.player`, leave by walking down the lane at x 2.5.
- After a play-test, the chat log (PowerShell from `worker/`): `npx wrangler kv key list --binding GHOSTS --prefix
  "chat:" --remote`, then `kv key get` each; rows `{t, npc, player, line, reply, source}`. Rows up to 05:51 UTC
  2026-11-04 are read (play-test #1 and Claude's tests). Typos like "monring" are the humanizer's, on purpose.
- Shell edits with backticks or `${}` break Bash heredocs: write a Python patch script to `.scratch/`.
- The untracked `info-ref/` folder is the user's; never commit or touch it.

## File map
- Code: client/src/{sim,life,mind,world,game,pixel,finetune}/ · worker/src/{room,room-do,npc,app,llm-policy,rival,chat,banter,cheer,gazette}.ts.
  Seams: `game/ports.ts`, Overworld.buildScene, `pixel/pixel-view.ts`. Entry: `client/src/pixel/main.ts`.
- Docs: index `docs/README.md`; submission `docs/ops/submission.md`; demo `docs/ops/demo.md`; tools `docs/ops/tooling.md`.
- Earlier sessions: `docs/archive/HISTORY.md` (grep "2026-11-04 session").
