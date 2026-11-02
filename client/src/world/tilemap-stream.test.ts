import { describe, expect, it } from "vitest";
import { generateWorld, groundOrigin, type Platform, type WorldMap } from "../world/layout";
import { placeDecor } from "./grounds-decor";
import { Overworld } from "./overworld";
import { buildTerrain, edgeOf, tile } from "./sunny-terrain";
import { buildTileMap, T, tileAt, tileWalkable, type TileMap } from "./tilemap";

// Extra room exercises successful carving without changing production ground dimensions or rules.
function roomy(seed: number): WorldMap {
  const [w, h] = [50, 40];
  const p: Platform = {
    id: "home", kind: "home", label: "Home", x: 0, z: 0, r: 11, cell: [0, 0],
    ground: { seed, w, h, theme: "meadow", land: new Uint8Array(w * h).fill(1),
      gates: { n: { i: 13, j: 0 }, s: { i: 13, j: h - 1 }, w: { i: 0, j: 10 }, e: { i: w - 1, j: 10 } } },
  };
  return { platforms: [p, { id: "islet", kind: "islet", label: "Islet", x: -30, z: 0, r: 4, cell: [-1, 0] }],
    bridges: [{ a: "home", b: "islet", ax: -12.5, az: 0.5, bx: -26, bz: 0.5, w: 3.2 }] };
}

const production = (seed: number): WorldMap => generateWorld({ me: { seed, slot: seed % 24 },
  others: [{ id: "peer", name: "Peer", seed: seed + 30, slot: (seed + 1) % 24 }] });

function flood(m: TileMap, x: number, z: number, poolOnly = false): Set<number> {
  const seen = new Set<number>();
  const stack = [[Math.floor(x - m.ox), Math.floor(z - m.oz)]];
  while (stack.length) {
    const [i, j] = stack.pop()! as [number, number];
    const k = j * m.w + i;
    if (i < 0 || j < 0 || i >= m.w || j >= m.h || seen.has(k)) continue;
    if (poolOnly ? m.kind[k] !== T.pool : !tileWalkable(m, m.ox + i + 0.5, m.oz + j + 0.5)) continue;
    seen.add(k);
    stack.push([i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]);
  }
  return seen;
}

function check(world: WorldMap): number {
  const m = buildTileMap(world);
  expect(buildTileMap(structuredClone(world))).toEqual(m);
  let streams = 0;
  for (const p of world.platforms.filter((q) => q.ground)) {
    const g = p.ground!;
    const [ox, oz] = groundOrigin(p);
    const index = (i: number, j: number) => (oz + j - m.oz) * m.w + ox + i - m.ox;
    const seen = flood(m, p.x + 0.5, p.z + 0.5);
    for (const { i, j } of Object.values(g.gates)) expect(seen.has(index(i, j))).toBe(true);
    const pools: number[] = [];
    for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) {
      const k = index(i, j);
      if (m.kind[k] === T.pool) pools.push(k);
      const water = (a: number, b: number) => [T.water, T.pool, T.bridge].some((t) => tileAt(m, a, b) === t);
      const [x, z] = [ox + i + 0.5, oz + j + 0.5];
      if (!water(x, z)) {
        expect(water(x - 1, z) && water(x + 1, z), `thin land at ${x},${z}`).toBe(false);
        expect(water(x, z - 1) && water(x, z + 1), `thin land at ${x},${z}`).toBe(false);
      }
      if (m.kind[k] !== T.pool) continue;
      expect(tileWalkable(m, x, z)).toBe(false);
      // Two complete dry rows separate water from roads, bridges, gates, yards and the house.
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        expect([T.path, T.bridge, T.water]).not.toContain(tileAt(m, x + dx, z + dz));
        expect(Math.hypot((i + dx - (g.w - 1) / 2) / 8.5, (j + dz - (g.h - 1) / 2) / 6.2)).toBeGreaterThan(1);
        expect(Math.hypot((x + dx - p.x) / 7.5, (z + dz - p.z + 1) / 5)).toBeGreaterThan(1);
        expect(Math.abs(x + dx - p.x) <= 103 / 32 && z + dz - p.z >= -2.5 - 97 / 16 && z + dz - p.z <= -2.5).toBe(false);
        for (const gate of Object.values(g.gates)) expect([i + dx, j + dz]).not.toEqual([gate.i, gate.j]);
      }
      // Every water cell belongs to a 2 x 2 water block, including at stepped elbows.
      expect([-1, 0].some((dz) => [-1, 0].some((dx) =>
        [0, 1].every((b) => [0, 1].every((a) => tileAt(m, x + dx + a, z + dz + b) === T.pool))))).toBe(true);
    }
    if (!pools.length) continue;
    streams++;
    const first = pools[0]!;
    expect(flood(m, m.ox + first % m.w + 0.5, m.oz + Math.floor(first / m.w) + 0.5, true).size).toBe(pools.length);
    // The channel widens into a complete 4 x 3 pool.
    expect(pools.some((k) => [0, 1, 2].every((b) => [0, 1, 2, 3].every((a) => m.kind[k + b * m.w + a] === T.pool)))).toBe(true);
    const terrain = buildTerrain(m);
    const near = new Set(pools.flatMap((k) => [-1, 0, 1].flatMap((b) => [-1, 0, 1].map((a) => k + b * m.w + a))));
    for (const k of near) {
      if (m.kind[k] === T.pool) expect(terrain.land[k]).toBeGreaterThan(0);
    }
  }
  return streams;
}

