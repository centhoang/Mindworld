// The world map rasterised to a 16 px tile grid: 1 world unit = 1 tile. Round places become islands with a
// slightly ragged coast, players' grounds use their seeded shape, bridges become plank strips, the rest is
// water. Walking checks read this grid, so what you see is exactly where you can walk.

import { THEMES } from "../world/ground";
import { groundOrigin, type Platform, type WorldMap } from "../world/layout";

export const TILE = 16;

export const T = { water: 0, grass: 1, path: 2, bridge: 3, sand: 4, flowers: 5, tall: 6 } as const;
export type TileKind = (typeof T)[keyof typeof T];

export const AWAY = 4; // look bit: the tile belongs to a ghost ground (drawn dimmed)

export interface TileMap {
  w: number;
  h: number;
  ox: number; // world x of tile column 0
  oz: number; // world z of tile row 0
  kind: Uint8Array;
  look: Uint8Array; // theme index (THEMES) | AWAY
}

// Small deterministic hash so the coast and the meadow detail look the same on every load.
export function hash2(i: number, j: number, salt = 0): number {
  let h = (i * 374761393 + j * 668265263 + salt * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const MARGIN = 6; // water tiles around the outermost land

function bounds(p: Platform): [number, number, number, number] {
  if (p.ground) {
    const [ox, oz] = groundOrigin(p);
    return [ox, oz, ox + p.ground.w, oz + p.ground.h];
  }
  return [Math.floor(p.x - p.r), Math.floor(p.z - p.r), Math.ceil(p.x + p.r), Math.ceil(p.z + p.r)];
}

export function buildTileMap(w: WorldMap): TileMap {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const p of w.platforms) {
    const [x0, z0, x1, z1] = bounds(p);
    minX = Math.min(minX, x0); maxX = Math.max(maxX, x1);
    minZ = Math.min(minZ, z0); maxZ = Math.max(maxZ, z1);
  }
  const ox = minX - MARGIN;
  const oz = minZ - MARGIN;
  const tw = maxX + MARGIN - ox;
  const th = maxZ + MARGIN - oz;
  const kind = new Uint8Array(tw * th);
  const look = new Uint8Array(tw * th);
  const idx = (x: number, z: number) => (z - oz) * tw + (x - ox); // world tile -> index

  // Bridges first (2-3 planks wide), then land on top, so a bridge never covers a coast tile.
  for (const b of w.bridges) {
    const half = b.w / 2 - 0.4;
    for (let z = Math.floor(Math.min(b.az, b.bz) - 2); z <= Math.max(b.az, b.bz) + 2; z++)
      for (let x = Math.floor(Math.min(b.ax, b.bx) - 2); x <= Math.max(b.ax, b.bx) + 2; x++)
        if (nearSegment(b.ax, b.az, b.bx, b.bz, x + 0.5, z + 0.5, half)) kind[idx(x, z)] = T.bridge;
  }
  for (const p of w.platforms) {
    const [x0, z0, x1, z1] = bounds(p);
    const theme = p.ground ? THEMES.indexOf(p.ground.theme) : 0;
    for (let z = z0; z < z1; z++)
      for (let x = x0; x < x1; x++) {
        const k = landKind(p, x, z);
        if (k === null) continue;
        kind[idx(x, z)] = k;
        look[idx(x, z)] = theme | (p.away ? AWAY : 0);
      }
    // A fishing pond: open water in the middle of the ground, with a short dock out into it.
    const pond = p.kind === "pond" && p.spots?.pond;
    if (pond) {
      for (let z = Math.floor(pond.z - 3); z <= pond.z + 3; z++)
        for (let x = Math.floor(pond.x - 4); x <= pond.x + 4; x++)
          if (((x + 0.5 - pond.x) / 3.4) ** 2 + ((z + 0.5 - pond.z) / 2.2) ** 2 < 1) kind[idx(x, z)] = T.water;
      for (let z = Math.floor(pond.z); z <= Math.floor(pond.z) + 2; z++) kind[idx(Math.floor(pond.x), z)] = T.bridge;
    }
  }

  // Paths from each plaza to its bridges, so the eye follows the way out.
  const pathLine = (x0: number, z0: number, x1: number, z1: number) => {
    const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0));
    for (let s = 0; s <= n; s++) {
      const at = idx(Math.floor(x0 + ((x1 - x0) * s) / n), Math.floor(z0 + ((z1 - z0) * s) / n));
      if (kind[at] !== T.water && kind[at] !== T.bridge) kind[at] = T.path;
    }
  };
  const byId = new Map(w.platforms.map((p) => [p.id, p]));
  for (const b of w.bridges) {
    const pa = byId.get(b.a)!;
    const pb = byId.get(b.b)!;
    if (pa.kind !== "islet") pathLine(pa.x + 0.5, pa.z + 0.5, b.ax, b.az);
    if (pb.kind !== "islet") pathLine(pb.x + 0.5, pb.z + 0.5, b.bx, b.bz);
  }
  return { w: tw, h: th, ox, oz, kind, look };
}

// The tile at world tile (x, z) if it is land of platform p, else null.
function landKind(p: Platform, x: number, z: number): TileKind | null {
  const cx = x + 0.5;
  const cz = z + 0.5;
  const d = Math.hypot(cx - p.x, cz - p.z);
  const r = hash2(x, z, 2);
  if (p.ground) {
    const [ox, oz] = groundOrigin(p);
    const g = p.ground;
    const on = (a: number, b: number) => a >= 0 && b >= 0 && a < g.w && b < g.h && g.land[b * g.w + a] === 1;
    const gi = x - ox;
    const gj = z - oz;
    if (!on(gi, gj)) return null;
    let coast = false;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (!on(gi + di, gj + dj)) coast = true;
    if (coast) return T.sand;
    if (d < 2.6) return T.path;
    return r < 0.06 ? T.flowers : T.grass;
  }
  if (d > p.r - 0.6 * hash2(x, z, 1)) return null;
  if (d > p.r - 1.4) return T.sand;
  if (d < 2.6 && p.kind !== "wild" && p.kind !== "islet" && p.kind !== "picnic") return T.path; // a little plaza in the middle
  if (p.kind === "wild" && r < 0.22) return T.tall;
  return r < (p.kind === "picnic" ? 0.12 : 0.06) ? T.flowers : T.grass;
}

function nearSegment(ax: number, az: number, bx: number, bz: number, x: number, z: number, half: number): boolean {
  const dx = bx - ax;
  const dz = bz - az;
  const t = ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz);
  if (t < -0.05 || t > 1.05) return false;
  return Math.hypot(x - (ax + t * dx), z - (az + t * dz)) <= half;
}

export function tileAt(m: TileMap, x: number, z: number): TileKind {
  const i = Math.floor(x - m.ox);
  const j = Math.floor(z - m.oz);
  if (i < 0 || j < 0 || i >= m.w || j >= m.h) return T.water;
  return m.kind[j * m.w + i] as TileKind;
}

export function lookAt(m: TileMap, i: number, j: number): number {
  const a = i - m.ox;
  const b = j - m.oz;
  if (a < 0 || b < 0 || a >= m.w || b >= m.h) return 0;
  return m.look[b * m.w + a]!;
}

// Feet must stand on a non-water tile, with a small margin so sprites don't hang over the coast.
export function tileWalkable(m: TileMap, x: number, z: number): boolean {
  const e = 0.3;
  return [[x - e, z], [x + e, z], [x, z - e], [x, z + 0.1]].every(([a, b]) => tileAt(m, a!, b!) !== T.water);
}
