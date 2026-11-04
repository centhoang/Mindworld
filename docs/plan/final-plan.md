# Final plan: Mindworld, Nov 3 16:00 VN to submission (Nov 5, 09:00 VN)

## Status (update every session)
- **P0 done** (Nov 3 ~17:00 VN, live): LOCAL_ONLY off, `CLOUD_LIVELY` flag added (nothing uses it yet), bugs 34 and 36.
- **P1 part done** (live `main-DyR8JZim`): fight rules (block, counter, charge, signature, crits both sides, brute HP 48,
  Prove +29.0 held-out) and the battle screen (shouts 1-5 twice per wild fight, damage pops, charge pips, effect lines).
- **P1 rivals done** (live `main-mYTbEBmg`, worker b05d04d5): Elder/Mo/Ama pets from day 1, duel ask and refusals,
  villager challenges, rehearsal-based adaptation with Muse Spark's `/api/rival` plan, loss explanation + next lesson,
  memory/respect/news/coins. Design and bench: `docs/ai/pet.md` "Village rivals". Proof: `docs/testing/proof/pet/rivals-live.md`.
  Changed from the plan: the duel is a live `Battle` (with shouts and Teach), not the precomputed `runDuel`; the model's
  plan is one candidate the sim rehearses, not the memo itself.
- **P1 coach review done** (live `main-CKR3gYL-`, worker 973186f7): `sim/review.ts` reads the replay, rehearses each
  lesson the memo lacks against the same foe, proposes the best one that also passes the Teach gate; "Teach it" types it
  into Teach. Design and bench: `docs/ai/pet.md` "Coach review". Proof: `docs/testing/proof/pet/coach-review-live.md`
  (Mo duel -> counter lesson -> Muse Spark taught it, Prove +14.3). Changed from the plan: the lesson is chosen by the
  sim (rehearsal + gate), not by replay rules alone; the cloud review text stays in P5.
- **P1 trainers done** (live `main-R92c8Tcb`, worker 26730c70): player, villager or other player beside their pet,
  idle / attack swing on a shout (no sword layer) / hurt on a hard hit / jump on a win. Proof `proof/pet/trainers-live.md`.
- **P1 done** (live `main-OQm_PqE6`, worker 6bdb78ea): pack HP bars (green, red at <= 40%) and blue charge bar, pack
  glint on crits and signatures. Proof `proof/pet/bars-glint-live.md`. Not done from the P1 list: pack expression icons
  over pets (`expression_attack`, `stress`, `love`); left out as optional polish.
