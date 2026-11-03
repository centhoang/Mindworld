# HANDOFF: Mindworld final plan (2026-11-03, ~17:30 VN)

**Starting prompt:** "Read HANDOFF.md, then continue docs/plan/final-plan.md from its Status section (P1: NPC rivals next). Follow CLAUDE.md."

## Where things stand
- **The plan:** `docs/plan/final-plan.md` (approved by the user 2026-11-03 16:20 VN). Phases P0-P8, VN timeline, cut lines,
  and a Status section at the top. Keep that Status current every session.
- Live `main-DyR8JZim` (worker version cccb5a4f). Local commits on `rework/fresh-look` up to 8a276f0 plus this hand-off, not pushed.
- Tests: client 620, worker 209 (unchanged), tsc clean.
- Spend 2026-11-03: $0.28 of the $30 day cap (cloud minds since LOCAL_ONLY went off: about +$0.07 in 25 min with one hidden tab).
  Credits: Meta ~$149.9, Modal ~$100, Baseten total spent $0.74 of its $50 cap.

## Done this session
- P0: `LOCAL_ONLY = false` (user: "can go off now so I can test"). Minds without a local model use `CloudMind` (Muse Spark on
  Baseten, one call a second at most, `pixel/main.ts`), then rules. New flag `CLOUD_LIVELY` in `game/test-mode.ts` for P5 extras.
- Bug 34 (user: bubble moves aside): `layoutBubbles(..., keepOut)` in `view/bubbles.ts`; `drawGoals` returns the card's box.
- Bug 36 (user: keep model names, friendlier): Brain lines in `switchBrain` say plain words first, then "(Llama 3.2 1B, tuned)".
- P1 rules (`sim/battle.ts`, `sim/types.ts` `TurnFx`): block, counter x1.5, charge to `CHARGE_MAX` 2 then signature x2,
  crits 8% both sides, foe counter. Brute HP 48. Bench and numbers in `docs/ai/pet.md`. The 5 moves and memo DSL are unchanged.
- P1 screen (`pixel/battle.ts`, `fight-flow.ts`, `sim/duel.ts`): shouts on keys 1-5 (2 per wild fight), damage pops,
  charge pips, signature names from genes, counter/crit/block lines; a fainted foe no longer strikes back on screen.
  Live proof: `docs/testing/proof/pet/combat-live.md`.

## Next actions
1. P1 rest, in order (detail in the plan's Status and P1 section): NPC rivals -> coach review -> trainer sprites -> pack bars.
   Reuse: `runDuel`/`duelView` (`sim/duel.ts`), `fight-flow.duel`, offers like "Wanna dance?" (`mind/offers.ts`,
   `game/chat-flow.ts`), `mind/npcs.ts` `hasPet`, `worker/src/wild-memos.ts` + `memo-dsl.ts` for `/api/rival`,
   the scripted coach rules in `sim/cortex.ts` (~line 288) as the local review fallback.
   Do not edit the coach prompt text in `sim/cortex.ts` (frozen for the tuned 1B); add cloud-only lines elsewhere.
2. Then P2-P8 per the plan. If the user says "sleep", switch to Director mode (`docs/ops/director.md`) with the plan as the queue.
3. After any user play-test: read the chat log unasked, add failures to `docs/testing/checks/npc.md`, bugs to `docs/BUGS.md`.

## Open
- 46: same small house for every player, with an interior (P4).
- 37: dance never chosen unforced (P2, dance floor).
- 34, 36 and 45, 47, 48 fixed, waiting for the user's review on live.
- Not done by a person: a 2-person play, the stranger test. 100 bots not proven (89 held) (P3).

## Decisions (standing)
- NPCs are the star: a player cannot tell them from a human. The sim reasons; the model picks among valid options and speaks.
- The game must still work free after the event. Local prompts are frozen at af455c4: a text change needs a retrain. Cloud `VILLAGER_STYLE` is not frozen.
- `LOCAL_ONLY` is off since 2026-11-03 (user). Cloud extras go behind `CLOUD_LIVELY`; off must leave the game playable.
- Combat keeps the 5 moves and the memo DSL, so no retrain (Claude's call, in the plan).
- Submission day (user): make GitHub and the 4 HF repos public, remove Access. Remove `/api/chatlog`, its client call and the KV rows (P8, last).
- Pack rules (user): a human activity with no matching pack animation is dropped. Everything is top-down, front side only, never iso (`docs/visual/visual.md`).
- Deadline: Nov 4, 9 PM ET = Nov 5, 9 AM Vietnam.

## Gotchas
- **A hidden Browser pane stalls requestAnimationFrame**: the game looks frozen and keys do nothing. Check `tabs_context` ("pane is hidden").
  Drive by hand: `__px.world.update(0.05, new Set(["arrowdown"]))`. A fight: `__px.fight(__px.world.wilds[0])`, then loop
  `__px.battleView.update(0.05)`, `battleView.cmdKey("enter")` picks Fight, `battleView.shoutKey("2")` shouts; hook `battleView.onLine` to read the lines.
- `__px.blocked()` shows what holds the keys (mode, door, menus, teach, chat).
- A deploy can take minutes to show on the site while wrangler says it is active. Check the `main-` file in `/`; do not redeploy for that.
- Deploy: `npm --prefix client run build`, then `npx wrangler deploy` inside `worker/`, check it says `pet-mind`. If `wrangler.jsonc` appears at the root, delete it.
- `/api/spend` shows the day's spend and caps.
- pets.uryto.dev answers 200 from this home network only. Local dev: `.claude/launch.json` `client-dev` (no worker: /api 502s, fine for movement).
- The dev GPU gate asks on first load in a clean profile: pick "This computer only has this graphics chip".
- Tool how-to (test Chrome, tab driving, chat log): `docs/ops/tooling.md`. Combat bench: `client/node_modules/.bin/tsx .scratch/combat/bench.ts` (gitignored; recreate from `docs/ai/pet.md` if gone).
- `cd` inside a Bash call moves the session's working folder: use absolute paths.
- The untracked `info-ref/` folder is the user's; never commit or touch it.
- Code: client/src/{sim,life,mind,world,game,pixel,finetune}/ · worker/src/{room,room-do,npc,app}.ts. Seams: `game/ports.ts`, Overworld.buildScene, `pixel/pixel-view.ts`.
