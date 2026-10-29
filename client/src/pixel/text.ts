// Pixel text and the dialogue box. Glyphs come from an 8 px pixel font (Press Start 2P, OFL) drawn once per
// string to a small canvas and thresholded, so every pixel is either ink or nothing: no grey antialiasing
// smearing under the CRT. The 9-slice frame is drawn in code until the art bible's frame lands.

import { PAL } from "./art";

export const FONT = '8px "Press Start 2P", monospace';
export const GLYPH = 8;
export const LINE = 11;

const cache = new Map<string, HTMLCanvasElement>();

export function textSprite(s: string, color: string): HTMLCanvasElement {
  const key = `${color}|${s}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = Math.max(1, s.length * GLYPH);
  c.height = GLYPH + 2;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.font = FONT;
  g.textBaseline = "top";
  g.fillStyle = color;
  g.fillText(s, 0, 1);
  const d = g.getImageData(0, 0, c.width, c.height);
  for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i]! >= 110 ? 255 : 0;
  g.putImageData(d, 0, 0);
  if (cache.size > 400) cache.clear();
  cache.set(key, c);
  return c;
}

export function drawText(g: CanvasRenderingContext2D, s: string, x: number, y: number, color: string = PAL.ink): void {
  g.drawImage(textSprite(s, color), Math.round(x), Math.round(y));
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

// Cream box with a 2 px warm wood border and rounded 1 px corners.
export function drawFrame(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  g.fillStyle = PAL.woodD;
  g.fillRect(x + 1, y, w - 2, h);
  g.fillRect(x, y + 1, w, h - 2);
  g.fillStyle = PAL.woodL;
  g.fillRect(x + 2, y + 1, w - 4, h - 2);
  g.fillRect(x + 1, y + 2, w - 2, h - 4);
  g.fillStyle = PAL.sandL;
  g.fillRect(x + 3, y + 3, w - 6, h - 6);
}

// Bottom dialogue box: up to 3 lines, with an optional speaker name tab.
export function drawDialogue(g: CanvasRenderingContext2D, screenW: number, screenH: number, text: string, who?: string): void {
  const w = Math.min(screenW - 16, 360);
  const h = 3 * LINE + 12;
  const x = Math.floor((screenW - w) / 2);
  const y = screenH - h - 6;
  drawFrame(g, x, y, w, h);
  wrap(text, w - 16).slice(0, 3).forEach((l, i) => drawText(g, l, x + 8, y + 7 + i * LINE));
  if (who) {
    const tw = who.length * GLYPH + 12;
    drawFrame(g, x + 6, y - 12, tw, 15);
    drawText(g, who, x + 12, y - 8, PAL.wood);
  }
}
