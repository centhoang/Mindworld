# HANDOFF: Mindworld rework (2026-11-02)

**Starting prompt:** "Read HANDOFF.md. Continue from Next actions. Follow CLAUDE.md."

## State
- Branch `rework/fresh-look`, not pushed, live at https://pets.uryto.dev/ (see `wrangler deployments`). Fallback: `main`, the last pixel build.
- Tests: client 677, worker 207, tsc clean. `LOCAL_ONLY` is on. Credits: Meta ~$149.9, Modal ~$100.
- Docs index `docs/README.md`, plan `docs/RESTRUCTURE.md`. Seams: `game/ports.ts`, Overworld.buildScene, `pixel/pixel-view.ts`, chat, room and fight flows.
- User has not reviewed bugs 13-23. Not proven with 2 players. Steps 0-5d deployed. Labs live: `/lab/npc`, `/lab/pet`, `/lab/net`, `/lab/visual`. Tuned 3B stays out (`docs/ai/npc.md`).
- 5a: cloud free talk works (`proof/npc/`). Open: rude and gossip checks not run. 5b: AOI live (`proof/network/`), 89 bots held; 100 not proven.
- 5c, 5d built: village, one plane on every screen, as built in `docs/RESTRUCTURE.md`. Seen on localhost; `scope-check` on live not run. Bug 24 fixed, unit test only.

## Decisions
- NPCs are the star: a player cannot tell them from a human. The sim reasons; the model picks among valid options and speaks.
- The game must still work free after the event. Prompts are frozen at af455c4: a text change needs a retrain.
- The user tests only once the whole plan is executed (2026-11-02). Until then, run the checks and record proof; do not stop for review.
- Submission day (user): make GitHub and the 4 HF repos public, remove Access. Remove `/api/chatlog`, its client call and the KV rows.

## Decisions from the user (2026-11-02)
- Look: mosaic plane, Tile skin (not the glyph spike). Chat: tiers, with cloud free talk during the event. World: one compact village that shows NPC and pet minds.
- Deadline in Vietnam: Nov 5, 9 AM. Cut list and all steps: `docs/RESTRUCTURE.md`.

## Next actions
1. Run `scope-check` on visual and pet on the deployed build, with proof images. A Teach lesson through the tuned model is still unproven.
2. Step 6: wire and cut. Remove boss, ghosts, furniture editing, `generateWorld` and its tests, goal "Outsmart The Reader". `checks/game.md`, 2+ players, drop `/api/chatlog`.
3. Nov 5 morning: step 7 only. It must turn `LOCAL_ONLY` off.

## Gotchas
- Chat log: from `worker/`, `npx wrangler kv key list --binding GHOSTS --remote --prefix chat:`, then `kv key get`.
- Chat test: rig up, then `node scripts/npc-chat-run.mjs`. Any client edit reloads the tab and kills a run.
- pets.uryto.dev answers 200 from this home network (approved bypass); other IPs get 403. Not a leak.
- Deploy as plain single commands: chained with others, the auto-mode check blocks it. Deploy only from `worker/`. If `wrangler.jsonc` appears at the root, delete it.
- Test Chrome: `bash .scratch/mlc/chrome.sh "<url>"` (port 9333, GTX 1050). Weights: `node .scratch/mlc/serve.mjs`. Run dev server first.
- Game with the model: `http://localhost:5173/?gpu=capable&tuned=http://127.0.0.1:8099/n4/{q}/`.
- Drive a tab: `node scripts/cdp-tab.mjs "<url regex>" "<js or file>"`; shot: `scripts/cdp-shot.mjs`. `?p=2` = a second player.

## File map
docs/{README,RESTRUCTURE,BUGS}.md, docs/{game,ai,visual,network,testing,ops,archive}/
client/src/{sim,life,mind,world,game,pixel,finetune}/ · worker/src/{room,room-do,npc,app}.ts
