// The one village: hand-authored rows of tiles, the places on them, and twelve plots along two streets. Pure data,
// so every client builds the same map from who holds which plot. x = column + VILLAGE_X, z = row + VILLAGE_Z.
// Legend: ~ sea, . grass, " tall grass, * flowers, = path, o pond, # pier, T tree, b bush, B berry bush, s stump, r rock.
// Trees gather in clumps toward the coast, as in the pack's demo village; a few small groups stay inland (P4).

import { T, type TileMap } from "./tilemap";
import type { Ground } from "./ground";
import type { GroundOwner, LayoutInput, Platform, PlatformKind, WorldMap } from "./layout";

export const VILLAGE_X = -33;
export const VILLAGE_Z = -20;
export const PLOT_COUNT = 12;
export const GUEST_SLOT = PLOT_COUNT; // no free plot: a shared yard, seen only by the guests themselves
const PLOT_W = 10;
const PLOT_H = 7;

export const VILLAGE_ROWS = [
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~.......................................................~~~~~",
  "~~~~~~T.T.T\".*..\".*..\"..T.T.T........T.T.T................T..~~~~~",
  "~~~~.\".\"..\".\"s.\".\"..\".\"...........................oooooo.........~",
  "~~~~.T\"T.T.\"....\"....\"...T.T.T........T.T........oooooooo...r....~",
  "~....\".\"..\"s\"..\".\"..\".\"..........................oooooooo.....r..~",
  "~..T.T\"....\"....\"....\"....T...s.....B.T..........ooo###oo........~",
  "~....\".\"..\".\"..\".\"..\".\"B..................B..r...ooo###oo...r....~",
  "~..T..\"B...\"..\".\"..\".\"..\".....=======.............oo###o.........~",
  "~....\".*..\".*..\".*..\".*.......=======...............###....T.T...~",
  "~.B.T.\"..\".\"..\".\"..\".\"..\".......===......................s.......~",
  "~....\".*..\".*..\".*..\".*.........=======================.....T.T..~",
  "~..b...r...b.........s.....================.............b........~",
  "~............T*T...*.....===================................T.T..~",
  "~............*....*.....====================.....................~",
  "~......................=====================..............B..T...~",
  "~............*....*b...=====================.....................~",
  "~......................=====================................T.T..~",
  "~.b..........========================================............~",
  "~............========================================........T.s.~",
  "~............========================================............~",
  "~....T...T.............=====================.s...................~",
  "~..T...T....B*T...T....=====================................T.T..~",
  "~.s.......T.....T......=====================..T...B..............~",
  "~...T.T.T....*......B...===================.....T............T.b.~",
  "~..........s.........r....===============........................~",
  "~...............................===..............................~",
  "~...............................===..............................~",
  "~...............................===..............................~",
  "~...............................===..............................~",
  "~...............................===..............................~",
  "~...............................===..............................~",
  "~...............................===..............................~",
  "~.===============================================================~",
  "~.===============================================================~",
  "~...............................===..............................~",
  "~...............................===..............................~",
  "~...............................===..............................~",
  "~...............................===..............................~",
  "~...............................===..............................~",
  "~...............................===..............................~",
  "~...............................===..............................~",
  "~.....=========================================================..~",
  "~.....=========================================================..~",
  "~~~~.............................................................~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
] as const;

const TILE_OF: Record<string, number> = { "~": T.water, ".": T.grass, "\"": T.tall, "*": T.flowers, "=": T.path, o: T.pool, "#": T.bridge, T: T.grass, b: T.grass, B: T.grass, s: T.grass, r: T.grass };
const THING_OF: Record<string, VillageThing["kind"]> = { T: "tree", b: "bush", B: "bush-big", s: "stump", r: "rock" };

export interface VillageThing {
  kind: "tree" | "bush" | "bush-big" | "stump" | "rock"; // bush-big is drawn as the pack's berry bush
  x: number;
  z: number;
}

export function villageTiles(): TileMap {
  const h = VILLAGE_ROWS.length, w = VILLAGE_ROWS[0].length;
  const kind = new Uint8Array(w * h);
  VILLAGE_ROWS.forEach((row, j) => [...row].forEach((c, i) => (kind[j * w + i] = TILE_OF[c]!)));
  return { w, h, ox: VILLAGE_X, oz: VILLAGE_Z, kind, look: new Uint8Array(w * h), high: new Uint8Array(w * h) };
}

export function villageThings(): VillageThing[] {
  const out: VillageThing[] = [];
  VILLAGE_ROWS.forEach((row, j) => [...row].forEach((c, i) => {
    const kind = THING_OF[c];
    if (kind) out.push({ kind, x: VILLAGE_X + i + 0.5, z: VILLAGE_Z + j + 0.5 });
  }));
  return out;
}

// Shared places that are not a platform's prop (P2 activities). The quarry's rocks are the "r"s north-east of
// the pond; a miner stands just west of one, facing it.
export const DANCE_FLOOR = { x: -3, z: -2, w: 6, h: 4 }; // tiles: the plaza's centre
export const CAMPFIRE = { x: -16.5, z: -3 }; // on the village green
export const STATUE = { x: 0, z: -4 }; // the pack's statue on the square, north of the dance floor, facing the road up to the Elder
export const PEN = { x: 4, z: -11, w: 5, h: 3 }; // tiles: the farm animals' yard on the Elder's lawn
export const QUARRY: readonly { x: number; z: number }[] = [{ x: 27.5, z: -14.5 }, { x: 29.5, z: -13.5 }, { x: 27.5, z: -11.5 }];

