# HANDOFF: Mindworld rework (2026-11-02)

**Starting prompt:** "Read HANDOFF.md. Continue from Next actions. Follow CLAUDE.md."

## State
- Branch `rework/fresh-look`, not pushed, live at https://pets.uryto.dev/ (see `wrangler deployments`). Fallback: `main`, the last pixel build.
- Tests: client 652, worker 207, tsc clean. `LOCAL_ONLY` is on. Credits: Meta ~$149.9, Modal ~$100.
- Docs index `docs/README.md`, plan `docs/RESTRUCTURE.md`. Seams: `game/ports.ts`, Overworld.buildScene, `pixel/pixel-view.ts`, chat, room and fight flows.
- The user has not reviewed the bug 13-23 fixes. Not proven with 2 players. The glyph spike may replace them.
- Steps 0-4, 5a, 5b done, deployed. Labs live: `/lab/npc`, `/lab/pet`, `/lab/net`, `/lab/visual`. Tuned 3B stays out (`docs/ai/npc.md`).
- 5a: cloud free talk works (`proof/npc/`). Open: bug 24 (Ama's goods), rude and gossip checks not run. 5b: AOI live (`proof/network/`), 89 bots held; 100 not proven.
- Glyph spike approved by the user: `client/glyph-spike.html`, proof in `docs/testing/proof/visual/`.

## Decisions
- NPCs are the star: a player cannot tell them from a human. The sim reasons; the model picks among valid options and speaks.
- The game must still work free after the event. Prompts are frozen at af455c4: a text change needs a retrain.
- The user reviews scope by scope in labs, not by playing the whole game (`docs/testing/testing.md`).
- Submission day (user): make GitHub and the 4 HF repos public, remove Access. Remove `/api/chatlog`, its client call and the KV rows.

## Decisions from the user (2026-11-02)
- Look: glyph spike first. Chat: tiers, with cloud free talk during the event. World: one compact village that shows NPC and pet minds.
- Deadline in Vietnam: Nov 5, 9 AM. Cut list and all steps: `docs/RESTRUCTURE.md`.

## Next actions
1. Execute `docs/RESTRUCTURE.md` from step 5c (read its "As built" notes first), in order.
2. A day ahead of plan: Nov 3: 5c, 5d, bug 24. Nov 4: 6. Nov 5 morning: 7 only. Step 7 must turn `LOCAL_ONLY` off.

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
