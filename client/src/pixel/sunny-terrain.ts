// Sunnyside terrain rules, read off the pack's example room: which tile goes where, from the land shape alone.
// Land edges are one tile family and roads a matching one; a south edge drops two rows of cliff and ends in foam.
// Pure, so a shape can be checked without a canvas.

import { hash2, T, type TileMap } from "./tiles";

// A cell = tile index in tiles.png (row * 64 + col) | flags. 0 = nothing.
export const MIRROR = 1 << 16;
export const FLIP = 1 << 17;
export const CELL_ID = 0xffff;
export const tile = (row: number, col: number, flags = 0) => row * 64 + col + flags;

export interface Terrain {
  land: Int32Array; // grass, cliffs and foam
  road: Int32Array;
  shade: Int32Array; // sea shadow under the cliffs, drawn over the foam
}

type EdgeName = "nw" | "n" | "ne" | "w" | "e" | "sw" | "s" | "se" | "inNw" | "inNe" | "inSw" | "inSe";
const GRASS: Record<EdgeName, number> = {
  nw: tile(3, 8), n: tile(3, 4), ne: tile(4, 4), w: tile(3, 6), e: tile(4, 3), sw: tile(4, 6), s: tile(4, 5), se: tile(4, 7),
  inNw: tile(3, 2), inNe: tile(3, 3), inSw: tile(3, 5), inSe: tile(4, 1),
};
const GRASS_FILL = tile(3, 1);
const ACCENT = [tile(2, 1), tile(2, 2), tile(2, 3), tile(2, 5), tile(2, 6)];
const ROAD: Record<EdgeName, number> = {
  nw: tile(7, 19), n: tile(7, 15), ne: tile(8, 15), w: tile(7, 17), e: tile(8, 14), sw: tile(8, 17), s: tile(8, 16), se: tile(8, 18),
  inNw: tile(7, 13), inNe: tile(7, 14), inSw: tile(7, 16), inSe: tile(8, 12),
};
const ROAD_FILL = [tile(7, 12), tile(7, 12), tile(7, 12), tile(7, 20), tile(7, 21), tile(8, 20), tile(8, 21)];
// Ponds and rivers are the sea's own water (same repeat, same glints), so they read as one body of water.
export const seaCell = (i: number, j: number) => tile(18 + (((j % 4) + 4) % 4), 11 + (((i % 4) + 4) % 4));
const CLIFF = (i: number, j: number) => (((i + j) & 1) ? tile(3, 11) : tile(4, 11));

// Which edge tile a cell of a shape takes, or null for the plain inside.
export function edgeOf(on: (i: number, j: number) => boolean, i: number, j: number): EdgeName | null {
  const [n, e, s, w] = [on(i, j - 1), on(i + 1, j), on(i, j + 1), on(i - 1, j)];
  if (!n && !w) return "nw";
  if (!n && !e) return "ne";
  if (!s && !w) return "sw";
  if (!s && !e) return "se";
  if (!n) return "n";
  if (!s) return "s";
  if (!w) return "w";
  if (!e) return "e";
  if (!on(i - 1, j - 1)) return "inNw";
  if (!on(i + 1, j - 1)) return "inNe";
  if (!on(i - 1, j + 1)) return "inSw";
  if (!on(i + 1, j + 1)) return "inSe";
  return null;
}

