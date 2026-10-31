// Pixel art: the approved art bible (docs/STYLE.md) PNGs under /art, plus the few sprites still drawn in code.
// Every color below is one of the 28 canonical palette entries; scenes ask for tiles and sprites by name.

import { AWAY, hash2, lookAt, T, TILE, type TileKind, type TileMap } from "./tiles";
import { THEMES } from "../world/ground";

// Old key names kept so scenes didn't need renaming; values are the STYLE.md palette.
export const PAL = {
  ink: "#39463F",
  grassD: "#537D59", grass: "#9FC66A", grassM: "#BFDA82", grassL: "#DDE8A3", grassS: "#78A05D",
  waterD: "#519F95", water: "#32DCE8", waterL: "#9ED7CA", foam: "#D4EADD", teal: "#43847C",
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
const OPTIONAL = ["props-grounds", "npc-mo", "npc-ama", "npc-pip"] as const; // newer sheets: the game draws code stand-ins until they exist
export type ArtName = (typeof FILES)[number] | (typeof OPTIONAL)[number];
// Drawn season art for the autumn and snow grounds ("tile-grass-1" -> "tile-grass-autumn-1"); anything without
// its own file is recoloured from the meadow art (themed below).
const SEASONAL: readonly ArtName[] = ["tile-grass-0", "tile-grass-1", "tile-grass-2", "prop-tree"];
export const seasonName = (name: string, theme: number): string => name.replace(/(-\d+)?$/, (n) => `-${THEMES[theme & 3]}${n}`);

const art = new Map<string, HTMLImageElement>();

export const hasArt = (name: ArtName): boolean => art.has(name);

export function img(name: ArtName): HTMLImageElement {
  const i = art.get(name);
  if (!i) throw new Error(`art not loaded: ${name}`);
  return i;
}

export function loadArt(base = "/art/"): Promise<void> {
  const one = (f: ArtName, must: boolean) =>
    new Promise<void>((res, rej) => {
      const i = new Image();
      i.onload = () => { art.set(f, i); res(); };
      i.onerror = () => (must ? rej(new Error(`art ${f}`)) : res());
      i.src = `${base}${f}.png`;
    });
  const seasons = SEASONAL.flatMap((f) => [1, 2].map((th) => seasonName(f, th) as ArtName));
  return Promise.all([...FILES.map((f) => one(f, true)), ...[...OPTIONAL, ...seasons].map((f) => one(f, false))]).then(() => undefined);
}

// Ground themes by recolour: the meadow greens of any sheet swapped for autumn or snow palette entries
// (index = THEMES order; 0 = meadow = the art as drawn). Cached per image and theme.
const SWAP: Record<number, Record<string, string>> = {
  1: {
    [PAL.grassD]: PAL.coral, [PAL.grassS]: PAL.furD, [PAL.grass]: PAL.fur, [PAL.grassM]: PAL.furM, [PAL.grassL]: PAL.furL,
    // Native Sunnyside grass, path/shore rims and detail overlays (art-tiles.mjs).
    "#63C74D": PAL.fur, "#87CF5E": PAL.furM, "#7BCF5C": PAL.furM,
    "#54B263": PAL.furD, "#4FA748": PAL.furD, "#4EA647": PAL.furD, "#4DA76F": PAL.furD,
    "#489956": PAL.coral, "#3E8948": PAL.coral, "#3D8847": PAL.coral, "#3F8E4F": PAL.coral,
  },
  2: {
    [PAL.grassD]: PAL.stone, [PAL.grassS]: PAL.stoneM, [PAL.grass]: PAL.stoneL, [PAL.grassM]: PAL.sandL, [PAL.grassL]: PAL.sandL,
    "#63C74D": PAL.stoneL, "#87CF5E": PAL.sandL, "#7BCF5C": PAL.sandL,
    "#54B263": PAL.stoneM, "#4FA748": PAL.stoneM, "#4EA647": PAL.stoneM, "#4DA76F": PAL.stoneM,
    "#489956": PAL.stone, "#3E8948": PAL.stone, "#3D8847": PAL.stone, "#3F8E4F": PAL.stone,
  },
};
const themedCache = new Map<string, HTMLCanvasElement>();
const hex = (r: number, g: number, b: number) => `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()}`;

// A loaded image recoloured for a ground theme (the Sunnyside sheets and strips use this directly).
const recolourCache = new WeakMap<object, Map<number, HTMLCanvasElement>>();
export function recoloured(src: HTMLImageElement, theme: number): CanvasImageSource {
  const swap = SWAP[theme & 3];
  if (!swap) return src;
  let byTheme = recolourCache.get(src);
  if (!byTheme) recolourCache.set(src, (byTheme = new Map()));
  const hit = byTheme.get(theme & 3);
  if (hit) return hit;
  const [c, g] = canvas(src.width, src.height);
  g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  for (let p = 0; p < d.data.length; p += 4) {
    const to = swap[hex(d.data[p]!, d.data[p + 1]!, d.data[p + 2]!)];
    if (!to || !d.data[p + 3]) continue;
    d.data[p] = parseInt(to.slice(1, 3), 16);
    d.data[p + 1] = parseInt(to.slice(3, 5), 16);
    d.data[p + 2] = parseInt(to.slice(5, 7), 16);
  }
  g.putImageData(d, 0, 0);
  byTheme.set(theme & 3, c);
  return c;
}

export function themed(name: ArtName, theme: number): CanvasImageSource {
  const swap = SWAP[theme & 3];
  if (!swap) return img(name);
  const drawn = art.get(seasonName(name, theme));
  if (drawn) return drawn;
  const k = `${name}:${theme & 3}`;
  const hit = themedCache.get(k);
  if (hit) return hit;
  const src = img(name);
  const [c, g] = canvas(src.width, src.height);
  g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  for (let p = 0; p < d.data.length; p += 4) {
    const to = swap[hex(d.data[p]!, d.data[p + 1]!, d.data[p + 2]!)];
    if (!to || !d.data[p + 3]) continue;
    d.data[p] = parseInt(to.slice(1, 3), 16);
    d.data[p + 1] = parseInt(to.slice(3, 5), 16);
    d.data[p + 2] = parseInt(to.slice(5, 7), 16);
  }
  g.putImageData(d, 0, 0);
  themedCache.set(k, c);
  return c;
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
  landTile(g, m, i, j, sx, sy, t);
  if (lookAt(m, i, j) & AWAY) {
    g.fillStyle = "rgba(57,70,63,0.45)"; // ink veil: the owner is away
    g.fillRect(sx, sy, TILE, TILE);
  }
}

function landTile(g: Ctx, m: TileMap, i: number, j: number, sx: number, sy: number, t: number): void {
  const k = kindAt(m, i, j);
  const th = lookAt(m, i, j) & 3;
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
    if (solid) g.drawImage(themed(`tile-path-${Math.floor(hash2(i, j, 5) * 3)}` as ArtName, th), sx, sy);
    else {
      const [ax, ay] = cell(mask);
      g.drawImage(themed("tile-path-atlas", th), ax, ay, TILE, TILE, sx, sy, TILE, TILE);
    }
  } else if (water) {
    const [ax, ay] = cell(water);
    g.drawImage(themed("tile-shore-atlas", th), ax, ay, TILE, TILE, sx, sy, TILE, TILE);
  } else {
    g.drawImage(themed(`tile-grass-${Math.floor(hash2(i, j, 4) * 3)}` as ArtName, th), sx, sy);
  }
  // Concave corners: both cardinals are land but the diagonal is water (order NW, NE, SE, SW).
  const corners: [number, number, number][] = [[-1, -1, 0], [1, -1, 1], [1, 1, 2], [-1, 1, 3]];
  for (const [di, dj, n] of corners) {
    if (isWater(m, i + di, j + dj) && !isWater(m, i + di, j) && !isWater(m, i, j + dj))
      g.drawImage(themed("tile-shore-inner", th), n * TILE, 0, TILE, TILE, sx, sy, TILE, TILE);
  }
  if (!water && k === T.flowers) g.drawImage(themed("tile-detail-flowers", th), sx, sy);
  if (!water && k === T.tall) g.drawImage(themed("tile-detail-tuft", th), sx, sy);
}

