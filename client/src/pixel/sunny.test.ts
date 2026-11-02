import { describe, expect, it, vi } from "vitest";
import { drawTree, loadSunny, placeSeaLife } from "./sunny";
import { drawDecor } from "./grounds-draw";
import { buildTileMap, T, tileAt, type TileMap } from "../world/tilemap";
import { bridgeLayers } from "./sunny-terrain";

describe("bridge underside", () => {
  it("puts a shadow and posts on the water south of a horizontal bridge, and nothing on land", () => {
    const kind = new Uint8Array(12 * 8).fill(T.water);
    for (let j = 1; j <= 3; j++) for (let i = 1; i <= 10; i++) kind[j * 12 + i] = T.bridge;
    for (const k of [6 * 12 + 1, 6 * 12 + 2]) kind[k] = T.grass;
    const m = { w: 12, h: 8, ox: 0, oz: 0, kind, look: new Uint8Array(96), high: new Uint8Array(96) } as unknown as TileMap;
    const { shadow, posts } = bridgeLayers(m);
    expect(shadow[4 * 12 + 5]).not.toBe(0);
    expect(shadow[2 * 12 + 5]).toBe(0);
    expect([...posts].filter(Boolean).length).toBeGreaterThan(0);
    expect(posts[6 * 12 + 1]).toBe(0);
  });
});
