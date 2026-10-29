// A simple in-canvas list menu (party, later shop/decor): framed box, title tab, rows with an optional
// icon, a blinking cursor. Input is handled by the caller; this only draws.

import { PAL } from "./art";
import { drawFrame, drawText, GLYPH } from "./text";

export interface MenuRow {
  label: string;
  note?: string; // right-aligned, dimmer
  icon?: HTMLCanvasElement;
}

export const ROW_H = 22;

export function drawMenu(g: CanvasRenderingContext2D, sw: number, sh: number, title: string, rows: readonly MenuRow[], cursor: number, t: number, footer = ""): void {
  const w = Math.min(sw - 24, 280);
  const h = rows.length * ROW_H + 16 + (footer ? 14 : 0);
  const x = Math.floor((sw - w) / 2);
  const y = Math.max(18, Math.floor((sh - h) / 2));
  drawFrame(g, x, y, w, h);
  const tw = title.length * GLYPH + 12;
  drawFrame(g, x + 6, y - 12, tw, 15);
  drawText(g, title, x + 12, y - 8, PAL.wood);
  rows.forEach((r, i) => {
    const ry = y + 8 + i * ROW_H;
    if (i === cursor) {
      g.fillStyle = PAL.sand;
      g.fillRect(x + 5, ry - 1, w - 10, ROW_H - 2);
      if (Math.floor(t * 3) % 2 === 0) drawText(g, ">", x + 8, ry + 6, PAL.wood);
    }
    let tx = x + 18;
    if (r.icon) {
      g.drawImage(r.icon, tx, ry + ROW_H / 2 - r.icon.height / 2 - 1);
      tx += r.icon.width + 4;
    }
    drawText(g, r.label, tx, ry + 6);
    if (r.note) drawText(g, r.note, x + w - 10 - r.note.length * GLYPH, ry + 6, PAL.sandD);
  });
  if (footer) drawText(g, footer, x + 10, y + h - 14, PAL.sandD);
}