// Each villager's own house: its art and its foot. The door is just south of the foot.
export const NPC_HOMES: Record<string, { art: string; x: number; z: number }> = {
  elder: { art: "house-bluesmall", x: 0, z: -15.5 },
  mo: { art: "house-green", x: 12, z: -13.5 },
  ama: { art: "house-red", x: -13, z: -9.5 },
  pip: { art: "house-redsmall", x: -23, z: -9.5 },
};
export const npcDoor = (id: string): { x: number; z: number } | undefined => {
  const h = NPC_HOMES[id];
  return h && { x: h.x, z: h.z + 0.7 };
};

const COLUMNS = [-11, 2, -21, 12, -31, 22]; // nearest the spine road first, so early players are neighbours
const ROWS = [7, 16];
// Plot n's top-left tile. Slot order is what the room hands out; the house stands on the left, its beds to the right.
export const PLOT_AT: [number, number][] = [...ROWS.flatMap((z) => COLUMNS.map((x): [number, number] => [x, z])), [-31, -6]];

// Every plot has the same small house (bug 46), whoever holds it; only the roof colour changes, by slot. `x, z` is the
// house's foot (bottom centre of its picture), in the plot's left half; the door is in the middle of its front wall.
export const ROOFS = ["blue", "red", "green", "orange", "purple"] as const;
export type Roof = (typeof ROOFS)[number];
export const plotHouse = (slot: number): { x: number; z: number; roof: Roof } => {
  const [x, z] = PLOT_AT[slot] ?? PLOT_AT[GUEST_SLOT]!;
  return { x: x + 2.5, z: z + 4, roof: ROOFS[slot % ROOFS.length]! };
};
// The front fence along each plot's south row, with a three-tile gate centred on the door: runs of whole tiles,
// [x0, x1) at row z. Runs that meet across plots join into one.
export function plotFences(slots: readonly number[]): { x0: number; x1: number; z: number }[] {
  const rows = new Map<number, Set<number>>();
  for (const s of slots) {
    const [x, z] = PLOT_AT[s]!;
    const row = rows.get(z + PLOT_H - 1) ?? new Set<number>();
    for (let i = 0; i < PLOT_W; i++) if (i < 1 || i > 3) row.add(x + i);
    rows.set(z + PLOT_H - 1, row);
  }
  const out: { x0: number; x1: number; z: number }[] = [];
  for (const [z, row] of rows) {
    const xs = [...row].sort((a, b) => a - b);
    let x0 = xs[0]!;
    xs.forEach((x, n) => {
      if (xs[n + 1] === x + 1) return;
      if (x > x0) out.push({ x0, x1: x + 1, z }); // a lone post would show a rail to nowhere
      x0 = xs[n + 1]!;
    });
  }
  return out;
}

const plotGround = (seed: number): Ground => ({
  seed, theme: "meadow", w: PLOT_W, h: PLOT_H, land: new Uint8Array(PLOT_W * PLOT_H).fill(1),
  gates: { n: { i: 1, j: 0 }, e: { i: 9, j: 3 }, s: { i: 2, j: 6 }, w: { i: 0, j: 3 } }, // s: the middle of the gap in the front fence
});

function plot(slot: number, p: { id: string; kind: PlatformKind; label: string; owner: string; seed: number; away?: boolean }): Platform {
  const [x, z] = PLOT_AT[slot]!;
  const { seed, away, ...rest } = p;
  return { ...rest, x: x + 4, z: z + 5, r: 6, cell: [slot + 3, 3], ground: plotGround(seed), rect: [x, z, x + PLOT_W, z + PLOT_H], away: away || undefined };
}

const place = (id: string, kind: PlatformKind, label: string, cell: [number, number], rect: [number, number, number, number], spots?: Platform["spots"]): Platform =>
  ({ id, kind, label, cell, rect, x: Math.floor((rect[0] + rect[2]) / 2), z: Math.floor((rect[1] + rect[3]) / 2), r: Math.min(rect[2] - rect[0], rect[3] - rect[1]) / 2 + 3, spots });

const SHARED: Platform[] = [
  place("plaza", "plaza", "Village square", [0, 0], [-10, -7, 11, 7]),
  place("npc", "npc", "Elder's house", [0, -1], [-8, -18, 9, -8]),
  place("wild", "wild", "Wild meadow", [-1, -1], [-31, -18, -8, -7]),
  place("pond", "pond", "Fishing pond", [1, -1], [9, -18, 32, -7], { pond: { x: 20, z: -13 }, dock: { x: 20, z: -10.8 } }), // no loose rod: one shows only in a fisher's hands
  place("picnic", "picnic", "Village green", [-1, 0], [-21, -7, -10, 7]), // no bench or slide (user, 2026-11-03)
  place("playground", "playground", "Playground", [1, 0], [11, -7, 32, 7], { goal: { x: 22, z: -4 }, ball: { x: 22, z: 2.5 } }),
];

export function villageWorld(input: LayoutInput = {}): WorldMap {
  const { me, others = [] } = input;
  const plots = new Map<number, Platform>();
  const open = (s: number) => Number.isInteger(s) && s >= 0 && s < PLOT_COUNT;
  if (me) {
    const slot = open(me.slot) ? me.slot : GUEST_SLOT;
    plots.set(slot, plot(slot, { id: "home", kind: "home", label: slot === GUEST_SLOT ? "Guest yard" : "Your ground", owner: "me", seed: me.seed }));
  }
  for (const o of others as readonly GroundOwner[]) {
    if (!open(o.slot) || plots.has(o.slot)) continue;
    plots.set(o.slot, plot(o.slot, { id: `g-${o.id}`, kind: "ground", label: `${o.name}'s ground${o.away ? " (away)" : ""}`, owner: o.id, seed: o.seed, away: o.away }));
  }
  // Plots first: the guest yard lies inside the picnic green.
  return { platforms: [...plots.values(), ...SHARED], bridges: [], tiles: villageTiles(), things: villageThings() };
}
