# Test tooling

How to drive the game and read its logs. Moved from `HANDOFF.md`.

- The Browser pane stops frames when hidden: drive timing checks in the test Chrome (`.scratch/chk/run*.mjs`).
- Chat log: from `worker/`, `npx wrangler kv key list --binding GHOSTS --remote --prefix chat:`, then `kv key get`.
- Chat test: rig up, then `node scripts/npc-chat-run.mjs`. Any client edit reloads the tab and kills a run.
- Test Chrome: `bash .scratch/mlc/chrome.sh "<url>"` (port 9333, GTX 1050). Weights: `node .scratch/mlc/serve.mjs`. Run dev server first.
- Game with the model: `http://localhost:5173/?gpu=capable&tuned=http://127.0.0.1:8099/n4/{q}/`.
- Drive a tab: `node scripts/cdp-tab.mjs "<url regex>" "<js or file>"`; shot: `scripts/cdp-shot.mjs`. `?p=2` = a second player.
- Join check on live (P3, after every deploy): `node scripts/join-check.mjs` (bots in the `check` room; `--big 0` skips the
  100-player part). Close the test Chrome first. After a deploy, wait until `/` serves the new `main-` name and a
  minute more (the Durable Objects restart; the 16-19/20 runs of 2026-11-04 were all straight after deploys). **Wait 2
  minutes between runs** and check the room is empty first (`node scripts/room-probe.mjs check`): a close lost on
  the home link leaves a ghost until the room's 90 s reaper, and the next run's checks fail on it. A lone "room is
  empty: 1 left behind" that a probe 100 s later shows gone is the link, not the room (`proof/network/llm-lockdown-live.md`). Each
  bot try with no welcome in 6 s is dropped and retried; the lines under a failed check say what each try did. Hold a room with bots: `node scripts/net-bots.mjs 20 75 spread "wss://mindworld.uryto.dev/api/room?room=check"`.
- Test tabs in the bots' room: `https://mindworld.uryto.dev/?room=check&p=N`. Slow-link first visit: `.scratch/chk/slow-net.mjs <kbps> <latencyMs>` (test Chrome).

## Seeing any part of the map at 1:1 (P4, dev tab in the Browser pane)
Paste into `javascript_tool`, then `__region(x, z, scale)` and take a screenshot (scale 3 = zoomed in, 1 = 800x600 art px):
```js
window.__region = (cx, cz, s = 1) => { const w = __px.world; const sc = w.buildScene(); const c = document.createElement('canvas');
  c.width = Math.floor(800 / s); c.height = Math.floor(600 / s); const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  w.view.draw({ ...sc, cam: { x: cx, z: cz }, panels: [], hint: null, banner: null, showMap: false }, g, c.width, c.height, performance.now() / 1000);
  let d = document.getElementById('shotwrap'); if (!d) { d = document.createElement('div'); d.id = 'shotwrap'; document.body.appendChild(d); }
  d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#222'; d.innerHTML = ''; const im = new Image(); im.src = c.toDataURL();
  im.style.cssText = `width:${c.width * s}px;height:${c.height * s}px;image-rendering:pixelated`; d.appendChild(im); };
```
The whole village: a 1056x736 canvas with `cam: { x: 0, z: 3 }`. Remove `#shotwrap` (or reload) to play again.
