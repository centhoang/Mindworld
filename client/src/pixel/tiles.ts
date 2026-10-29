// The world map rasterised to a 16 px tile grid: 1 world unit = 1 tile. Platforms become islands with a
// slightly ragged coast, bridges become plank strips, the rest is water. Walking checks read this grid, so
// what you see is exactly where you can walk.

import type { WorldMap } from "../world/layout";

export const TILE = 16;

export const T = { water: 0, grass: 1, path: 2, bridge: 3, sand: 4, flowers: 5, tall: 6 } as const;
export type TileKind = (typeof T)[keyof typeof T];

export interface TileMap {
  w: number;
  h: number;
  ox: number; // world x of tile column 0
  oz: number; // world z of tile row 0
  kind: Uint8Array;
}

// Small deterministic hash so the coast and the meadow detail look the same on every load.
export function hash2(i: number, j: number, salt = 0): number {
  let h = (i * 374761393 + j * 668265263 + salt * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const MARGIN = 6; // water tiles around the outermost land

export function buildTileMap(w: WorldMap): TileMap {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const p of w.platforms) {
    minX = Math.min(minX, p.x - p.r); maxX = Math.max(maxX, p.x + p.r);
    minZ = Math.min(minZ, p.z - p.r); maxZ = Math.max(maxZ, p.z + p.r);
  }
  const ox = Math.floor(minX) - MARGIN;
  const oz = Math.floor(minZ) - MARGIN;
  const tw = Math.ceil(maxX) + MARGIN - ox;
  const th = Math.ceil(maxZ) + MARGIN - oz;
  const kind = new Uint8Array(tw * th);
  for (let j = 0; j < th; j++) {
    for (let i = 0; i < tw; i++) {
      const x = ox + i + 0.5;
      const z = oz + j + 0.5;
      const onBridge = w.bridges.some((b) => nearSegment(b.ax, b.az, b.bx, b.bz, x, z, b.w / 2 - 0.4)); // 2-3 planks wide
      const land = w.platforms.find((p) => Math.hypot(x - p.x, z - p.z) <= p.r - 0.6 * hash2(i, j, 1));
      let k: TileKind = T.water;
      if (land) {
        const d = Math.hypot(x - land.x, z - land.z);
        const r = hash2(i, j, 2);
        if (d > land.r - 1.4) k = T.sand;
        else if (d < 2.6 && land.kind !== "wild") k = T.path; // a little plaza in the middle of each place
        else if (land.kind === "wild" && r < 0.22) k = T.tall;
        else if (r < 0.06) k = T.flowers;
        else k = T.grass;
      } else if (onBridge) k = T.bridge;
      kind[j * tw + i] = k;
    }
  }
  // Paths from each plaza to its bridges, so the eye follows the way out.
  const pathLine = (x0: number, z0: number, x1: number, z1: number) => {
    const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0));
    for (let s = 0; s <= n; s++) {
      const i = Math.floor(x0 + ((x1 - x0) * s) / n - ox);
      const j = Math.floor(z0 + ((z1 - z0) * s) / n - oz);
      const at = j * tw + i;
      if (kind[at] !== T.water && kind[at] !== T.bridge) kind[at] = T.path;
    }
  };
  const byId = new Map(w.platforms.map((p) => [p.id, p]));
  for (const b of w.bridges) {
    const pa = byId.get(b.a)!;
    const pb = byId.get(b.b)!;
    pathLine(pa.x, pa.z, b.ax, b.az);
    pathLine(pb.x, pb.z, b.bx, b.bz);
  }
  return { w: tw, h: th, ox, oz, kind };
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

// Feet must stand on a non-water tile, with a small margin so sprites don't hang over the coast.
export function tileWalkable(m: TileMap, x: number, z: number): boolean {
  const e = 0.3;
  return [[x - e, z], [x + e, z], [x, z - e], [x, z + 0.1]].every(([a, b]) => tileAt(m, a!, b!) !== T.water);
}
