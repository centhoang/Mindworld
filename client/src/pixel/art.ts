// Placeholder pixel art drawn in code at startup: one atlas of 16x16 tiles plus simple sprites. Colors come
// from the moodboard candidate palette; the curated set (docs/STYLE.md + CC0 tiles) replaces this file's
// output later without touching the scenes, which only ask for tiles and sprites by name.

import { hash2, T, TILE, type TileKind } from "./tiles";

export const PAL = {
  ink: "#141820",
  grassD: "#3a6340", grass: "#4c943c", grassM: "#7eaa3e", grassL: "#a6cc60",
  waterD: "#385a68", water: "#2797a6", waterL: "#55a0bc", foam: "#a8bed4",
  sandD: "#c2862e", sand: "#cdc98e", sandL: "#f7dfc8",
  woodD: "#45301f", wood: "#7a4628", woodM: "#a85f2a", woodL: "#c58757",
  stone: "#a69284", stoneL: "#d4ccc8",
  flowerY: "#ffd61e", flowerP: "#cba090", flowerW: "#f7dfc8",
} as const;

type Ctx = CanvasRenderingContext2D;

function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  return [c, g];
}

const px = (g: Ctx, x: number, y: number, col: string, w = 1, h = 1) => {
  g.fillStyle = col;
  g.fillRect(x, y, w, h);
};

// Each kind gets VARIANTS versions so big fields don't repeat; water has FRAMES animation frames.
export const VARIANTS = 3;
export const FRAMES = 4;

export interface Atlas {
  img: HTMLCanvasElement;
  // Source x,y of a tile kind's variant (or water frame).
  at(kind: TileKind, variant: number, frame: number): [number, number];
}

export function makeAtlas(): Atlas {
  const kinds = [T.water, T.grass, T.path, T.bridge, T.sand, T.flowers, T.tall];
  const cols = Math.max(VARIANTS, FRAMES);
  const [img, g] = canvas(cols * TILE, kinds.length * TILE);
  kinds.forEach((k, row) => {
    for (let v = 0; v < cols; v++) drawTile(g, k, v, v * TILE, row * TILE);
  });
  return {
    img,
    at(kind, variant, frame) {
      const row = kinds.indexOf(kind);
      const col = kind === T.water ? frame % FRAMES : variant % VARIANTS;
      return [col * TILE, row * TILE];
    },
  };
}

function speckle(g: Ctx, ox: number, oy: number, seed: number, n: number, col: string) {
  for (let i = 0; i < n; i++) px(g, ox + Math.floor(hash2(seed, i, 7) * 16), oy + Math.floor(hash2(seed, i, 8) * 16), col);
}

function drawTile(g: Ctx, k: TileKind, v: number, ox: number, oy: number) {
  const seed = k * 31 + v;
  switch (k) {
    case T.water: {
      px(g, ox, oy, PAL.water, 16, 16);
      // Two short highlight dashes drifting with the frame.
      for (const [x, y] of [[2, 4], [9, 11]] as const) px(g, ox + ((x + v) % 14), oy + y, PAL.waterL, 3, 1);
      px(g, ox + ((12 + v * 2) % 15), oy + 7, PAL.foam);
      break;
    }
    case T.grass:
    case T.flowers:
    case T.tall: {
      px(g, ox, oy, PAL.grass, 16, 16);
      speckle(g, ox, oy, seed, 10, PAL.grassM);
      speckle(g, ox, oy, seed + 99, 4, PAL.grassD);
      if (k === T.flowers) {
        for (let i = 0; i < 3; i++) {
          const x = ox + 2 + Math.floor(hash2(seed, i, 3) * 11);
          const y = oy + 2 + Math.floor(hash2(seed, i, 4) * 11);
          const c = [PAL.flowerY, PAL.flowerW, PAL.flowerP][i]!;
          px(g, x, y - 1, c); px(g, x - 1, y, c); px(g, x + 1, y, c); px(g, x, y + 1, c); px(g, x, y, PAL.flowerY);
        }
      }
      if (k === T.tall) {
        for (let i = 0; i < 5; i++) {
          const x = ox + 1 + Math.floor(hash2(seed, i, 5) * 13);
          const y = oy + 5 + Math.floor(hash2(seed, i, 6) * 9);
          px(g, x, y - 3, PAL.grassL, 1, 3); px(g, x + 1, y - 4, PAL.grassM, 1, 4); px(g, x + 2, y - 2, PAL.grassL, 1, 2);
          px(g, x, y, PAL.grassD, 3, 1);
        }
      }
      break;
    }
    case T.path:
      px(g, ox, oy, PAL.sand, 16, 16);
      speckle(g, ox, oy, seed, 8, PAL.sandL);
      speckle(g, ox, oy, seed + 50, 5, PAL.stone);
      break;
    case T.sand:
      px(g, ox, oy, PAL.sandL, 16, 16);
      speckle(g, ox, oy, seed, 7, PAL.sand);
      break;
    case T.bridge:
      px(g, ox, oy, PAL.woodM, 16, 16);
      for (let y = 0; y < 16; y += 4) px(g, ox, oy + y + 3, PAL.wood, 16, 1);
      px(g, ox + 3 + v, oy + 1, PAL.woodL, 2, 1);
      break;
  }
}

