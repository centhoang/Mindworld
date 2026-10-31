import { describe, expect, it } from "vitest";
import { generateWorld } from "../world/layout";
import { placeSeaLife } from "./sunny";
import { buildTileMap, T, tileAt, type TileMap } from "./tiles";

describe("seeded pack sea life", () => {
  for (const players of [1, 2, 6]) it(`places 2-4 boats and 3-6 ducks safely for ${players} players`, () => {
    const input = {
      me: { seed: 3, slot: 0 },
      others: Array.from({ length: players - 1 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, seed: i + 4, slot: i + 1 })),
      roomSeed: 2, day: 1,
    };
    const m = buildTileMap(generateWorld(input));
    const before = m.kind.slice();
    const life = placeSeaLife(m);
    // Independently generated client map, with its own buffers, agrees including phases and facing.
    expect(placeSeaLife(buildTileMap(generateWorld(input)))).toEqual(life);
    for (const [kind, min, max] of [["boat", 2, 4], ["duck", 3, 6]] as const) {
      const n = life.filter((p) => p.kind === kind).length;
      expect(n).toBeGreaterThanOrEqual(min);
      expect(n).toBeLessThanOrEqual(max);
    }
    for (const p of life) {
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        expect(tileAt(m, p.x + dx, p.z + dz)).toBe(T.water); // sea, never pond/land/bridge
      }
      expect(p.x).toBeGreaterThanOrEqual(m.ox + 2);
      expect(p.x).toBeLessThan(m.ox + m.w - 2);
      expect(p.z).toBeGreaterThanOrEqual(m.oz + 2);
      expect(p.z).toBeLessThan(m.oz + m.h - 2);
    }
    expect(m.kind).toEqual(before); // visual decoration never adds solid tiles
    const otherLook = { ...m, look: new Uint8Array(m.kind.length).fill(4) };
    expect(placeSeaLife(otherLook)).toEqual(life);
    expect(placeSeaLife({ ...m, ox: m.ox + 1 })).not.toEqual(life);
  });

  it("leaves maps without safe sea empty rather than using a bridge or pond", () => {
    for (const kind of [T.grass, T.bridge, T.pool]) {
      const m: TileMap = { w: 12, h: 12, ox: 0, oz: 0, kind: new Uint8Array(144).fill(kind), look: new Uint8Array(144) };
      expect(placeSeaLife(m)).toEqual([]);
    }
  });
});
