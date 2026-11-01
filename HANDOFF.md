# HANDOFF: Mindworld v3 (2026-11-01)

**Starting prompt:** "Read HANDOFF.md. Continue from Next actions. Follow CLAUDE.md."

## State
- Live behind Access: https://pets.uryto.dev/ (Worker fba2a061, code at c35a017). Tests: client 628, worker 191, tsc clean.
- The user's review of that build rejected parts of the look and chat: 10 open bugs in `docs/BUGS.md`, all blockers.
- `LOCAL_ONLY` is on. Credits: Meta ~$149.9, Modal ~$102 (approx).
- Claude weekly quota was ~90% before the Nov 1 17:00 UTC reset.
- Full history and old gotchas: `docs/HISTORY.md` (grep it, written before this review).

## Decisions
- NPCs are the star: a player cannot tell them from a human. The sim reasons; the model picks among valid options and speaks.
- The game must run on a local model, so it stays free after the event. Prompts are frozen at af455c4: a text change needs a retrain.
- Questions with one true answer (where, who, doing, prices, why) come from the sim (mind/directions.ts and neighbours).

## Pending decisions (user)
- 3B model: it can run in the browser if trained and converted the same way. It costs Modal credits and may not fit the 1050.
  Fix chat state (bug 10) first, then decide from the chat test results.
- Submission day: make GitHub and the 4 HF repos public, remove Access.

## Next actions
1. **Chat first:** record real chat (npc, player line, reply, time) so it can be read after each play-test. Fix bug 10 by tracking the open offer, whoever voiced it. Run docs/NPC-CHAT-TESTS.md.
2. **Bugs 1-9 in docs/BUGS.md:** start with ground scale (bug 1); placement, farm and collision depend on it.
3. Deploy, prove with 2 players, then check docs/EXPECTATIONS.md before asking for a play-test.

## Gotchas
- Deploy only from `worker/`. If `wrangler.jsonc` appears at the root, delete it.
- Test Chrome: `bash .scratch/mlc/chrome.sh "<url>"` (port 9333, GTX 1050, signed in to Access). Weights: `node .scratch/mlc/serve.mjs`.
- Game with the model: `http://localhost:5173/?gpu=capable&tuned=http://127.0.0.1:8099/n4/{q}/`.
- Drive a tab: `node scripts/cdp-tab.mjs "<url regex>" "<js or file>"`. `?p=2` = a second player. `__px.world.alwaysDay = true` for shots.
- Hidden preview pane: rAF stalls, so drive `__px.update` from a timer.
- The room moves NPC hosting from a hidden tab to a visible one. E first closes a toast; beds take E before water.

## File map
docs/{BUGS,EXPECTATIONS,NPC-CHAT-TESTS,TILE-RULES,STYLE,NPC-PLAN,EVENT,DEMO,DEPLOY,DIRECTOR,HISTORY}.md
client/src/pixel/{main,overworld,sunny,sunny-terrain,humans,crt,grounds-decor}.ts
client/src/mind/{npcs,brain,directions,hub}.ts · worker/src/{room,npc,app}.ts
scripts/{art-sunny.py,art-interior.py,codex.ps1,cdp-tab.mjs,npc-chat-test.js}
