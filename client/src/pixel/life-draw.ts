// Drawing for the living world: activity poses as code-driven offsets on the procedural pet sprites, the
// small props activities use (food bowl, poop, ball) and the time-of-day tint. Palette colours only.

import type { Pose } from "../life/activities";
import type { Phase } from "../life/clock";
import { PAL } from "./art";

type Ctx = CanvasRenderingContext2D;
const r = (g: Ctx, x: number, y: number, w: number, h: number, col: string) => {
  g.fillStyle = col;
  g.fillRect(x, y, w, h);
};

// A pet sprite (feet at `feetY`) in a pose. `walking` hops; `k` de-syncs neighbours.
export function drawPetPose(g: Ctx, s: HTMLCanvasElement, cx: number, feetY: number, pose: Pose | null, walking: boolean, t: number, k: number): void {
  const w = s.width;
  const h = s.height;
  let x = cx - w / 2;
  let y = feetY - h + 2;
  let sy = 1;
  let flip = false;
  const beat = Math.floor(t * 4 + k);
  if (walking) y -= beat % 2;
  else if (pose === "sleep") sy = 0.8;
  else if (pose === "squat") sy = 0.85;
  else if (pose === "eat") y += Math.floor(t * 3 + k) % 2;
  else if (pose === "sit") y += 1;
  else if (pose === "wiggle") x += (beat % 2) * 2 - 1;
  else if (pose === "dance") {
    y -= Math.floor(t * 3 + k) % 2 ? 3 : 0;
    flip = Math.floor(t * 1.5 + k) % 2 === 1;
  } else if (pose === "kick") y -= Math.floor(t * 6 + k) % 3 === 0 ? 2 : 0;
  x = Math.round(x);
  const dh = Math.round(h * sy);
  y = Math.round(y + (h - dh));
  if (flip) {
    g.save();
    g.translate(x + w, y);
    g.scale(-1, 1);
    g.drawImage(s, 0, 0, w, dh);
    g.restore();
  } else g.drawImage(s, x, y, w, dh);
  if (pose === "sleep" && !walking) {
    const z = Math.floor(t * 1.2 + k) % 3;
    r(g, x + w - 4 + z, y - 2 - z * 3, 3, 1, PAL.sandL);
    r(g, x + w - 2 + z, y - 1 - z * 3, 1, 1, PAL.sandL);
    r(g, x + w - 4 + z, y - z * 3, 3, 1, PAL.sandL);
  }
}

// Food bowl: 10x5 wooden bowl with berries.
export function drawBowl(g: Ctx, cx: number, by: number): void {
  const x = Math.round(cx - 5);
  const y = Math.round(by - 5);
  r(g, x, y + 1, 10, 4, PAL.ink);
  r(g, x + 1, y + 1, 8, 3, PAL.wood);
  r(g, x + 1, y + 1, 8, 1, PAL.woodL);
  r(g, x + 2, y, 2, 2, PAL.flowerP);
  r(g, x + 5, y, 2, 2, PAL.coral);
  r(g, x + 4, y - 1, 1, 1, PAL.flowerP);
}

// Poop: a small brown swirl, 6x5.
export function drawPoop(g: Ctx, cx: number, by: number, t: number, id: number): void {
  const x = Math.round(cx - 3);
  const y = Math.round(by - 5);
  r(g, x, y + 3, 6, 2, PAL.ink);
  r(g, x + 1, y + 1, 4, 3, PAL.ink);
  r(g, x + 2, y, 2, 1, PAL.ink);
  r(g, x + 1, y + 3, 4, 1, PAL.woodD);
  r(g, x + 2, y + 2, 2, 1, PAL.wood);
  if (Math.floor(t * 2 + id) % 4 === 0) r(g, x + 5, y - 3, 1, 2, PAL.stoneM); // stink line
}

// Ball bouncing between players: position along the pair, height from a hop curve.
export function drawBall(g: Ctx, x: number, y: number): void {
  const bx = Math.round(x - 2);
  const by = Math.round(y - 4);
  r(g, bx, by, 4, 4, PAL.ink);
  r(g, bx + 1, by, 2, 4, PAL.ink);
  r(g, bx, by + 1, 4, 2, PAL.ink);
  r(g, bx + 1, by + 1, 2, 2, PAL.panel);
  r(g, bx + 1, by + 1, 1, 1, PAL.coral);
}

// Time-of-day wash over the whole scene (drawn before the UI).
const TINT: Record<Phase, string | null> = { morning: null, noon: null, evening: "rgba(188,117,107,0.16)", night: "rgba(28,40,70,0.55)" };
export function drawTint(g: Ctx, phase: Phase, sw: number, sh: number): void {
  const c = TINT[phase];
  if (!c) return;
  g.fillStyle = c;
  g.fillRect(0, 0, sw, sh);
}

// A villager sitting (picnic, bench, fishing, sleeping), from a 16x24 cell of a walk sheet: the body above
// the legs (rows 0-18) drops 3 px onto the seat and the legs are redrawn bent toward the viewer: knees in
// the sheet's own trouser colour with ink sides, then the shoes. Facing away (row 3) the lap hides the legs.
// Built once per sheet cell, so a frame costs one drawImage.
const HIP = 19; // first leg row on the sheets (makePlayer layout and the npc-*.png sheets)
const DROP = 3;
const sitCache = new WeakMap<HTMLCanvasElement, Map<string, HTMLCanvasElement>>();

export function sitFrame(sheet: HTMLCanvasElement, sx: number, sy: number, away = false): HTMLCanvasElement {
  let byCell = sitCache.get(sheet);
  if (!byCell) sitCache.set(sheet, (byCell = new Map()));
  const key = `${sx},${sy},${away}`;
  const hit = byCell.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 24;
  const g = c.getContext("2d")!;
  g.drawImage(sheet, sx, sy, 16, HIP, 0, DROP, 16, HIP);
  const trousers = legColour(sheet, sx, sy);
  if (away) r(g, 4, HIP + DROP - 1, 8, 2, trousers);
  else
    for (const x of [3, 9]) {
      r(g, x, 20, 4, 2, PAL.ink); // knee outline
      r(g, x + 1, 20, 2, 2, trousers);
      r(g, x + 1, 22, 2, 1, trousers); // shin
      r(g, x, 22, 1, 1, PAL.ink);
      r(g, x + 3, 22, 1, 1, PAL.ink);
      r(g, x, 23, 4, 1, PAL.ink); // shoe
    }
  byCell.set(key, c);
  return c;
}

// The first coloured (not ink, not clear) pixel on the sheet's leg rows; wood brown if none.
function legColour(sheet: HTMLCanvasElement, sx: number, sy: number): string {
  const d = sheet.getContext("2d")?.getImageData(sx, sy + HIP, 16, 3).data;
  if (d)
    for (let p = 0; p < d.length; p += 4) {
      if (d[p + 3]! < 128) continue;
      const hex = `#${((1 << 24) | (d[p]! << 16) | (d[p + 1]! << 8) | d[p + 2]!).toString(16).slice(1).toUpperCase()}`;
      if (hex !== PAL.ink) return hex;
    }
  return PAL.woodD;
}
