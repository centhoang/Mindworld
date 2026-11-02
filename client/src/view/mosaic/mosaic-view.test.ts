import { describe, expect, it, vi } from "vitest";
import type { Scene } from "../../game/ports";
import { HUMAN_RUN_SPEED, HUMAN_WALK_SPEED } from "../../pixel/humans";
import { T, type TileMap } from "../../world/tilemap";
import { CELL } from "../glyph/atlas";
import { CLEAR, type CellGrid } from "./grid";
import { MosaicView } from "./mosaic-view";

// The view paints canvases; these do nothing, and the drawImage calls say where each plane landed.
const noop = () => undefined;
const quiet = new Proxy({}, { get: (_, k) => (k === "measureText" ? () => ({ width: 6 }) : noop), set: () => true });
vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => quiet }) });

const map: TileMap = { w: 200, h: 200, ox: 0, oz: 0, kind: new Uint8Array(40000).fill(T.grass), look: new Uint8Array(40000) };
const scene = (x: number, z: number, cam: { x: number; z: number }, walking: boolean): Scene => ({
  map, cam, indoors: false, clock: { day: 0, hour: 12, phase: "noon" as Scene["clock"]["phase"], label: "Mon 12:00" }, day: true,
  showNames: false, showMap: false, pets: [], props: [], beds: [], bubbles: [], hint: null, banner: null, inspector: null, panels: [],
  people: [{ id: "me", name: "Kai", kind: "me", x, z, dir: 0, walking, pose: null, look: { hair: "spikeyhair", tool: "hands" } }],
});

// Your body's left edge in the plane, in cells.
const leftEdge = (grid: CellGrid) => {
  for (let x = 0; x < grid.cols; x++) for (let y = 0; y < grid.rows; y++) if (grid.background(x, y) !== CLEAR) return x;
  throw new Error("nobody on the plane");
};

// Hold one direction like the game does: the avatar walks, the scene's camera eases after it, and the view draws.
function hold(speed: number, frames: (i: number) => number, start = 50.1) {
  const view = new MosaicView();
  const drawn: { screen: number; ground: number }[] = [];
  const planes: [number, number][] = [];
  const g = { drawImage: (_: unknown, x: number, y: number) => planes.push([x, y]) } as unknown as CanvasRenderingContext2D;
  const mine = view as unknown as { mine: { grid: CellGrid } };
  let x = start, cam = x, t = 10, ground = 0, lastWorld = 0;
  const frame = (dt: number, walking: boolean) => {
    if (walking) x += speed * dt;
    cam += (x - cam) * (1 - Math.exp(-dt * 8));
    t += dt;
    planes.length = 0;
    view.draw(scene(x, 40, { x: cam, z: 40 }, walking), g, 640, 360, t);
    let scroll = planes[0]![0] - lastWorld;
    if (scroll > CELL / 2) scroll -= CELL;
    if (scroll < -CELL / 2) scroll += CELL;
    lastWorld = planes[0]![0];
    ground += scroll;
    const screen = leftEdge(mine.mine.grid) * CELL + planes[1]![0];
    drawn.push({ screen, ground: screen - ground });
  };
  for (let i = 0; i < 60; i++) frame(1 / 60, false);
  drawn.length = 0;
  for (let i = 0; i < 150; i++) frame(frames(i), true);
  const held = [...drawn];
  for (let i = 0; i < 120; i++) frame(1 / 60, false);
  return { held, planes: [...planes] };
}

const steps = (v: number[]) => v.slice(1).map((n, i) => n - v[i]!);
const even = () => 1 / 60;
const uneven = (i: number) => [1 / 60, 1 / 60, 1 / 90, 1 / 30, 1 / 60, 1 / 45][i % 6]!;

describe("holding one direction", () => {
  for (const [name, speed] of [["walking", HUMAN_WALK_SPEED], ["running", HUMAN_RUN_SPEED]] as const) {
    for (const [pace, frames] of [["even frames", even], ["uneven frames", uneven]] as const) {
      it(`${name} on ${pace}: you never step back, on screen or on the ground`, () => {
        for (const start of [50.1, 50.16, 50.17, 50.3]) {
          const { held } = hold(speed, frames, start);
          expect(Math.min(...steps(held.map((d) => d.ground)))).toBeGreaterThanOrEqual(0);
          expect(Math.min(...steps(held.map((d) => d.screen)))).toBeGreaterThanOrEqual(0);
        }
      });
    }
  }

  it("at rest all planes sit on one grid", () => {
    const { planes } = hold(HUMAN_RUN_SPEED, even);
    expect(planes.map(([x]) => Math.abs(x))).toEqual([0, 0, 0]);
  });
});
