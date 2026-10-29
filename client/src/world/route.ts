// Walking routes for village minds: a breadth-first search over 1-unit tiles (tile centres tested with
// `canWalk`), then the path thinned to the corners. Used when a straight line would leave the ground,
// e.g. home -> bridge -> the picnic hill next door. Pure, so it is tested without a scene.

import type { Vec } from "./movement";

const NB: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Waypoints from `from` to `to` (the last one is `to` itself), or null when no route is found within
// `maxTiles` visited tiles. An empty list = the straight line is clear.
export function findRoute(from: Vec, to: Vec, canWalk: (x: number, z: number) => boolean, maxTiles = 20000): Vec[] | null {
  if (lineClear(from, to, canWalk)) return [];
  const si = Math.floor(from.x);
  const sj = Math.floor(from.z);
  const ti = Math.floor(to.x);
  const tj = Math.floor(to.z);
  const k = (i: number, j: number) => (i + 4096) * 8192 + (j + 4096); // tiles stay within +-4096
  const prev = new Map<number, number>([[k(si, sj), -1]]);
  const queue: [number, number][] = [[si, sj]];
  let found = false;
  for (let q = 0; q < queue.length && prev.size < maxTiles; q++) {
    const [i, j] = queue[q]!;
    if (i === ti && j === tj) {
      found = true;
      break;
    }
    for (const [di, dj] of NB) {
      const ni = i + di;
      const nj = j + dj;
      const nk = k(ni, nj);
      if (prev.has(nk)) continue;
      if (!(ni === ti && nj === tj) && !canWalk(ni + 0.5, nj + 0.5)) continue;
      prev.set(nk, k(i, j));
      queue.push([ni, nj]);
    }
  }
  if (!found) return null;
  const cells: Vec[] = [];
  for (let c = k(ti, tj); c >= 0; c = prev.get(c)!) cells.push({ x: Math.floor(c / 8192) - 4096 + 0.5, z: (c % 8192) - 4096 + 0.5 });
  cells.reverse();
  cells[cells.length - 1] = { ...to };
  // Thin: from each kept point, walk ahead while the straight line stays clear (linear, so long walks
  // across the map stay cheap).
  const out: Vec[] = [];
  let at = from;
  let i = 0;
  while (i < cells.length) {
    let far = i;
    while (far + 1 < cells.length && lineClear(at, cells[far + 1]!, canWalk)) far++;
    out.push(cells[far]!);
    at = cells[far]!;
    i = far + 1;
  }
  return out;
}

// Samples the segment every 0.25 units.
export function lineClear(a: Vec, b: Vec, canWalk: (x: number, z: number) => boolean): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.25));
  for (let s = 1; s <= n; s++) {
    const t = s / n;
    if (!canWalk(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
  }
  return true;
}
