# HANDOFF: Mindworld v3 (2026-11-01)

**Starting prompt:** "Read HANDOFF.md. Continue from Next actions. Follow CLAUDE.md."

## State
- Live behind Access: https://pets.uryto.dev/. Tests: client 633, worker 192, tsc clean.
- Bugs 13-23 fixed and waiting for the user's review (`docs/BUGS.md`); draw order rule: `docs/LAYERS.md`.
- Chat offers work on the real model; free talk on the 1B is weak (bug 11). `LOCAL_ONLY` is on. Credits: Meta ~$149.9, Modal ~$102.
- Full history and old gotchas: `docs/HISTORY.md` (grep it).

## Decisions
- NPCs are the star: a player cannot tell them from a human. The sim reasons; the model picks among valid options and speaks.
- The game must run on a local model, so it stays free after the event. Prompts are frozen at af455c4: a text change needs a retrain.
- Questions with one true answer come from the sim (mind/directions.ts and neighbours). Offers: mind/offers.ts.
- `cleanReply` strips bond notes read aloud and repeat invitations from model lines.
- 3B (user, 2026-11-01): convert it and check it runs in the browser on the 1050 FIRST, then train. No training spend before that.
- Submission day (user): make GitHub and the 4 HF repos public, remove Access.
- Chat log is development only: remove `/api/chatlog`, the client call and the KV rows before submission.

## Next actions
1. 3B: runs on the 1050 at 2.7 tok/s (docs/FINETUNE.md end). Run `llama32-3b-n4-e2-r16` started on Modal: check it, convert, bench reply quality.
2. Prove with 2 players, run the chat tests and check EXPECTATIONS before asking for a play-test.
3. After any play-test, read the chat log (below), add failures to BUGS and NPC-CHAT-TESTS.

## Gotchas
- Read the chat log from `worker/`: `npx wrangler kv key list --binding GHOSTS --remote --prefix chat:`, then `kv key get`. Write-only over HTTP on purpose.
- Chat test: rig up, then `node scripts/npc-chat-run.mjs`; results in `.scratch/chat-runs/`. Any client edit reloads the tab and kills a run.
- Deploy only from `worker/`. If `wrangler.jsonc` appears at the root, delete it.
- Test Chrome: `bash .scratch/mlc/chrome.sh "<url>"` (port 9333, GTX 1050, signed in to Access). Weights: `node .scratch/mlc/serve.mjs`.
- Game with the model: `http://localhost:5173/?gpu=capable&tuned=http://127.0.0.1:8099/n4/{q}/`.
- Drive a tab: `node scripts/cdp-tab.mjs "<url regex>" "<js or file>"`; shot: `scripts/cdp-shot.mjs`. `?p=2` = a second player.
- `__px.world.alwaysDay = true` for shots. Hidden pane: rAF stalls, drive `__px.update` from a timer. The room moves NPC hosting from a hidden tab to a visible one. E first closes a toast; beds take E before water.

## File map
docs/{BUGS,EXPECTATIONS,LAYERS,NPC-CHAT-TESTS,TILE-RULES,STYLE,NPC-PLAN,EVENT,DEMO,DEPLOY,DIRECTOR,HISTORY}.md
client/src/pixel/{main,overworld,interior,sunny,sunny-terrain,grounds-decor,tiles}.ts · game/house.ts
client/src/mind/{npcs,offers,brain,directions,hub}.ts · worker/src/{room,npc,app}.ts
scripts/{art-sunny.py,art-interior.py,codex.ps1,cdp-tab.mjs,cdp-shot.mjs,npc-chat-test.js,npc-chat-run.mjs}
