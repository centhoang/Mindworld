# Test tooling

How to drive the game and read its logs. Moved from `HANDOFF.md`.

- The Browser pane stops frames when hidden: drive timing checks in the test Chrome (`.scratch/chk/run*.mjs`).
- Chat log: from `worker/`, `npx wrangler kv key list --binding GHOSTS --remote --prefix chat:`, then `kv key get`.
- Chat test: rig up, then `node scripts/npc-chat-run.mjs`. Any client edit reloads the tab and kills a run.
- Test Chrome: `bash .scratch/mlc/chrome.sh "<url>"` (port 9333, GTX 1050). Weights: `node .scratch/mlc/serve.mjs`. Run dev server first.
- Game with the model: `http://localhost:5173/?gpu=capable&tuned=http://127.0.0.1:8099/n4/{q}/`.
- Drive a tab: `node scripts/cdp-tab.mjs "<url regex>" "<js or file>"`; shot: `scripts/cdp-shot.mjs`. `?p=2` = a second player.
- Join check on live (P3, after every deploy): `node scripts/join-check.mjs` (bots in the `check` room; `--big 0` skips the
  100-player part). Close the test Chrome first. Hold a room with bots: `node scripts/net-bots.mjs 20 75 spread "wss://pets.uryto.dev/api/room?room=check"`.
- Test tabs in the bots' room: `https://pets.uryto.dev/?room=check&p=N`. Slow-link first visit: `.scratch/chk/slow-net.mjs <kbps> <latencyMs>` (test Chrome).