- **P2 mostly done** (live `main-CrFuSOoI`, worker f42a02af, commit 57b6461): one shared ball through the room (kick
  numbers, late joiners, DO storage; `docs/network/network.md` "The ball"), soccer villagers chase and shoot, pitch cleared;
  soccer and dance open to start alone (bug 37); dance floor; campfire, haul, repair, mine, feed (animal yard), swim with
  the pack strips. Proof: `docs/testing/proof/game/activities.md` P2 (Pip's unforced kickabout and goal on live, two live
  tabs on the same kicks; headless watch: every new activity starts unforced).
  Changed from the plan: one goal, not two; mining sells nothing (stone would unbalance the price board's pairs); no
  string lights or notes (only old non-pack lights art); the player's hammering to upgrade the house waits for P4 (bug 46).
  **P2 done** (2026-11-04 00:32 VN): 19-min live watch, every activity but soccer and farm started unforced (soccer seen
  unforced earlier on live); haul's carry strip on screen; swim was drawn on the pond's edge, fixed (`waterReach`).
- **P3 done** (live `main-26ntqsHn`, worker 82897677, commits 289c996, d5ad3ed): `scripts/join-check.mjs` loop, 3 runs on
  live, clean at the end (20 at once, plots, refresh races, late joiners, kick burst, host leaves, 100 held, 101st sent to
  the next room, clean close). Bugs 49-52 found and fixed. Real tabs: Guest yard and spill-room toasts, background host
  hand-over, duel with a join, three dancing, phone-size window, Fast/Slow 3G. Proof `docs/testing/proof/network/join-live.md`.
  Changed from the plan: bots use their own `check` room (they would host villagers in the real one); overflow rooms are
  `main-2`..`main-9`. Not run live: joining while someone is indoors (same rule as fighting). Gap found: no touch controls.
  **Next: P4** (map polish + bug 46), then user play-test #1. Run `node scripts/join-check.mjs` after every deploy.
- **P4 mostly done** (live worker 14537484, commits 160c5b6, cbbf566, 821289a): bug 46 (the same small house on every plot,
  Codex art in pack style, roofs recoloured into the pack's 5 colours by slot, a small room inside with the crate); every
  plot has a 2x3 tilled field and a gated front fence of pack rail tiles; the west coast moved out a tile; touch controls
  (`pixel/touch.ts`). Proof `docs/testing/proof/visual/house-46-live.png`, `house-46-inside-live.png`; join-check clean.
  BuiltDemo sheet: `.scratch/p4/demo-all.png`. Changed from the plan: houses stand on free plots too (the streets were empty
  grass); furniture placing inside is gone (the house comes furnished). Not done: tree clumps toward the coast, stumps,
  berry bushes, the plaza's bare dirt (pack `statue.png` exported, not loaded).
  **User play-test #1 done** (2026-11-04): bugs 53-60 in `docs/BUGS.md` (campfire pose and flames, house interior art, pet
  marks, shout keys, battle layout and one pixel size). **Next: fix 53-60**, then P5. The user plays once more, last.
- **Play-test #1 bugs 53-60 fixed** (live worker c25d5953, build `main-Aj3mXOIh`, commits dcfbe7c, 413b5a2, 2026-11-04
  ~10:50 VN): campfire pose and flame, the house room (Codex), pet marks (Codex, 90 files), the battle screen redone (one
  pixel size via a half-size scene canvas, Codex backdrop/ground/pads, panels in a top bar, shout box). Proof
  `docs/testing/proof/pet/playtest1-fixes-live.md`. **Next: P5.**
- **P5 a-c done** (live worker 051d8ab7, build `main-BOsI1_9N`, commits c7a8ba4, cfa6a77 + docs, 2026-11-04 ~12:20 VN):
  join check fixed (the script picked closed sockets as talkers; 20/20); Village Gazette on the town board and as a
  toast (Muse Spark 1.3, Meta Model API, cached per room and game day, rules fallback); a watching villager's line per
  fight (Muse Spark Open, prefetched, remembered); the inspector names the service of each mind's last line. Design
  `docs/ai/npc.md` "Village Gazette"; proof `docs/testing/proof/game/p5-live.md`. **Next: P5d** (campfire stories /
  NPC-to-NPC talk from the cloud with memories), then P5e postcards if time, then P6 at 18:00 VN.
- **P5d done** (live worker d82cfc08, build `main-C2rhNIcQ`, 2026-11-04 ~11:40 VN by the local clock): villagers talk
  to each other and tell evening campfire stories from the cloud with their memories (`/api/banter`, Muse Spark Open,
  one call per talk, only while a player is within 14 tiles, 1 per 40 s per machine, $1/day); rules story and the old
  local/scripted path as fallback. Design `docs/ai/npc.md` "Villagers talk to each other"; proof `p5-live.md` d.
  **Next: P5e** postcards if time (verify Muse Image first), then P6 at 18:00 VN.
- **P5e done** (live worker ebecde8f, build `main-p-yOsRi0`, 2026-11-04 ~12:50 VN): Postcards. Muse Image 1.0 on the
  Meta Model API ($0.01 an image, checked on dev.meta.ai first) paints a keepsake of your pet and who was there after a
  win, a new friend or a campfire story, from real state (genes, watcher, storyteller); album on C / the Album chip.
  $2/day cap. Proof `p5-live.md` e. **P5 complete. Next: P6 freeze at 18:00 VN** (ask about Access first).

