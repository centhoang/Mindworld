// Outdoor decor on players' grounds and in-between grounds: bushes, rocks, short fences, party lights on
// picnic hill. Seeded from the ground's own seed (players' grounds) or its cell + kind (in-betweens), so
// every client places the same decor without sending it. Pure: tested without a scene.
//
// Clear-path rules: decor stands on grass; roadside and crop-field fences may border dirt.
// Random decor also avoids activity spots and the yard. Every solid piece keeps a free ring of walkable
// tiles around it, so it can never cut a route (a lone obstacle with an open ring around it).

import { mulberry32 } from "../sim/rng";
import { groundOrigin, type Platform, type WorldMap } from "../world/layout";
import { T, type TileMap } from "../world/tilemap";

export const DECOR_KINDS = ["bush", "bush-big", "rock", "rock-big", "fence", "fence-v", "stump", "jar", "crates", "lights", "grass", "flowers", "windmill", "crop-wheat", "crop-carrot"] as const;
export type DecorKind = (typeof DECOR_KINDS)[number];

export interface DecorPiece {
  kind: DecorKind;
  x: number; // foot, world units (bottom centre of the sprite)
  z: number;
  tiles: number[]; // map tile indexes it blocks (empty = walk through)
  platform: string;
  field?: boolean;
  soil?: number[]; // decorative field dirt, applied by the scene after placement (not real farm beds)
}

// Width in tiles of random solid pieces; roadside and field fences have their own placement.
const WIDTH = { bush: 1, "bush-big": 2, rock: 1, "rock-big": 2, fence: 1, stump: 1, jar: 1, crates: 2 } as const;
const PICK: (keyof typeof WIDTH)[] = ["bush", "bush", "bush-big", "bush-big", "rock", "rock-big", "stump", "jar", "crates"];

const seedOf = (p: Platform): number =>
  p.ground ? (p.ground.seed ^ 0x2c1b3c6d) >>> 0 : (Math.imul(p.cell[0] + 41, 73856093) ^ Math.imul(p.cell[1] + 37, 19349663) ^ p.kind.length * 2654435761) >>> 0;

const GRASSY = new Set<number>([T.grass, T.tall, T.flowers]);