export interface Sprite {
  img: HTMLCanvasElement;
  w: number;
  h: number;
  frames: number; // walk frames (columns 0..frames-1)
  idle?: number; // first of two idle columns (standing, then the breathing head bob), if the sheet has them
}

// The frame column to draw: the walk cycle while moving, else standing still with a short head bob every
// ~2.5 s (sheets without idle columns stand on frame 0).
export function spriteFrame(s: Sprite, moving: boolean, walkT: number, t: number): number {
  if (moving) return Math.floor(walkT * 8) % s.frames;
  if (s.idle === undefined) return 0;
  return s.idle + (t % 2.5 > 2.1 ? 1 : 0);
}

// The player, 16x24, 4 walk frames + 2 idle frames x 4 directions (rows: down, left, right, up). The body
// (hat to hips) is frame 0 of each ImageGen row; the generated in-between frames don't match, so legs and
// arms are drawn here per frame: front/back raise the forearm on the side opposite the lifted foot, side
// views get code-drawn arms (near arm over the body, far arm behind it) swinging against the stride.
const LEG_TOP = [19, 20, 20, 19]; // first leg row per direction (rows above it come from the art)
const SIDE_SWING = [-1, 0, 1, 0]; // near arm per walk frame: back while the near leg is ahead
export function makePlayer(sheet: ArtName = "player-walk"): Sprite {
  const src = art.get(sheet);
  if (!src) return drawnPlayer();
  const [c, g] = canvas(96, 96);
  for (let d = 0; d < 4; d++) {
    const oy = d * 24;
    const top = LEG_TOP[d]!;
    const side = d === 1 || d === 2;
    for (let f = 0; f < 6; f++) {
      const ox = f * 16;
      const idle = f >= 4;
      g.drawImage(src, 0, oy, 16, top, ox, oy, 16, top);
      if (f === 5) {
        // head bob: hat and face 1 px down, shoulders stay
        g.clearRect(ox, oy, 16, 14);
        g.drawImage(src, 0, oy, 16, 14, ox, oy + 1, 16, 14);
      }
      if (!side) {
        frontLegs(g, ox, oy, idle ? 0 : f);
        if (f === 1 || f === 3) raiseForearm(g, ox, oy, d, f === 1 ? 10 : 3);
        continue;
      }
      const left = d === 1;
      const X = (x: number) => ox + (left ? 15 - x : x);
      // Remove the baked-in arms (the sheet's frame 0 is mid-stride) and close the chest outline.
      for (const [x, y] of [[4, 15], [4, 16], [4, 17], [9, 16], [10, 16], [11, 16], [9, 17], [10, 17], [11, 17]] as const) g.clearRect(X(x), oy + y, 1, 1);
      for (const y of [15, 16, 17]) px(g, X(9), oy + y, PAL.ink);
      sideLegs(g, ox, oy, idle ? 4 : f, left);
      const sw = idle ? 0 : SIDE_SWING[f]!;
      g.globalCompositeOperation = "destination-over"; // far arm: only where the body leaves gaps
      sideArm(g, ox, oy, -sw, left);
      g.globalCompositeOperation = "source-over";
      sideArm(g, ox, oy, sw, left);
    }
  }
  return { img: c, w: 16, h: 24, frames: 4, idle: 4 };
}

