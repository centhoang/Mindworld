// The world map rasterised to a 16 px tile grid: 1 world unit = 1 tile. Round places become islands with a
// slightly ragged coast, players' grounds use their seeded shape, bridges become plank strips, the rest is
// water. Walking checks read this grid, so what you see is exactly where you can walk.

import { THEMES } from "../world/ground";
import { inBlock, groundOrigin, type Platform, type WorldMap } from "../world/layout";
import { mulberry32 } from "../sim/rng";

export const TILE = 16;

export const T = { water: 0, grass: 1, path: 2, bridge: 3, sand: 4, flowers: 5, tall: 6, pool: 7, ledge: 8 } as const;
export type TileKind = (typeof T)[keyof typeof T];

export const AWAY = 4; // look bit: the tile belongs to a ghost ground (drawn dimmed)

export interface TileMap {
  w: number;
  h: number;
  ox: number; // world x of tile column 0
  oz: number; // world z of tile row 0
  kind: Uint8Array;
  look: Uint8Array; // theme index (THEMES) | AWAY
  high?: Uint8Array; // 1 = on a raised terrace
  soil?: Uint8Array; // 1 = farm dirt, drawn in the pack's light road family
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
    const pond = p.spots?.pond;
    if (pond) {
      for (let z = Math.floor(pond.z - 3); z <= pond.z + 3; z++)
        for (let x = Math.floor(pond.x - 4); x <= pond.x + 4; x++)
          // A rectangle with notched corners: coast tiles only join on straight edges.
          if (Math.abs(x + 0.5 - pond.x) < 4 && Math.abs(z + 0.5 - pond.z) < 3 && Math.abs(x + 0.5 - pond.x) + Math.abs(z + 0.5 - pond.z) < 5.5) kind[idx(x, z)] = T.pool;
      // A pier three planks wide, so it gets the bridge's caps and rails.
      for (let z = Math.floor(pond.z); z <= Math.floor(pond.z) + 3; z++) for (let dx = -1; dx <= 1; dx++) kind[idx(Math.floor(pond.x) + dx, z)] = T.bridge;
    }
  }

  // No land one tile wide: the edge tiles need a body behind them.
  const wet = (k: number) => kind[k] === T.water || kind[k] === T.bridge;
  for (let pass = 0; pass < 3; pass++)
    for (let j = 1; j < th - 1; j++)
      for (let i = 1; i < tw - 1; i++) {
        const at = j * tw + i;
        if (!wet(at) && ((wet(at - 1) && wet(at + 1)) || (wet(at - tw) && wet(at + tw)))) kind[at] = T.water;
      }

  // Paths from each plaza to its bridges, so the eye follows the way out: 3 tiles wide, on land only.
  const pathBlock = (cx: number, cz: number) => {
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        const at = idx(cx + dx, cz + dz);
        if (!wet(at) && kind[at] !== T.pool) kind[at] = T.path;
      }
  };
  // Along one axis, then the other: a road never runs on a slant.
  const pathLine = (x0: number, z0: number, x1: number, z1: number) => {
    const [ax, az, bx, bz] = [Math.floor(x0), Math.floor(z0), Math.floor(x1), Math.floor(z1)];
    for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) pathBlock(x, az);
    for (let z = Math.min(az, bz); z <= Math.max(az, bz); z++) pathBlock(bx, z);
  };
  const byId = new Map(w.platforms.map((p) => [p.id, p]));
  for (const b of w.bridges) {
    const pa = byId.get(b.a)!;
    const pb = byId.get(b.b)!;
    if (pa.kind !== "islet") pathLine(pa.x + 0.5, pa.z + 0.5, b.ax, b.az);
    if (pb.kind !== "islet") pathLine(pb.x + 0.5, pb.z + 0.5, b.bx, b.bz);
  }
  // Road verges wander: a tile-deep bulge here and there, on grass well away from water.
  const at = (x: number, z: number) => (x < ox || z < oz || x >= ox + tw || z >= oz + th ? T.water : kind[idx(x, z)]!);
  const bulge: number[] = [];
  for (let z = oz; z < oz + th; z++) for (let x = ox; x < ox + tw; x++) {
    if (at(x, z) !== T.grass && at(x, z) !== T.flowers) continue;
    if (![at(x - 1, z), at(x + 1, z), at(x, z - 1), at(x, z + 1)].includes(T.path) || hash2(Math.floor(x / 3), Math.floor(z / 3), 91) > 0.35) continue;
    let dry = true;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if ([T.water, T.bridge, T.pool].includes(at(x + dx, z + dz) as never)) dry = false;
    if (dry) bulge.push(idx(x, z));
  }
  for (const k of bulge) kind[k] = T.path;
  const map: TileMap = { w: tw, h: th, ox, oz, kind, look, high: new Uint8Array(tw * th) };
  // Roads must be final before choosing water: never carve a route that would need a bridge.
  for (const p of w.platforms) if (p.ground) {
    carveStream(map, p);
    raiseTerrace(map, p);
  }
  return map;
}

