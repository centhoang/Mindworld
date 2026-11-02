import { describe, expect, it } from "vitest";
import { buildTileMap, T, tileAt, tileWalkable } from "./tilemap";
import { villageWorld } from "./village-map";

describe("tile map", () => {
  const world = villageWorld({ me: { seed: 3, slot: 0 }, others: [{ id: "a", name: "A", seed: 4, slot: 1 }], roomSeed: 2, day: 1 });
  const m = buildTileMap(world);

  it("puts land under every place", () => {
    for (const p of world.platforms) expect(tileAt(m, p.x, p.z)).not.toBe(T.water);
  });

  it("is deterministic", () => {
    expect(buildTileMap(world).kind).toEqual(m.kind);
  });

  it("open water is not walkable", () => {
    const i = m.kind.indexOf(T.water);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(tileWalkable(m, m.ox + (i % m.w) + 0.5, m.oz + Math.floor(i / m.w) + 0.5)).toBe(false);
  });
});
