// The world map: a hub of shared places in the middle, players' own grounds on a ring of slots around it,
// and bridges between grid neighbours. Pure data, so the scene, the walk rules and the live room all agree
// on the same map: every client builds it from the same inputs (who holds which slot with which ground
// seed, the room seed and the shared day) without sending any map data.
//
// Grid: cells (i, j) CELL units apart, the square at (0, 0). Slots = cells with i + j odd (a checkerboard), inner
// rings first, so two players' grounds are never side by side. Everything that is not a player's ground fills the
// even "gap" cells between them: a few shared places a lone player needs, more as players arrive, and in-between
// grounds (playground, picnic hill, fishing pond) rolled per day where two grounds touch one gap.
// Any place cut off from the square gets the shortest chain of fillers (in-betweens on gaps, small stepping isles
// on free slots), so everything is always walkable.

import { mulberry32 } from "../sim/rng";
import { groundFromSeed, GROUND_H, GROUND_W, isLand, type Ground, type Side } from "./ground";

export const PLATFORM_KINDS = ["plaza", "home", "ground", "wild", "boss", "npc", "event", "playground", "picnic", "pond", "islet"] as const;
export type PlatformKind = (typeof PLATFORM_KINDS)[number];
export const BETWEEN_KINDS = ["playground", "picnic", "pond"] as const;
export type BetweenKind = (typeof BETWEEN_KINDS)[number];

export interface Vec2 {
  x: number;
  z: number;
}

export interface Platform {
  id: string;
  kind: PlatformKind;
  label: string;
  x: number;
  z: number;
  r: number; // circle radius (grounds: a rough size; their shape is `ground`)
  cell: [number, number];
  owner?: string; // a player's ground: their live id ("me" for home)
  ground?: Ground; // seeded shape for home + players' grounds
  away?: boolean; // the owner left: a ghost ground until the slot frees
  spots?: Record<string, Vec2>; // activity anchors on in-between grounds
}

export interface Bridge {
  a: string;
  b: string;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  w: number;
}

export interface WorldMap {
  platforms: Platform[];
  bridges: Bridge[];
}

export interface GroundOwner {
  id: string;
  name: string;
  seed: number;
  slot: number;
  away?: boolean;
}

export interface LayoutInput {
  me?: { seed: number; slot: number };
  others?: readonly GroundOwner[];
  roomSeed?: number;
  day?: number;
}

export const CELL = 30; // grid spacing between platform centres: room for a 26x20 ground plus water
export const BRIDGE_W = 3.2;
export const SLOT_COUNT = 24;
const MAX_RING = 5;

const RADIUS: Record<PlatformKind, number> = {
  plaza: 10.5, home: 11, ground: 11, wild: 12.5, boss: 11, npc: 10.5, event: 11, playground: 9, picnic: 9, pond: 9.5, islet: 4.5,
};
const LABEL: Partial<Record<PlatformKind, string>> = {
  plaza: "Village square",
  home: "Your ground",
  wild: "Wild meadow",
  boss: "Boss room",
  npc: "Elder's house",
  event: "Event ground",
  playground: "Playground",
  picnic: "Picnic hill",
  pond: "Fishing pond",
  islet: "Stepping isle",
};

// Shared places, fixed so players learn the map: [i, j, kind, players needed before it fills in].
const SHARED: [number, number, PlatformKind, number][] = [
  [0, 0, "plaza", 0],
  [-1, -1, "npc", 0],
  [1, -1, "wild", 0],
  [0, -2, "boss", 0],
  [1, 1, "event", 2],
  [-1, 1, "wild", 3],
  [2, 0, "wild", 4],
  [-2, 0, "wild", 5],
];

const ring = (i: number, j: number) => Math.max(Math.abs(i), Math.abs(j));
const key = (i: number, j: number) => `${i},${j}`;
const isGap = (i: number, j: number) => ring(i, j) >= 1 && (((i + j) % 2) + 2) % 2 === 0;

// Slot n -> grid cell: inner rings first, clockwise from north, so early players are neighbours.
export const SLOTS: [number, number][] = (() => {
  const cells: [number, number][] = [];
  for (let r = 1; r <= 4; r++)
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) if (ring(i, j) === r && !isGap(i, j)) cells.push([i, j]);
  const ang = ([i, j]: [number, number]) => (Math.atan2(i, -j) + Math.PI * 2) % (Math.PI * 2);
  cells.sort((a, b) => ring(...a) - ring(...b) || ang(a) - ang(b));
  return cells.slice(0, SLOT_COUNT);
})();

// The shared day for in-between rolls: one game day = 12 real minutes, same on every client.
export const DAY_MS = 12 * 60 * 1000;
export const worldDay = (now = Date.now()): number => Math.floor(now / DAY_MS);

