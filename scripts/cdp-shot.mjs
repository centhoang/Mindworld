// node scripts/cdp-shot.mjs <url regex> <out.png>: a screenshot of a tab in the test Chrome.
import fs from 'node:fs';
const [re, out] = process.argv.slice(2);
const page = (await (await fetch('http://127.0.0.1:9333/json')).json()).find((t) => t.type === 'page' && new RegExp(re).test(t.url));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id !== 1) return; fs.writeFileSync(out, Buffer.from(m.result.data, 'base64')); process.exit(0); };
ws.send(JSON.stringify({ id: 1, method: 'Page.captureScreenshot', params: { format: 'png' } }));
