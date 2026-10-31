import { describe, expect, it } from "vitest";
import { generateWorld, type LayoutInput } from "../world/layout";
import { placeDecor } from "./grounds-decor";
import { buildTileMap, T, type TileMap } from "./tiles";

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
function reach(m: TileMap, blocked: Set<number>, from: number): Set<number> {
  const seen = new Set<number>([from]);
  const stack = [from];
  while (stack.length) {
    const k = stack.pop()!;
    const [i, j] = [k % m.w, Math.floor(k / m.w)];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const [a, b] = [i + di, j + dj];
      const n = b * m.w + a;
      if (a < 0 || b < 0 || a >= m.w || b >= m.h || seen.has(n) || blocked.has(n) || m.kind[n] === T.water) continue;
      seen.add(n);
      stack.push(n);
    }
  }
  return seen;
}

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

  it("never stands on or next to paths and bridges", () => {
    for (const d of decor)
      for (const k of d.tiles) {
        const [i, j] = [k % m.w, Math.floor(k / m.w)];
        for (let dj = -1; dj <= 1; dj++)
          for (let di = -1; di <= 1; di++) {
            const t = m.kind[(j + dj) * m.w + i + di];
            expect(t === T.path || t === T.bridge, `${d.kind} at ${d.x},${d.z}`).toBe(false);
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
});