// A coast edge drawn over a land tile next to water: one row of foam + darker sand lip.
export function drawShore(g: Ctx, x: number, y: number, side: "n" | "s" | "e" | "w", frame: number) {
  const foam = frame % 2 ? PAL.foam : PAL.waterL;
  if (side === "s") { px(g, x, y + 15, foam, 16, 1); px(g, x, y + 14, PAL.sandD, 16, 1); }
  if (side === "n") { px(g, x, y, foam, 16, 1); }
  if (side === "e") { px(g, x + 15, y, foam, 1, 16); }
  if (side === "w") { px(g, x, y, foam, 1, 16); }
}

export interface Sprite {
  img: HTMLCanvasElement;
  w: number;
  h: number;
  frames: number; // horizontal frames
}

// The player: 16x24, 4 directions x 2 walk frames (rows: down, left, right, up).
export function makePlayer(): Sprite {
  const [img, g] = canvas(32, 96);
  for (let d = 0; d < 4; d++) {
    for (let f = 0; f < 2; f++) {
      const ox = f * 16;
      const oy = d * 24;
      const step = f ? 1 : 0;
      // legs
      px(g, ox + 5, oy + 19, PAL.woodD, 2, 4 - step); px(g, ox + 9, oy + 19, PAL.woodD, 2, 3 + step);
      // body (warm red overalls)
      px(g, ox + 4, oy + 12, PAL.ink, 8, 8);
      px(g, ox + 5, oy + 13, "#c0503a", 6, 6);
      px(g, ox + 5, oy + 13, "#e06a48", 2, 2);
      // head
      px(g, ox + 3, oy + 3, PAL.ink, 10, 10);
      px(g, ox + 4, oy + 4, PAL.sandL, 8, 8);
      // hair
      px(g, ox + 3, oy + 2, PAL.ink, 10, 3);
      px(g, ox + 4, oy + 3, PAL.woodM, 8, 2);
      if (d === 3) px(g, ox + 4, oy + 4, PAL.woodM, 8, 7);
      if (d === 1) px(g, ox + 9, oy + 4, PAL.woodM, 3, 6);
      if (d === 2) px(g, ox + 4, oy + 4, PAL.woodM, 3, 6);
      // eyes
      if (d === 0) { px(g, ox + 6, oy + 8, PAL.ink); px(g, ox + 9, oy + 8, PAL.ink); px(g, ox + 5, oy + 10, PAL.flowerP); px(g, ox + 10, oy + 10, PAL.flowerP); }
      if (d === 1) px(g, ox + 5, oy + 8, PAL.ink);
      if (d === 2) px(g, ox + 10, oy + 8, PAL.ink);
    }
  }
  return { img, w: 16, h: 24, frames: 2 };
}

// A round pet blob tinted by its gene hue: 16x16, 2 bounce frames.
export function makePetSprite(hue: number): Sprite {
  const [img, g] = canvas(32, 16);
  const body = `hsl(${hue} 55% 62%)`;
  const shade = `hsl(${(hue + 340) % 360} 45% 45%)`;
  const light = `hsl(${(hue + 20) % 360} 70% 80%)`;
  for (let f = 0; f < 2; f++) {
    const ox = f * 16;
    const sq = f; // squash on frame 1
    px(g, ox + 2, 4 + sq, PAL.ink, 12, 11 - sq);
    px(g, ox + 3, 5 + sq, body, 10, 9 - sq);
    px(g, ox + 3, 11, shade, 10, 3);
    px(g, ox + 4, 6 + sq, light, 3, 2);
    px(g, ox + 3, 2 + sq, PAL.ink, 3, 3); px(g, ox + 10, 2 + sq, PAL.ink, 3, 3);
    px(g, ox + 4, 3 + sq, body); px(g, ox + 11, 3 + sq, body);
    px(g, ox + 5, 8 + sq, PAL.ink); px(g, ox + 10, 8 + sq, PAL.ink);
    px(g, ox + 7, 10, PAL.flowerP, 2, 1);
  }
  return { img, w: 16, h: 16, frames: 2 };
}

// Round tree, 32x40 (2x2.5 tiles), trunk anchored at bottom-centre.
export function makeTree(): Sprite {
  const [img, g] = canvas(32, 40);
  px(g, 13, 26, PAL.ink, 6, 13);
  px(g, 14, 26, PAL.wood, 4, 12);
  px(g, 14, 26, PAL.woodM, 1, 12);
  const blob = (cx: number, cy: number, r: number, c: string) => {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) px(g, cx + x, cy + y, c);
  };
  blob(16, 15, 13, PAL.ink);
  blob(16, 15, 12, PAL.grassD);
  blob(14, 13, 10, PAL.grass);
  blob(12, 10, 6, PAL.grassM);
  blob(10, 8, 2, PAL.grassL);
  px(g, 8, 38, PAL.grassD, 16, 2); // ground shadow
  return { img, w: 32, h: 40, frames: 1 };
}
