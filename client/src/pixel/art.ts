// Pixel art: the approved art bible (docs/STYLE.md) PNGs under /art, plus the few sprites still drawn in code.
// Every color below is one of the 28 canonical palette entries; scenes ask for tiles and sprites by name.

import { hash2, T, TILE, type TileKind, type TileMap } from "./tiles";

// Old key names kept so scenes didn't need renaming; values are the STYLE.md palette.
export const PAL = {
  ink: "#39463F",
  grassD: "#537D59", grass: "#9FC66A", grassM: "#BFDA82", grassL: "#DDE8A3", grassS: "#78A05D",
  waterD: "#519F95", water: "#6CBAB2", waterL: "#9ED7CA", foam: "#D4EADD", teal: "#43847C",
  sandD: "#A57954", sand: "#E0BC85", sandL: "#FFF3D8",
  woodD: "#795849", wood: "#A57954", woodM: "#C69A67", woodL: "#E0BC85", cream: "#F4DEC6",
  stoneD: "#7A8F89", stone: "#9CAC9B", stoneM: "#BFC7AF", stoneL: "#DDE1C6",
  furD: "#B88163", fur: "#D8A67A", furM: "#EBC796", furL: "#F7E5BA",
  flowerY: "#EDC76A", flowerP: "#E69B86", flowerW: "#FFF3D8", coral: "#BC756B",
  panel: "#FFF3D8",
} as const;

type Ctx = CanvasRenderingContext2D;

const FILES = [
  "tile-grass-0", "tile-grass-1", "tile-grass-2", "tile-water-0", "tile-water-1", "tile-water-2", "tile-water-3",
  "tile-path-atlas", "tile-path-0", "tile-path-1", "tile-path-2", "tile-shore-atlas", "tile-shore-inner", "tile-detail-flowers", "tile-detail-tuft",
  "tile-bridge", "tile-crop-states", "prop-tree", "prop-house-aframe", "ui-frame-12", "font-6x8", "player-walk", "props-decor",
  "interior-empty", "monster-mallow-back", "monster-sprig-back", "market-stall", "elder-npc",
] as const;
export type ArtName = (typeof FILES)[number];

const art = new Map<string, HTMLImageElement>();

export const hasArt = (name: ArtName): boolean => art.has(name);

export function img(name: ArtName): HTMLImageElement {
  const i = art.get(name);
  if (!i) throw new Error(`art not loaded: ${name}`);
  return i;
}

export function loadArt(base = "/art/"): Promise<void> {
  return Promise.all(
    FILES.map(
      (f) =>
        new Promise<void>((res, rej) => {
          const i = new Image();
          i.onload = () => { art.set(f, i); res(); };
          i.onerror = () => rej(new Error(`art ${f}`));
          i.src = `${base}${f}.png`;
        }),
    ),
  ).then(() => undefined);
}

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

export const FRAMES = 4; // water animation cells, 250 ms each

// Bridge tiles: the art is a horizontal deck; vertical bridges use a pre-rotated copy.
let bridgeV: HTMLCanvasElement | null = null;
function verticalBridge(): HTMLCanvasElement {
  if (bridgeV) return bridgeV;
  const [c, g] = canvas(TILE, TILE);
  g.translate(TILE, 0);
  g.rotate(Math.PI / 2);
  g.drawImage(img("tile-bridge"), 0, 0);
  return (bridgeV = c);
}

const isWater = (m: TileMap, i: number, j: number) => kindAt(m, i, j) === T.water;
const isPath = (m: TileMap, i: number, j: number) => {
  const k = kindAt(m, i, j);
  return k === T.path || k === T.bridge;
};

function kindAt(m: TileMap, i: number, j: number): TileKind {
  const a = i - m.ox;
  const b = j - m.oz;
  if (a < 0 || b < 0 || a >= m.w || b >= m.h) return T.water;
  return m.kind[b * m.w + a] as TileKind;
}

// N=1, E=2, S=4, W=8 (STYLE.md "Tiles and seams"); atlas cell index = mask, 4 per row.
export function edgeMask(test: (di: number, dj: number) => boolean): number {
  return (test(0, -1) ? 1 : 0) | (test(1, 0) ? 2 : 0) | (test(0, 1) ? 4 : 0) | (test(-1, 0) ? 8 : 0);
}

const cell = (mask: number): [number, number] => [(mask % 4) * TILE, Math.floor(mask / 4) * TILE];

