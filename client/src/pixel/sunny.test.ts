import { describe, expect, it, vi } from "vitest";
import { generateWorld } from "../world/layout";
import { drawTree, loadSunny, placeSeaLife } from "./sunny";
import { drawDecor } from "./grounds-draw";
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

it("draws four round trees per pine, native field crops, and advancing windmill frames", async () => {
  class PackImage {
    onload?: () => void;
    width = 16; height = 16; complete = true; naturalWidth = 16;
    private path = "";
    get src() { return this.path; }
    set src(value: string) {
      this.path = value;
      if (value.includes("tree_")) { this.width = 128; this.height = 34; }
      if (value.includes("windmill")) { this.width = 1008; this.height = 112; }
      queueMicrotask(() => this.onload?.());
    }
  }
  vi.stubGlobal("Image", PackImage);
  vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => ({ stamps: { pine: [28, 43] }, anims: [], clouds: [] }) })));
  const drawImage = vi.fn();
  const g = { drawImage, globalAlpha: 1 } as unknown as CanvasRenderingContext2D;
  const now = vi.spyOn(performance, "now");
  try {
    await loadSunny();
    for (let seed = 0; seed < 5; seed++) drawTree(g, seed, 40, 60, 0, 0);
    const sources = drawImage.mock.calls.map((c) => (c[0] as PackImage).src);
    expect(sources.filter((s) => s.endsWith("pine.png"))).toHaveLength(1);
    expect(sources.filter((s) => s.includes("tree_01"))).toHaveLength(4);
    expect(sources.filter((s) => s.includes("tree_02"))).toHaveLength(0);
    drawImage.mockClear();
    now.mockReturnValue(0);
    drawDecor(g, "windmill", 80, 120, 1, 0, false);
    now.mockReturnValue(120);
    drawDecor(g, "windmill", 80, 120, 1, 0, false);
    expect(drawImage.mock.calls.map((c) => c.slice(1))).toEqual([
      [0, 0, 112, 112, 24, 2, 112, 112], [112, 0, 112, 112, 24, 2, 112, 112],
    ]);
    drawImage.mockClear();
    drawDecor(g, "crop-wheat", 40, 60, 1, 0, false);
    expect((drawImage.mock.calls[0]![0] as PackImage).src).toContain("crop-wheat-4.png");
    drawImage.mockClear();
    drawDecor(g, "grass", 40, 60, 1, 0, false);
    expect(drawImage.mock.calls[0]!.slice(1)).toEqual([27 * 16, 2 * 16, 16, 16, 32, 44, 16, 16]);
  } finally {
    now.mockRestore(); vi.unstubAllGlobals();
  }
});