export function buildTerrain(m: TileMap): Terrain {
  const size = m.w * m.h;
  const out: Terrain = { land: new Int32Array(size), road: new Int32Array(size), shade: new Int32Array(size) };
  const at = (i: number, j: number) => (i < 0 || j < 0 || i >= m.w || j >= m.h ? T.water : m.kind[j * m.w + i]!);
  // Ponds and streams are coast like any other: same grass edge, same cliff and the same moving foam.
  const dry = (i: number, j: number) => at(i, j) !== T.water && at(i, j) !== T.bridge && at(i, j) !== T.pool;
  const isRoad = (i: number, j: number) => at(i, j) === T.path;
  const high = (i: number, j: number) => m.high?.[j * m.w + i] === 1;
  const isPool = (i: number, j: number) => at(i, j) === T.pool;
  const free = (i: number, j: number) => i >= 0 && j >= 0 && i < m.w && j < m.h && !dry(i, j);
  const put = (a: Int32Array, i: number, j: number, cell: number) => {
    a[j * m.w + i] = cell;
  };
  for (let j = 0; j < m.h; j++)
    for (let i = 0; i < m.w; i++) {
      const k = j * m.w + i;
      if (isPool(i, j) && !out.land[k]) out.land[k] = seaCell(i + m.ox, j + m.oz);
      if (!dry(i, j)) continue;
      const edge = edgeOf(dry, i, j);
      if (edge) out.land[k] = GRASS[edge];
      else out.land[k] = hash2(i, j, 21) < 0.07 ? ACCENT[Math.floor(hash2(i, j, 22) * ACCENT.length)]! : GRASS_FILL;
      if (isRoad(i, j)) {
        const e = edgeOf(isRoad, i, j);
        out.road[k] = e ? ROAD[e] : ROAD_FILL[Math.floor(hash2(i, j, 23) * ROAD_FILL.length)]!;
      }
      if (at(i, j) === T.ledge) {
        // Terrace walls sit on the road layer, over plain grass: the lip of the top, or the cliff below it.
        out.land[k] = GRASS_FILL;
        // Corner cliff tiles carry sea and foam, so a terrace face is plain cliff from end to end.
        out.road[k] = high(i, j) ? GRASS[edgeOf(high, i, j) ?? "n"] : CLIFF(i, j);
      }
      if (dry(i, j + 1)) continue;
      // The south face of this column, then its foam.
      const west = edge === "sw";
      const east = edge === "se";
      const coast = west ? [tile(4, 10), tile(2, 19, MIRROR), tile(6, 19, MIRROR)] : east ? [tile(4, 10, MIRROR), tile(2, 19), tile(6, 19)] : [CLIFF(i, j + 1), CLIFF(i, j + 2), tile(2, 20)];
      // Inland the drop is one row shorter, and a narrow stream keeps its water: only the foam line shows.
      const room = [1, 2, 3].filter((n) => isPool(i, j + n)).length;
      const face = !isPool(i, j + 1) ? coast : room >= 3 ? coast.slice(1) : coast.slice(2);
      let last = j;
      face.forEach((cell, n) => {
        if (last !== j + n || !free(i, j + n + 1)) return;
        put(out.land, i, j + n + 1, cell);
        last = j + n + 1;
      });
    }
  return out;
}

// Which part of a cell a rail leaves free. Outer rows of a wide bridge keep only the half towards the deck, so routes
// through tile centres use the middle lane; the posts at each end stand on the land and block the same way.
const KEEP_S = 1, KEEP_N = 2, KEEP_E = 3, KEEP_W = 4;
const RAIL_FREE = 0.45;
const railMasks = new WeakMap<TileMap, Uint8Array>();
function railMask(m: TileMap): Uint8Array {
  const hit = railMasks.get(m);
  if (hit) return hit;
  const mask = new Uint8Array(m.w * m.h);
  const on = (a: number, b: number) => a >= 0 && b >= 0 && a < m.w && b < m.h && m.kind[b * m.w + a] === T.bridge;
  const put = (a: number, b: number, v: number) => {
    if (a >= 0 && b >= 0 && a < m.w && b < m.h) mask[b * m.w + a] = v;
  };
  const run = (i: number, j: number, di: number, dj: number) => {
    let n = 0;
    while (n < 9 && on(i + di * (n + 1), j + dj * (n + 1))) n++;
    return n;
  };
  for (let j = 0; j < m.h; j++)
    for (let i = 0; i < m.w; i++) {
      if (!on(i, j)) continue;
      if (run(i, j, 1, 0) + run(i, j, -1, 0) >= run(i, j, 0, 1) + run(i, j, 0, -1)) {
        const keep = !on(i, j - 1) ? KEEP_S : !on(i, j + 1) ? KEEP_N : 0;
        if (!keep || (!on(i, j - 1) && !on(i, j + 1))) continue;
        put(i, j, keep);
        if (!on(i - 1, j)) put(i - 1, j, keep);
        if (!on(i + 1, j)) put(i + 1, j, keep);
      } else {
        const keep = !on(i - 1, j) ? KEEP_E : !on(i + 1, j) ? KEEP_W : 0;
        if (!keep || (!on(i - 1, j) && !on(i + 1, j))) continue;
        put(i, j, keep);
        if (!on(i, j - 1)) put(i, j - 1, keep);
        if (!on(i, j + 1)) put(i, j + 1, keep);
      }
    }
  railMasks.set(m, mask);
  return mask;
}