// One map tile at world tile coords (i, j), drawn at screen (sx, sy).
export function drawMapTile(g: Ctx, m: TileMap, i: number, j: number, sx: number, sy: number, t: number): void {
  const k = kindAt(m, i, j);
  if (k === T.water) {
    const f = (Math.floor(t * 4) + Math.floor(hash2(i, j, 3) * 4)) % FRAMES;
    g.drawImage(img(`tile-water-${f}` as ArtName), sx, sy);
    return;
  }
  if (k === T.bridge) {
    // Bridges are 2-3 tiles wide: the deck runs along the longer stretch of bridge tiles.
    const run = (di: number, dj: number) => {
      let n = 0;
      while (n < 8 && kindAt(m, i + di * (n + 1), j + dj * (n + 1)) === T.bridge) n++;
      return n;
    };
    const horiz = run(1, 0) + run(-1, 0) >= run(0, 1) + run(0, -1);
    g.drawImage(horiz ? img("tile-bridge") : verticalBridge(), sx, sy);
    return;
  }
  const water = edgeMask((di, dj) => isWater(m, i + di, j + dj));
  if (k === T.path) {
    const mask = edgeMask((di, dj) => isPath(m, i + di, j + dj));
    // Inside a plaza (all four sides and corners path) use plain dirt so the grass corner dots don't grid it.
    const solid = mask === 15 && [[-1, -1], [1, -1], [1, 1], [-1, 1]].every(([di, dj]) => isPath(m, i + di!, j + dj!));
    if (solid) g.drawImage(img(`tile-path-${Math.floor(hash2(i, j, 5) * 3)}` as ArtName), sx, sy);
    else {
      const [ax, ay] = cell(mask);
      g.drawImage(img("tile-path-atlas"), ax, ay, TILE, TILE, sx, sy, TILE, TILE);
    }
  } else if (water) {
    const [ax, ay] = cell(water);
    g.drawImage(img("tile-shore-atlas"), ax, ay, TILE, TILE, sx, sy, TILE, TILE);
  } else {
    g.drawImage(img(`tile-grass-${Math.floor(hash2(i, j, 4) * 3)}` as ArtName), sx, sy);
  }
  // Concave corners: both cardinals are land but the diagonal is water (order NW, NE, SE, SW).
  const corners: [number, number, number][] = [[-1, -1, 0], [1, -1, 1], [1, 1, 2], [-1, 1, 3]];
  for (const [di, dj, n] of corners) {
    if (isWater(m, i + di, j + dj) && !isWater(m, i + di, j) && !isWater(m, i, j + dj))
      g.drawImage(img("tile-shore-inner"), n * TILE, 0, TILE, TILE, sx, sy, TILE, TILE);
  }
  if (!water && k === T.flowers) g.drawImage(img("tile-detail-flowers"), sx, sy);
  if (!water && k === T.tall) g.drawImage(img("tile-detail-tuft"), sx, sy);
}

export interface Sprite {
  img: HTMLCanvasElement;
  w: number;
  h: number;
  frames: number; // horizontal frames
}

// The player, 16x24, 4 frames x 4 directions (rows: down, left, right, up). Only frame 0 of each ImageGen row
// is used: the generated in-between frames don't match each other, so the walk is built here from that one pose.
const LEG_TOP = [19, 20, 20, 19]; // first leg row per direction
export function makePlayer(): Sprite {
  const src = art.get("player-walk");
  if (!src) return drawnPlayer();
  const [c, g] = canvas(64, 96);
  for (let d = 0; d < 4; d++) {
    const oy = d * 24;
    const top = LEG_TOP[d]!;
    for (let f = 0; f < 4; f++) {
      const ox = f * 16;
      if (f % 2 === 0) { g.drawImage(src, 0, oy, 16, 24, ox, oy, 16, 24); continue; } // contact pose
      // Passing pose: body up 1 px, one leg lifted with it, the other stays planted (its top row stretched).
      g.drawImage(src, 0, oy, 16, top, ox, oy - 1, 16, top);
      const lift = f === 1 ? 0 : 8;
      const plant = 8 - lift;
      g.drawImage(src, lift, oy + top, 8, 24 - top, ox + lift, oy + top - 1, 8, 24 - top);
      g.drawImage(src, plant, oy + top, 8, 24 - top, ox + plant, oy + top, 8, 24 - top);
      g.drawImage(src, plant, oy + top, 8, 1, ox + plant, oy + top - 1, 8, 1);
    }
  }
  return { img: c, w: 16, h: 24, frames: 4 };
}