## Context
The user woke on Nov 3 and set the demo target (`docs/plan/final-input.md`): harder, richer pet combat with adapted
teaching and NPC rivals; more human activities (every one the pack supports), a ball that rolls when touched, a dance
floor; a many-players test; map polish from `VisualAssetPack/BuiltDemo/`; local model for dynamic decisions and cloud
APIs for liveliness; a surprise aimed at the prizes; then submission prep. About 41 hours remain, including the user's
sleep, two play-tests and the recording. This plan orders the work, names the cut lines and keeps every phase shippable.

**User decisions in this session (2026-11-03):**
- `LOCAL_ONLY` goes **off now**, so the user can test the real build. Credits are fine. `/api/chatlog` removal stays last.
- Bug 34: a bubble that would cover the Goals panel moves below it.
- Bug 36: Brain panel keeps model names, plain words first: "Thinks on this computer (Llama 3.2 1B, tuned)".

**Claude's design calls:**
- Combat keeps the 5 moves and the memo DSL unchanged, so the tuned 1B (Instinct and coach) needs no retrain and Prove
  stays valid. Depth comes from rules the DSL already expresses (`last`, `intent`, `turn`, HP) plus a far richer screen.
- Cloud liveliness goes behind a new `CLOUD_LIVELY` flag beside `CLOUD_CHAT` (`client/src/game/test-mode.ts`). Off = the
  game runs free, as after the event. Every call goes through the worker ledger; caps unchanged (`MAX_DAILY_USD` 30).
- Sessions: CLAUDE.md wins over parallel-session cards. Normal mode runs phases in order; when the user says "sleep",
  Director mode (`docs/ops/director.md`) runs the queue one worker at a time.

## Timeline (VN) and cut lines
| Phase | Window | Gate |
|---|---|---|
| P0 Setup, LOCAL_ONLY off, 34, 36 | Nov 3 16:30-17:30 | Deployed; spend watched for 30 min |
| P1 Combat | Nov 3 17:30-24:00 | Sim tests, Prove numbers, live fight shots |
| P2 Activities, ball, dance floor | Nov 4 00:00-06:00 (Director if user sleeps) | Each activity seen unforced on live |
| P3 Many players join live | Nov 4 06:00-09:00 | Join checks clear on live: bots + 3-4 real tabs |
| P4 Map polish + bug 46 | Nov 4 08:00-13:00 | User play-test #1 |
| P5 Liveliness + surprise | Nov 4 13:00-17:00 | Spend under caps; off-flag still plays |
| P6 Freeze, play-test #2 | Nov 4 18:00-22:00 | Every `checks/*.md` clear, 2+ players |
| P7 Submission prep | Nov 4 20:00-23:00 | Demo script, README, numbers |
| User records | Nov 4 23:00-Nov 5 03:00 | |
| P8 Last step | Nov 5 06:00-08:00 | Chatlog gone, public, submitted by 08:00 |

**Cut order if late:** postcards (P5) -> swim and animals (P2) -> gazette (P5) -> village challenges by NPCs (P1, keep
player-started) -> battle polish extras. **Never cut:** LOCAL_ONLY off, core combat and NPC rivals, ball, dance floor,
bug 46, many players joining live without issue, demo prep.

## P0 Setup (this session, first)
1. Copy this plan to `docs/plan/final-plan.md`; add it to `docs/README.md`; record the three user decisions in
   `HANDOFF.md`, `docs/BUGS.md` (34, 36 now "fix"), and the CLAUDE.md `LOCAL_ONLY` rule (now off; chatlog removal last).
2. `client/src/game/test-mode.ts`: `LOCAL_ONLY = false`. Check what turns on (cloud minds via `cloudMind`, scripted
   fallbacks, Teach coach tiers in `game/coach.ts`) and that "[local model gave no line]" is gone.
3. Bug 34: clamp a bubble's box below the Goals panel rect where they overlap (bubble placement in `pixel/pixel-view.ts`,
   `underBubbles`). Bug 36: Brain panel wording, plain words first, model name after.
4. Tests, tsc, secrets scan, commit, deploy (standing approval). Watch the ledger for 30 min of live play; note spend.

