// The whole screen is one plane of cells. A cell is a character, an ink and a background, and nothing else exists.
// Callers write the frame they want; flush() compares it with what is shown and paints only the cells that differ.
// Each cell also has an owner. Where two owners meet, the later one's outline runs along the grout between the cells.
export const KEEP = -1; // as a background: leave the cell's background, so a character can sit on the ground
export const CLEAR = -2; // a background on a layer: nothing here, the plane below shows
export const NO_EDGE = -1;
export type StyleCell = { ch: number; ink: number; bg: number };
export type Restyle = (c: StyleCell, x: number, y: number, bgAt: (x: number, y: number) => number) => void;
export type PaintCell = (x: number, y: number, ch: string, ink: number, bg: number, right: number, bottom: number, corner: number) => void;

const FIRST_ID = 32; // lower ids are the ground's fixed ranks

export class CellGrid {
  private ch: Uint16Array;
  private ink: Int32Array;
  private bg: Int32Array;
  private owner: Int32Array;
  private edge: Int32Array;
  private right: Int32Array;
  private bottom: Int32Array;
  private corner: Int32Array;
  private shownCh: Int32Array;
  private shownInk: Int32Array;
  private shownBg: Int32Array;
  private shownRight: Int32Array;
  private shownBottom: Int32Array;
  private shownCorner: Int32Array;
  private ids = FIRST_ID;
  penId = 0; // who is drawing now; 0 draws without owning, for smoke and sparks
  private penEdge = NO_EDGE;

  constructor(readonly cols: number, readonly rows: number) {
    const n = cols * rows;
    this.ch = new Uint16Array(n).fill(32);
    this.ink = new Int32Array(n);
    this.bg = new Int32Array(n);
    this.owner = new Int32Array(n);
    this.edge = new Int32Array(n).fill(NO_EDGE);
    this.right = new Int32Array(n);
    this.bottom = new Int32Array(n);
    this.corner = new Int32Array(n);
    this.shownCh = new Int32Array(n).fill(-1); // nothing shown yet, so the first flush paints every cell
    this.shownInk = new Int32Array(n);
    this.shownBg = new Int32Array(n);
    this.shownRight = new Int32Array(n);
    this.shownBottom = new Int32Array(n);
    this.shownCorner = new Int32Array(n);
  }

  // Blank the layer for a new frame.
  clear(): void {
    this.ch.fill(32);
    this.bg.fill(CLEAR);
    this.owner.fill(0);
    this.edge.fill(NO_EDGE);
    this.restart();
  }

  restart(): void {
    this.ids = FIRST_ID;
    this.penId = 0;
  }

  pen(id: number, edge: number): void {
    this.penId = id;
    this.penEdge = edge;
  }

  // A new thing starts: everything put until the next one is one shape, in front of what came before.
  fresh(edge: number): void {
    this.pen(++this.ids, edge);
  }

  // Paint every cell again on the next flush.
  repaint(): void {
    this.shownCh.fill(-1);
  }

  put(x: number, y: number, ch: string, ink: number, bg: number = KEEP): void {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
    const i = y * this.cols + x;
    this.ch[i] = ch.charCodeAt(0);
    this.ink[i] = ink;
    if (bg !== KEEP) this.bg[i] = bg;
    if (this.penId && (bg !== KEEP || ch !== " ")) {
      this.owner[i] = this.penId;
      this.edge[i] = this.penEdge;
    }
  }

  // Take a cell back off this layer, because something in front covers it.
  erase(x: number, y: number): void {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
    const i = y * this.cols + x;
    this.ch[i] = 32;
    this.bg[i] = CLEAR;
    this.owner[i] = 0;
  }

  background(x: number, y: number): number {
    return x < 0 || y < 0 || x >= this.cols || y >= this.rows ? 0 : this.bg[y * this.cols + x]!;
  }

  setBackground(x: number, y: number, bg: number): void {
    if (x >= 0 && y >= 0 && x < this.cols && y < this.rows) this.bg[y * this.cols + x] = bg;
  }

  recolour(f: (rgb: number) => number): void {
    for (let i = 0; i < this.bg.length; i++) {
      if (this.bg[i]! >= 0) this.bg[i] = f(this.bg[i]!);
      this.ink[i] = f(this.ink[i]!);
      if (this.edge[i]! >= 0) this.edge[i] = f(this.edge[i]!);
    }
  }

  // Rewrites every cell. bgAt reads the backgrounds as they were before this pass; off the plane it repeats the edge.
  restyle(f: Restyle): void {
    const before = this.bg.slice();
    const bgAt = (x: number, y: number) => before[Math.max(0, Math.min(this.rows - 1, y)) * this.cols + Math.max(0, Math.min(this.cols - 1, x))]!;
    const c: StyleCell = { ch: 0, ink: 0, bg: 0 };
    for (let i = 0; i < before.length; i++) {
      c.ch = this.ch[i]!;
      c.ink = this.ink[i]!;
      c.bg = before[i]!;
      f(c, i % this.cols, Math.floor(i / this.cols), bgAt);
      this.ch[i] = c.ch;
      this.ink[i] = c.ink;
      this.bg[i] = c.bg;
    }
  }

  // The line between two cells, in the colour of the one in front.
  private between(a: number, b: number): number {
    const p = this.owner[a]!, q = this.owner[b]!;
    return p === q ? NO_EDGE : p > q ? this.edge[a]! : this.edge[b]!;
  }

  private outline(): void {
    const { cols, rows, right, bottom, corner } = this;
    for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
      right[i] = x + 1 < cols ? this.between(i, i + 1) : NO_EDGE;
      bottom[i] = y + 1 < rows ? this.between(i, i + cols) : NO_EDGE;
    }
    // A line that turns at a cell's corner may belong to the neighbours only; the corner pixel is still this cell's.
    for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
      const down = y + 1 < rows ? right[i + cols]! : NO_EDGE, along = x + 1 < cols ? bottom[i + 1]! : NO_EDGE;
      corner[i] = Math.max(right[i]!, bottom[i]!, down, along);
    }
  }

  // Returns how many cells were painted.
  flush(paint: PaintCell): number {
    this.outline();
    let painted = 0;
    for (let i = 0; i < this.ch.length; i++) {
      if (this.ch[i] === this.shownCh[i] && this.ink[i] === this.shownInk[i] && this.bg[i] === this.shownBg[i]
        && this.right[i] === this.shownRight[i] && this.bottom[i] === this.shownBottom[i] && this.corner[i] === this.shownCorner[i]) continue;
      this.shownCh[i] = this.ch[i]!;
      this.shownInk[i] = this.ink[i]!;
      this.shownBg[i] = this.bg[i]!;
      this.shownRight[i] = this.right[i]!;
      this.shownBottom[i] = this.bottom[i]!;
      this.shownCorner[i] = this.corner[i]!;
      paint(i % this.cols, Math.floor(i / this.cols), String.fromCharCode(this.ch[i]!), this.ink[i]!, this.bg[i]!, this.right[i]!, this.bottom[i]!, this.corner[i]!);
      painted++;
    }
    return painted;
  }
}
