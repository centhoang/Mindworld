import { describe, expect, it } from "vitest";
import { generateWorld } from "../world/layout";
import { buildTileMap, T, tileAt, tileWalkable } from "./tiles";

describe("tile map", () => {
  const world = generateWorld({ me: { seed: 3, slot: 0 }, others: [{ id: "a", name: "A", seed: 4, slot: 1 }], roomSeed: 2, day: 1 });
  const m = buildTileMap(world);

  it("covers every platform with a water margin", () => {
    for (const p of world.platforms) expect(tileAt(m, p.x, p.z)).not.toBe(T.water);
    expect(tileAt(m, m.ox + 0.5, m.oz + 0.5)).toBe(T.water);
  });

  it("is deterministic", () => {
    expect(buildTileMap(world).kind).toEqual(m.kind);
  });

  it("bridges are walkable end to end", () => {
    for (const b of world.bridges) {
      for (let s = 0; s <= 10; s++) {
        const x = b.ax + ((b.bx - b.ax) * s) / 10;
        const z = b.az + ((b.bz - b.az) * s) / 10;
        expect(tileWalkable(m, x, z), `${b.a}->${b.b} at ${s}`).toBe(true);
      }
    }
  });

  it("open water is not walkable", () => {
    const home = world.platforms.find((p) => p.kind === "home")!;
    // Halfway along a diagonal between two land cells there is only water.
    expect(tileWalkable(m, home.x + 15, home.z + 15)).toBe(false);
  });
});