## P1 Combat (top priority)
**Rules** (`client/src/sim/battle.ts`, `enemies.ts`; pure, seeded, unit tested in `sim.test.ts`):
- Counter: attack right after a guard that blocked a hit deals x1.5 ("Counter!"). Teachable with `last: guard`.
- Focus: guard or emote adds 1 focus (max 3). Attack at 3 focus is the pet's signature move (x2), named from genes
  (`game/genes.ts`). Crits from the seeded roll.
- Enemy patterns per archetype: brute charges (calm, then heavy), turtle turtles, skitter flees when hurt, bully feints
  (telegraphs heavy, strikes after you guard), pal befriends. All visible through existing intents, so a memo can beat them.
- Trainer shouts: 2 per wild or NPC fight, keys 1-5 override the pet's next move; the memo runs the rest. Live player
  duels stay precomputed from both memos (`sim/duel.ts`), no shouts.
- Balance gate: an empty memo loses to most foes; a good memo wins; Prove lift on held-out seeds stays >= +15 points.
  Re-run the eval (`client/src/eval/`, proxy `memoPolicy`) and write the new numbers to `docs/ai/pet.md`.

**Battle screen** (`client/src/pixel/battle.ts` `BattleView`, `pixel/fight-flow.ts`): pack UI bars (`redbar`/`greenbar`
for HP, `bluebar` for focus), popping damage numbers, hit flash, small shake, `glint` VFX on crits and signatures,
pack expression icons (`expression_attack`, `stress`, `love`) over pets, move names in the log, and each trainer drawn
behind their pet with the unused human strips: `attack` (shout), `hurt` (pet hit), `jump` (win), `idle`. Copy new
pack files into `client/public/art/` with the existing art pipeline (`scripts/art-sunny.py`).

**NPC rivals** (agentic, adaptive):
- Elder, Mo and Ama own a pet from day 1 (genes seeded per villager); Pip's arrives with his goal (`mind/npcs.ts`
  `hasPet`). Pets follow their owner and show in the scene.
- Challenge: "wanna duel?" becomes an offer like "Wanna dance?" (`mind/offers.ts`, `game/chat-flow.ts`); villagers can
  accept, refuse with a reason, or schedule it. Villagers also challenge the player when fun is low and the bond is fair.
- The fight reuses `runDuel` (`sim/duel.ts`) with the villager as side b and `fight-flow.duel` for the screen. Result
  feeds bonds (respect), memory facts and gossip ("Kai beat Mo's pet"), and coins (`duelCoins`).
- Rival memo: new worker route `POST /api/rival`, built on the `worker/src/wild-memos.ts` pattern: Muse Spark writes a
  counter-memo from the player's memo and last fights, validated by `worker/src/memo-dsl.ts`, cached in KV per
  (villager, memo hash), with a quota and ledger cap. Fallback: bundled persona memos (Mo patient counter-guard, Ama
  befriender, Elder balanced, Pip reckless). After a loss the screen says why ("Mo's pet guards after your guard").

**Adapted teaching:** after each fight a coach review reads the replay and memo and proposes one lesson in plain words;
"Teach this" pre-fills Teach (`pixel/teach.ts`). Cloud: Muse Spark (reuse the "Learn from my fights" path if it is still
in `game/coach.ts`). Local fallback: replay rules ("took 2 heavy hits unguarded -> guard when it winds up").

