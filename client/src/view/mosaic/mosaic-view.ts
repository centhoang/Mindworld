// The game's view: planes of cells on their own canvases. Between updates nothing is painted; on an update only changed
// cells are. The world plane slides under the frame while the camera moves, you ride on your own plane so you glide
// instead of hopping a cell at a time, and panels stay fixed on top. At rest all three sit on the same grid.
import type { BubbleFate, Scene, SceneBattle, View } from "../../game/ports";
import { CELL, cell } from "../glyph/atlas";
import { composeBattle } from "./battle";
import { CELLS_PER_TILE, compose, iris } from "./compose";
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

// One axis of the view, in cells. While you walk both ends chase your real position, not a whole cell, so nothing moves
// in bursts and neither ever steps back. The distance between them is what the eye sees: it holds still to the pixel
// unless it really changed. At rest both land on whole cells.
class Follow {
  cam: number | null = null;
  me = 0;
  gap = 0; // pixels from the view's edge to you
  private lastCam = 0;
  private lastMe = 0;

  private chase(from: number, to: number, last: number, moving: boolean, dt: number): number {
    const next = glide(from, moving ? to : Math.round(to), dt);
    if (Math.abs(to - last) > JUMP) return next;
    return to > last ? Math.max(from, next) : to < last ? Math.min(from, next) : next;
  }

  step(cam: number, me: number, moving: boolean, dt: number): void {
    if (this.cam === null) [this.cam, this.me] = [Math.round(cam), Math.round(me)];
    else [this.cam, this.me] = [this.chase(this.cam, cam, this.lastCam, moving, dt), this.chase(this.me, me, this.lastMe, moving, dt)];
    const exact = (this.me - this.cam) * CELL, want = Math.round(exact);
    const hold = Math.abs(exact - this.gap) < 1 || (want - this.gap) * (me - this.lastMe) < 0;
    [this.lastCam, this.lastMe] = [cam, me];
    this.gap = moving && hold ? this.gap : want;
  }
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
  wipe = 0;
  grout = true;
  private shownGrout = true;
  private world = new Plane(false, () => this.grout);
  private mine = new Plane(true, () => this.grout);
  private top = new Plane(true, () => this.grout);
  private last = "";
  private lastT = 0;
  private x = new Follow(); // the top-left cell of the view and you, between whole cells while they move
  private y = new Follow();
  private drawnMe = { x: 0, y: 0 }; // the cell you were last composed at: your plane moves on from there
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
    const you = scene.people.find((p) => p.kind === "me");
    const moving = you?.walking ?? false;
    this.x.step(scene.cam.x * CELLS_PER_TILE - (cols >> 1), (you?.x ?? 0) * CELLS_PER_TILE, moving, dt);
    this.y.step(scene.cam.z * CELLS_PER_TILE - (rows >> 1), (you?.z ?? 0) * CELLS_PER_TILE, moving, dt);
    const camX = Math.floor(this.x.cam!), camY = Math.floor(this.y.cam!);
    const key = `${Math.floor(t * TICK)},${camX},${camY},${this.wipe}`;
    if (key !== this.last) {
      this.last = key;
      this.mine.grid.clear();
      this.top.grid.clear();
      this.fates = compose(scene, this.world.grid, t, { me: this.mine.grid, top: this.top.grid, camX, camY });
      this.drawnMe = { x: Math.round((you?.x ?? 0) * CELLS_PER_TILE), y: Math.round((you?.z ?? 0) * CELLS_PER_TILE) };
      if (this.wipe > 0) iris(this.top.grid, this.wipe);
      this.painted = this.world.flush() + this.mine.flush() + this.top.flush();
    }
    g.drawImage(this.world.canvas, -Math.round((this.x.cam! - camX) * CELL), -Math.round((this.y.cam! - camY) * CELL));
    g.drawImage(this.mine.canvas, this.x.gap - (this.drawnMe.x - camX) * CELL, this.y.gap - (this.drawnMe.y - camY) * CELL);
    g.drawImage(this.top.canvas, 0, 0);
    return this.fates;
  }

  battle(b: SceneBattle, g: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    this.planes(Math.ceil(w / CELL), Math.ceil(h / CELL));
    this.x.cam = this.y.cam = null; // back in the village, the view starts where it stands
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
