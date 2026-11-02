// The whole screen is one plane of cells. A cell is a character, an ink and a background, and nothing else exists.
// Callers write the frame they want; flush() compares it with what is shown and paints only the cells that differ.
export const KEEP = -1; // as a background: leave the cell's background, so a character can sit on the ground
export type StyleCell = { ch: number; ink: number; bg: number };
export type Restyle = (c: StyleCell, x: number, y: number, bgAt: (x: number, y: number) => number) => void;
export type PaintCell = (x: number, y: number, ch: string, ink: number, bg: number) => void;

export class CellGrid {
  private ch: Uint16Array;
  private ink: Int32Array;
  private bg: Int32Array;
  private shownCh: Int32Array;
  private shownInk: Int32Array;
  private shownBg: Int32Array;

  constructor(readonly cols: number, readonly rows: number) {
    const n = cols * rows;
    this.ch = new Uint16Array(n).fill(32);
    this.ink = new Int32Array(n);
    this.bg = new Int32Array(n);
    this.shownCh = new Int32Array(n).fill(-1); // nothing shown yet, so the first flush paints every cell
    this.shownInk = new Int32Array(n);
    this.shownBg = new Int32Array(n);
  }

  put(x: number, y: number, ch: string, ink: number, bg: number = KEEP): void {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
    const i = y * this.cols + x;
    this.ch[i] = ch.charCodeAt(0);
    this.ink[i] = ink;
    if (bg !== KEEP) this.bg[i] = bg;
  }

  background(x: number, y: number): number {
    return x < 0 || y < 0 || x >= this.cols || y >= this.rows ? 0 : this.bg[y * this.cols + x]!;
  }

  setBackground(x: number, y: number, bg: number): void {
    if (x >= 0 && y >= 0 && x < this.cols && y < this.rows) this.bg[y * this.cols + x] = bg;
  }

  recolour(f: (rgb: number) => number): void {
    for (let i = 0; i < this.bg.length; i++) {
      this.bg[i] = f(this.bg[i]!);
      this.ink[i] = f(this.ink[i]!);
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

  // Returns how many cells were painted.
  flush(paint: PaintCell): number {
    let painted = 0;
    for (let i = 0; i < this.ch.length; i++) {
      if (this.ch[i] === this.shownCh[i] && this.ink[i] === this.shownInk[i] && this.bg[i] === this.shownBg[i]) continue;
      this.shownCh[i] = this.ch[i]!;
      this.shownInk[i] = this.ink[i]!;
      this.shownBg[i] = this.bg[i]!;
      paint(i % this.cols, Math.floor(i / this.cols), String.fromCharCode(this.ch[i]!), this.ink[i]!, this.bg[i]!);
      painted++;
    }
    return painted;
  }
}
