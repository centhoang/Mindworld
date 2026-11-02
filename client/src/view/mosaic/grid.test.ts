import { describe, expect, it } from "vitest";
import { CellGrid, CLEAR, KEEP, NO_EDGE } from "./grid";
import { glide } from "./mosaic-view";

const noPaint = () => {};

describe("glide", () => {
  it("moves part of the way, lands exactly, and snaps across a door", () => {
    const mid = glide(10, 11, 1 / 60);
    expect(mid).toBeGreaterThan(10);
    expect(mid).toBeLessThan(10.5);
    let at = 10;
    for (let i = 0; i < 60; i++) at = glide(at, 11, 1 / 60);
    expect(at).toBe(11);
    expect(glide(10, 40, 1 / 60)).toBe(40);
  });
});

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
    expect(seen).toEqual([[2, 1, "@", 0xffffff, 0x112233, NO_EDGE, NO_EDGE, NO_EDGE]]);
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

  const edges = (g: CellGrid) => {
    const seen = new Map<string, [number, number, number]>();
    g.flush((x, y, _c, _i, _b, right, bottom, corner) => seen.set(`${x},${y}`, [right, bottom, corner]));
    return seen;
  };

  it("draws the outline of the one in front where two shapes meet, and none inside a shape", () => {
    const g = new CellGrid(3, 1);
    g.fresh(0x111111);
    g.put(0, 0, " ", 0, 1);
    g.put(1, 0, " ", 0, 1);
    g.fresh(0x222222);
    g.put(2, 0, " ", 0, 2);
    const seen = edges(g);
    expect(seen.get("0,0")![0]).toBe(NO_EDGE);
    expect(seen.get("1,0")![0]).toBe(0x222222);
  });

  it("closes the corner when the line turns on the neighbours' sides", () => {
    const g = new CellGrid(2, 2);
    g.fresh(0x111111);
    g.put(0, 0, " ", 0, 1);
    g.fresh(0x222222);
    g.put(1, 1, " ", 0, 2);
    const seen = edges(g);
    expect(seen.get("0,0")![0]).toBe(0x111111);
    expect(seen.get("0,0")![2]).not.toBe(NO_EDGE);
  });

  it("gives smoke no outline: a pen of 0 owns nothing", () => {
    const g = new CellGrid(2, 1);
    g.pen(0, NO_EDGE);
    g.put(0, 0, "o", 1);
    expect(edges(g).get("0,0")![0]).toBe(NO_EDGE);
  });

  it("a cleared layer holds only its shapes, and a covered cell comes off it", () => {
    const g = new CellGrid(2, 1);
    g.clear();
    g.fresh(0x111111);
    g.put(0, 0, " ", 0, 5);
    expect(g.background(1, 0)).toBe(CLEAR);
    expect(edges(g).get("0,0")![0]).toBe(0x111111);
    g.erase(0, 0);
    expect(g.background(0, 0)).toBe(CLEAR);
    expect(edges(g).get("0,0")![0]).toBe(NO_EDGE);
  });
});
