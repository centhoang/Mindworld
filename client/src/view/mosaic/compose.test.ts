import { describe, expect, it } from "vitest";
import type { Scene, ScenePerson } from "../../game/ports";
import { T, type TileMap } from "../../world/tilemap";
import { C, compose, nightStep } from "./compose";
import { CellGrid } from "./grid";

const map: TileMap = { w: 40, h: 30, ox: 0, oz: 0, kind: new Uint8Array(1200).fill(T.grass), look: new Uint8Array(1200) };
const person = (over: Partial<ScenePerson> = {}): ScenePerson => ({ id: "me", name: "Kai", kind: "me", x: 20, z: 15, dir: 0, walking: false, pose: null, look: { hair: "spikeyhair", tool: "hands" }, ...over });
const scene = (over: Partial<Scene> = {}): Scene => ({
  map, cam: { x: 20, z: 15 }, indoors: false, clock: { day: 0, hour: 12, phase: "noon" as Scene["clock"]["phase"], label: "Mon 12:00" }, day: false,
  showNames: true, showMap: false, people: [person()], pets: [], props: [], beds: [], bubbles: [], hint: null, banner: null, inspector: null, panels: [], ...over,
});
const collect = (grid: CellGrid) => {
  const cells: string[] = [];
  grid.flush((x, y, ch) => cells.push(`${x},${y}:${ch}`));
  return cells;
};
const screenText = (grid: CellGrid) => {
  const rows = Array.from({ length: grid.rows }, () => Array(grid.cols).fill(" "));
  // A fresh plane shows nothing, so the first flush names every cell.
  grid.flush((x, y, ch) => { rows[y]![x] = ch; });
  return rows.map((r) => r.join("")).join("\n");
};

describe("compose", () => {
  it("paints a few cells when one person takes one step", () => {
    const grid = new CellGrid(80, 45);
    compose(scene(), grid, 1);
    collect(grid);
    compose(scene({ people: [person({ x: 20 + 1 / 3 })] }), grid, 1);
    const changed = collect(grid).length;
    expect(changed).toBeGreaterThan(0);
    expect(changed).toBeLessThan(80);
  });

  it("paints nothing when nothing changed", () => {
    const grid = new CellGrid(80, 45);
    compose(scene(), grid, 1);
    collect(grid);
    compose(scene(), grid, 1);
    expect(collect(grid)).toEqual([]);
  });

  it("writes names and panels as characters on the plane", () => {
    const grid = new CellGrid(80, 45);
    compose(scene({ panels: [{ place: "corner", title: "Town board", rows: [{ label: "Corn 5c" }] }] }), grid, 1);
    const text = screenText(grid);
    expect(text).toContain("Kai");
    expect(text).toContain("Town board");
    expect(text).toContain("Corn 5c");
    expect(text).toContain("Mon 12:00");
  });

  it("shows a bubble's text and reports it not held", () => {
    const grid = new CellGrid(80, 45);
    const fates = compose(scene({ bubbles: [{ id: "me", x: 20, z: 15, head: "", text: "hello there", thought: false, first: true }] }), grid, 1);
    expect(fates).toEqual([["me", false]]);
    expect(screenText(grid)).toContain("hello there");
  });

  it("keeps a bubble on the plane for someone at the top edge", () => {
    const grid = new CellGrid(40, 20);
    compose(scene({ cam: { x: 20, z: 18 }, bubbles: [{ id: "me", x: 20, z: 15, head: "", text: "up here", thought: false, first: true }] }), grid, 1);
    expect(screenText(grid)).toContain("up here");
  });

  it("puts the person lower on screen in front", () => {
    const grid = new CellGrid(80, 45);
    const a = person({ id: "a", name: "A", kind: "npc", look: { hair: "mophair", tool: "hands" } });
    const b = person({ id: "b", name: "B", kind: "npc", z: 15 + 1 / 3, look: { hair: "spikeyhair", tool: "hands" } });
    compose(scene({ people: [b, a] }), grid, 1);
    const front = new CellGrid(80, 45);
    compose(scene({ people: [a, b] }), front, 1);
    expect(screenText(grid)).toEqual(screenText(front));
  });

  it("darkens the night in steps and keeps windows lit", () => {
    expect(nightStep(12)).toBe(0);
    expect(nightStep(23)).toBe(8);
    expect(nightStep(18.5)).toBeGreaterThan(0);
    const grid = new CellGrid(80, 45);
    compose(scene({ clock: { ...scene().clock, hour: 23 }, props: [{ kind: "home", x: 20, z: 10 }] }), grid, 1);
    const colours = new Set<number>();
    grid.flush((_x, _y, _c, _i, bg) => colours.add(bg));
    expect(colours.has(C.glow)).toBe(true);
    expect(colours.has(C.grass)).toBe(false);
  });
});
