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
