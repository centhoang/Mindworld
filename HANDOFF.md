# HANDOFF: Mindworld final stretch (2026-11-04, ~16:55 UTC; deadline Nov 5 02:00 UTC = 09:00 VN)

**Starting prompt:** "Read HANDOFF.md, then do Next actions in order: finish the demo video (docs/ops/demo.md
'Video build'), then the play-test log and P8. Follow CLAUDE.md."

## State
- **The plan:** `docs/plan/final-plan.md` (Status at the top). Deadline Nov 4, 9 PM ET = Nov 5, 09:00 VN.
- **Live:** `https://mindworld.uryto.dev` (and pets.uryto.dev until P8), worker **24fb26ae**, client `main-Bn5TVW1j`,
  behind Access (home network only). Unchanged this session.
- **Demo video in progress (this session):** staged on a local build, not recorded on live (user). 22 shots written,
  16 peeked and working; pipeline, shot table, narration plan and what is left: `docs/ops/demo.md` "Video build".
  All tooling and outputs in `.scratch/video/` (gitignored). Nothing rendered to mp4 yet. No game code changed.
- Scope checks on live done (2026-11-04 evening); every list clear except lines needing a person or P8.
- **P8 is ready as a patch, not applied:** `.scratch/p8/p8.patch` (removes `/api/chatlog`, `CLIENT_DAILY_USD = "2"`,
  drops pets.uryto.dev, README "$2/day per client"). Tested applied: worker 288/288, tsc clean. `git apply --check`
  passes on 45427c1.
- Tests: client 710, worker 288, tsc clean both. Commits on `rework/fresh-look` up to 8861d29 (local, not pushed).
  This session: docs only (demo.md, HANDOFF), not committed.
- Spend this session: $0 (mock worker, offline TTS).

## Decisions (standing)
- **Video (user, 2026-11-04):** stage every scene with scripts on the local build; our own lines, our own camera;
  video-only polish (light, particles, emotes) is fine; never change the live game for it. Claude builds the video;
  the user uploads and submits. Narration voice: Kokoro `af_heart` (offline). Music must be original (no downloads).
- **Codex (user, 2026-11-04):** may take non-visual tasks with a clear brief; Claude keeps visual work, the demo video,
  the final check and the submission form, and reviews every Codex output (`CLAUDE.md`).
- **Domain (user): `mindworld.uryto.dev`.** Saves, postcards and the cached model are per origin.
- Bugs 61 and 62 left in the freeze. NPCs are the star: the sim reasons; the model picks among valid options and speaks.
- The game must still work free after the event. `LOCAL_ONLY` off; cloud extras behind `CLOUD_LIVELY`.
- Submission day (user): GitHub and the 4 HF repos public, Access removed, right before submitting (P8).
- Test bots never join `main`: use `check`. The TEMP Chrome profile (Claude in Chrome) is Claude's to use freely
  for project services (user, 2026-11-04); still read-only for Discord and the submission form.

## Pending decisions (user)
- The user's last play-test (2+ players) on live. Bugs 34, 36, 37, 45-60, 63-65 wait for that review.
- Submission form fields marked **[USER]** in `docs/ops/submission.md` (team name, opinions, consent box, X link, video link).
- The video's opening line ("built Oct 27 - Nov 4 / already existed: open-source libraries, a licensed pixel-art pack
  (Sunnyside World), Meta's models"): the user confirms when watching the cut.

## Next actions
1. **Finish the demo video** (`docs/ops/demo.md` "Video build", "Left to do"): start the stack (worker-mock,
   client-dev-room, test Chrome, `node shoot.mjs load`), peek shots 17-22 and fix, re-peek 4/12/16, re-voice at 1.05
   with n03 shortened, render all 22 (`node shoot.mjs render <shot>`, about 1-2 min each; run in the background),
   make an original chiptune bed + bubble blips, edit to <= 180 s with ffmpeg (fades, narration at the planned starts,
   loudness, ASS captions), review a contact sheet, SendUserFile the mp4. Then close the dev servers and test Chrome.
2. **The user's last play-test.** After it: read the chat log unasked (Gotchas), add failures to
   `docs/testing/checks/npc.md`, bugs to `docs/BUGS.md`; remove bugs the user saw fixed.
3. **P8** (order in `final-plan.md`), only after step 2: `git apply .scratch/p8/p8.patch`, worker tests and both tsc,
   commit, build, deploy (two plain commands), check `/api/chatlog` POST gives 404 on live, delete the `chat:` KV rows
   (PowerShell from `worker/`: list `--prefix "chat:"`, `kv key delete` each; ~200 rows). The user makes the repo and
   4 HF repos public and removes Access; an hour of outside join checks (phone on mobile data + a second machine + a
   30-bot burst for 2 minutes, watch `/api/spend`); the user uploads the video, posts on X, fills [USER], submits.
