// Waits for the model in the test tab, runs scripts/npc-chat-test.js, saves the replies to .scratch/chat-runs/.
import fs from 'node:fs';
const page = (await (await fetch('http://127.0.0.1:9333/json')).json()).find((t) => t.type === 'page' && /capable/.test(t.url));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const ev = (expression) => new Promise((res) => {
  const me = ++id;
  const on = (e) => { const m = JSON.parse(e.data); if (m.id !== me) return; ws.removeEventListener('message', on); res(m.result?.result?.value); };
  ws.addEventListener('message', on);
  ws.send(JSON.stringify({ id: me, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (expr, ms) => { for (const t0 = Date.now(); Date.now() - t0 < ms; await wait(5000)) if (await ev(expr)) return true; return false; };
const ok = await until('!!window.__px?.world?.npcs?.hasModel?.()', 8 * 60e3);
console.log('model', ok);
if (!ok) process.exit(1);
await ev(fs.readFileSync('scripts/npc-chat-test.js', 'utf8'));
await until('window.__c?.done', 20 * 60e3);
const rows = JSON.parse(await ev('JSON.stringify(window.__c.rows)'));
fs.mkdirSync('.scratch/chat-runs', { recursive: true });
const file = `.scratch/chat-runs/${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
fs.writeFileSync(file, rows.map((r) => (r[0] === '--' ? `\n## ${r[1]}: ${r[2] ?? ''}` : `> ${r[1]}\n  ${r[2]}  [${r[3]} ${r[4]}ms]`)).join('\n'));
console.log(file);
process.exit(0);