// `reserved(x, z)` = scene things the decor must keep clear of (houses, beds, trees, signs, the stall).
// `featureReserved` omits trees only: the scene clears trees from accepted fields and mill yards.
export function placeDecor(world: WorldMap, m: TileMap, reserved: (x: number, z: number) => boolean = () => false,
  featureReserved: (x: number, z: number) => boolean = reserved): DecorPiece[] {
  const out: DecorPiece[] = [];
  const taken = new Set<number>(); // solid tiles plus their free ring
  const planted = new Set<number>();
  const soil = new Set<number>();
  const kindAt = (i: number, j: number) => (i < 0 || j < 0 || i >= m.w || j >= m.h ? T.water : soil.has(j * m.w + i) ? T.path : m.kind[j * m.w + i]!);
  const nearPath = (i: number, j: number) => {
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (kindAt(i + di, j + dj) === T.path || kindAt(i + di, j + dj) === T.bridge) return true;
    return false;
  };
  for (const p of world.platforms) {
    const between = !!p.spots;
    const rng = mulberry32(seedOf(p));
    const spots = Object.values(p.spots ?? {});
    const free = (x: number, z: number) => {
      if (spots.some((s) => Math.abs(s.x - x) < 3.5 && Math.abs(s.z - z) < 3.5)) return false;
      return Math.hypot((x - p.x) / (p.ground ? 9 : 6), (z - p.z + 1) / (p.ground ? 6.5 : 5)) >= 1; // the yard: house, beds, plaza
    };
    if (p.kind === "picnic" && p.spots?.blanket) {
      const b = p.spots.blanket; // a string of lights on two posts behind the blanket (walk-through)
      out.push({ kind: "lights", x: b.x + 0.5, z: b.z - 1.6, tiles: [], platform: p.id });
    }
    const want = p.ground ? 60 + Math.floor(rng() * 20) : between ? 12 + Math.floor(rng() * 6) : 28 + Math.floor(rng() * 12);
    const [x0, z0, w, h] = p.ground ? [...groundOrigin(p), p.ground.w, p.ground.h] : [p.x - p.r, p.z - p.r, p.r * 2, p.r * 2];
    const gates = p.ground ? Object.values(p.ground.gates).map((g) => [x0 + g.i - m.ox, z0 + g.j - m.oz]) : [];
    const gateClear = (i: number, j: number) => !gates.some(([gi, gj]) => Math.abs(i - gi!) <= 2 && Math.abs(j - gj!) <= 2);
    const clearGrass = (i: number, j: number, feature = false) => GRASSY.has(kindAt(i, j)) && !m.high?.[j * m.w + i] &&
      gateClear(i, j) && !(feature ? featureReserved : reserved)(m.ox + i + 0.5, m.oz + j + 0.5) && onPlatform(p, m.ox + i + 0.5, m.oz + j + 0.5);

    // Choose features independently of the small-decor RNG and of the local owner/theme.
    const features = mulberry32(seedOf(p) ^ 0x6661726d);
    if (p.ground && features() < 0.5) {
      const fw = 5 + Math.floor(features() * 3), fh = 3 + Math.floor(features() * 2);
      for (let tries = 0; tries < 1000; tries++) {
        const i0 = Math.floor(x0 - m.ox + 2 + features() * (w - fw - 4));
        const j0 = Math.floor(z0 - m.oz + 3 + features() * (h - fh - 6));
        let ok = true;
        // Two fence rows, with open ends and an unobstructed outer detour. No pre-existing road is changed.
        for (let dj = -2; dj <= fh + 1 && ok; dj++) for (let di = -1; di <= fw && ok; di++) {
          if (!clearGrass(i0 + di, j0 + dj, true) || !free(m.ox + i0 + di + 0.5, m.oz + j0 + dj + 0.5)) ok = false;
        }
        if (!ok) continue;
        const dirt: number[] = [];
        for (let dj = 0; dj < fh; dj++) for (let di = 0; di < fw; di++) {
          const k = (j0 + dj) * m.w + i0 + di;
          dirt.push(k); soil.add(k); planted.add(k);
          out.push({ kind: dj % 2 ? "crop-carrot" : "crop-wheat", x: m.ox + i0 + di + 0.5, z: m.oz + j0 + dj + 0.5, tiles: [], platform: p.id, field: true });
        }
        out[out.length - 1]!.soil = dirt;
        for (const j of [j0 - 1, j0 + fh]) {
          const tiles = Array.from({ length: fw }, (_, di) => j * m.w + i0 + di);
          out.push({ kind: "fence", x: m.ox + i0 + fw / 2, z: m.oz + j + 0.5, tiles, platform: p.id, field: true });
        }
        for (let dj = -2; dj <= fh + 1; dj++) for (let di = -1; di <= fw; di++) taken.add((j0 + dj) * m.w + i0 + di);
        break;
      }
    }

    const mill = mulberry32(seedOf(p) ^ 0x77696e64);
    if (p.kind === "npc" || (p.ground && mill() < 0.5)) {
      for (let tries = 0; tries < 1200; tries++) {
        const i = Math.floor(x0 - m.ox + mill() * w), j = Math.floor(z0 - m.oz + mill() * h);
        let ok = true;
        // A tower two tiles wide and five tall, with a wheel on top: only its foot is solid, but the whole mill keeps clear of houses.
        // Never behind the house in the middle of the yard.
        if (Math.abs(m.ox + i + 0.5 - p.x) < (p.ground ? 9 : 5.5) && m.oz + j + 0.5 < p.z + 2) ok = false;
        for (let dj = -6; dj <= 1 && ok; dj++) for (let di = -3; di <= 3 && ok; di++) {
          if (featureReserved(m.ox + i + di + 0.5, m.oz + j + dj + 0.5)) ok = false;
          if (Math.abs(di) > 1 || Math.abs(dj) > 1) continue;
          if (!clearGrass(i + di, j + dj, true) || taken.has((j + dj) * m.w + i + di) || !free(m.ox + i + di + 0.5, m.oz + j + dj + 0.5) || nearPath(i + di, j + dj)) ok = false;
        }
        if (!ok) continue;
        const tiles = [j * m.w + i - 1, j * m.w + i];
        out.push({ kind: "windmill", x: m.ox + i, z: m.oz + j + 0.5, tiles, platform: p.id });
        for (let dj = -6; dj <= 2; dj++) for (let di = -2; di <= 2; di++) taken.add((j + dj) * m.w + i + di);
        break;
      }
    }
    if (p.ground) {
      // Straight roads carry a fence on both sides. Scan every road line and side, letting the grass check
      // discard inner lines and the junction buffer leave entrances open. (dx, dz) points away from the road.
      const fenceFree = (i: number, j: number, dx: number, dz: number) => {
        if (!GRASSY.has(kindAt(i, j)) || !onPlatform(p, m.ox + i + 0.5, m.oz + j + 0.5)) return false;
        if (gates.some(([gi, gj]) => Math.abs(i - gi!) <= 2 && Math.abs(j - gj!) <= 2)) return false;
        for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
          const [q, r] = [i + a * Math.abs(dz) + b * dx, j + a * Math.abs(dx) + b * dz];
          if (kindAt(q, r) === T.bridge) return false;
          if ((b === 0 || b === 1) && kindAt(q, r) === T.path) return false;
        }
        // A clear ring provides a detour around either end, even when the road borders the coast.
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const k = kindAt(i + di, j + dj);
          if (k === T.water || k === T.pool || k === T.bridge || k === T.ledge || taken.has((j + dj) * m.w + i + di) || reserved(m.ox + i + di + 0.5, m.oz + j + dj + 0.5)) return false;
        }
        return true;
      };
      const fenceRow = (start: number, stop: number, line: number, side: number, across: boolean) => {
        const cell = (n: number): [number, number] => (across ? [n, line + side] : [line + side, n]);
        const ok = (n: number) => fenceFree(...cell(n), across ? 0 : side, across ? side : 0);
        for (let a = start; a < stop;) {
          if (!ok(a)) { a++; continue; }
          let end = a;
          while (end < stop && ok(end)) end++;
          if (end - a < 3) { a = end; continue; }
          const len = Math.min(end - a, 5 + Math.floor(rng() * 4));
          const tiles = Array.from({ length: len }, (_, n) => { const [i, j] = cell(a + n); return j * m.w + i; });
          const [i, j] = cell(a);
          if (across) out.push({ kind: "fence", x: m.ox + a + len / 2, z: m.oz + j + 0.5, tiles, platform: p.id });
          else out.push({ kind: "fence-v", x: m.ox + i + 0.5, z: m.oz + a + len - 0.5, tiles, platform: p.id });
          const [wide, deep] = across ? [len, 1] : [1, len];
          for (let dj = -2; dj < deep + 2; dj++) for (let di = -2; di < wide + 2; di++) taken.add((j + dj) * m.w + i + di);
          a += len + 2;
        }
      };
      const roads = (lines: number, along: number, first: number, begin: number, across: boolean) => {
        for (let line = first; line < first + lines; line++) {
          const at = (n: number) => (across ? kindAt(n, line) : kindAt(line, n));
          for (let n = begin; n < begin + along;) {
            if (at(n) !== T.path) { n++; continue; }
            const start = n;
            while (n < begin + along && at(n) === T.path) n++;
            if (n - start < 6) continue;
            fenceRow(start, n, line, -1, across);
            fenceRow(start, n, line, 1, across);
          }
        }
      };
      roads(h, w, z0 - m.oz, x0 - m.ox, true);
      roads(w, h, x0 - m.ox, z0 - m.oz, false);
    }
    for (let tries = 0, placed = 0; tries < 1800 && placed < want; tries++) {
      // Small plants are walk-through clusters, so doubling detail need not double collision obstacles.
      if (rng() < 0.65) {
        const i = Math.floor(x0 + rng() * w) - m.ox, j = Math.floor(z0 + rng() * h) - m.oz;
        const kind = rng() < 0.55 ? "flowers" : "grass";
        const group: number[] = [];
        const count = 3 + Math.floor(rng() * 4);
        const offsets = [[0, 0], [1, 0], [0, 1], [-1, 0], [1, 1], [0, -1]];
        for (const [di, dj] of offsets.slice(0, count)) {
          const a = i + di!, b = j + dj!, k = b * m.w + a;
          if (!clearGrass(a, b) || nearPath(a, b) || taken.has(k) || planted.has(k) || !free(m.ox + a + 0.5, m.oz + b + 0.5)) continue;
          group.push(k);
        }
        if (group.length < 3) continue;
        for (const k of group) {
          planted.add(k);
          out.push({ kind, x: m.ox + k % m.w + 0.5, z: m.oz + Math.floor(k / m.w) + 0.5, tiles: [], platform: p.id });
        }
        placed += group.length;
        continue;
      }
      const kind = PICK[Math.floor(rng() * PICK.length)]!;
      const len = kind === "fence" ? 2 + Math.floor(rng() * 2) : WIDTH[kind];
      const i0 = Math.floor(x0 + rng() * w) - m.ox;
      const j = Math.floor(z0 + rng() * h) - m.oz;
      let ok = true;
      // the piece on grass, and a one-tile ring of walkable land around it with nothing taken
      for (let dj = -1; dj <= 1 && ok; dj++)
        for (let di = -1; di <= len && ok; di++) {
          const [i, jj] = [i0 + di, j + dj];
          const k = kindAt(i, jj);
          if ((di >= 0 && di < len && dj === 0 ? !GRASSY.has(k) : k === T.water || k === T.pool || k === T.bridge || k === T.ledge) || taken.has(jj * m.w + i) || planted.has(jj * m.w + i) || !gateClear(i, jj) || reserved(m.ox + i + 0.5, m.oz + jj + 0.5)) ok = false;
        }
      for (let di = 0; di < len && ok; di++) {
        const x = m.ox + i0 + di + 0.5;
        const z = m.oz + j + 0.5;
        if (nearPath(i0 + di, j) || !free(x, z) || !onPlatform(p, x, z)) ok = false;
      }
      if (!ok) continue;
      const tiles = Array.from({ length: len }, (_, di) => j * m.w + i0 + di);
      for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= len + 1; di++) taken.add((j + dj) * m.w + i0 + di);
      out.push({ kind, x: m.ox + i0 + len / 2, z: m.oz + j + 0.5, tiles, platform: p.id });
      placed++;
    }
  }
  return out;
}

function onPlatform(p: Platform, x: number, z: number): boolean {
  if (!p.ground) return Math.max(Math.abs(x - p.x), Math.abs(z - p.z)) <= p.r - 1.5;
  const [ox, oz] = groundOrigin(p);
  const i = Math.floor(x - ox);
  const j = Math.floor(z - oz);
  return i >= 0 && j >= 0 && i < p.ground.w && j < p.ground.h && p.ground.land[j * p.ground.w + i] === 1;
}
