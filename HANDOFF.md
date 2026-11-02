# HANDOFF: Mindworld rework (2026-11-02)

**Starting prompt:** "Read HANDOFF.md. Continue from Next actions. Follow CLAUDE.md."

## State
- Branch `rework/fresh-look`, not pushed. `main` = the last pixel build, live at https://pets.uryto.dev/ (Worker 7f8d45b9).
- Tests: client 633, worker 192, tsc clean. `LOCAL_ONLY` is on. Credits: Meta ~$149.9, Modal ~$100.
- Docs reorganised: index `docs/README.md`, plan `docs/RESTRUCTURE.md`. No game code changed for the rework yet.
- The user has not reviewed the bug 13-23 fixes. Not proven with 2 players. The glyph spike may replace them.
- Tuned 3B trained, on the Modal volume with a GGUF: `llama32-3b-n4-e2-r16`. Not benched, not converted.

## Decisions
- NPCs are the star: a player cannot tell them from a human. The sim reasons; the model picks among valid options and speaks.
- The game must still work free after the event. Prompts are frozen at af455c4: a text change needs a retrain.
- The user reviews scope by scope in labs, not by playing the whole game (`docs/testing/testing.md`).
- Submission day (user): make GitHub and the 4 HF repos public, remove Access. Remove `/api/chatlog`, its client call and the KV rows.

## Decisions from the user (2026-11-02)
- Look: glyph spike first. Chat: tiers, with cloud free talk during the event. World: one compact village that shows NPC and pet minds.
- Deadline in Vietnam: Nov 5, 9 AM. Cut list and all steps: `docs/RESTRUCTURE.md`.

## Next actions
1. Execute `docs/RESTRUCTURE.md` from step 0, in order. Stop at the glyph spike gate for the user's judgement.
2. Nov 2: steps 0-3. Nov 3: 4, 5a, 5b. Nov 4: 5c, 5d, 6. Nov 5 morning: 7 only.
3. Step 0 includes changing the `LOCAL_ONLY` rule in CLAUDE.md to allow cloud free talk.

## Gotchas
- Chat log: from `worker/`, `npx wrangler kv key list --binding GHOSTS --remote --prefix chat:`, then `kv key get`.
- Chat test: rig up, then `node scripts/npc-chat-run.mjs`. Any client edit reloads the tab and kills a run.
- Deploy only from `worker/`. If `wrangler.jsonc` appears at the root, delete it.
- Test Chrome: `bash .scratch/mlc/chrome.sh "<url>"` (port 9333, GTX 1050). Weights: `node .scratch/mlc/serve.mjs`. Run dev server first.
- Game with the model: `http://localhost:5173/?gpu=capable&tuned=http://127.0.0.1:8099/n4/{q}/`.
- Drive a tab: `node scripts/cdp-tab.mjs "<url regex>" "<js or file>"`; shot: `scripts/cdp-shot.mjs`. `?p=2` = a second player.
- On Windows set `PYTHONUTF8=1` before `modal`, or its printing crashes. Browser speed test: `.scratch/lay/b3.js`, on `/mlc-bench.html`.

## File map
docs/{README,RESTRUCTURE,BUGS}.md, docs/{game,ai,visual,network,testing,ops,archive}/
client/src/{sim,life,mind,world,game,pixel,finetune}/ · worker/src/{room,room-do,npc,app}.ts