// What sits on a gap cell today. `forced` = the cell is needed as a stepping stone, so never empty.
export function rollBetween(roomSeed: number, i: number, j: number, day: number, forced = false): BetweenKind | null {
  const r = mulberry32((roomSeed ^ Math.imul(i + 97, 73856093) ^ Math.imul(j + 89, 19349663) ^ Math.imul(day + 1, 83492791)) >>> 0)();
  const w = forced ? r * 80 : r * 100; // playground 30, picnic 25, pond 25, nothing 20
  return w < 30 ? "playground" : w < 55 ? "picnic" : w < 80 ? "pond" : null;
}

function betweenSpots(kind: BetweenKind, x: number, z: number): Record<string, Vec2> {
  if (kind === "playground") return { goal: { x, z: z - 4 }, ball: { x, z: z + 0.5 }, slide: { x: x - 4.5, z: z + 2 } };
  if (kind === "picnic") return { blanket: { x, z: z + 0.5 }, basket: { x: x + 1.5, z: z + 0.2 }, bench: { x: x - 4, z: z - 2.5 } };
  return { pond: { x, z: z - 2.5 }, dock: { x, z: z + 0.2 }, rod: { x: x + 1, z: z + 1 } };
}

// The Elder's island keeps a fishing pond, so Mo has water even with nobody else around.
const elderPond = (x: number, z: number): Record<string, Vec2> => ({ pond: { x: x - 5.5, z: z + 3.6 }, dock: { x: x - 5.5, z: z + 6.3 } });

export function generateWorld(input: LayoutInput = {}): WorldMap {
  const { me, others = [], roomSeed = 1, day = 0 } = input;
  const cells = new Map<string, Platform>();
  const put = (i: number, j: number, p: Omit<Platform, "x" | "z" | "r" | "cell">) =>
    cells.set(key(i, j), { ...p, x: i * CELL, z: j * CELL, r: RADIUS[p.kind], cell: [i, j] });

  const players = (me ? 1 : 0) + others.length;
  let wilds = 0;
  for (const [i, j, kind, need] of SHARED) if (players >= need) put(i, j, { id: kind === "wild" ? (wilds++ ? `wild-${wilds - 1}` : "wild") : kind, kind, label: LABEL[kind]!, ...(kind === "npc" ? { spots: elderPond(i * CELL, j * CELL) } : {}) });

  // Players' grounds: home first, so a stale peer claiming my slot never hides it.
  const slotOk = (s: number) => Number.isInteger(s) && s >= 0 && s < SLOTS.length;
  if (me && slotOk(me.slot)) {
    const [i, j] = SLOTS[me.slot]!;
    put(i, j, { id: "home", kind: "home", label: LABEL.home!, owner: "me", ground: groundFromSeed(me.seed) });
  }
  for (const o of others) {
    if (!slotOk(o.slot)) continue;
    const [i, j] = SLOTS[o.slot]!;
    if (cells.has(key(i, j))) continue;
    const label = `${o.name}'s ground${o.away ? " (away)" : ""}`;
    put(i, j, { id: `g-${o.id}`, kind: "ground", label, owner: o.id, ground: groundFromSeed(o.seed), away: o.away || undefined });
  }

  const isOwned = (i: number, j: number) => {
    const p = cells.get(key(i, j));
    return !!p && (p.kind === "home" || p.kind === "ground");
  };
  const NB: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const putBetween = (i: number, j: number, kind: BetweenKind) =>
    put(i, j, { id: `b-${i},${j}`, kind, label: LABEL[kind]!, spots: betweenSpots(kind, i * CELL, j * CELL) });

  // In-between grounds on gap cells that touch two or more players' grounds, rolled per room + day.
  for (let i = -MAX_RING; i <= MAX_RING; i++)
    for (let j = -MAX_RING; j <= MAX_RING; j++) {
      if (!isGap(i, j) || cells.has(key(i, j))) continue;
      if (NB.filter(([di, dj]) => isOwned(i + di, j + dj)).length < 2) continue;
      const kind = rollBetween(roomSeed, i, j, day);
      if (kind) putBetween(i, j, kind);
    }

  // Stepping stones: link every cut-off place to the square by the shortest chain of new cells.
  const reach = () => {
    const seen = new Set([key(0, 0)]);
    const stack: [number, number][] = [[0, 0]];
    while (stack.length) {
      const [i, j] = stack.pop()!;
      for (const [di, dj] of NB) {
        const k = key(i + di, j + dj);
        if (!seen.has(k) && cells.has(k)) {
          seen.add(k);
          stack.push([i + di, j + dj]);
        }
      }
    }
    return seen;
  };
  for (const { cell: [i0, j0] } of [...cells.values()]) {
    let seen = reach();
    if (seen.has(key(i0, j0))) continue;
    const prev = new Map<string, string | null>([[key(i0, j0), null]]);
    const queue: [number, number][] = [[i0, j0]];
    let end: string | null = null;
    while (queue.length && !end) {
      const [i, j] = queue.shift()!;
      for (const [di, dj] of NB) {
        const [a, b] = [i + di, j + dj];
        const k = key(a, b);
        if (prev.has(k) || ring(a, b) > MAX_RING) continue;
        prev.set(k, key(i, j));
        if (seen.has(k)) {
          end = k;
          break;
        }
        queue.push([a, b]);
      }
    }
    for (let k = end ? prev.get(end)! : null; k && k !== key(i0, j0); k = prev.get(k)!) {
      if (cells.has(k)) continue;
      const [i, j] = k.split(",").map(Number) as [number, number];
      if (isGap(i, j)) putBetween(i, j, rollBetween(roomSeed, i, j, day, true)!);
      else put(i, j, { id: `i-${k}`, kind: "islet", label: LABEL.islet! });
    }
    seen = reach();
  }

  // Bridges join right and down neighbours (no pair twice), gate to gate on the cell's centre line.
  const bridges: Bridge[] = [];
  for (const p of cells.values()) {
    const [i, j] = p.cell;
    for (const [di, dj] of [[1, 0], [0, 1]] as const) {
      const q = cells.get(key(i + di, j + dj));
      if (!q) continue;
      const [ax, az] = bridgeEnd(p, di ? "e" : "s");
      const [bx, bz] = bridgeEnd(q, di ? "w" : "n");
      bridges.push({ a: p.id, b: q.id, ax, az, bx, bz, w: BRIDGE_W });
    }
  }
  return { platforms: [...cells.values()], bridges };
}