// Fallback before the sheet loads (and in tests): the coded farmer, 2 frames.
function drawnPlayer(): Sprite {
  const [img, g] = canvas(32, 96);
  for (let d = 0; d < 4; d++) {
    for (let f = 0; f < 2; f++) {
      const ox = f * 16;
      const oy = d * 24;
      const step = f ? 1 : 0;
      // boots + legs
      px(g, ox + 5, oy + 19, PAL.ink, 2, 4 - step); px(g, ox + 9, oy + 19, PAL.ink, 2, 3 + step);
      px(g, ox + 5, oy + 19, PAL.teal, 2, 2); px(g, ox + 9, oy + 19, PAL.teal, 2, 2);
      // coral shirt with cream apron
      px(g, ox + 4, oy + 12, PAL.ink, 8, 8);
      px(g, ox + 5, oy + 13, PAL.flowerP, 6, 6);
      px(g, ox + 5, oy + 13, PAL.coral, 1, 6);
      if (d !== 3) px(g, ox + 6, oy + 15, PAL.cream, 4, 4);
      // face
      px(g, ox + 4, oy + 6, PAL.ink, 8, 7);
      px(g, ox + 5, oy + 7, PAL.furM, 6, 5);
      if (d === 3) px(g, ox + 5, oy + 7, PAL.woodD, 6, 5);
      // straw hat: wide brim, honey crown with a coral band
      px(g, ox + 1, oy + 5, PAL.ink, 14, 3);
      px(g, ox + 2, oy + 6, PAL.woodL, 12, 1);
      px(g, ox + 4, oy + 1, PAL.ink, 8, 5);
      px(g, ox + 5, oy + 2, PAL.woodL, 6, 3);
      px(g, ox + 5, oy + 2, PAL.furL, 3, 1);
      px(g, ox + 5, oy + 4, PAL.coral, 6, 1);
      // eyes / cheeks
      if (d === 0) { px(g, ox + 6, oy + 9, PAL.ink); px(g, ox + 9, oy + 9, PAL.ink); px(g, ox + 5, oy + 10, PAL.flowerP); px(g, ox + 10, oy + 10, PAL.flowerP); }
      if (d === 1) px(g, ox + 5, oy + 9, PAL.ink);
      if (d === 2) px(g, ox + 10, oy + 9, PAL.ink);
    }
  }
  return { img, w: 16, h: 24, frames: 2 };
}

// Props drawn straight from the PNGs, anchored at bottom-centre.
export interface Prop {
  name: ArtName;
  w: number;
  h: number;
}
export const TREE: Prop = { name: "prop-tree", w: 32, h: 48 };
export const HOUSE: Prop = { name: "prop-house-aframe", w: 48, h: 48 };
export const MARKET_STALL: Prop = { name: "market-stall", w: 48, h: 48 };

// Furniture, tools and crops from the ImageGen props sheet (props-decor.json).
export const PROPS = {
  bed: [0, 0, 32, 32], rug: [32, 0, 48, 32], table: [80, 0, 32, 32], bookshelf: [112, 0, 16, 32],
  chair: [0, 32, 16, 16], lamp: [16, 32, 16, 16], fern: [32, 32, 16, 16], broadleaf: [48, 32, 16, 16],
  succulent: [64, 32, 16, 16], crate: [80, 32, 16, 16], frame: [96, 32, 16, 16], flowerpot: [112, 32, 16, 16],
  seedbag: [0, 48, 16, 16], can: [16, 48, 16, 16],
} as const satisfies Record<string, readonly [number, number, number, number]>;
export type PropName = keyof typeof PROPS;
const CROP_ROW = { wheat: 64, carrot: 80, tomato: 96 } as const;

// A prop with its bottom-left at (x, bottom).
export function drawSheetProp(g: Ctx, name: PropName, x: number, bottom: number): void {
  const [sx, sy, w, h] = PROPS[name];
  g.drawImage(img("props-decor"), sx, sy, w, h, Math.round(x), Math.round(bottom - h), w, h);
}

export function drawCrop(g: Ctx, crop: keyof typeof CROP_ROW, stage: number, x: number, y: number): void {
  g.drawImage(img("props-decor"), Math.min(3, stage) * TILE, CROP_ROW[crop], TILE, TILE, x, y, TILE, TILE);
}

export function drawProp(g: Ctx, p: Prop, footX: number, footY: number): void {
  g.drawImage(img(p.name), Math.round(footX - p.w / 2), Math.round(footY - p.h));
}