describe("ground streams", () => {
  it.each(Array.from({ length: 30 }, (_, seed) => seed))("preserves deterministic tiles, gates, roads and land thickness for production seed %i", (seed) => {
    const streams = check(production(seed));
    expect(streams).toBeLessThanOrEqual(2);
  });

  it("gives most grounds a stream at production size", () => {
    let grounds = 0;
    let streams = 0;
    for (let seed = 0; seed < 30; seed++) {
      grounds += 2;
      streams += check(production(seed));
    }
    expect(streams / grounds).toBeGreaterThanOrEqual(0.5);
  }, 60_000);

  it.each(Array.from({ length: 30 }, (_, seed) => seed))("carves at most one safe closed stream for roomy seed %i", (seed) => {
    expect(check(roomy(seed))).toBeLessThanOrEqual(1);
  });

  it("gives most roomy grounds a stream over 30 seeds", () => {
    const streams = Array.from({ length: 30 }, (_, seed) => buildTileMap(roomy(seed)).kind.includes(T.pool)).filter(Boolean).length;
    expect(streams).toBeGreaterThanOrEqual(20);
  });

  it("raises a terrace on most grounds, its top reached only by the ramp", () => {
    let terraces = 0;
    for (let seed = 0; seed < 30; seed++) {
      const world = production(seed);
      const m = buildTileMap(world);
      const home = world.platforms.find((p) => p.kind === "home")!;
      const seen = flood(m, home.x + 0.5, home.z + 0.5);
      for (let k = 0; k < m.kind.length; k++) if (m.high![k] && m.kind[k] !== T.ledge) {
        terraces++;
        const [x, z] = [m.ox + k % m.w + 0.5, m.oz + Math.floor(k / m.w) + 0.5];
        if (world.platforms.filter((p) => p.ground).length) expect(tileWalkable(m, x, z)).toBe(true);
      }
      // Everything walkable on the map is one connected piece, terrace tops included.
      const interior = (k: number) => k >= m.w && k % m.w > 0 && k % m.w < m.w - 1;
      for (let k = 0; k < m.kind.length; k++)
        if (m.high![k] && m.kind[k] !== T.ledge && interior(k) && seen.size) expect(seen.has(k), `seed ${seed}`).toBe(true);
    }
    expect(terraces).toBeGreaterThan(30 * 12);
  }, 30_000);

  it("existing tree and decor placement avoid carved water", () => {
    let checked = 0;
    for (let seed = 0; seed < 30; seed++) {
      const world = roomy(seed);
      const map = buildTileMap(world);
      if (!map.kind.includes(T.pool)) continue;
      checked++;
      const scene = Object.assign(Object.create(Overworld.prototype), { world, map, trees: [], treeTiles: new Set<number>(),
        house: { x: 0, z: -2.5 }, houses: [], beds: [], allBeds: [], landmarks: [], noticeBoard: null, stall: null });
      scene.placeTrees();
      for (const k of scene.treeTiles as Set<number>) expect(map.kind[k]).not.toBe(T.pool);
      for (const d of placeDecor(world, map)) for (const k of d.tiles) expect(map.kind[k]).not.toBe(T.pool);
    }
    expect(checked).toBeGreaterThan(0);
  });
});