// Front/back: the forearm (below the sleeve) moves up 1 px, as if swung toward or away from the viewer.
function raiseForearm(g: Ctx, ox: number, oy: number, d: number, x: number): void {
  const y0 = d === 0 ? 16 : 15;
  const img = g.getImageData(ox + x, oy + y0, 2, 19 - y0);
  g.clearRect(ox + x, oy + y0, 2, 19 - y0);
  g.putImageData(img, ox + x, oy + y0 - 1);
}

// A side-view arm from the shoulder (cols 6-7): two sleeve rows, two skin rows and the hand outline; the
// lower rows lean with the swing (-1 back, 0 hanging, 1 forward). Drawn facing right; left mirrors it.
function sideArm(g: Ctx, ox: number, oy: number, swing: number, left: boolean): void {
  const dot = (x: number, y: number, col: string) => px(g, ox + (left ? 15 - x : x), oy + y, col);
  const rows: [number, number, string, string][] = [
    [14, 0, PAL.cream, PAL.stoneM],
    [15, 0, PAL.cream, PAL.stoneM],
    [16, swing, PAL.woodL, PAL.woodM],
    [17, 2 * swing, PAL.woodM, PAL.wood],
  ];
  for (const [y, dx, c1, c2] of rows) {
    const x = 6 + dx;
    dot(x - 1, y, PAL.ink);
    dot(x, y, c1);
    dot(x + 1, y, c2);
    dot(x + 2, y, PAL.ink);
  }
  dot(6 + 2 * swing, 18, PAL.ink);
  dot(7 + 2 * swing, 18, PAL.ink);
}

