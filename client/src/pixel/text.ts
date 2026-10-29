// Pixel text and boxes from the art bible: the original 6x8 bitmap font (`font-6x8.png`, ASCII 32-95,
// 16 x 4 cells, uppercase only) and the 12x12 nine-slice frame (cuts at 4 and 8). Colored text uses a tinted
// copy of the font atlas, cached per color.

import { img, PAL } from "./art";

export const GLYPH = 6;
export const LINE = 10;

const tinted = new Map<string, HTMLCanvasElement>();

function fontIn(color: string): HTMLCanvasElement {
  const hit = tinted.get(color);
  if (hit) return hit;
  const src = img("font-6x8");
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext("2d")!;
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  tinted.set(color, c);
  return c;
}

export function glyphIndex(ch: string): number {
  const code = ch.toUpperCase().charCodeAt(0);
  return code >= 32 && code <= 95 ? code - 32 : 31; // 31 = "?"
}

export function drawText(g: CanvasRenderingContext2D, s: string, x: number, y: number, color: string = PAL.ink): void {
  const f = fontIn(color);
  let cx = Math.round(x);
  const cy = Math.round(y);
  for (const ch of s) {
    if (ch !== " ") {
      const n = glyphIndex(ch);
      g.drawImage(f, (n % 16) * GLYPH, Math.floor(n / 16) * 8, GLYPH, 8, cx, cy, GLYPH, 8);
    }
    cx += GLYPH;
  }
}

// Greedy word wrap to a pixel width (monospace font, so characters = width / GLYPH).
export function wrap(s: string, width: number): string[] {
  const max = Math.max(1, Math.floor(width / GLYPH));
  const out: string[] = [];
  let line = "";
  for (const word of s.split(/\s+/).filter(Boolean)) {
    if (!line) line = word;
    else if (line.length + 1 + word.length <= max) line += ` ${word}`;
    else {
      out.push(line);
      line = word;
    }
    while (line.length > max) {
      out.push(line.slice(0, max));
      line = line.slice(max);
    }
  }
  if (line) out.push(line);
  return out;
}

// Nine-slice cream panel: 4x4 corners kept exact, 4 px edges tiled and clipped, flat cream centre.
export function drawFrame(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const f = img("ui-frame-12");
  w = Math.max(12, Math.round(w));
  h = Math.max(12, Math.round(h));
  g.fillStyle = PAL.panel;
  g.fillRect(x + 4, y + 4, w - 8, h - 8);
  for (let ex = 4; ex < w - 4; ex += 4) {
    const ew = Math.min(4, w - 4 - ex);
    g.drawImage(f, 4, 0, ew, 4, x + ex, y, ew, 4);
    g.drawImage(f, 4, 8, ew, 4, x + ex, y + h - 4, ew, 4);
  }
  for (let ey = 4; ey < h - 4; ey += 4) {
    const eh = Math.min(4, h - 4 - ey);
    g.drawImage(f, 0, 4, 4, eh, x, y + ey, 4, eh);
    g.drawImage(f, 8, 4, 4, eh, x + w - 4, y + ey, 4, eh);
  }
  g.drawImage(f, 0, 0, 4, 4, x, y, 4, 4);
  g.drawImage(f, 8, 0, 4, 4, x + w - 4, y, 4, 4);
  g.drawImage(f, 0, 8, 4, 4, x, y + h - 4, 4, 4);
  g.drawImage(f, 8, 8, 4, 4, x + w - 4, y + h - 4, 4, 4);
}

// Bottom dialogue box (STYLE.md: 368x48 at y 160 on a 384 screen): optional 32x32 portrait, speaker name in
// wood on the first line, then up to 3 lines (2 with a name).
export function drawDialogue(
  g: CanvasRenderingContext2D, screenW: number, screenH: number, text: string, who?: string, portrait?: CanvasImageSource, boxW?: number,
): void {
  const w = boxW ?? Math.min(screenW - 16, 368);
  const h = 48;
  const x = boxW ? 8 : Math.floor((screenW - w) / 2);
  const y = screenH - h - 8;
  drawFrame(g, x, y, w, h);
  let tx = x + 8;
  if (portrait) {
    g.drawImage(portrait, x + 8, y + 8, 32, 32);
    tx = x + 48;
  }
  let ty = y + 8;
  const lines = 3;
  if (who) {
    drawText(g, who, tx, ty, PAL.wood);
    ty += LINE;
  }
  wrap(text, x + w - 8 - tx).slice(0, who ? lines - 1 : lines).forEach((l, i) => drawText(g, l, tx, ty + i * LINE));
}