// Grounds: origin of the shape's tile (0, 0) in world tiles, so tile (gi, gj) covers [ox+gi, ox+gi+1).
export const groundOrigin = (p: Platform): [number, number] => [p.x - Math.floor(GROUND_W / 2), p.z - Math.floor(GROUND_H / 2)];

// Where a bridge meets a platform on one side: the gate tile for grounds, the rim for round places.
// Bridges run on the cell's centre line + 0.5, which is exactly the grounds' gate row/column.
function bridgeEnd(p: Platform, side: Side): [number, number] {
  const out = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] }[side];
  if (p.ground) {
    const [ox, oz] = groundOrigin(p);
    const g = p.ground.gates[side];
    return [ox + g.i + 0.5, oz + g.j + 0.5];
  }
  const d = p.r - 0.8; // sink a little into the platform so walkable areas overlap
  return [p.x + 0.5 + out[0]! * d, p.z + 0.5 + out[1]! * d];
}

// Places without a seeded ground are squares with a notch at each corner: straight coasts, as the pack's tiles need.
// (x, z) is any point; the notches are seeded by the place, so all clients agree.
export function inBlock(p: Platform, x: number, z: number): boolean {
  const dx = Math.abs(x - p.x);
  const dz = Math.abs(z - p.z);
  if (dx > p.r || dz > p.r) return false;
  const seed = (p.cell[0] * 7 + p.cell[1] * 13 + (x > p.x ? 3 : 0) + (z > p.z ? 5 : 0)) >>> 0;
  const across = Math.min(p.r / 2, 2 + (seed * 2654435761 >>> 28) % 4);
  const down = Math.min(p.r / 2, 2 + (seed * 40503 >>> 4) % 3);
  return !(dx > p.r - across && dz > p.r - down);
}

export function onGround(p: Platform, x: number, z: number): boolean {
  if (!p.ground) return inBlock(p, x, z);
  const [ox, oz] = groundOrigin(p);
  return isLand(p.ground, Math.floor(x - ox), Math.floor(z - oz));
}

const EDGE = 0.45; // keep feet this far from a round platform's rim

function onBridge(b: Bridge, x: number, z: number): boolean {
  const dx = b.bx - b.ax;
  const dz = b.bz - b.az;
  const t = ((x - b.ax) * dx + (z - b.az) * dz) / (dx * dx + dz * dz);
  if (t < 0 || t > 1) return false;
  return Math.hypot(x - (b.ax + t * dx), z - (b.az + t * dz)) <= b.w / 2 - 0.2;
}

// Rough walk check on the vector map (the scene walks on the tile grid built from it).
export function walkable(w: WorldMap, x: number, z: number): boolean {
  return (
    w.platforms.some((p) => (p.ground ? onGround(p, x, z) : Math.hypot(x - p.x, z - p.z) <= p.r - EDGE)) || w.bridges.some((b) => onBridge(b, x, z))
  );
}

export function platformAt(w: WorldMap, x: number, z: number): Platform | null {
  return w.platforms.find((p) => onGround(p, x, z)) ?? null;
}
