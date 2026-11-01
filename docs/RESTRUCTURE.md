# Restructure plan

**Branch:** `rework/fresh-look`. **Submission:** Nov 4, 9 PM ET. About 2 days left, so the order below ships a working game at every step. `main` stays the fallback.

## Decisions needed first (user)
1. **Look:** glyph spike, or stay on Sunnyside? (`visual/visual.md`) Recommended: half-day spike.
2. **Chat:** tiers with cloud during the event, or local only? (`ai/npc.md`) Recommended: tiers, after the 3B bench.
3. **World:** one compact village? And which cut candidates go? (`game/design.md`)

## Work order
| # | Task | Done when |
|---|---|---|
| 0 | Tuned 3B vs 1B bench on the NPC cases, native | Numbers and transcripts in `ai/npc.md` |
| 1 | **Seams:** split game state from `pixel/main.ts` and `overworld.ts`. Interfaces: `View`, `Transport`, `MindBackend` | Game plays the same, tests pass |
| 2 | **Labs:** `/lab/npc`, `/lab/visual`, `/lab/net`, `/lab/pet`, each with a fake for the rest | Each opens alone behind Access |
| 3 | **NPC scope:** chosen chat tier, shorter replies, typing feel | `checks/npc.md` clear |
| 4 | **Network scope:** `aoi.ts`, near routing, tick batching, snapshots, bots | `checks/network.md` clear |
| 5 | **Visual scope:** spike, decide, build only the must-draw list, compact world | `checks/visual.md` clear |
| 6 | **Wire and cut:** full game, remove cut systems, chat log, dead code | `checks/game.md` clear |
| 7 | **Submission:** demo script update, README, repos public (user) | `ops/demo.md`, `ops/event.md` |

Steps 3, 4 and 5 run in parallel sessions after 1 and 2, since they touch separate folders.

## If time runs out
Skip the look change: ship Sunnyside, compact. Keep AOI grid and batching. Keep labs that exist. Chat quality comes before all else: NPCs are the star, and Demo plus Impact are 55% of the score.

**Risk:** step 1 touches the two largest files just before a deadline. Keep it mechanical: move code, change no behaviour, commit in small steps.

## Workflow from now on
- One session, one scope. Start with `HANDOFF.md`.
- Project skills: `scope-publish` puts one scope live; `scope-check` runs its list with proof.
- See progress at a glance: `docs/testing/checks/`.
- Bugs go to `docs/BUGS.md` under their scope.
