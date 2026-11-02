// The game's view: a plane of cells on its own canvas. Between updates nothing is painted; on an update only changed
// cells are, and the plane goes to the frame whole.
import type { BubbleFate, Scene, SceneBattle, View } from "../../game/ports";
import { CELL, cell } from "../glyph/atlas";
import { composeBattle } from "./battle";
import { compose } from "./compose";
import { CellGrid } from "./grid";

const TICK = 24; // plane updates per second
const css = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

export class MosaicView implements View {
  private plane = document.createElement("canvas");
  private g = this.plane.getContext("2d", { alpha: false })!;
  private grid = new CellGrid(1, 1);
  private last = -1;
  private fates: BubbleFate[] = [];
  painted = 0;

  private paint = (x: number, y: number, ch: string, ink: number, bg: number): void => {
    cell(this.g, x, y, ch, css(ink), css(bg));
    this.g.fillStyle = "rgba(43,58,58,.08)";
    this.g.fillRect(x * CELL + CELL - 1, y * CELL, 1, CELL);
    this.g.fillRect(x * CELL, y * CELL + CELL - 1, CELL - 1, 1);
  };

  private frame(g: CanvasRenderingContext2D, w: number, h: number, t: number, build: () => void): void {
    const cols = Math.ceil(w / CELL), rows = Math.ceil(h / CELL), now = Math.floor(t * TICK);
    if (cols !== this.grid.cols || rows !== this.grid.rows) {
      this.grid = new CellGrid(cols, rows);
      this.plane.width = cols * CELL;
      this.plane.height = rows * CELL;
      this.last = -1;
    }
    if (now !== this.last) {
      this.last = now;
      build();
      this.painted = this.grid.flush(this.paint);
    }
    g.drawImage(this.plane, 0, 0);
  }

  draw(scene: Scene, g: CanvasRenderingContext2D, w: number, h: number, t: number): BubbleFate[] {
    this.frame(g, w, h, t, () => (this.fates = compose(scene, this.grid, t)));
    return this.fates;
  }

  battle(b: SceneBattle, g: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    this.frame(g, w, h, t, () => composeBattle(b, this.grid, t));
  }
}
