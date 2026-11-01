import { describe, expect, it, vi } from "vitest";
import { generateWorld, groundOrigin, type LayoutInput } from "../world/layout";
import { placeDecor } from "./grounds-decor";
import { buildTileMap, T, type TileMap } from "./tiles";
import { Overworld } from "./overworld";

const input: LayoutInput = {
  me: { seed: 3, slot: 0 },
  others: [
    { id: "a", name: "A", seed: 4, slot: 1 },
    { id: "b", name: "B", seed: 99, slot: 2 },
    { id: "c", name: "C", seed: 1234, slot: 3 },
  ],
  roomSeed: 2,
  day: 1,
};

// Walkable tiles reachable from the square, with some tiles blocked.
function reach(m: TileMap, blocked: Set<number>, from: number, land?: Set<number>): Set<number> {
  const seen = new Set<number>([from]);
  const stack = [from];
  while (stack.length) {
    const k = stack.pop()!;
    const [i, j] = [k % m.w, Math.floor(k / m.w)];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const [a, b] = [i + di, j + dj];
      const n = b * m.w + a;
      if (a < 0 || b < 0 || a >= m.w || b >= m.h || seen.has(n) || blocked.has(n) || m.kind[n] === T.water || m.kind[n] === T.pool || (land && !land.has(n))) continue;
      seen.add(n);
      stack.push(n);
    }
  }
  return seen;
}

vi.setConfig({ testTimeout: 30_000 }); // forest tests build many worlds

