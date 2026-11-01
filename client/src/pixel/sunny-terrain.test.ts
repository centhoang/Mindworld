import { describe, expect, it } from "vitest";
import { railBlocks } from "./sunny-terrain";
import { T, type TileMap } from "./tiles";

// A bridge running east, three tiles deep (rows 1..3), columns 0..5.
function bridge(): TileMap {
  const [w, h] = [6, 5];
  const kind = new Uint8Array(w * h);
  for (let j = 1; j <= 3; j++) for (let i = 0; i < w; i++) kind[j * w + i] = T.bridge;
  return { w, h, ox: 0, oz: 0, kind } as unknown as TileMap;
}

describe("bridge rails", () => {
  it("keep a walker to the deck side of the outer rows, so routes take the middle lane", () => {
    const m = bridge();
    expect(railBlocks(m, 2.5, 1.1)).toBe(true);
    expect(railBlocks(m, 2.5, 3.9)).toBe(true);
    expect(railBlocks(m, 2.5, 1.5)).toBe(true);
    expect(railBlocks(m, 2.5, 1.7)).toBe(false);
    expect(railBlocks(m, 2.5, 2.1)).toBe(false);
    expect(railBlocks(m, 2.5, 3.4)).toBe(false);
    expect(railBlocks(m, 2.5, 3.5)).toBe(true);
    expect(railBlocks(m, 2.5, 0.5)).toBe(false); // off the bridge
  });
});