4. If the user says "sleep", Director mode (`docs/ops/director.md`).

## Open
- Bug 61 (`docs/BUGS.md` NPC): no-model hosts run some villager decisions on rules; README "Honest limits" says so.
- Minds' memories live in the hosting tab: when the last host leaves and someone reloads, villagers start with no
  friends. Gazette notes likewise.
- Not done by a person: a 2-person play, the stranger test.
- Seen, not logged as bugs: Ama, the Elder and the default player share the orange-ponytail look (the video gives Kai
  curly hair); the dance only runs at noon and in the evening.

## Gotchas
- **Video shoot:** a Browser-pane tab on localhost:5181/8799 joins the `video` room and takes villagers: close it.
  `shoot.mjs load` reloads the tab (stage script must be registered before navigation). Shot files are re-sent on every
  peek/render, so shot edits need no reload; `director.js` edits need `load`. The sim can drop a villager's puppet:
  `D.npc` registers a hold that is re-applied every frame. The game's own dusk tint is mild; the video sets
  `scene.day = true` and grades light itself (`D.light`). Font is uppercase ASCII 32-95 only. Each fight needs a fresh
  `BattleView` (old steps carry over otherwise). Mo's pet is "Ripple".
- **Join check:** close the test Chrome first; after a deploy wait until `/` serves the new `main-` name and a minute
  more; wait 2 minutes between runs and `node scripts/room-probe.mjs check` first (must say `peers: 0`).
- **Deploy:** `npm --prefix client run build`, then `npx wrangler deploy` inside `worker/`. If it exits 255 without the
  "Deployed pet-mind triggers" line, run `npx wrangler triggers deploy` there. If `wrangler.jsonc` appears at the root,
  delete it. `/api/spend` shows the day's spend and caps.
- **Client tests under load** time out at 5 s in random files: `npx vitest run --testTimeout=30000` (710 pass).
- **Two Chromes.** The **TEMP profile** (user's own Chrome, Claude in Chrome tools) is signed in to Cloudflare,
  Cerebral Valley and Discord. The **test Chrome** (CDP 9333, `.scratch/mlc/chrome-profile`) is a bench profile signed
  in to nothing. No-GPU bench Chrome: `--user-data-dir=.scratch/chk7/nogpu-profile --remote-debugging-port=9334
  --disable-gpu --disable-features=WebGPU,Vulkan`. Close each via CDP `Browser.close`.
- The details page (cerebralvalley.ai/e/meta-ai-developer-hackathon/details) needs sign-in: read it in the TEMP
  profile. Video rules there: 3 minutes, show only what was built in the event and say so clearly, "genuinely cool to
  watch"; finalists' videos are watched live.
- Live drivers from earlier sessions in `.scratch/chk7/` (teach2, fight, bored, yes/rematch, dance, nogpu-chat,
  go-home). Live tests change the bench save (`localStorage["petmind.v1.p1"]`).
- Game clock: a day is 12 real minutes, 30 s per game hour; night 22:00-06:00. Hour from a tab:
  `(((__px.world.npcs.v.t / 30) + 8) % 24)`. Villager hosts: `Object.fromEntries(__px.world.npcs.hosts)`.
- After a play-test, the chat log (PowerShell from `worker/`): `npx wrangler kv key list --binding GHOSTS --prefix
  "chat:" --remote`, then `kv key get` each; rows `{t, npc, player, line, reply, source}`. Rows up to 05:51 UTC
  2026-11-04 are read.
- Shell edits with backticks or `${}` break Bash heredocs: write a Python patch script.
- The untracked `info-ref/` folder is the user's; never commit or touch it.

## File map
- Code: client/src/{sim,life,mind,world,game,pixel,finetune}/ · worker/src/{room,room-do,npc,app,llm-policy,rival,chat,banter,cheer,gazette}.ts.
  Seams: `game/ports.ts`, Overworld.buildScene, `pixel/pixel-view.ts`. Entry: `client/src/pixel/main.ts`.
- Video: `.scratch/video/` (director.js, stage.js, shoot.mjs, shots/, narration.json, tts.py, assets/, voice/).
- Docs: index `docs/README.md`; submission `docs/ops/submission.md`; demo + video build `docs/ops/demo.md`; tools `docs/ops/tooling.md`.
- Earlier sessions: `docs/archive/HISTORY.md` (grep "2026-11-04 session").
