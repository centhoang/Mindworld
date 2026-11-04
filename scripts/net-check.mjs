// Network list on the live room with two sockets: what each one hears as the other walks away and back.
const url = process.argv[2] ?? "wss://mindworld.uryto.dev/api/room";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function bot(name, x, z) {
  const b = { got: [], ws: new WebSocket(url), id: "" };
  b.ws.onopen = () => b.ws.send(JSON.stringify({ t: "hello", name, x, z, px: x - 1, pz: z, genes: { hue: 0.5 }, groundSeed: 7 }));
  b.ws.onmessage = (e) => {
    const m = JSON.parse(String(e.data));
    if (m.t === "welcome") b.id = m.id;
    b.got.push(...(m.t === "b" ? m.m : [m]));
  };
  b.go = (x2, z2) => b.ws.send(JSON.stringify({ t: "pos", x: x2, z: z2, px: x2 - 1, pz: z2 }));
  b.send = (o) => b.ws.send(JSON.stringify(o));
  b.take = (t) => { const n = b.got.filter((m) => m.t === t); b.got = []; return n; };
  return b;
}
const rows = [];
const check = (what, ok) => { rows.push(`${ok ? "pass" : "FAIL"}  ${what}`); };
const up = async (b) => { for (let i = 0; i < 100 && !b.id; i++) await wait(100); if (!b.id) throw new Error("no connection, run again"); return b; };
const a = await up(bot("Near", 0, 0));
const b = await up(bot("Far", 100, 0));
await wait(500);
check("a far newcomer starts out of view", a.got.some((m) => m.t === "exit"));
b.got = []; a.got = [];
b.go(5, 0); await wait(600);
const entered = a.got.filter((m) => m.t === "enter").length;
check("walking in brings an enter", entered === 1);
b.go(6, 0); await wait(500);
check("positions follow in the tick batch", a.got.some((m) => m.t === "pos"));
b.send({ t: "farm", plots: [["wheat", 2]] }); await wait(1000);
check("a farm change reaches someone near", a.got.some((m) => m.t === "farm"));
b.got = []; a.got = [];
b.send({ t: "emote", e: "wave" }); await wait(1000);
check("an emote reaches someone near", a.got.some((m) => m.t === "emote"));
await wait(1600);
b.go(19, 0); await wait(1000); b.go(21, 0); await wait(1000); b.go(19, 0); await wait(1000); // still next to a's cell: no flicker
a.got = []; b.go(100, 0); await wait(600);
check("walking away brings one exit", a.got.filter((m) => m.t === "exit").length === 1);
a.got = [];
b.go(101, 0); await wait(500);
check("no positions from out of view", !a.got.some((m) => m.t === "pos"));
b.send({ t: "emote", e: "heart" }); await wait(1000);
check("an emote does not reach someone far", !a.got.some((m) => m.t === "emote"));
b.send({ t: "say", text: "far away" }); await wait(1000);
check("chat does not reach someone far", !a.got.some((m) => m.t === "say"));
a.got = [];
b.go(2, 0); await wait(600);
const back = a.got.find((m) => m.t === "enter");
check("coming back: enter with the farm", back?.plots?.[0]?.[0] === "wheat");
a.got = [];
b.ws.close(); await wait(800);
check("a real leave reaches everyone", a.got.some((m) => m.t === "leave"));
const c = await up(bot("Back", 2, 0)); await wait(500);
const d = a.got.filter((m) => m.t === "join");
check("a reconnect joins once", d.length === 1 && !c.got.some((m) => m.t === "welcome" && m.peers.some((p) => p.id === b.id)));
a.ws.close(); c.ws.close();
await wait(1500);
console.log(rows.join("\n"));
process.exit(0);