// Front/back: two short legs; frames 1 and 3 lift the left or the right foot 2 px (0 and 2 both planted).
function frontLegs(g: Ctx, ox: number, oy: number, f: number): void {
  px(g, ox + 7, oy + 19, PAL.ink, 1, 2); // between the legs
  for (const [x0, outer, lift] of [[5, 4, f === 1 ? 2 : 0], [8, 10, f === 3 ? 2 : 0]] as const) {
    px(g, ox + outer, oy + 19, PAL.ink, 1, 3 - lift);
    px(g, ox + x0, oy + 19, PAL.teal, 2, 3 - lift);
    px(g, ox + Math.min(x0, outer), oy + 22 - lift, PAL.ink, 3, 2);
    px(g, ox + x0, oy + 22 - lift, lift ? PAL.wood : PAL.woodD, 2, 1);
  }
}

// Side: a 4-frame stride (near leg ahead, passing, far leg ahead, passing). Drawn facing right; facing left
// mirrors it. The near leg is lighter teal; the far one is drawn first so the near one overlaps it.
function sideLegs(g: Ctx, ox: number, oy: number, f: number, left: boolean): void {
  const X = (x: number) => ox + (left ? 15 - x : x);
  const dot = (x: number, y: number, col: string) => px(g, X(x), oy + y, col);
  // cols: x of the 2-px leg per row from row 20; the last entry is the boot. A lifted leg has fewer rows.
  const leg = (cols: readonly number[], pants: string) => {
    cols.forEach((x, r) => {
      const boot = r === cols.length - 1;
      dot(x - 1, 20 + r, PAL.ink);
      dot(x + 2, 20 + r, PAL.ink);
      dot(x, 20 + r, boot ? PAL.woodD : pants);
      dot(x + 1, 20 + r, boot ? PAL.wood : pants);
    });
    const y = 20 + cols.length;
    const x = cols[cols.length - 1]!;
    for (let i = -1; i <= 2; i++) dot(x + i, y, PAL.ink); // sole
    dot(x + 3, y - 1, PAL.ink); // toe points forward
  };
  const near = PAL.waterD;
  const far = PAL.teal;
  if (f === 0) {
    leg([6, 5, 4], far);
    leg([7, 8, 9], near);
  } else if (f === 2) {
    leg([7, 8, 9], far);
    leg([6, 5, 4], near);
  } else if (f === 1) {
    leg([6, 6], far); // swinging forward, foot raised
    leg([7, 7, 7], near); // planted under the hips
  } else if (f === 3) {
    leg([6, 6, 6], far);
    leg([7, 7], near);
  } else {
    leg([6, 6, 6], far); // idle: both feet planted under the hips
    leg([7, 7, 7], near);
  }
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

export function drawProp(g: Ctx, p: Prop, footX: number, footY: number, look = 0): void {
  if (look & AWAY) g.globalAlpha = 0.6; // a ghost ground's props fade with it
  g.drawImage(themed(p.name, look), Math.round(footX - p.w / 2), Math.round(footY - p.h));
  g.globalAlpha = 1;
}
