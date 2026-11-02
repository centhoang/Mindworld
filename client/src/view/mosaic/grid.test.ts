import { describe, expect, it } from "vitest";
import { CellGrid, KEEP } from "./grid";

const noPaint = () => {};

describe("CellGrid", () => {
  it("paints every cell once, then nothing while the frame is the same", () => {
    const g = new CellGrid(4, 3);
    expect(g.flush(noPaint)).toBe(12);
    expect(g.flush(noPaint)).toBe(0);
  });

  it("paints only the cells that changed", () => {
    const g = new CellGrid(4, 3);
    g.flush(noPaint);
    g.put(2, 1, "@", 0xffffff, 0x112233);
    const seen: unknown[] = [];
    expect(g.flush((...cell) => seen.push(cell))).toBe(1);
    expect(seen).toEqual([[2, 1, "@", 0xffffff, 0x112233]]);
  });

  it("does not paint a cell written back to the value shown", () => {
    const g = new CellGrid(2, 2);
    g.put(0, 0, "a", 1, 2);
    g.flush(noPaint);
    g.put(0, 0, "b", 1, 2);
    g.put(0, 0, "a", 1, 2);
    expect(g.flush(noPaint)).toBe(0);
  });

  it("keeps the background under a character, and ignores cells off the plane", () => {
    const g = new CellGrid(2, 2);
    g.put(0, 0, " ", 0, 0x123456);
    g.put(0, 0, "x", 9, KEEP);
    g.put(5, 5, "x", 9, 9);
    expect(g.background(0, 0)).toBe(0x123456);
  });
});
