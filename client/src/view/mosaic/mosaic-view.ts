// The game's view: planes of cells on their own canvases. Between updates nothing is painted; on an update only changed
// cells are. The world plane slides under the frame while the camera moves, you ride on your own plane so you glide
// instead of hopping a cell at a time, and panels stay fixed on top. At rest all three sit on the same grid.
import type { BubbleFate, Scene, SceneBattle, View } from "../../game/ports";
import { CELL, cell } from "../glyph/atlas";
import { composeBattle } from "./battle";
import { CELLS_PER_TILE, compose } from "./compose";
import { CLEAR, CellGrid, NO_EDGE } from "./grid";

const TICK = 24; // plane updates per second
const GLIDE = 11; // how fast the view catches up, per second
const JUMP = 9; // cells: further than this is a door or a warp, not a walk
const css = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

// Moves toward a whole cell without overshooting, and lands exactly on it.
export function glide(from: number, to: number, dt: number): number {
  if (Math.abs(to - from) > JUMP) return to;
  const next = from + (to - from) * (1 - Math.exp(-dt * GLIDE));
  return Math.abs(to - next) < 0.02 ? to : next;
}

class Plane {
  readonly canvas = document.createElement("canvas");
  private g: CanvasRenderingContext2D;
  grid = new CellGrid(1, 1);

  constructor(alpha: boolean, private readonly grout: () => boolean) {
    this.g = this.canvas.getContext("2d", { alpha })!;
  }

  private paint = (x: number, y: number, ch: string, ink: number, bg: number, right: number, bottom: number, corner: number): void => {
    const g = this.g, px = x * CELL, py = y * CELL;
    if (bg === CLEAR) g.clearRect(px, py, CELL, CELL);
    cell(g, x, y, ch, css(ink), bg === CLEAR ? "transparent" : css(bg));
    if (bg !== CLEAR && this.grout()) {
      g.fillStyle = "rgba(43,58,58,.08)";
      g.fillRect(px + CELL - 1, py, 1, CELL);
      g.fillRect(px, py + CELL - 1, CELL - 1, 1);
    }
    if (right !== NO_EDGE) {
      g.fillStyle = css(right);
      g.fillRect(px + CELL - 1, py, 1, CELL);
    }
    if (bottom !== NO_EDGE) {
      g.fillStyle = css(bottom);
      g.fillRect(px, py + CELL - 1, CELL, 1);
    }
    if (corner !== NO_EDGE) {
      g.fillStyle = css(corner);
      g.fillRect(px + CELL - 1, py + CELL - 1, 1, 1);
    }
  };

  size(cols: number, rows: number): boolean {
    if (cols === this.grid.cols && rows === this.grid.rows) return false;
    this.grid = new CellGrid(cols, rows);
    this.canvas.width = cols * CELL;
    this.canvas.height = rows * CELL;
    return true;
  }

  flush(): number {
    return this.grid.flush(this.paint);
  }
}

export class MosaicView implements View {
  grout = true;
  private shownGrout = true;
  private world = new Plane(false, () => this.grout);
  private mine = new Plane(true, () => this.grout);
  private top = new Plane(true, () => this.grout);
  private last = "";
  private lastT = 0;
  private cam: { x: number; y: number } | null = null; // the top-left cell of the view, between whole cells while it moves
  private me: { x: number; y: number } | null = null;
  private fates: BubbleFate[] = [];
  painted = 0;

  private planes(cols: number, rows: number): void {
    const grew = [this.world.size(cols + 1, rows + 1), this.mine.size(cols + 1, rows + 1), this.top.size(cols, rows)];
    if (grew.some(Boolean)) this.last = "";
    if (this.grout !== this.shownGrout) {
      this.shownGrout = this.grout;
      for (const p of [this.world, this.mine, this.top]) p.grid.repaint();
      this.last = "";
    }
  }

  draw(scene: Scene, g: CanvasRenderingContext2D, w: number, h: number, t: number): BubbleFate[] {
    const cols = Math.ceil(w / CELL), rows = Math.ceil(h / CELL);
    this.planes(cols, rows);
    const dt = Math.max(0, Math.min(0.1, t - this.lastT));
    this.lastT = t;
    const toX = Math.round(scene.cam.x * CELLS_PER_TILE) - (cols >> 1), toY = Math.round(scene.cam.z * CELLS_PER_TILE) - (rows >> 1);
    this.cam = this.cam ? { x: glide(this.cam.x, toX, dt), y: glide(this.cam.y, toY, dt) } : { x: toX, y: toY };
    const you = scene.people.find((p) => p.kind === "me");
    const youX = you ? Math.round(you.x * CELLS_PER_TILE) : 0, youY = you ? Math.round(you.z * CELLS_PER_TILE) : 0;
    this.me = you && this.me ? { x: glide(this.me.x, youX, dt), y: glide(this.me.y, youY, dt) } : { x: youX, y: youY };
    const camX = Math.floor(this.cam.x), camY = Math.floor(this.cam.y);
    const key = `${Math.floor(t * TICK)},${camX},${camY}`;
    if (key !== this.last) {
      this.last = key;
      this.mine.grid.clear();
      this.top.grid.clear();
      this.fates = compose(scene, this.world.grid, t, { me: this.mine.grid, top: this.top.grid, camX, camY });
      this.painted = this.world.flush() + this.mine.flush() + this.top.flush();
    }
    const sx = -Math.round((this.cam.x - camX) * CELL), sy = -Math.round((this.cam.y - camY) * CELL);
    g.drawImage(this.world.canvas, sx, sy);
    g.drawImage(this.mine.canvas, sx + Math.round((this.me.x - youX) * CELL), sy + Math.round((this.me.y - youY) * CELL));
    g.drawImage(this.top.canvas, 0, 0);
    return this.fates;
  }

  battle(b: SceneBattle, g: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    this.planes(Math.ceil(w / CELL), Math.ceil(h / CELL));
    this.cam = null; // back in the village, the view starts where it stands
    const key = `battle${Math.floor(t * TICK)}`;
    if (key !== this.last) {
      this.last = key;
      this.top.grid.clear();
      composeBattle(b, this.top.grid, t);
      this.painted = this.top.flush();
    }
    g.drawImage(this.top.canvas, 0, 0);
  }
}
