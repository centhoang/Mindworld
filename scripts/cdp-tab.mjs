// node ev.mjs <exact-url-suffix-regex> <file-or-expression>
import fs from 'node:fs';
const [re, arg] = process.argv.slice(2);
const expression = fs.existsSync(arg) ? fs.readFileSync(arg, 'utf8') : arg;
const page = (await (await fetch('http://127.0.0.1:9333/json')).json()).find((t) => t.type === 'page' && new RegExp(re).test(t.url));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id !== 1) return; console.log(m.result?.exceptionDetails ? JSON.stringify(m.result.exceptionDetails).slice(0, 400) : JSON.stringify(m.result?.result?.value)); process.exit(0); };
ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