describe("ground decor", () => {
  const world = generateWorld(input);
  const m = buildTileMap(world);
  const decor = placeDecor(world, m);

  it("is the same on every client for the same layout", () => {
    expect(placeDecor(generateWorld(input), buildTileMap(generateWorld(input)))).toEqual(decor);
  });

  it("puts some on every ground, shared places included", () => {
    for (const p of world.platforms.filter((q) => q.ground)) expect(decor.filter((d) => d.platform === p.id).length, p.id).toBeGreaterThan(0);
    expect(decor.some((d) => d.platform === "plaza")).toBe(true);
  });

  it("changes with the ground's seed", () => {
    const other = generateWorld({ ...input, me: { seed: 77, slot: 0 } });
    const home = (d: ReturnType<typeof placeDecor>) => d.filter((q) => q.platform === "home").map((q) => [q.kind, q.x, q.z]);
    expect(home(placeDecor(other, buildTileMap(other)))).not.toEqual(home(decor));
  });

  it("keeps random decor away from paths and lets only roadside fences border roads", () => {
    for (const d of decor)
      for (const k of d.tiles) {
        expect([T.grass, T.tall, T.flowers]).toContain(m.kind[k]);
        const [i, j] = [k % m.w, Math.floor(k / m.w)];
        const roadside = d.kind === "fence" && d.tiles.every((t) => m.kind[t + m.w] === T.path);
        for (let dj = -1; dj <= 1; dj++)
          for (let di = -1; di <= 1; di++) {
            const t = m.kind[(j + dj) * m.w + i + di];
            expect(t === T.bridge || (t === T.path && !roadside), `${d.kind} at ${d.x},${d.z}`).toBe(false);
          }
      }
  });

  it("keeps activity spots clear", () => {
    for (const p of world.platforms.filter((q) => q.spots))
      for (const s of Object.values(p.spots!))
        for (const d of decor.filter((q) => q.tiles.length)) expect(Math.abs(d.x - s.x) < 3 && Math.abs(d.z - s.z) < 3).toBe(false);
  });

  it("never cuts a route: every walkable tile stays reachable", () => {
    const blocked = new Set(decor.flatMap((d) => d.tiles));
    const plaza = world.platforms.find((p) => p.kind === "plaza")!;
    const start = (Math.floor(plaza.z) - m.oz) * m.w + Math.floor(plaza.x) - m.ox;
    const before = reach(m, new Set(), start);
    const after = reach(m, blocked, start);
    expect(after.size).toBe(before.size - [...blocked].filter((k) => before.has(k)).length);
  });

  it("respects the scene's reserved places", () => {
    const home = world.platforms.find((p) => p.kind === "home")!;
    const near = (x: number, z: number) => Math.abs(x - home.x) < 20 && Math.abs(z - home.z) < 20;
    expect(placeDecor(world, m, near).some((d) => d.platform === "home")).toBe(false);
  });

  it("adds roadside fences without cutting ground or bridge routes over 20 seeds", () => {
    let checked = 0;
    for (let seed = 0; seed < 20; seed++) {
      const wd = generateWorld({ ...input, me: { seed, slot: 0 }, others: input.others!.map((o, n) => ({ ...o, seed: seed * 31 + n + 1 })) });
      const map = buildTileMap(wd);
      const pieces = placeDecor(wd, map);
      const blocked = new Set(pieces.flatMap((d) => d.tiles));
      expect(placeDecor(wd, map)).toEqual(pieces);
      for (const p of wd.platforms.filter((q) => q.ground)) {
        const g = p.ground!;
        const [ox, oz] = groundOrigin(p);
        const index = (i: number, j: number) => (oz + j - map.oz) * map.w + ox + i - map.ox;
        const land = new Set<number>();
        let hasRun = false;
        for (let j = 0; j < g.h; j++) {
          let run = 0;
          for (let i = 0; i < g.w; i++) {
            if (g.land[j * g.w + i] && map.kind[index(i, j)] !== T.pool) land.add(index(i, j));
            run = map.kind[index(i, j)] === T.path ? run + 1 : 0;
            if (run >= 6) hasRun = true;
          }
        }
        const fences = pieces.filter((d) => d.platform === p.id && d.kind === "fence" && d.tiles.every((t) => map.kind[t + map.w] === T.path));
        if (hasRun) {
          expect(fences.length, `seed ${seed}, ${p.id}`).toBeGreaterThan(0);
          checked++;
        }
        for (const f of fences) {
          expect(f.tiles.length).toBeGreaterThanOrEqual(3);
          expect(f.tiles.length).toBeLessThanOrEqual(6);
          for (const [n, tile] of f.tiles.entries()) {
            expect(tile).toBe(f.tiles[0]! + n);
            expect(Math.floor(tile / map.w)).toBe(Math.floor(f.tiles[0]! / map.w));
            for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
              const k = map.kind[tile + dj * map.w + di];
              expect(k).not.toBe(T.bridge);
              if (dj === -1 || dj === 0) expect(k).not.toBe(T.path);
            }
            for (const gate of Object.values(g.gates)) {
              const k = index(gate.i, gate.j);
              expect(Math.abs(tile % map.w - k % map.w) <= 2 && Math.abs(Math.floor(tile / map.w) - Math.floor(k / map.w)) <= 2).toBe(false);
            }
          }
          for (const other of fences.filter((q) => q !== f && Math.floor(q.tiles[0]! / map.w) === Math.floor(f.tiles[0]! / map.w))) {
            expect(Math.min(...f.tiles.flatMap((a) => other.tiles.map((b) => Math.abs(a - b)))) - 1).toBeGreaterThanOrEqual(2);
          }
        }
        // Restrict the flood to this ground, so another island cannot hide a severed route.
        const from = index(Math.floor(p.x - ox), Math.floor(p.z - oz));
        const seen = reach(map, blocked, from, land);
        expect(seen.size, `all land: seed ${seed}, ${p.id}`).toBe(land.size - [...blocked].filter((t) => land.has(t)).length);
        for (const b of wd.bridges) {
          if (b.a !== p.id && b.b !== p.id) continue;
          const [x, z] = b.a === p.id ? [b.ax, b.az] : [b.bx, b.bz];
          expect(seen.has(index(Math.floor(x - ox), Math.floor(z - oz))), `bridge: seed ${seed}, ${p.id}`).toBe(true);
        }
      }
    }
    expect(checked).toBe(80);
  });

  it("keeps roadside fences and their detours out of reserved tiles", () => {
    const fence = decor.find((d) => d.kind === "fence" && d.tiles.every((t) => m.kind[t + m.w] === T.path))!;
    expect(fence).toBeDefined();
    const reserved = (x: number, z: number) => Math.abs(x - fence.x) < 1 && Math.abs(z - fence.z) < 1;
    for (const d of placeDecor(world, m, reserved)) for (const tile of d.tiles) {
      const x = m.ox + tile % m.w + 0.5;
      const z = m.oz + Math.floor(tile / m.w) + 0.5;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) expect(reserved(x + dx, z + dz)).toBe(false);
    }
  });

  it("hangs party lights on picnic hill", () => {
    let hills = 0;
    for (let day = 0; day < 20; day++) {
      const wd = generateWorld({ ...input, others: [...input.others!, ...[4, 5, 6, 7].map((slot) => ({ id: `n${slot}`, name: "N", seed: slot, slot }))], day });
      const picnic = wd.platforms.filter((p) => p.kind === "picnic");
      if (!picnic.length) continue;
      hills++;
      const lights = placeDecor(wd, buildTileMap(wd)).filter((d) => d.kind === "lights");
      expect(lights.length).toBe(picnic.length);
      expect(lights.every((l) => l.tiles.length === 0)).toBe(true);
    }
    expect(hills).toBeGreaterThan(0); // no picnic hill in 20 days would be a layout bug
  });

  it("grows deterministic forest clumps while preserving shore, road and yard clearances", () => {
    for (let seed = 0; seed < 20; seed++) {
      const wd = generateWorld({ ...input, me: { seed, slot: 0 } });
      const map = buildTileMap(wd);
      const home = wd.platforms.find((p) => p.kind === "home")!;
      const make = () => Object.assign(Object.create(Overworld.prototype), {
        world: wd, map, trees: [] as { x: number; z: number }[], treeTiles: new Set<number>(),
        house: { x: home.x, z: home.z - 2.5 },
        houses: wd.platforms.filter((p) => p.kind === "ground").map((p) => ({ x: p.x, z: p.z - 2.5 })), allBeds: [],
        beds: Array.from({ length: 6 }, (_, i) => ({ x: home.x + 5 + i % 3, z: home.z - 4 + Math.floor(i / 3) * 2 })),
        landmarks: [], noticeBoard: null, stall: null,
      }) as { placeTrees(): void; trees: { x: number; z: number }[]; treeTiles: Set<number> };
      const scene = make();
      scene.placeTrees();
      const repeat = make();
      repeat.placeTrees();
      expect(repeat.trees).toEqual(scene.trees);
      expect(scene.treeTiles.size).toBe(scene.trees.length);
      for (const p of wd.platforms.filter((q) => q.ground)) {
        const [ox, oz] = groundOrigin(p);
        const trees = scene.trees.filter((t) => {
          const [i, j] = [Math.floor(t.x - ox), Math.floor(t.z - oz)];
          return i >= 0 && j >= 0 && i < p.ground!.w && j < p.ground!.h && p.ground!.land[j * p.ground!.w + i] === 1;
        });
        expect(trees.length).toBeLessThanOrEqual(225);
        const remaining = new Set(trees);
        let clumps = 0;
        while (remaining.size) {
          const stack = [remaining.values().next().value!];
          remaining.delete(stack[0]!);
          let size = 0;
          while (stack.length) {
            const t = stack.pop()!;
            size++;
            for (const other of remaining) if (Math.max(Math.abs(t.x - other.x), Math.abs(t.z - other.z)) <= 4) {
              remaining.delete(other);
              stack.push(other);
            }
          }
          expect(size).toBeGreaterThanOrEqual(2); // cramped coasts cannot always fit five safely
          expect(size).toBeLessThanOrEqual(90);
          clumps++;
        }
        expect(clumps).toBeLessThanOrEqual(9);
        for (const t of trees) {
          const i = Math.floor(t.x - map.ox), j = Math.floor(t.z - map.oz);
          expect(Math.hypot((t.x - p.x) / 7.5, (t.z - p.z + 1) / 5)).toBeGreaterThanOrEqual(0.9);
          for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
            const k = map.kind[(j + dj) * map.w + i + di];
            expect(k === T.path || k === T.bridge).toBe(false);
          }
          for (const [di, dj] of [[-2, 0], [2, 0], [-1, 0], [1, 0], [0, -2], [-2, 1], [2, 1], [0, 1], [0, 2], [0, 3], [-2, 3], [2, 3]]) {
            expect([T.water, T.pool, T.bridge]).not.toContain(map.kind[(j + dj!) * map.w + i + di!]);
          }
          for (const other of trees.filter((q) => q !== t)) expect(Math.max(Math.abs(t.x - other.x), Math.abs(t.z - other.z))).toBeGreaterThanOrEqual(1.2);
        }
      }
      expect(scene.trees.length).toBeGreaterThan(0);
    }
  });

  it("fits denser tight clumps when a ground has room", () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = generateWorld({ me: { seed, slot: 0 } }).platforms.find((q) => q.ground)!;
      p.ground!.land.fill(1); // rectangular test ground without narrow corner cuts
      const wd = { platforms: [p], bridges: [] };
      const scene = Object.assign(Object.create(Overworld.prototype), {
        world: wd, map: buildTileMap(wd), trees: [] as { x: number; z: number }[], treeTiles: new Set<number>(),
        house: { x: 1000, z: 1000 }, houses: [], beds: [], allBeds: [], landmarks: [], noticeBoard: null, stall: null,
      }) as { placeTrees(): void; trees: { x: number; z: number }[] };
      scene.placeTrees();
      const remaining = new Set(scene.trees);
      let clumps = 0;
      while (remaining.size) {
        const stack = [remaining.values().next().value!];
        remaining.delete(stack[0]!);
        let size = 0;
        while (stack.length) {
          const t = stack.pop()!;
          size++;
          for (const other of remaining) if (Math.max(Math.abs(t.x - other.x), Math.abs(t.z - other.z)) <= 4) {
            remaining.delete(other);
            stack.push(other);
          }
        }
        expect(size, `seed ${seed}`).toBeGreaterThanOrEqual(2);
        expect(size).toBeLessThanOrEqual(90);
        clumps++;
      }
      expect(clumps, `seed ${seed}`).toBeGreaterThanOrEqual(1);
      expect(clumps).toBeLessThanOrEqual(9);
    }
  });
});
