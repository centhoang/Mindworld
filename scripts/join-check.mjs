// Join check on the live room: what many players joining at once get. Bots go to the `check` room (its own Durable
// Object, never the real village), with hard limits on sockets and time, and close cleanly. One line per check.
// node scripts/join-check.mjs [--big 100] [--room check] [--url wss://pets.uryto.dev/api/room]   (--big 0 skips the full room)
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const MAX_SOCKETS = 160, MAX_SECONDS = 180, PLOTS = 12, ROOM_MAX = 100, AWAY_MS = 600_000, REFRESH_HOLD_MS = 60_000; // worker room.ts
const base = arg("url", "wss://pets.uryto.dev/api/room");
const room = arg("room", "check");
const big = Math.min(ROOM_MAX, Number(arg("big", ROOM_MAX)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (ok, ms) => { const end = Date.now() + ms; while (!ok() && Date.now() < end) await wait(50); return ok(); };
const limit = setTimeout(() => { console.log("FAIL  time limit"); process.exit(2); }, MAX_SECONDS * 1000);

const rows = [];
let fails = 0;
const check = (what, ok, note = "") => { rows.push(`${ok ? "pass" : "FAIL"}  ${what}${note ? `  (${note})` : ""}`); if (!ok) fails++; console.log(rows.at(-1)); };

let opened = 0;
const bots = [];
// A bot is a player's socket: hello, then it keeps the room's list of who is in (welcome + join - leave).
function bot(name, { seed, x = 0, z = 0, slot, r = room } = {}) {
  const b = { name, seed, x, z, r, id: "", corner: undefined, view: new Map(), dupJoins: 0, got: [], bytes: 0, tries: 0, t0: performance.now(), tWelcome: 0, closed: null, full: false, quit: false, hosts: {}, lastN: 0, backwards: 0 };
  const open = () => {
    if (opened >= MAX_SOCKETS) return void (b.closed = "socket limit");
    opened++;
    b.tries++;
    const ws = new WebSocket(`${base}?room=${r}`);
    b.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ t: "hello", name, x, z, px: x - 1, pz: z, genes: { hue: (seed % 10) / 10 }, groundSeed: seed, ...(slot !== undefined ? { slot } : {}) }));
    ws.onmessage = (e) => {
      const text = String(e.data);
      b.bytes += text.length;
      if (text === "pong") return;
      const m = JSON.parse(text);
      for (const one of m.t === "b" ? m.m : [m]) hear(b, one);
    };
    ws.onerror = () => {};
    ws.onclose = (e) => {
      // A handshake that failed: try again a little later, as the game does.
      if (!b.id && !b.full && !b.quit && b.tries < 4) return void setTimeout(open, 1000 * b.tries);
      b.closed ??= `${e.code}`;
    };
  };
  open();
  bots.push(b);
  return b;
}
function hear(b, m) {
  b.got.push(m);
  if (m.t === "welcome") {
    b.id = m.id;
    b.corner = m.corner;
    b.tWelcome = performance.now() - b.t0;
    b.welcome = m;
    b.hosts = { ...m.npcs };
    for (const p of m.peers) b.view.set(p.id, p.name);
  } else if (m.t === "join") {
    if (b.view.has(m.peer.id)) b.dupJoins++;
    b.view.set(m.peer.id, m.peer.name);
  } else if (m.t === "leave") b.view.delete(m.id);
  else if (m.t === "full") b.full = true;
  else if (m.t === "npcHost") b.hosts[m.npc] = m.host;
  else if (m.t === "ball") {
    if (m.n <= b.lastN) b.backwards++;
    b.lastN = m.n;
  }
}
const send = (b, o) => b.ws?.readyState === 1 && b.ws.send(JSON.stringify(o));
const quit = (b) => { b.quit = true; b.ws?.close(); };
const live = () => bots.filter((b) => b.id && !b.quit && b.closed === null);
const sorted = (a) => [...a].sort((x, y) => x - y);
const pct = (a, p) => Math.round(sorted(a)[Math.min(a.length - 1, Math.floor(a.length * p))] ?? 0);

// 0. Who is in the room before we start.
const probe = bot("Probe", { seed: 900, x: 0, z: 0 });
if (!(await until(() => probe.id, 10_000))) { console.log("FAIL  no connection to the room; run again"); process.exit(2); }
const before = [...probe.view.keys()];
const takenBefore = probe.welcome.peers.filter((p) => p.corner !== null).length;
check("the check room starts empty", before.length === 0, `${before.length} already in`);

