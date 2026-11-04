// Load test: N bots walk in the room and each counts what it receives. Hard limits on bots and seconds.
// node scripts/net-bots.mjs <bots> <seconds> <spread|crowd> [url]
const MAX_BOTS = 120, MAX_SECONDS = 90;
const bots = Math.min(MAX_BOTS, Number(process.argv[2] ?? 10));
const seconds = Math.min(MAX_SECONDS, Number(process.argv[3] ?? 20));
const mode = process.argv[4] ?? "spread";
const url = process.argv[5] ?? "wss://mindworld.uryto.dev/api/room";
const STEP_MS = 200;

const stats = [];
const socks = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let started = 0, full = 0;
for (let i = 0; i < bots; i++) {
  const home = mode === "crowd" ? { x: 8, z: 8 } : { x: -120 + (i % 10) * 26, z: -120 + Math.floor(i / 10) * 26 };
  const s = { i, n: 0, bytes: 0, last: 0, gaps: [], seen: 0, x: home.x, z: home.z, home };
  const ws = new WebSocket(url);
  ws.onopen = () => ws.send(JSON.stringify({ t: "hello", name: `Bot${i}`, x: s.x, z: s.z, px: s.x - 1, pz: s.z, genes: { hue: i / bots }, groundSeed: i + 1 }));
  ws.onmessage = (e) => {
    if (!started) return;
    const text = String(e.data);
    s.n++;
    s.bytes += text.length;
    if (text.startsWith('{"t":"full"')) full++;
    if (!text.startsWith('{"t":"b"')) return;
    const now = performance.now();
    if (s.last) s.gaps.push(now - s.last);
    s.last = now;
  };
  ws.onerror = (e) => { s.failed = true; s.why = String(e.error?.cause?.message ?? e.error?.message ?? e.message ?? "error").slice(0, 60) || "error"; };
  ws.onclose = (e) => { s.closed = `${e.code} ${e.reason}`.slice(0, 40); };
  stats.push(s);
  socks.push(ws);
  await wait(Number(process.env.JOIN_MS ?? 60)); // no thundering join
}
await wait(1000);
started = performance.now();
const walk = setInterval(() => {
  const t = (performance.now() - started) / 1000;
  socks.forEach((ws, i) => {
    if (ws.readyState !== 1) return;
    const s = stats[i];
    s.x = s.home.x + Math.cos(t + i) * 4;
    s.z = s.home.z + Math.sin(t * 0.7 + i) * 4;
    ws.send(JSON.stringify({ t: "pos", x: s.x, z: s.z, px: s.x - 1, pz: s.z }));
  });
}, STEP_MS);
await wait(seconds * 1000);
clearInterval(walk);
const spent = (performance.now() - started) / 1000;
const live = socks.filter((w) => w.readyState === 1).length;
const whys = {};
for (const s of stats) { const k = s.why ?? s.closed; if (k) whys[k] = (whys[k] ?? 0) + 1; }
socks.forEach((w) => w.close());
const sorted = (a) => [...a].sort((x, y) => x - y);
const mid = (a) => sorted(a)[Math.floor(a.length / 2)] ?? 0;
const gaps = sorted(stats.flatMap((s) => s.gaps));
console.log(JSON.stringify({
  bots, mode, seconds, connected: live, full, whys, failed: stats.filter((s) => s.failed).length,
  msgPerBotPerS: +(mid(stats.map((s) => s.n)) / spent).toFixed(1),
  bytesPerBotPerS: Math.round(mid(stats.map((s) => s.bytes)) / spent),
  maxBytesPerBotPerS: Math.round(Math.max(...stats.map((s) => s.bytes)) / spent),
  batchGapMs: { p50: Math.round(gaps[Math.floor(gaps.length * 0.5)] ?? 0), p95: Math.round(gaps[Math.floor(gaps.length * 0.95)] ?? 0), max: Math.round(gaps.at(-1) ?? 0) },
}));
await wait(3000); // let the closes land, or the next run finds the room full
process.exit(0);