Checks: add lines to `docs/testing/checks/pet.md` (fights feel tense; a rival adapts; the coach's lesson wins Prove).

## P2 Human activities, ball, dance floor
Pack human strips: 12 loaded today; unused `carry`, `hammering`, `mining`, `swimming`, `roll`, `attack`, `hurt`,
`death` (`VisualAssetPack/.../Characters/Human/`). Unused elements: farm animals, fire, glint, coracle.

- **Ball** (new pure `client/src/life/ball.ts`): state is the last kick `{x, z, vx, vz, t0}`; position is analytic with
  friction; bounces off blocked tiles; a goal scores. Any human who touches it (player, villager, remote player) kicks it
  along their facing at their speed. Network: a `kick` message through the room (`worker/src/room.ts`, AOI near, last
  kick stored for late joiners); every client integrates the same kick, so all see one ball. Soccer villagers chase the
  real ball and aim at the far goal (`run`; `roll` for a dive at goal). Soccer may start solo as a kickabout that draws
  others (fixes Pip waiting alone). Replace the scripted ball path in `pixel/pixel-view.ts`.
- **Dance floor + bug 37**: a `dancefloor` place in `world/village-map.ts` (dance uses it, not `lawn`), pack tiles,
  evening string lights and notes. Dance can start solo and others join the open gathering (`life/village.ts`
  gatherings); evening party hour raises its score; a player dancing (key or the Dance emote) pulls nearby villagers.
  A dance routine cycles `jump`, `roll` and `doing`.
- **New activities** (each: `ActivityDef` in `life/activities.ts`, a place in the map, its strip loaded for all 7
  looks, a unit test, seen unforced in a 12-min live watch): haul (`carry`, wood or crops to the stall), repair
  (`hammering`, stall, fences, dance stage; the player hammers to upgrade the house), mine (`mining`, quarry rocks,
  stone sells at the stall via `mind/economy.ts`), campfire (fire VFX, `idle`/`waiting`, evening gathering), swim
  (`swimming`, a marked swim zone only), feed animals (`doing`, pack chickens/ducks/cow/sheep/pig in a small pen).
  The local 1B's choose and plan prompts take dynamic, grammar-constrained options (`mind/brain.ts`), so new ids need
  no retrain. Fix the pet `eat` target that still points at the removed bowl (`overworld.ts` `this.bowl`).
- Update `docs/testing/proof/game/activities.md` and `checks/game.md`.

## P3 Many players join live without issue (user, 2026-11-03: "make sure (test, update, repeat) so on live, many players can join without issues")
**How:** a loop on the deployed build, not a one-off test. (1) Run every check below on live. (2) Log each failure in
`docs/BUGS.md` (Network) with its proof. (3) Fix, test, deploy. (4) Run the whole check again. Repeat until one full run
is clean. First build one command, `scripts/join-check.mjs` (bots burst + full room + late join + plot reclaim, numbers
out, hard limits, clean close), so every loop is cheap; the real-tab and machine checks stay manual in the TEMP Chrome.
The loop runs again after every later deploy (P4, P5, P6 freeze, P8 public): a feature that breaks joining is fixed first.
Today: one room Durable Object (`/api/room`, `worker/src/room.ts`), `ROOM_MAX_PEERS` 100, 12 plots (`CORNERS`), then
guests; a 101st player gets `{t:"full"}` and plays alone (`world/live.ts` status `full`). 89 of 100 bots held last time.
- **Join is quick and plain:** open the link, be in the village and "online" within about 10 s, no setup, whatever the
  join order. Measure time to first frame and to online; a stuck "connecting" retries and says so.
- **Bursts:** 20 bots joining in the same second, then up to 100 (`scripts/net-bots.mjs`, hard limit, clean close):
  no lost peer, no duplicate, no stuck socket; bytes per peer and tick time reported. Find and fix the 89-of-100 gap.
- **Full room:** the 101st player joins a second room (an overflow room name on `/api/room`, the client moves on `full`)
  instead of playing alone. Unit tests in worker and `live.test.ts`.
- **Plots:** players 1-12 get a plot, 13+ join the Guest yard and are told so in one line; a refresh or a dropped
  connection gets the same plot back (the away hold in `room.ts`).
- **Late joiners see now:** ball (last kick), a dance or soccer in progress, villagers in the same places, farms, a duel
  shown as busy.
- **Joining mid-event:** someone joins while another player fights, dances, is inside a house, or hosts the villagers;
  nobody glitches. The villagers' host leaves mid-conversation: the chat carries on with the new host.
- **Different machines:** no GPU (cloud minds: only elected hosts call `/api/llm`, so spend grows per room, not per
  player; check `/api/spend`), a phone-size window, a throttled network in the test Chrome, a second browser.
- **Real people:** 3-4 real tabs in the TEMP Chrome profile (home network allowed): a duel, the ball in sync, a host
  hand-over when a tab closes, three people dancing.
- Proof: `docs/testing/proof/network/join-live.md`, one dated block per loop run (what failed, what was fixed).
  Gate: one clean run of every join line in `docs/testing/checks/network.md` on live.

## P4 Map polish + bug 46, then user play-test #1
- One contact sheet of `VisualAssetPack/BuiltDemo/` in `.scratch/`; list what the demo village has that ours lacks
  (decor density, flowers, fences, path borders, props) and apply it within `docs/visual/visual.md` and `layers.md`.
- Bug 46: one small house for every plot (roof-colour variants), each with a small interior. Codex brief for the small
  house interior in pack style (`docs/visual/style.md`, top-down, front only). Change `HOME_ART` (`game/house.ts`),
  `interior.ts`, `HOME_BLOCKS`, `HOME_DOOR_DX`; keep `exitHouse`'s nearest open spot.
- Lay out P2's places cleanly: dance floor, pitch and goals, quarry, campfire, pen, swim zone.
- Deploy, then the user play-tests. After it: read the chat log unasked, add failures to `checks/npc.md`, bugs to `BUGS.md`.

## P5 Liveliness and the surprise (cloud, behind `CLOUD_LIVELY`)
Spread across the services, each with a cap and a free fallback:
- Baseten Muse Spark Open: villager chat (live), rival memos. Modal Spark Open: failover for all of them.
- Meta Model API Muse Spark 1.3: coach review; **Village Gazette** on the board: once per game day the host's client
  sends the day's real events (promises kept or broken, duels, goals, prices) and gets three headlines, shown on the
  board and as a toast.
- Evening campfire stories and NPC-to-NPC talk from the cloud with memories; local 1B fallback.
- A watching villager comments once per fight (prefetched).
- **Surprise, for Best Creative Build ($5k):** Postcards. After a win or a party, Muse Image paints a keepsake postcard
  of your pet and friends from real state (genes to a description), kept in an album. First verify the Muse Image API and
  price on dev.meta.ai docs; hard cap $2/day; skip if unavailable.
- Brain panel names which service answered each line (bug 36 wording).

## P6 Freeze (Nov 4 18:00 VN)
Bug fixes only. `scope-check` every scope on live. User play-test #2 with 2+ players: the whole-game check.

## P7 Submission prep
- Rewrite `docs/ops/demo.md` for this build. Opening line names what pre-existed: the Sunnyside World art pack
  (`VisualAssetPack/License.txt` allows use), open-source libraries, Meta's models. Beats: birthday promise (star), a
  rival who adapts, the lively village (ball, dance, gazette), Teach and Prove, many players and host hand-over. List
  every Meta model use.
- README for a stranger: play link, what to do, how the models are used, "Built with Llama" (Llama licence).
- Re-check numbers (bench, new Prove lift, spend). Compliance: secrets scan of all history, first commit is Oct 26
  23:14 VN = 12:14 ET after kickoff (confirm acceptable), no copied code. X post draft for after submission (user posts).

## P8 Last (Nov 5 morning VN, done by 08:00)
Remove `/api/chatlog`, its client call and KV rows; deploy. User makes GitHub and the 4 HF repos public and removes
Access. **Join check on the public URL** right after Access goes: a phone on mobile data and a second machine join at
the same time, plus a 30-bot burst for 2 minutes; watch errors and `/api/spend`. User submits.
Open question for the user: removing Access at the freeze (Nov 4 ~18:00 VN, already Nov 4 ET = submission day) would
give this check, and the recording, time to fix what only outside players hit.

## Verification (every phase)
- `npm --prefix client test`, `npm --prefix worker test`, tsc, secrets scan, local commit, deploy (two plain commands,
  from `worker/`), then `scope-check` on live with proof in `docs/testing/proof/<scope>/`.
- Combat: seeded sim tests, eval numbers, live shots of counter, signature, shout, rival loss explanation.
- Ball: unit test that two clients fed the same kicks agree on the position; live two-tab check.
- Activities: 12-min live watch, each seen unforced.
- Spend: ledger after each deploy; caps unchanged. Mock the LLM in all tests.
- HANDOFF at each milestone; `get_usage` at milestones; hand off near 35% context.