// The shape generator's guaranteed yard, the scene's working yard, the house and the gates (ground tiles).
function inYard(p: Platform, i: number, j: number, shape = true): boolean {
  const g = p.ground!;
  const [ox, oz] = groundOrigin(p);
  const [x, z] = [ox + i + 0.5 - p.x, oz + j + 0.5 - p.z];
  return (shape && Math.hypot((i - (g.w - 1) / 2) / 8.5, (j - (g.h - 1) / 2) / 6.2) <= 1) ||
    Math.hypot(x / 7.5, (z + 1) / 5) <= 1 ||
    // Largest house stamp (103 x 97 px), at z - 2.5; protect its whole visible rectangle.
    (Math.abs(x) <= 8 && z >= -2.5 - 9 && z <= -1.5) || // the home house, 221 x 136 px at z - 2.5
    Object.values(g.gates).some((gate) => gate.i === i && gate.j === j);
}

// One raised block per ground: a walled grass top, a two-row cliff on its south side, a dirt ramp through the
// middle of the cliff. Chosen after roads and water, on plain grass only, so it can never cut a route.
function raiseTerrace(m: TileMap, p: Platform): void {
  const g = p.ground!;
  const rng = mulberry32(g.seed ^ 0x74657272);
  const [ox, oz] = groundOrigin(p);
  const index = (i: number, j: number) => (oz + j - m.oz) * m.w + ox + i - m.ox;
  const plain = (i: number, j: number) => {
    if (i < 0 || j < 0 || i >= g.w || j >= g.h || !g.land[j * g.w + i] || inYard(p, i, j, false)) return false;
    const k = m.kind[index(i, j)]!;
    return k === T.grass || k === T.flowers || k === T.tall;
  };
  for (let tries = 0; tries < 800; tries++) {
    const [rw, rh] = [8 + Math.floor(rng() * 3), 4 + Math.floor(rng() * 2)];
    const [i0, j0] = [Math.floor(rng() * g.w), Math.floor(rng() * g.h)];
    let ok = true;
    for (let j = j0 - 2; j < j0 + rh + 3 && ok; j++) for (let i = i0 - 1; i < i0 + rw + 1 && ok; i++) ok = plain(i, j);
    if (!ok) continue;
    const ramp = i0 + Math.floor((rw - 3) / 2);
    // The ramp is road, so it keeps the two dry rows every road keeps from water.
    for (let j = j0 + rh - 2; j <= j0 + rh + 4 && ok; j++) for (let i = ramp - 2; i < ramp + 5 && ok; i++)
      ok = m.kind[index(i, j)] !== T.pool;
    if (!ok) continue;
    for (let j = j0; j < j0 + rh + 2; j++) for (let i = i0; i < i0 + rw; i++) {
      const k = index(i, j);
      const top = j < j0 + rh;
      if (top) m.high![k] = 1;
      if (!top || i === i0 || i === i0 + rw - 1 || j === j0 || j === j0 + rh - 1) m.kind[k] = T.ledge;
    }
    for (let j = j0 + rh - 2; j <= j0 + rh + 2; j++) for (let i = ramp; i < ramp + 3; i++) m.kind[index(i, j)] = T.path;
    return;
  }
}

