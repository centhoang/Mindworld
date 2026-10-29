// The world map: floating platforms on a grid, joined by bridges between grid neighbours. Pure data, so
// the scene, the walk rules and (later) the live rooms all agree on the same map. Your corner sits in the
// middle; shared places around it; other players' corners fill the free cells.

export const PLATFORM_KINDS = ["home", "wild", "boss", "market", "npc", "event", "corner"] as const;
export type PlatformKind = (typeof PLATFORM_KINDS)[number];

export interface Platform {
  id: string;
  kind: PlatformKind;
  label: string;
  x: number;
  z: number;
  r: number;
  owner?: string; // a corner's ghost id
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

export interface CornerOwner {
  id: string;
  name: string;
}

export const CELL = 30; // grid spacing between platform centres: big lands, short bridges between them
export const BRIDGE_W = 3.2;

const RADIUS: Record<PlatformKind, number> = { home: 11.5, wild: 12.5, boss: 11, market: 10.5, npc: 10.5, event: 11, corner: 10.5 };
const LABEL: Record<Exclude<PlatformKind, "corner">, string> = {
  home: "Your corner",
  wild: "Wild meadow",
  boss: "Boss room",
  market: "Market",
  npc: "Elder's house",
  event: "Event ground",
};

// Cell -> place. Shared places are fixed so players learn the map; diagonal cells hold other players'
// corners, and a spare diagonal becomes more meadow.
const PLACES: [number, number, PlatformKind][] = [
  [0, 0, "home"],
  [0, -1, "event"],
  [1, 0, "wild"],
  [0, 1, "market"],
  [-1, 0, "npc"],
  [1, -1, "boss"],
];
const CORNER_CELLS: [number, number][] = [
  [-1, -1],
  [-1, 1],
  [1, 1],
];

export function generateWorld(corners: readonly CornerOwner[] = []): WorldMap {
  const cells = new Map<string, Platform>();
  const put = (i: number, j: number, p: Omit<Platform, "x" | "z" | "r">) =>
    cells.set(`${i},${j}`, { ...p, x: i * CELL, z: j * CELL, r: RADIUS[p.kind] });
  for (const [i, j, kind] of PLACES) put(i, j, { id: kind, kind, label: LABEL[kind as Exclude<PlatformKind, "corner">] });
  CORNER_CELLS.forEach(([i, j], n) => {
    const owner = corners[n];
    if (owner) put(i, j, { id: `corner-${owner.id || n}`, kind: "corner", label: `${owner.name}'s corner`, owner: owner.id });
    else put(i, j, { id: `wild-${n}`, kind: "wild", label: "Wild meadow" });
  });

  // Bridges join right and down neighbours, so every cell is reachable and no pair is joined twice.
  const bridges: Bridge[] = [];
  for (const [key, p] of cells) {
    const [i, j] = key.split(",").map(Number) as [number, number];
    for (const [di, dj] of [[1, 0], [0, 1]] as const) {
      const q = cells.get(`${i + di},${j + dj}`);
      if (!q) continue;
      const len = Math.hypot(q.x - p.x, q.z - p.z);
      const ux = (q.x - p.x) / len;
      const uz = (q.z - p.z) / len;
      // Ends sink a little into each platform so the walkable areas overlap.
      bridges.push({ a: p.id, b: q.id, ax: p.x + ux * (p.r - 0.8), az: p.z + uz * (p.r - 0.8), bx: q.x - ux * (q.r - 0.8), bz: q.z - uz * (q.r - 0.8), w: BRIDGE_W });
    }
  }
  return { platforms: [...cells.values()], bridges };
}

const EDGE = 0.45; // keep feet this far from a platform's rim

function onBridge(b: Bridge, x: number, z: number): boolean {
  const dx = b.bx - b.ax;
  const dz = b.bz - b.az;
  const t = ((x - b.ax) * dx + (z - b.az) * dz) / (dx * dx + dz * dz);
  if (t < 0 || t > 1) return false;
  return Math.hypot(x - (b.ax + t * dx), z - (b.az + t * dz)) <= b.w / 2 - 0.2;
}

export function walkable(w: WorldMap, x: number, z: number): boolean {
  return w.platforms.some((p) => Math.hypot(x - p.x, z - p.z) <= p.r - EDGE) || w.bridges.some((b) => onBridge(b, x, z));
}

export function platformAt(w: WorldMap, x: number, z: number): Platform | null {
  return w.platforms.find((p) => Math.hypot(x - p.x, z - p.z) <= p.r) ?? null;
}
