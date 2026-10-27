// Evaluate a JS expression in the first page of a Chrome started with --remote-debugging-port.
// Usage: node scripts/cdp-eval.mjs <port> "<expression>" [urlFilter]
// The expression may return a promise; the JSON-serialisable result is printed. Local debugging helper only.
const [port, expression, urlFilter = ''] = process.argv.slice(2);
if (!port || !expression) {
  console.error('usage: node scripts/cdp-eval.mjs <port> "<expression>" [urlFilter]');
  process.exit(2);
}
const pages = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).filter(
  (t) => t.type === 'page' && t.url.includes(urlFilter),
);
if (!pages.length) {
  console.error('no matching page');
  process.exit(1);
}
const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = () => rej(new Error('ws error'));
});
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id !== 1) return;
  if (msg.error) console.error(JSON.stringify(msg.error));
  else if (msg.result.exceptionDetails) console.error(JSON.stringify(msg.result.exceptionDetails.exception?.description ?? msg.result.exceptionDetails));
  else console.log(typeof msg.result.result.value === 'string' ? msg.result.result.value : JSON.stringify(msg.result.result.value));
  ws.close();
  process.exit(msg.error || msg.result.exceptionDetails ? 1 : 0);
};
ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
setTimeout(() => process.exit(3), 120000);