// 1. Twenty players in the same second.
const burst = Array.from({ length: 20 }, (_, i) => bot(`Bot${i}`, { seed: 1000 + i, x: (i % 5) * 3, z: Math.floor(i / 5) * 3 }));
await until(() => burst.every((b) => b.id), 12_000);
const inBurst = burst.filter((b) => b.id);
const times = inBurst.map((b) => b.tWelcome);
check("20 joining at once all get in within 10 s", inBurst.length === 20 && Math.max(...times) < 10_000,
  `${inBurst.length}/20, welcome p50 ${pct(times, 0.5)} ms, max ${Math.round(Math.max(...times))} ms, retries ${burst.reduce((n, b) => n + b.tries - 1, 0)}`);
check("every player gets their own id", new Set(inBurst.map((b) => b.id)).size === inBurst.length);
await wait(1500);
const everyone = [probe, ...inBurst];
const missing = everyone.map((b) => everyone.filter((o) => o !== b && !b.view.has(o.id)).length);
check("everyone sees everyone (none lost)", missing.every((n) => n === 0), `most missing ${Math.max(...missing)}`);
check("nobody is seen twice", everyone.every((b) => b.dupJoins === 0) && everyone.every((b) => new Set(b.view.keys()).size === b.view.size));
check("no socket stuck", burst.every((b) => b.id || b.full), `${burst.filter((b) => !b.id).length} without a welcome`);
const corners = everyone.map((b) => b.corner).filter((c) => c !== null);
// A plot left under a minute ago is kept for its owner's refresh (room.ts REFRESH_HOLD_MS): a fast rerun meets the last one's.
const ours = new Set(everyone.map((b) => b.seed));
const held = probe.welcome.aways.filter((a) => AWAY_MS - a.ttl < REFRESH_HOLD_MS && !ours.has(a.seed)).length;
const want = Math.min(everyone.length, PLOTS - takenBefore - held);
check(`the first ${PLOTS} get a plot, the rest the Guest yard`, corners.length === want && new Set(corners).size === corners.length,
  `${corners.length} plots (want ${want}), ${everyone.length - corners.length} guests`);

// 2. A refresh gets the same plot back, even when a newcomer joins in those seconds.
const a = inBurst.find((b) => b.corner !== null && b !== probe);
quit(a);
await wait(400);
const a2 = bot(a.name, { seed: a.seed, x: a.x, z: a.z });
await until(() => a2.id, 8000);
check("a refresh gets the same plot back", a2.corner === a.corner, `had ${a.corner}, got ${a2.corner}`);
const b = inBurst.find((o) => o.corner !== null && o !== a && o !== probe);
quit(b);
await wait(150);
const newcomer = bot("Newcomer", { seed: 2000, x: 30, z: 30 });
await until(() => newcomer.id, 8000);
const b2 = bot(b.name, { seed: b.seed, x: b.x, z: b.z, slot: b.corner });
await until(() => b2.id, 8000);
check("a refresh keeps its plot when someone joins meanwhile", b2.corner === b.corner && newcomer.corner === null,
  `had ${b.corner}, got ${b2.corner}; newcomer got ${newcomer.corner}`);

// 3. Someone who joins late sees things as they are now.
const [kicker, farmer, talkA, talkB] = [a2, b2, inBurst[2], inBurst[3]].filter(Boolean);
send(kicker, { t: "kick", x: 22, z: 2.5, vx: 3, vz: -1, by: kicker.id });
send(farmer, { t: "farm", plots: [["wheat", 3], ["", 0]] });
send(talkA, { t: "talk", with: talkB.id });
await wait(800);
const late = bot("Late", { seed: 2100, x: farmer.x, z: farmer.z });
await until(() => late.id, 8000);
await wait(1200);
check("a late joiner gets the ball's last kick", !!late.welcome?.ball && late.welcome.ball.n === kicker.lastN, `kick ${kicker.lastN}, welcome ${late.welcome?.ball?.n}`);
check("a late joiner sees a nearby farm without anyone resending it",
  late.got.some((m) => (m.t === "farm" && m.id === farmer.id && m.plots?.[0]?.[0] === "wheat") || (m.t === "enter" && m.peer?.id === farmer.id && m.plots?.[0]?.[0] === "wheat")));
