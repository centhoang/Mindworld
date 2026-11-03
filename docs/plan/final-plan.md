# Final plan: Mindworld, Nov 3 16:00 VN to submission (Nov 5, 09:00 VN)

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
| P3 Many players | Nov 4 06:00-08:00 | Bot numbers + 3-4 real tabs |
| P4 Map polish + bug 46 | Nov 4 08:00-13:00 | User play-test #1 |
| P5 Liveliness + surprise | Nov 4 13:00-17:00 | Spend under caps; off-flag still plays |
| P6 Freeze, play-test #2 | Nov 4 18:00-22:00 | Every `checks/*.md` clear, 2+ players |
| P7 Submission prep | Nov 4 20:00-23:00 | Demo script, README, numbers |
| User records | Nov 4 23:00-Nov 5 03:00 | |
| P8 Last step | Nov 5 06:00-08:00 | Chatlog gone, public, submitted by 08:00 |

**Cut order if late:** postcards (P5) -> swim and animals (P2) -> gazette (P5) -> village challenges by NPCs (P1, keep
player-started) -> battle polish extras. **Never cut:** LOCAL_ONLY off, core combat and NPC rivals, ball, dance floor,
bug 46, many-players test, demo prep.

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

## P3 Many players
- `scripts/net-bots.mjs`: 100 bots walking, kicking the ball and emoting; report bytes per peer and tick time; find why
  only 89 held last time and fix it (`ROOM_MAX_PEERS`, socket cleanup, DO limits).
- 3-4 real tabs in the TEMP Chrome profile (home network allowed): a duel, the ball in sync across tabs, a host
  hand-over when a tab closes, three people dancing. Proof in `docs/testing/proof/network/` and `game/`.

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
Access. Stranger test from a phone off the home network. User submits.

## Verification (every phase)
- `npm --prefix client test`, `npm --prefix worker test`, tsc, secrets scan, local commit, deploy (two plain commands,
  from `worker/`), then `scope-check` on live with proof in `docs/testing/proof/<scope>/`.
- Combat: seeded sim tests, eval numbers, live shots of counter, signature, shout, rival loss explanation.
- Ball: unit test that two clients fed the same kicks agree on the position; live two-tab check.
- Activities: 12-min live watch, each seen unforced.
- Spend: ledger after each deploy; caps unchanged. Mock the LLM in all tests.
- HANDOFF at each milestone; `get_usage` at milestones; hand off near 35% context.
