# Game implementation (no visuals)

Stack: TypeScript, plain canvas client, one Cloudflare Worker that serves the client and API, one room Durable Object per world. No game engine.

## Client modules (`client/src/`)
| Folder | Holds |
|---|---|
| `sim/` | Battle, duels, boss, memo DSL, paired-seed proof. Pure and deterministic |
| `life/` | Clock, needs, activities, relations, the village sim |
| `mind/` | Villager and pet minds: brain, scheduler, memory, promises, bonds, jobs, economy, goals, offers |
| `world/` | Ground shapes, world layout, walking, routes, live room client |
| `game/` | Save, farm, shop, party, house rooms, chat, voices (model backends), onboarding |
| `finetune/`, `eval/` | Training data and benches. Never shipped to play |
| `pixel/` | Everything drawn, plus `main.ts`. See the split below |

## Worker (`worker/src/`)
`app.ts` routes, `room.ts` room logic, `room-do.ts` its Durable Object, `npc.ts` host election, `chat.ts` and `providers.ts` paid calls, `ledger.ts` and `spend-do.ts` the spend cap, `ghosts.ts` saved fighters, `mlc.ts` weights proxy, `geo.ts` the geo block.

## Core rules
- `client/src/sim/` and `life/` take no DOM, canvas or network.
- The model only picks from valid choices. Each call has a fallback, and bad output is rejected.
- One model per machine, one priority queue: player talking, then promises, plans, idle.
- `LOCAL_ONLY` in `game/test-mode.ts`: no cloud, no scripted lines until near submission.
- Each paid call goes through the ledger with a daily cap.
- The save is local storage, parsed field by field. Same seed gives the same world on every client.

## Known problems for the rework
- `pixel/main.ts` (1,056 lines) and `pixel/overworld.ts` (1,440) mix game logic with drawing. A lab cannot start one scope alone until they split.
- `pixel/tiles.ts` holds the map's logic, not just tiles.

## Target split
`game core` (state, rules, no drawing) <- `view` (draws state) and `net` (syncs state) and `mind` (decides). Each sits behind a small interface, so a lab swaps the others for fakes. Details: `../RESTRUCTURE.md`.

## Commands
`npm --prefix client test` · `npm --prefix worker test` · `npm --prefix client run dev` · deploy: `../ops/deploy.md`.
