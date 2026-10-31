// A player's ground: a unique island shape from a seed, so every client draws the same ground for the same
// player without sending the map. A stepped rectangle in tiles, one connected land mass with no holes, a
// theme, and four gates (N/E/S/W) where bridges attach. Pure: tested without a scene.

import { mulberry32 } from "../sim/rng";

export const THEMES = ["meadow", "autumn", "snow"] as const; // beach + night come later as recolours
export type Theme = (typeof THEMES)[number];
export type Side = "n" | "e" | "s" | "w";

export interface Ground {
  seed: number;
  theme: Theme;
  w: number;
  h: number;
  land: Uint8Array; // 1 = land, row-major w*h
  gates: Record<Side, { i: number; j: number }>;
}

export const GROUND_W = 26;
export const GROUND_H = 20;
const YARD_RX = 8.5; // tiles: the fixed oval yard in the middle
const YARD_RY = 6.2;

export function groundFromSeed(seed: number, w = GROUND_W, h = GROUND_H): Ground {
  const rng = mulberry32(seed ^ 0x5bd1e995);
  const theme = THEMES[Math.floor(rng() * THEMES.length)]!;
  // A rectangle with stepped corners: the pack's coast tiles only join on straight edges and small steps, so a
  // ground never has a long diagonal. Each corner gets its own seeded steps; the oval yard is always kept.
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const land = new Uint8Array(w * h);
  land.fill(1);
  const corners = [[0, 0], [1, 0], [0, 1], [1, 1]] as const;
  for (const [right, bottom] of corners) {
    const across = 4 + Math.floor(rng() * 6);
    const down = 3 + Math.floor(rng() * 3);
    for (const [wide, deep] of [[across, down], [Math.ceil(across / 2), down + 2]] as const)
      for (let b = 0; b < deep; b++)
        for (let a = 0; a < wide; a++) {
          const i = right ? w - 1 - a : a;
          const j = bottom ? h - 1 - b : b;
          if (Math.hypot((i - cx) / YARD_RX, (j - cy) / YARD_RY) >= 1) land[j * w + i] = 0;
        }
  }
  keepMainland(land, w, h, Math.round(cx), Math.round(cy));
  fillHoles(land, w, h);
  return { seed, theme, w, h, land, gates: findGates(land, w, h) };
}

const at = (land: Uint8Array, w: number, h: number, i: number, j: number) => i >= 0 && j >= 0 && i < w && j < h && land[j * w + i] === 1;

function flood(w: number, h: number, start: [number, number], ok: (i: number, j: number) => boolean): Uint8Array {
  const seen = new Uint8Array(w * h);
  const stack = [start];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    if (i < 0 || j < 0 || i >= w || j >= h || seen[j * w + i] || !ok(i, j)) continue;
    seen[j * w + i] = 1;
    stack.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]);
  }
  return seen;
}

// Only the land connected to the centre survives (no stray islets you can't walk to).
function keepMainland(land: Uint8Array, w: number, h: number, ci: number, cj: number): void {
  land[cj * w + ci] = 1;
  const main = flood(w, h, [ci, cj], (i, j) => land[j * w + i] === 1);
  for (let k = 0; k < land.length; k++) land[k] = main[k]!;
}

// Water not connected to the border becomes land (no lakes inside a ground; ponds are props).
function fillHoles(land: Uint8Array, w: number, h: number): void {
  const outside = new Uint8Array(w * h);
  for (let i = 0; i < w; i++) for (const j of [0, h - 1]) if (!land[j * w + i]) outside.set(flood(w, h, [i, j], (x, y) => !land[y * w + x]).map((v, k) => v | outside[k]!));
  for (let j = 0; j < h; j++) for (const i of [0, w - 1]) if (!land[j * w + i]) outside.set(flood(w, h, [i, j], (x, y) => !land[y * w + x]).map((v, k) => v | outside[k]!));
  for (let k = 0; k < land.length; k++) if (!outside[k]) land[k] = 1;
}

// Gate = the outermost land tile on the centre line of each side.
function findGates(land: Uint8Array, w: number, h: number): Ground["gates"] {
  const ci = Math.round((w - 1) / 2);
  const cj = Math.round((h - 1) / 2);
  const scan = (i0: number, j0: number, di: number, dj: number) => {
    let last = { i: ci, j: cj };
    for (let i = i0, j = j0; at(land, w, h, i, j); i += di, j += dj) last = { i, j };
    return last;
  };
  return { n: scan(ci, cj, 0, -1), s: scan(ci, cj, 0, 1), w: scan(ci, cj, -1, 0), e: scan(ci, cj, 1, 0) };
}

export const landCount = (g: Ground): number => g.land.reduce((s, v) => s + v, 0);
export const isLand = (g: Ground, i: number, j: number): boolean => at(g.land, g.w, g.h, i, j);

// A fresh random seed for a new player's ground (saved once, then reused).
export const newGroundSeed = (): number => (Math.random() * 2 ** 31) >>> 0;