export function railBlocks(m: TileMap, x: number, z: number): boolean {
  const [fx, fz] = [x - m.ox, z - m.oz];
  const [i, j] = [Math.floor(fx), Math.floor(fz)];
  if (i < 0 || j < 0 || i >= m.w || j >= m.h) return false;
  const keep = railMask(m)[j * m.w + i];
  if (!keep) return false;
  const [u, v] = [fx - i, fz - j];
  return keep === KEEP_S ? v < 1 - RAIL_FREE : keep === KEEP_N ? v > RAIL_FREE : keep === KEEP_E ? u < 1 - RAIL_FREE : u > RAIL_FREE;
}

// Bridge planks and rails for the whole map. Ends lie one tile up on the land, as the pack's bridges do.
export function bridgeLayers(m: TileMap): { deck: Int32Array; rail: Int32Array } {
  const deck = new Int32Array(m.w * m.h);
  const rail = new Int32Array(m.w * m.h);
  const on = (a: number, b: number) => a >= 0 && b >= 0 && a < m.w && b < m.h && m.kind[b * m.w + a] === T.bridge;
  const put = (i: number, j: number, d: number, r: number) => {
    if (i < 0 || j < 0 || i >= m.w || j >= m.h) return;
    deck[j * m.w + i] = d;
    rail[j * m.w + i] = r;
  };
  const run = (i: number, j: number, di: number, dj: number) => {
    let n = 0;
    while (n < 9 && on(i + di * (n + 1), j + dj * (n + 1))) n++;
    return n;
  };
  for (let j = 0; j < m.h; j++)
    for (let i = 0; i < m.w; i++) {
      if (!on(i, j)) continue;
      const across = run(i, j, 1, 0) + run(i, j, -1, 0) >= run(i, j, 0, 1) + run(i, j, 0, -1);
      if (across) {
        const row = !on(i, j - 1) ? 11 : !on(i, j + 1) ? 13 : 12;
        put(i, j, tile(row, 40, i & 1 ? MIRROR : 0), row === 11 ? tile(2, 39) : row === 13 ? tile(0, 39) : 0);
        if (!on(i - 1, j)) put(i - 1, j, tile(row, 39), row === 11 ? tile(2, 42, MIRROR) : row === 13 ? tile(0, 38) : 0);
        if (!on(i + 1, j)) put(i + 1, j, tile(row, 39, MIRROR), row === 11 ? tile(2, 42) : row === 13 ? tile(0, 38, MIRROR) : 0);
      } else {
        const lone = !on(i - 1, j) && !on(i + 1, j);
        const col = lone ? 40 : !on(i - 1, j) ? 39 : !on(i + 1, j) ? 41 : 40;
        const side = col !== 40;
        put(i, j, tile(12, col), side ? tile(3, 40) : 0);
        if (!on(i, j - 1)) put(i, j - 1, tile(11, col), side ? tile(1, 40) : 0);
        if (!on(i, j + 1)) put(i, j + 1, tile(11, 80 - col, MIRROR | FLIP), side ? tile(4, 40) : 0);
      }
    }
  return { deck, rail };
}