check("a late joiner sees who is talking", late.welcome?.talks?.some(([x, y]) => x === talkA.id && y === talkB.id));
check("a late joiner learns who hosts the villagers", ["elder", "mo", "ama", "pip"].every((n) => !!late.hosts[n]), JSON.stringify(late.hosts));

// 4. A kick burst: ten players kick for 3 s; everyone ends on the same last kick, never going back.
const kickers = live().slice(0, 10);
for (let t = 0; t < 3000; t += 150) {
  kickers.forEach((k, i) => send(k, { t: "kick", x: 20 + i * 0.1, z: 2 + t / 3000, vx: Math.cos(t + i) * 5, vz: Math.sin(t + i) * 5, by: k.id }));
  await wait(150);
}
await wait(1000);
const ends = new Set(live().map((o) => o.lastN));
check("a kick burst ends on the same kick for everyone", ends.size === 1, `${ends.size} different last kicks over ${live().length} players`);
check("kicks never arrive out of order", live().every((o) => o.backwards === 0), `${live().reduce((n, o) => n + o.backwards, 0)} backwards`);
check("nobody is thrown out for kicking", kickers.every((k) => k.closed === null));

// 5. The villagers' host leaves: someone else hosts them at once.
const hostId = probe.hosts.elder;
const host = live().find((o) => o.id === hostId && o !== probe);
if (host) {
  quit(host);
  await until(() => probe.hosts.elder && probe.hosts.elder !== hostId, 3000);
  check("when the villagers' host leaves, another player hosts them", !!probe.hosts.elder && probe.hosts.elder !== hostId);
} else check("when the villagers' host leaves, another player hosts them", false, `host ${hostId} is not a bot`);

// 6. A full room: up to 100, then the 101st is sent on and plays with the others in the next room.
if (big > 0) {
  const t0 = performance.now();
  for (let i = 0; opened < MAX_SOCKETS && live().length + bots.filter((o) => !o.id && o.closed === null && !o.quit).length < big; i++) {
    bot(`Big${i}`, { seed: 3000 + i, x: -120 + (i % 10) * 26, z: -120 + Math.floor(i / 10) * 26 });
    await wait(25);
  }
  await until(() => live().length >= big, 25_000);
  const held = live().length;
  check(`${big} players held at once`, held === big, `${held} in ${Math.round((performance.now() - t0) / 1000)} s, retries ${bots.reduce((n, o) => n + o.tries - 1, 0)}, handshake failures ${bots.filter((o) => !o.id && !o.full).length}`);
  // Walk them all for 5 s at 5 Hz: what each one receives.
  const at = new Map(live().map((o) => [o, o.bytes]));
  const walkT0 = performance.now();
  for (let s = 0; s < 25; s++) {
    live().forEach((o, i) => { const x = o.x + Math.cos(s / 3 + i) * 2, z = o.z + Math.sin(s / 4 + i) * 2; send(o, { t: "pos", x, z, px: x - 1, pz: z }); });
    await wait(200);
  }
  const secs = (performance.now() - walkT0) / 1000;
  const per = [...at].map(([o, was]) => (o.bytes - was) / secs);
  console.log(`      traffic while ${at.size} walk: p50 ${pct(per, 0.5)} B/s per player, max ${pct(per, 1)} B/s`);
  if (held >= ROOM_MAX) {
    const extra = bot("Extra", { seed: 4000 });
    await until(() => extra.full || extra.id, 8000);
    const next = bot("Extra", { seed: 4000, r: `${room}-2` });
    await until(() => next.id, 8000);
    check("the 101st is told the room is full, and the next room lets them in", extra.full && !!next.id, `full ${extra.full}, next room ${next.id ? "in" : "no"}`);
  }
}

// 7. Everyone leaves: nobody is left behind as a stuck player.
bots.forEach(quit);
await wait(3000);
const after = bot("After", { seed: 901 });
await until(() => after.id, 8000);
check("after everyone leaves, the room is empty", after.view.size === 0, `${after.view.size} left behind`);
quit(after);
await wait(1500);
console.log(`${fails ? "FAILED" : "CLEAN"}: ${rows.length - fails}/${rows.length} pass, ${opened} sockets opened`);
clearTimeout(limit);
process.exit(fails ? 1 : 0);
