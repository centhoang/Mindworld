// /lab/net: the real room and nothing else. People are dots; the readout counts what crosses the socket.
import { randomGenes } from "../game/genes";
import { LiveLink, roomUrl, type LivePeer } from "../world/live";

const seen = { inN: 0, inB: 0, outN: 0, outB: 0 };

// The real socket, counted.
function counted(url: string) {
  const ws = new WebSocket(url);
  ws.addEventListener("message", (e) => {
    seen.inN++;
    seen.inB += String(e.data).length;
  });
  return new Proxy(ws, {
    get(t, k) {
      if (k === "send") return (data: string) => {
        seen.outN++;
        seen.outB += data.length;
        t.send(data);
      };
      const v = Reflect.get(t, k) as unknown;
      return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(t) : v;
    },
    set: (t, k, v) => Reflect.set(t, k, v),
  });
}

const player = new URLSearchParams(location.search).get("p") ?? "1";
const me = { x: 0, z: 0, px: 0, pz: 0 };
const peers = new Map<string, { name: string; x: number; z: number }>();
const addPeer = (p: LivePeer) => void peers.set(p.id, { name: p.name, x: p.x, z: p.z });
const statusEl = document.getElementById("status")!;
const live = new LiveLink(roomUrl(location), () => ({ name: `Lab ${player}`, genes: randomGenes(Number(player) * 101), ...me }), {
  welcome: (_id, _corner, list) => {
    peers.clear();
    list.forEach(addPeer);
  },
  join: addPeer,
  leave: (id) => void peers.delete(id),
  pos: (id, x, z) => {
    const p = peers.get(id);
    if (p) [p.x, p.z] = [x, z];
  },
  pose: () => undefined,
  emote: () => undefined,
  status: (s) => void (statusEl.textContent = s),
}, (url) => counted(url) as never);
live.connect();

const keys = new Set<string>();
addEventListener("keydown", (e) => keys.add(e.key.toLowerCase()));
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
let wander = false;
const wanderBtn = document.getElementById("wander")!;
wanderBtn.onclick = () => wanderBtn.classList.toggle("on", (wander = !wander));

const canvas = document.getElementById("dots") as HTMLCanvasElement;
const g = canvas.getContext("2d")!;
const SCALE = 4;
const dot = (x: number, z: number, colour: string, name: string) => {
  const [sx, sz] = [canvas.width / 2 + x * SCALE, canvas.height / 2 + z * SCALE];
  g.fillStyle = colour;
  g.fillRect(sx - 3, sz - 3, 6, 6);
  g.fillText(name, sx + 6, sz + 4);
};
let last = performance.now();
// A timer, not animation frames: a background tab keeps playing, so two tabs can test each other.
setInterval(() => {
  const now = performance.now();
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const go = (a: string, b: string) => (keys.has(a) || keys.has(b) ? 1 : 0);
  me.x += (go("d", "arrowright") - go("a", "arrowleft")) * dt * 8;
  me.z += (go("s", "arrowdown") - go("w", "arrowup")) * dt * 8;
  if (wander) [me.x, me.z] = [Math.cos(now / 1500) * 20, Math.sin(now / 1100) * 14];
  [me.px, me.pz] = [me.x - 1, me.z];
  live.tick(now, me);
  g.fillStyle = "#79c2c6";
  g.fillRect(0, 0, canvas.width, canvas.height);
  for (const p of peers.values()) dot(p.x, p.z, "#3b2c35", p.name);
  dot(me.x, me.z, "#e8505b", "me");
}, 50);

const numbers = document.getElementById("numbers")!;
setInterval(() => {
  numbers.innerHTML = `<tr><th>Players seen</th><td>${peers.size + 1}</td></tr><tr><th>In</th><td>${seen.inN} msg/s, ${seen.inB} B/s</td></tr><tr><th>Out</th><td>${seen.outN} msg/s, ${seen.outB} B/s</td></tr>`;
  seen.inN = seen.inB = seen.outN = seen.outB = 0;
}, 1000);
