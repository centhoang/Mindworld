// Join a room once, print who the welcome lists, leave: is the room empty before a join check?
// node scripts/room-probe.mjs [room] [host]   (default: check, mindworld.uryto.dev)
const room = process.argv[2] ?? "check";
const host = process.argv[3] ?? "mindworld.uryto.dev";
const ws = new WebSocket(`wss://${host}/api/room?room=${room}`);
const t = setTimeout(() => { console.log("no welcome in 20 s"); process.exit(1); }, 20000);
ws.onopen = () => ws.send(JSON.stringify({ t: "hello", name: "Probe2", x: 0, z: 0, px: -1, pz: 0, genes: { hue: 0.1 }, groundSeed: 901 }));
ws.onmessage = (e) => {
  const s = String(e.data); if (s === "pong") return;
  const m = JSON.parse(s);
  for (const one of m.t === "b" ? m.m : [m]) if (one.t === "welcome") {
    console.log(new Date().toISOString(), "peers:", one.peers.length, JSON.stringify(one.peers.map((p) => ({ id: p.id, name: p.name, away: p.away, corner: p.corner }))).slice(0, 600));
    clearTimeout(t); ws.onclose = () => process.exit(0); ws.close(1000); setTimeout(() => process.exit(0), 5000); // exit only once the close is out, or it leaves a ghost
  }
};
