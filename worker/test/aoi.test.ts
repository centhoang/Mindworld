import { describe, expect, it } from "vitest";
import { Batcher, CELL, CROWD, Grid, MARGIN } from "../src/aoi";

describe("Grid", () => {
  it("sees the 3 x 3 cells around a peer", () => {
    const g = new Grid();
    g.move("a", 1, 1);
    expect(g.move("b", CELL + 1, 1).entered).toEqual(["a"]);
    expect(g.move("c", CELL * 3, 1).entered).toEqual([]);
    expect(g.near("a")).toEqual(["b"]);
    expect(g.covers("a", CELL * 2 - 1, 0)).toBe(true);
    expect(g.covers("a", CELL * 2, 0)).toBe(false);
  });

  it("tells who comes into view and who drops out", () => {
    const g = new Grid();
    g.move("a", 1, 1);
    g.move("far", CELL * 3 + 1, 1);
    expect(g.move("a", CELL * 2 + MARGIN + 1, 1)).toEqual({ entered: ["far"], left: [], moved: true });
    g.move("b", CELL * 2 + 1, 1);
    expect(g.move("a", -CELL, 1).left).toEqual(expect.arrayContaining(["b", "far"]));
  });

  it("does not flicker on a border", () => {
    const g = new Grid();
    g.move("a", CELL - 1, 1);
    for (const x of [CELL + 1, CELL - 1, CELL + MARGIN - 1]) expect(g.move("a", x, 1).moved).toBe(false);
    expect(g.move("a", CELL + MARGIN + 1, 1).moved).toBe(true);
  });

  it("forgets a peer that left", () => {
    const g = new Grid();
    g.move("a", 1, 1);
    g.move("b", 1, 1);
    g.remove("b");
    expect(g.near("a")).toEqual([]);
  });

  it("works on the negative side of the map", () => {
    const g = new Grid();
    g.move("a", -1, -1);
    g.move("b", -CELL - 1, -1);
    expect(g.sees("a", "b")).toBe(true);
    expect(g.sameCell("a", "b")).toBe(false);
  });
});

describe("Batcher", () => {
  it("keeps only the newest per key", () => {
    const b = new Batcher<string>();
    b.add("p", "pos:a", "old");
    b.add("p", "pos:a", "new");
    b.add("p", "pos:b", "b");
    expect(b.take(0, () => false).get("p")).toEqual(["new", "b"]);
    expect(b.pending).toBe(false);
  });

  it("holds far entities back every other tick in a crowd", () => {
    const b = new Batcher<string>();
    for (let i = 0; i <= CROWD; i++) b.add("p", `pos:${i}`, `${i}`);
    expect(b.take(1, (_p, k) => k !== "pos:0").get("p")).toEqual(["0"]);
    expect(b.pending).toBe(true);
    expect(b.take(2, () => true).get("p")).toHaveLength(CROWD);
  });

  it("sends everything when it is not a crowd", () => {
    const b = new Batcher<string>();
    b.add("p", "pos:a", "a");
    expect(b.take(1, () => true).get("p")).toEqual(["a"]);
  });
});
