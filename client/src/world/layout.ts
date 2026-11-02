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
import type { TileMap } from "./tilemap";
import type { VillageThing } from "./village-map";

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
  rect?: [number, number, number, number]; // the village's places and plots: x0, z0, x1, z1, end exclusive
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
  tiles?: TileMap; // the village: authored tiles, used as they are
  things?: readonly VillageThing[]; // the village: its trees, bushes and rocks
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

export const CELL = 40; // grid spacing between platform centres: room for a 36x28 ground plus water
export const BRIDGE_W = 3.2;
export const SLOT_COUNT = 24;
const MAX_RING = 5;

export const DAY_MS = 12 * 60 * 1000;
export const worldDay = (now = Date.now()): number => Math.floor(now / DAY_MS);

// What sits on a gap cell today. `forced` = the cell is needed as a stepping stone, so never empty.
export const groundOrigin = (p: Platform): [number, number] => p.rect ? [p.rect[0], p.rect[1]] : [p.x - Math.floor(GROUND_W / 2), p.z - Math.floor(GROUND_H / 2)];

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
  if (p.rect) return x >= p.rect[0] && z >= p.rect[1] && x < p.rect[2] && z < p.rect[3];
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
