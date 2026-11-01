import { expect, it } from "vitest";
import { generateWorld, groundOrigin, type WorldMap } from "../world/layout";
import { placeDecor, type DecorPiece } from "./grounds-decor";
import { Overworld } from "./overworld";
import { buildTileMap, T, type TileMap } from "./tiles";

type Scene = { placeTrees(): void; placeDecor(): void; trees: { x: number; z: number }[]; treeTiles: Set<number>; decor: DecorPiece[]; map: TileMap };
function sceneFor(world: WorldMap): Scene {
  const home = world.platforms.find((p) => p.kind === "home")!;
  const grounds = world.platforms.filter((p) => p.ground);
  const beds = grounds.flatMap((p) => Array.from({ length: 6 }, (_, i) => ({ x: Math.floor(p.x) + 5 + i % 3, z: Math.floor(p.z) - 4 + Math.floor(i / 3) * 2 })));
  return Object.assign(Object.create(Overworld.prototype), {
    world, map: buildTileMap(world), trees: [], treeTiles: new Set<number>(), decorTiles: new Set<number>(),
    house: { x: home.x, z: home.z - 2.5 }, houses: grounds.filter((p) => p !== home).map((p) => ({ x: p.x, z: p.z - 2.5 })),
    beds, allBeds: beds, landmarks: world.platforms.filter((p) => p.kind === "npc").map((p) => ({ x: p.x, z: p.z - 3.5 })),
    noticeBoard: null, stall: null, signs: [],
  }) as Scene;
}

it("dresses real forested grounds with seeded features and keeps every route connected", () => {
  let fields = 0, mills = 0, elders = 0, details = 0, trees = 0;
  for (let seed = 0; seed < 40; seed++) {
    const world = generateWorld({ me: { seed, slot: 0 }, roomSeed: 2, day: 1 });
    const home = world.platforms.find((p) => p.ground)!;
    const scene = sceneFor(world);
    scene.placeTrees();
    const before = scene.map.kind.slice();
    scene.placeDecor();
    const pieces = scene.decor.filter((d) => d.platform === home.id);
    fields += Number(pieces.some((d) => d.soil));
    mills += Number(pieces.some((d) => d.kind === "windmill"));
    elders += Number(scene.decor.some((d) => d.kind === "windmill" && world.platforms.find((p) => p.id === d.platform)?.kind === "npc"));
    details += pieces.filter((d) => !d.field).length;
    trees += scene.trees.filter((t) => Math.abs(t.x - home.x) < 18 && Math.abs(t.z - home.z) < 14).length;
    const repeat = sceneFor(world);
    repeat.placeTrees(); repeat.placeDecor();
    expect(repeat.decor).toEqual(scene.decor);
    expect(repeat.map.kind).toEqual(scene.map.kind);
    for (const t of scene.trees) expect(scene.trees.some((u) => u !== t && Math.max(Math.abs(t.x - u.x), Math.abs(t.z - u.z)) <= 4)).toBe(true);
    const m = scene.map, solids = new Set(scene.decor.flatMap((d) => d.tiles));
    const blocked = new Set([...scene.treeTiles, ...solids]);
    for (const d of pieces) {
      for (const gate of Object.values(home.ground!.gates)) {
        const [ox, oz] = groundOrigin(home);
        expect(Math.abs(d.x - (ox + gate.i + 0.5)) <= 2 && Math.abs(d.z - (oz + gate.j + 0.5)) <= 2).toBe(false);
      }
      for (const k of d.soil ?? []) { expect([T.grass, T.tall, T.flowers]).toContain(before[k]); expect(m.kind[k]).toBe(T.path); }
      if (d.kind.startsWith("crop-")) expect(d.tiles).toEqual([]);
      if (d.soil) {
        const xs = d.soil.map((k) => k % m.w), zs = d.soil.map((k) => Math.floor(k / m.w));
        const width = Math.max(...xs) - Math.min(...xs) + 1, height = Math.max(...zs) - Math.min(...zs) + 1;
        expect(width).toBeGreaterThanOrEqual(5); expect(width).toBeLessThanOrEqual(7);
        expect(height).toBeGreaterThanOrEqual(3); expect(height).toBeLessThanOrEqual(4);
        expect(d.soil.length).toBe(width * height);
        const fences = pieces.filter((p) => p.field && p.kind === "fence");
        expect(fences).toHaveLength(2);
        expect(fences.map((p) => p.tiles.length)).toEqual([width, width]);
        expect(pieces.filter((p) => p.kind.startsWith("crop-"))).toHaveLength(width * height);
      }
    }
    const start = (Math.floor(home.z) - m.oz) * m.w + Math.floor(home.x) - m.ox;
    const flood = (obstacles: Set<number>) => {
      const seen = new Set([start]), stack = [start];
      while (stack.length) {
        const k = stack.pop()!, i = k % m.w, j = Math.floor(k / m.w);
        for (const [x, z] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]]) {
          const n = z! * m.w + x!;
          if (x! >= 0 && z! >= 0 && x! < m.w && z! < m.h && !seen.has(n) && !obstacles.has(n) && ![T.water, T.pool, T.ledge].includes(m.kind[n] as 0)) {
            seen.add(n); stack.push(n);
          }
        }
      }
      return seen;
    };
    const beforeDecor = flood(scene.treeTiles), seen = flood(blocked);
    expect(seen.size, `seed ${seed}, no severed routes`).toBe(beforeDecor.size - [...solids].filter((k) => beforeDecor.has(k)).length);
    for (const p of world.platforms) {
      const k = (Math.floor(p.z) - m.oz) * m.w + Math.floor(p.x) - m.ox;
      expect(seen.has(k), `seed ${seed}, route to ${p.id}`).toBe(true);
    }
  }
  expect(fields).toBeGreaterThanOrEqual(10);
  expect(fields).toBeLessThanOrEqual(28);
  expect(mills).toBeGreaterThanOrEqual(10);
  expect(mills).toBeLessThanOrEqual(28);
  expect(elders).toBe(40);
  expect(details / 40).toBeGreaterThanOrEqual(55);
  expect(trees / 40).toBeGreaterThanOrEqual(28);
}, 30_000);

it("keeps the pure placer independent of owner identity and away flags", () => {
  const input = { me: { seed: 3, slot: 0 }, others: [{ id: "b", name: "B", seed: 19, slot: 1 }] };
  const world = generateWorld(input), map = buildTileMap(world);
  const pieces = placeDecor(world, map);
  const kind = map.kind.slice();
  expect(placeDecor(world, map)).toEqual(pieces);
  expect(map.kind).toEqual(kind);
  for (const p of world.platforms) { p.away = true; p.owner = "other"; }
  expect(placeDecor(world, buildTileMap(world))).toEqual(pieces);
});

it("keeps the Elder's mill on clear grass as multiplayer bridges change", () => {
  for (const players of [1, 2, 4, 8, 12]) {
    const world = generateWorld({ me: { seed: 9, slot: 0 }, others: Array.from({ length: players - 1 }, (_, i) => ({ id: `p${i}`, name: "P", seed: i * 31 + 1, slot: i + 1 })) });
    const scene = sceneFor(world);
    scene.placeTrees(); scene.placeDecor();
    const mills = scene.decor.filter((d) => d.kind === "windmill" && world.platforms.find((p) => p.id === d.platform)?.kind === "npc");
    expect(mills, `${players} players`).toHaveLength(1);
    expect(mills[0]!.tiles.every((k) => [T.grass, T.tall, T.flowers].includes(scene.map.kind[k] as 1))).toBe(true);
  }
}, 30_000);
