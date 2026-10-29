# HANDOFF: Mindworld rework v2 in progress (2026-10-29 ~13:00 UTC+7)

**Fresh-session starting prompt (user pastes it):** "Read HANDOFF.md (v2 status) and the v2 plan in docs/REWORK.md. Do Next actions 1-3: apply the Codex art bible to the pixel build, then the interior + farm, then port the rest of v1. Follow CLAUDE.md (Normal mode, 35% context limit)."

## Now
- User play-tested 2026-10-29 morning: too much UI, combat lag/freeze, art "ok not stunning", wants enterable A-frame interior (`visual-ref/house-inside.webp`), decor felt AI slop, TTS voices unfriendly. Plus backlog: bigger lands, monster-battle view, tamed = owned, farm. All folded into `docs/REWORK.md` (stages A-E, vibe analysis of `visual-ref/`; contact sheet `.scratch/visuals/ref-sheet.jpg` = 19 refs in one image, read that instead of the files).
- Done today (pushed? see git log; NOT deployed): dc715b3 snappy fights (memo rule decides at once; model prefetched during the turn animation; cloud per-move picks opt-in via `?cloudmoves` because Baseten/Modal now take 2-8 s; battle meshes disposed). 8f618b3: dock (⚔️ fight log, 🧠 teach drawer, 💬 room chat) replaces always-open panels; footer + instinct/coach chips moved into the 🧠 drawer; lands ~2.6x bigger (`layout.ts` CELL 30), perspective low follow camera (`view.ts`), instanced wind meadow `world/grass.ts` (Codex, tests), babble voices `game/babble.ts` (WebAudio, replaces speechSynthesis; mute chip still works).
- Tests: client 168, worker 148. Live site = round 1 build only (version 210895d9).
- Deploy: `.claude/settings.json` now allows `npx wrangler deploy` (user OK'd). User is setting up Cloudflare Access (one-time PIN to their email) on pets.uryto.dev so we can deploy privately; go public only when the user says. Until the user confirms Access is on, ask before deploying.
- Credits: Meta $149.91 left; Modal ~$110 of $129.98 left; Baseten ~$0.15 used, balance unknown (`/v1/billing/usage_summary` = PERMISSION_DENIED with the hackathon inference key; needs a workspace management key from the user). All-time LLM+GPU ~$20.

## v2 status (2026-10-29 afternoon)
- Cloudflare Access ON for pets.uryto.dev (app "pets", policy "Owner only" = user's email, OTP; `/` and `/api` both 302 to Access). Zero Trust Free, team `blue-wind-39a8`. Deploy (`wrangler deploy`) was DENIED by the auto-mode classifier: user must run it or allow it.
- Plan approved (docs/REWORK.md "v2 plan"): plain Canvas2D + own WebGL2 CRT, CC0 tiles snapped to palette + procedural monsters, 3D dropped.
- Moodboard skill done by Codex (`.claude/skills/moodboard/`, helper `scripts/palette.mjs extract|quantize`, uses worker/node_modules/sharp). Codex HAS ImageGen. Codex run 2 (art bible `docs/STYLE.md` + samples/mockups in `.scratch/art/`) brief: `.scratch/codex-stylebible-brief.md`, result `.scratch/stylebible-codex.md`.
- Pixel build (`client/pixel.html`, `client/src/pixel/`), commits 349333a S1, dd70ef0 S2a, dfc884f S2b, 6779acb S2c. Tests 180.
  - S1: low-res canvas (h 216) + WebGL2 CRT (`crt.ts`, C toggles), tile map from layout (`tiles.ts`, 1 unit = 1 tile), overworld walk/camera/trees/banner, pixel text + dialogue (Press Start 2P thresholded).
  - S2a: battle screen `battle.ts` (script of timed steps; tested), procedural monsters `monster.ts` (genes -> any size), wild pets wander + fight on touch, pet plays `allowedMoves()[0]` (= memoPolicy) with "memo #n"/"instinct" tag. `game/save.ts` extracted (v1 main.ts uses it too).
  - S2b: `game/party.ts` owned party (save `party`, `active`); P = "Your pets" menu (`menu.ts`); non-active pets idle at home with bubbles.
  - S2c: T = Teach screen `teach.ts` (DOM input + canvas memo/proof), `game/coach.ts` chain live -> offline. Teach now uses effort low (was truncating ~1/8 at 4000 tokens); Muse Spark open weights answers in 3-6 s.
  - Dev hook `window.__px` ({world, battleView, update(dt,t), keys, setCrt, state, fight}). Hidden pane: screenshots can be stale; drive with `for(...) { __px.update(.05,t); await 0 }` (await lets the fight script's promises run).
- Codex run 2 (art bible) DONE (all programmatic, no ImageGen; 28 colors, 38 PNGs verified on-palette; weak spots: static poses, interiors/animation untested): `docs/STYLE.md` + `.scratch/art/` (mockups `mock-overworld-4x.png`, `mock-battle-4x.png` look great: soft cozy palette, 6x8 font `font-6x8.png`, A-frame, farm plots, Mallow/Sprig monsters, `build.mjs` generator, `manifest.json`). Final report -> `.scratch/stylebible-codex.md`.
- Codex wrapper gotcha: pass long briefs as a file ("Read .scratch/x.md and do it"); inline multi-line prompts break PowerShell arg parsing.

## Next actions (rework v2)
1. Read `.scratch/stylebible-codex.md` + `docs/STYLE.md`; user reviews the mockups. Then swap `pixel/art.ts` placeholders and colors for the approved set (tiles with autotiled coast, A-frame, trees, UI frame, 6x8 font instead of Press Start 2P, palette in `monster.ts` ramps) and match the mockup battle layout (portrait in text box, Fight/Teach/Swap/Run menu: Fight = watch the pet play its memo, Teach = Teach screen, Swap = party, Run).
2. S4: A-frame interior scene (enter by the door, decor grid) + farm loop (pure logic module + tests first: plots, seeds, water, timed growth, sell at market).
3. Port the rest of v1 `main.ts` onto pixel: NPC/pet chat (Muse Spark), wild re-teach memos (`fetchWildMemos`), boss, ghosts/live room (`world/live.ts`), local Llama coach + voice (power mode), babble; then make pixel.html the index and delete the three.js files (`world/view.ts`, `grass.ts`, `aframe.ts`, `game/scene.ts`, `style.ts`) and the `three` dependency.

## Gotchas (new)
- `client-dev` (5173) proxies /api to `worker-live` (8787, real keys). Dev hook `window.__world`; hidden pane stalls rAF: call `__world.update(dt, t)` by hand before screenshots; hide `.overlay` (hatch/hints) for clean shots.
- Grass is added to `root` after `mergeStatic` (never merge instanced meshes) and does not cast shadows.

## Mindworld next (older list; REWORK.md and Next actions above take precedence)
0. **TOP PRIORITY (user, 2026-10-29): cozy, cute, beautiful at first sight** (judges, X viewers, players must not dislike it on sight). Research first, write findings to `docs/VISUALS.md`: look for Claude skills/plugins for game art or three.js visuals (SearchSkills/SearchPlugins), free-to-use asset packs (CC0 low-poly/voxel: e.g. Kenney, Quaternius, KayKit, Poly Pizza; check each license, credit in README), and three.js techniques (toon/soft shading, outlines, soft shadows, warm palette + gradient sky, ambient occlusion, bloom, gentle idle animations, particles, water/clouds under the islands). Keep the bundle small and Meta-only for models (art assets are not models, fine). Then restyle the world + battle view and show the user screenshots before/after.
0b. **Each player's corner = an A-frame house** (user): the pet and player can go inside (or into a cozy porch area) to chill; the player decorates it (inside + plot). Corners of other players show their A-frame + decor.
1. World polish from the user's play-test: in-world speech (wild pets/NPC/boss bubbles + browser speechSynthesis voice), random modular pet at hatch (more genes/parts), market (coins from wins → decor), NPC chat via Muse Spark (Worker kind, capped + cached), camera zoom.
2. Live layer: Durable Object room per world (WebSocket hibernation): presence + avatar/pet positions ~10 Hz while moving, chat, emotes; online players' corners fill the grid; live pet-vs-pet with a shared seed. Free plan: 100k req/day, incoming WS messages billed 20:1, 13k GB-s/day (about one busy room all day). Fall back to ghosts over the limit; ask before Workers Paid ($5/mo).
3. Scheduled Worker job: Muse Spark re-teaches wild pets/boss from players' fights (cost-capped). Then pet-to-pet chat, breeding.
3. Idea parked by the user (play-test 2026-10-28): a pet "heavy attack" move (strong vs idle, weak vs guard). Not now: a new action changes the sim, the DSL, every bench number and the tuned models' training data; revisit only after submission or as a separate post-event version.
4. User: decide when to make the HF coach repos public (power-mode download needs it; Nov 3 with the GitHub repo is the default). User play-test of the free coach pending.

## Gotchas
- The Browser pane can stop running animation frames (rAF 0/s) when hidden: drive `__world.update(dt, t)` by hand in checks; battle tweens finish on timers anyway.
- llama-server on Windows: a second server can "listen" on a port already taken and requests still reach the first; use a new port per model and check `/v1/models`. Stop servers you started with TaskStop (their background task id); PowerShell Stop-Process was denied by auto mode.
- Bulk teacher runs through local Worker: `wrangler dev --env-file ../.env --env-file ../.scratch/bench.env` (per-client cap $0.40/day otherwise; `--var` did not override). Make sure only one process listens on 8787.
- GPU browser tests: Claude can launch a separate Chrome (`--force_high_performance_gpu --remote-debugging-port=9222 --user-data-dir=.scratch/chrome-gpu`) and drive it with `scripts/cdp-eval.mjs`; stop it and delete `.scratch/chrome-gpu` (~5 GB of weights cache) afterwards. A lost WebGPU device needs a Chrome restart.
- Free-credit content may be used by Meta: notice + no personal data. Geo-block list: `worker/src/geo.ts`.
- Small Muse calls burn 150-290 reasoning tokens: `maxTokens` >= 400 (memo 1500) or the reply is empty/`truncated`.
- Chromium ignores `powerPreference` on Windows: pane/Chrome use the iGPU unless Windows Graphics settings or `--force_high_performance_gpu`.
- Browser benchmarks: use `vite preview` (static). `vite dev` full-reloads on any file change and restarts auto-runs.
- Native spike files live in `.scratch/native/` (bin/, two GGUF ~2.8 GB, results json). `client/src/spike/native.ts` reruns the 32 prompts against any llama-server.
- Codex wrapper: absolute `scripts/codex.ps1` path when cwd is `client/` or `worker/`; from bash use the PowerShell tool. Output file can come back truncated: rerun once.
- `wrangler dev --env-file ../.env` loads keys; `WRANGLER_SEND_METRICS=false` silences telemetry. npm resolved TS 7, Vite 8, Vitest 5: all work. `@cloudflare/workers-types`: use the bare package.
- Fresh repo rule: only work from Oct 27; demo opens with pre-existing vs new. Never commit `.env`. Unread Discord: use the `sync-event` skill.

## File map
CLAUDE.md, AGENTS.md · docs/{EVENT,PLAN,SPIKES,DEPLOY,DISCORD_DRAFTS,DEMO,FINETUNE,CREDITS}.md · worker/{wrangler.toml,src/{app,ledger,spend-do,providers,geo,pricing,ghosts,mock,index}.ts,test} · client/{index.html,spike-b.html,src/{main.ts,game/,spike/,sim/,eval/cli.ts}} · scripts/{smoke_llm.py,codex.ps1} · .claude/{skills,launch.json}
## Decisions made
- Browser-first "Pet Mind": local Instinct + cloud Cortex (Meta via Worker proxy) + home plot/neighborhood + ghost arena; signature Teach -> Prove. docs/PLAN.md v2. Hostname `pets.uryto.dev` approved (DNS at deploy).
- Codex plan review adopted: T0 first, WebSocket rooms on DOs (WebRTC stretch), spend counters in DO storage, paired-seed eval. Meta Horizon rejected; EOS no browser SDK.
- Repo: private GitHub repo from Oct 27 (evidence), secrets scan of history, make public Nov 3.
- Eval's Instinct = deterministic proxy (rules executed directly); live local-model results are reported separately, never passed off as the proxy's. Say so in the demo.
- Cortex output = closed rule DSL (<= 8 rules, <= 3 conds): validated, rendered into the Instinct prompt, executed by the proxy.
- Instinct model: Llama-class counts as Meta models (Discord ruling). Spike B: Llama 3.2 1B is the only model stable on 4 GB but too weak to be sole decider. The game never depends on the local model: reflex/memo fallback on timeout (~1.5 s) or device loss.
- Local model role (user, 2026-10-27): guarded chooser + pet voice; the eval/Teach->Prove numbers still use the deterministic `memoPolicy`. `allowedMoves()[0]` == memoPolicy (tested), so rules-only mode is exactly the measured policy.
- No Unity switch (user confirmed 2026-10-28, after native spike): native 3B is reached from the browser game as "power mode" (`NativeVoice` -> llama-server on 127.0.0.1:8080, auto-probed at load). Default stays no-install browser.