// Coast and pond banks have no shared mouth tile. Keep two complete land rows at the mouth,
// using the closed-stream fallback rather than covering a coast edge with an incomplete bank.
function carveStream(m: TileMap, p: Platform): void {
  const g = p.ground!;
  const rng = mulberry32(g.seed ^ 0x7374726d);
  const [ox, oz] = groundOrigin(p);
  const index = (i: number, j: number) => (oz + j - m.oz) * m.w + ox + i - m.ox;
  const on = (i: number, j: number) => i >= 0 && j >= 0 && i < g.w && j < g.h && g.land[j * g.w + i] === 1;
  const kind = (i: number, j: number) => on(i, j) ? m.kind[index(i, j)]! : T.water;
  const wet = (k: number) => k === T.water || k === T.pool || k === T.bridge;
  const reserved = (i: number, j: number) => inYard(p, i, j);
  const safe = new Uint8Array(g.w * g.h);
  for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) {
    let ok = true;
    for (let dj = -2; dj <= 2 && ok; dj++) for (let di = -2; di <= 2 && ok; di++) {
      const k = kind(i + di, j + dj);
      if (wet(k) || k === T.path || reserved(i + di, j + dj)) ok = false;
    }
    safe[j * g.w + i] = +ok;
  }
  const shuffle = <A,>(a: A[]): A[] => {
    for (let n = a.length - 1; n > 0; n--) {
      const q = Math.floor(rng() * (n + 1));
      [a[n], a[q]] = [a[q]!, a[n]!];
    }
    return a;
  };
  // Each anchor is the coast end of a two-wide channel, with an inward axis and a side axis.
  const mouths: { i: number; j: number; di: number; dj: number }[] = [];
  for (const [di, dj] of [[0, 1], [1, 0], [0, -1], [-1, 0]])
    for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) {
      if (on(i, j) && on(i - dj!, j + di!) && !on(i - di!, j - dj!) && !on(i - dj! - di!, j + di! - dj!)) mouths.push({ i, j, di: di!, dj: dj! });
    }
  const lengths = shuffle([6, 7, 8, 9, 10]);
  const offsets = shuffle([-3, -2, 2, 3]);
  for (const { i, j, di, dj } of shuffle(mouths)) {
    if (![0, 1].every((du) => [0, 1].every((dv) => {
      const [a, b] = [i + di * (2 + du) - dj * dv, j + dj * (2 + du) + di * dv];
      return on(a, b) && safe[b * g.w + a];
    }))) continue;
    for (const length of lengths) for (const offset of offsets) for (let bend = 2; bend <= length - Math.abs(offset) - 2; bend++) {
      const cells = new Set<number>();
      let ok = true;
      const add = (a: number, b: number) => {
        if (!on(a, b) || !safe[b * g.w + a]) ok = false;
        else cells.add(b * g.w + a);
      };
      const point = (u: number, v: number): [number, number] => [i + di * u - dj * v, j + dj * u + di * v];
      // Sweep a 2 x 2 square along axis steps: two-wide legs and square, stepped elbows.
      const block = (u: number, v: number) => {
        for (let du = 0; du < 2; du++) for (let dv = 0; dv < 2; dv++) add(...point(u + du, v + dv));
      };
      const end = length - Math.abs(offset);
      for (let u = 2; u <= 2 + bend; u++) block(u, 0);
      for (let v = Math.min(0, offset); v <= Math.max(0, offset); v++) block(2 + bend, v);
      for (let u = 2 + bend; u < 2 + end; u++) block(u, offset);
      const [ex, ez] = point(2 + end, offset);
      // The terminal pool is always 4 columns by 3 rows, even for an east/west course.
      const px = ex - (di < 0 ? 3 : di === 0 ? 1 : 0);
      const pz = ez - (dj < 0 ? 2 : di < 0 ? 1 : 0);
      for (let b = 0; b < 3; b++) for (let a = 0; a < 4; a++) add(px + a, pz + b);
      if (!ok) continue;
      const water = (a: number, b: number) => cells.has(b * g.w + a) || wet(kind(a, b));
      // Reject narrow land between any two banks, including the original coast.
      for (const k of cells) {
        const [a, b] = [k % g.w, Math.floor(k / g.w)];
        for (let db = -1; db <= 1; db++) for (let da = -1; da <= 1; da++) {
          const [x, z] = [a + da, b + db];
          if (!water(x, z) && ((water(x - 1, z) && water(x + 1, z)) || (water(x, z - 1) && water(x, z + 1)))) ok = false;
        }
      }
      if (!ok) continue;
      // Validate the actual candidate before mutating tiles: all four gates stay connected to the centre.
      const seen = new Set<number>();
      const stack = [[Math.floor(p.x - ox), Math.floor(p.z - oz)]];
      while (stack.length) {
        const [a, b] = stack.pop()! as [number, number];
        const k = b * g.w + a;
        if (!on(a, b) || seen.has(k) || water(a, b)) continue;
        seen.add(k);
        stack.push([a - 1, b], [a + 1, b], [a, b - 1], [a, b + 1]);
      }
      if (Object.values(g.gates).some(({ i: a, j: b }) => !seen.has(b * g.w + a))) continue;
      for (const k of cells) m.kind[index(k % g.w, Math.floor(k / g.w))] = T.pool;
      return;
    }
  }
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
    if (coast) return T.grass;
    if (d < 2.6) return T.path;
    return r < 0.06 ? T.flowers : T.grass;
  }
  if (!inBlock(p, cx, cz)) return null;
  if (Math.max(Math.abs(cx - p.x), Math.abs(cz - p.z)) < 2.6 && p.kind !== "wild" && p.kind !== "islet" && p.kind !== "picnic") return T.path; // a little plaza in the middle
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
  return [[x - e, z], [x + e, z], [x, z - e], [x, z + 0.1]].every(([a, b]) => tileAt(m, a!, b!) !== T.water && tileAt(m, a!, b!) !== T.pool && tileAt(m, a!, b!) !== T.ledge);
}
