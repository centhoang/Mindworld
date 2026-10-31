// Outdoor decor on players' grounds and in-between grounds: bushes, rocks, short fences, party lights on
// picnic hill. Seeded from the ground's own seed (players' grounds) or its cell + kind (in-betweens), so
// every client places the same decor without sending it. Pure: tested without a scene.
//
// Clear-path rules: decor stands on grass only, never next to a path or bridge (gates included),
// never near an activity spot or the yard in a ground's middle, and every solid piece keeps a free ring of
// walkable tiles around it, so it can never cut a route (a lone obstacle with an open ring around it).

import { mulberry32 } from "../sim/rng";
import { groundOrigin, type Platform, type WorldMap } from "../world/layout";
import { T, type TileMap } from "./tiles";

export const DECOR_KINDS = ["bush", "bush-big", "rock", "rock-big", "fence", "stump", "jar", "lights"] as const;
export type DecorKind = (typeof DECOR_KINDS)[number];

export interface DecorPiece {
  kind: DecorKind;
  x: number; // foot, world units (bottom centre of the sprite)
  z: number;
  tiles: number[]; // map tile indexes it blocks (empty = walk through)
  platform: string;
}

// Width in tiles of each solid piece (fences come in runs of 2-3 posts).
const WIDTH: Record<Exclude<DecorKind, "lights">, number> = { bush: 1, "bush-big": 2, rock: 1, "rock-big": 2, fence: 1, stump: 1, jar: 1 };
const PICK: Exclude<DecorKind, "lights">[] = ["bush", "bush", "bush-big", "bush-big", "rock", "rock-big", "fence", "stump", "jar"];

const seedOf = (p: Platform): number =>
  p.ground ? (p.ground.seed ^ 0x2c1b3c6d) >>> 0 : (Math.imul(p.cell[0] + 41, 73856093) ^ Math.imul(p.cell[1] + 37, 19349663) ^ p.kind.length * 2654435761) >>> 0;

const GRASSY = new Set<number>([T.grass, T.tall, T.flowers]);

// `reserved(x, z)` = scene things the decor must keep clear of (houses, beds, trees, signs, the stall).
export function placeDecor(world: WorldMap, m: TileMap, reserved: (x: number, z: number) => boolean = () => false): DecorPiece[] {
  const out: DecorPiece[] = [];
  const taken = new Set<number>(); // solid tiles plus their free ring
  const kindAt = (i: number, j: number) => (i < 0 || j < 0 || i >= m.w || j >= m.h ? T.water : m.kind[j * m.w + i]!);
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
      return Math.hypot((x - p.x) / (p.ground ? 7.5 : 6), (z - p.z + 1) / 5) >= 1; // the yard: house, beds, plaza
    };
    if (p.kind === "picnic" && p.spots?.blanket) {
      const b = p.spots.blanket; // a string of lights on two posts behind the blanket (walk-through)
      out.push({ kind: "lights", x: b.x + 0.5, z: b.z - 1.6, tiles: [], platform: p.id });
    }
    const want = p.ground ? 9 + Math.floor(rng() * 4) : between ? 3 + Math.floor(rng() * 2) : 8 + Math.floor(rng() * 4);
    const [x0, z0, w, h] = p.ground ? [...groundOrigin(p), p.ground.w, p.ground.h] : [p.x - p.r, p.z - p.r, p.r * 2, p.r * 2];
    for (let tries = 0, placed = 0; tries < 200 && placed < want; tries++) {
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
          if ((di >= 0 && di < len && dj === 0 ? !GRASSY.has(k) : k === T.water || k === T.bridge) || taken.has(jj * m.w + i) || reserved(m.ox + i + 0.5, m.oz + jj + 0.5)) ok = false;
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
  if (!p.ground) return Math.hypot(x - p.x, z - p.z) <= p.r - 1.5;
  const [ox, oz] = groundOrigin(p);
  const i = Math.floor(x - ox);
  const j = Math.floor(z - oz);
  return i >= 0 && j >= 0 && i < p.ground.w && j < p.ground.h && p.ground.land[j * p.ground.w + i] === 1;
}
