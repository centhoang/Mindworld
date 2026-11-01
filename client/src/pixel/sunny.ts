// The Sunnyside world on screen: sea, terrain, bridges, clouds and the pack's sprites. Rules for which tile goes
// where are in sunny-terrain.ts; art comes from scripts/art-sunny.py (client/public/art/sunny).

import { recoloured } from "./art";
import { mulberry32 } from "../sim/rng";
import { bridgeLayers, buildTerrain, CELL_ID, FLIP, MIRROR, tile, type Terrain } from "./sunny-terrain";
import { AWAY, hash2, T, TILE, type TileMap } from "./tiles";

type Ctx = CanvasRenderingContext2D;
const BASE = "/art/sunny/";
const images = new Map<string, HTMLImageElement>();
let data: { stamps: Record<string, [number, number]>; clouds: [number, number, number][][]; anims: number[][] } = { stamps: {}, clouds: [], anims: [] };
const animOf = new Map<number, number[]>();

const STRIPS: Record<string, { frames: number }> = {
  spr_deco_tree_01_strip4: { frames: 4 }, spr_deco_tree_02_strip4: { frames: 4 }, spr_deco_glint_01_strip6: { frames: 6 }, spr_deco_glint_02_strip4: { frames: 4 },
  spr_deco_mushroom_red_01_strip4: { frames: 4 }, spr_deco_mushroom_blue_01_strip4: { frames: 4 }, chimneysmoke_01_strip30: { frames: 30 },
  spr_deco_duck_01_strip4: { frames: 4 }, spr_deco_chicken_01_strip4: { frames: 4 }, spr_deco_sheep_01_strip4: { frames: 4 }, spr_deco_pig_01_strip4: { frames: 4 }, spr_deco_cow_strip4: { frames: 4 },
  spr_deco_bird_01_strip4: { frames: 4 }, spr_deco_windmill_withshadow_strip9: { frames: 9 }, spr_deco_fire_01_strip4: { frames: 4 }, spr_deco_coracle_strip4: { frames: 4 },
};
const SINGLES = ["tiles", "f-isle-sand", "f-isle-green", "spr_deco_charactershadow", "spr_deco_shadow", "spr_deco_well", "spr_deco_campfire", "expression_chat", "label_left", "label_middle", "label_right", "itemdisc_01", "itemdisc_02", "interior", "interior-roof", "home-roof", "home-open", "spr_deco_rug_01",
  "f-bed", "f-rug", "f-table", "f-stool", "f-shelf", "f-vase", "f-sunflower", "f-picture"];
export const CROPS_ART = ["wheat", "carrot", "beetroot", "cabbage", "cauliflower", "kale", "parsnip", "potato", "pumpkin", "radish"] as const;

export const sunnyReady = (): boolean => images.has("tiles");
export const stampSize = (name: string): [number, number] => data.stamps[name] ?? [16, 16];

export async function loadSunny(): Promise<void> {
  data = await (await fetch(`${BASE}sunny.json`)).json();
  for (const frames of data.anims) animOf.set(frames[0]!, [frames[0]!, frames[frames.length - 1]!]);
  const one = (name: string) =>
    new Promise<void>((res) => {
      const i = new Image();
      i.onload = () => (images.set(name, i), res());
      i.onerror = () => res(); // a missing sprite leaves a gap, not a dead game
      i.src = `${BASE}${name}.png`;
    });
  const crops = CROPS_ART.flatMap((c) => [0, 1, 2, 3, 4, 5].map((n) => `crop-${c}-${n}`));
  await Promise.all([...SINGLES, ...Object.keys(STRIPS), ...Object.keys(data.stamps), ...crops].map(one));
}

// Mirrored and flipped tiles are cut once into their own little canvas.
const flipped = new Map<number, HTMLCanvasElement>();
function drawCell(g: Ctx, sheet: CanvasImageSource, cell: number, x: number, y: number, theme = 0): void {
  const id = cell & CELL_ID;
  const sx = (id % 64) * TILE;
  const sy = Math.floor(id / 64) * TILE;
  if (!(cell & (MIRROR | FLIP))) return g.drawImage(sheet, sx, sy, TILE, TILE, x, y, TILE, TILE);
  const key = cell + theme * (1 << 20);
  let c = flipped.get(key);
  if (!c) {
    c = document.createElement("canvas");
    c.width = c.height = TILE;
    const h = c.getContext("2d")!;
    h.translate(cell & MIRROR ? TILE : 0, cell & FLIP ? TILE : 0);
    h.scale(cell & MIRROR ? -1 : 1, cell & FLIP ? -1 : 1);
    h.drawImage(sheet, sx, sy, TILE, TILE, 0, 0, TILE, TILE);
    flipped.set(key, c);
  }
  g.drawImage(c, x, y);
}

const sheetFor = (theme: number): CanvasImageSource => recoloured(images.get("tiles")!, theme);
const animated = (cell: number, t: number): number => {
  const a = animOf.get(cell & CELL_ID);
  return a ? (cell & ~CELL_ID) | a[Math.floor(t * 1.9) & 1]! : cell;
};

export interface SunnyWorld {
  terrain: Terrain;
  deck: Int32Array;
  rail: Int32Array;
  shadow: Int32Array;
  posts: Int32Array;
  seaLife: SeaLife[];
}

export function buildSunny(m: TileMap): SunnyWorld {
  return { terrain: buildTerrain(m), ...bridgeLayers(m), seaLife: placeSeaLife(m) };
}

export interface SeaLife {
  kind: "boat" | "duck" | "isle-sand" | "isle-green";
  x: number; // world tiles, centred on a sea tile
  z: number;
  phase: number;
  flip: boolean;
}

// Hash geometry only: local themes and away flags must not change shared decoration.
export function placeSeaLife(m: TileMap): SeaLife[] {
  let seed = 2166136261;
  for (const n of [m.w, m.h, m.ox, m.oz, ...m.kind]) seed = Math.imul(seed ^ n, 16777619);
  const rng = mulberry32(seed);
  // Open sea around (i, j), in tiles: every cell within `reach` is water. Bridges count, so nothing touches a deck.
  const open = (reach: number) => {
    const cells: [number, number][] = [];
    for (let j = reach; j < m.h - reach; j++) for (let i = reach; i < m.w - reach; i++) {
      let clear = true;
      for (let dz = -reach; dz <= reach && clear; dz++) for (let dx = -reach; dx <= reach; dx++) {
        if (m.kind[(j + dz) * m.w + i + dx] !== T.water) { clear = false; break; }
      }
      if (clear) cells.push([m.ox + i + 0.5, m.oz + j + 0.5]);
    }
    return cells;
  };
  const out: SeaLife[] = [];
  const room = (p: SeaLife) => (p.kind.startsWith("isle") ? 7 : 3);
  // Sample without replacement, with room between silhouettes. Tiny/no-sea maps can run out.
  const fill = (candidates: [number, number][], count: number, kind: (n: number) => SeaLife["kind"]) => {
    for (let n = 0; candidates.length && n < count;) {
      const at = Math.floor(rng() * candidates.length);
      const [x, z] = candidates[at]!;
      candidates[at] = candidates[candidates.length - 1]!;
      candidates.pop();
      if (out.some((p) => Math.hypot(x - p.x, z - p.z) < room(p))) continue;
      out.push({ kind: kind(n++), x, z, phase: rng(), flip: rng() < 0.5 });
    }
  };
  const boats = 2 + Math.floor(rng() * 3);
  const ducks = 3 + Math.floor(rng() * 4);
  const isles = 4 + Math.floor(rng() * 4);
  fill(open(5), isles, (n) => (n % 3 === 2 ? "isle-green" : "isle-sand"));
  fill(open(2), boats + ducks, (n) => (n < boats ? "boat" : "duck"));
  return out;
}

export function drawSeaLife(g: Ctx, life: SeaLife[], camX: number, camY: number, sw: number, sh: number, t: number): void {
  for (const p of life) {
    if (p.kind.startsWith("isle")) {
      const img = images.get(`f-${p.kind}`);
      if (!img) continue;
      const [x, y] = [Math.round(p.x * TILE - camX - img.width / 2), Math.round(p.z * TILE - camY - img.height / 2)];
      if (x + img.width >= 0 && y + img.height >= 0 && x <= sw && y <= sh) g.drawImage(img, x, y);
      continue;
    }
    // Unchanged pack exports: Elements/Other/spr_deco_coracle_strip4.png and
    // Elements/Animals/spr_deco_duck_01_strip4.png (48x37 and 16x16 per frame).
    const name = p.kind === "boat" ? "spr_deco_coracle_strip4" : "spr_deco_duck_01_strip4";
    const img = images.get(name);
    if (!img) continue;
    const w = img.width / STRIPS[name]!.frames;
    const bob = Math.sin((t + p.phase) * Math.PI * 2) >= 0 ? 0 : 1;
    const x = Math.round(p.x * TILE - camX - w / 2);
    const y = Math.round(p.z * TILE - camY - img.height / 2) + bob;
    if (x + w < 0 || y + img.height < 0 || x > sw || y > sh) continue;
    strip(g, name, x, y, Math.floor(t * 4 + p.phase * 4) % 4, p.flip);
  }
}

const FLOWERS = [tile(3, 35), tile(3, 34), tile(3, 28)];

const mod4 = (n: number) => ((n % 4) + 4) % 4;

// The tiles on screen; k is -1 past the map's edge.
function eachTile(m: TileMap, camX: number, camY: number, sw: number, sh: number, fn: (i: number, j: number, x: number, y: number, k: number) => void): void {
  const i0 = Math.floor(camX / TILE);
  const j0 = Math.floor(camY / TILE);
  for (let j = j0; j <= j0 + Math.ceil(sh / TILE) + 1; j++)
    for (let i = i0; i <= i0 + Math.ceil(sw / TILE) + 1; i++) {
      const a = i - m.ox;
      const b = j - m.oz;
      fn(i, j, i * TILE - camX, j * TILE - camY, a < 0 || b < 0 || a >= m.w || b >= m.h ? -1 : b * m.w + a);
    }
}

export function drawSea(g: Ctx, m: TileMap, camX: number, camY: number, sw: number, sh: number, t: number): void {
  const base = sheetFor(0);
  eachTile(m, camX, camY, sw, sh, (i, j, x, y, k) => {
    drawCell(g, base, tile(18 + mod4(j), 11 + mod4(i)), x, y); // the sea runs on past the map: the world has no edge
    if (k >= 0 && m.kind[k] === T.water && hash2(i, j, 31) < 0.012) glint(g, x + 4, y + 4, i, j, t);
  });
}

// Land, roads, bridges and sea shadows.
export function drawLand(g: Ctx, m: TileMap, w: SunnyWorld, camX: number, camY: number, sw: number, sh: number, t: number): void {
  const base = sheetFor(0);
  eachTile(m, camX, camY, sw, sh, (i, j, x, y, k) => {
    if (k < 0) return;
    if (w.terrain.land[k]) drawCell(g, base, animated(w.terrain.land[k]!, t), x, y);
    if (w.terrain.road[k]) drawCell(g, base, w.terrain.road[k]!, x, y);
    if (m.kind[k] === T.flowers) drawCell(g, base, FLOWERS[Math.floor(hash2(i, j, 33) * FLOWERS.length)]!, x, y);
    if (w.terrain.shade[k]) drawCell(g, base, w.terrain.shade[k]!, x, y);
    if (w.shadow[k]) drawCell(g, base, w.shadow[k]!, x, y);
    if (w.posts[k]) drawCell(g, base, w.posts[k]!, x, y);
    if (w.deck[k]) drawCell(g, base, w.deck[k]!, x, y);
    if (m.kind[k] === T.pool && hash2(i, j, 31) < 0.03) glint(g, x + 4, y + 4, i, j, t);
    if (m.look[k]! & AWAY && w.terrain.land[k]) {
      g.fillStyle = "rgba(57,70,63,0.45)"; // the owner is away
      g.fillRect(x, y, TILE, TILE);
    }
  });
}

// One bridge rail, drawn with the people so nobody walks over a fence.
export function drawRail(g: Ctx, cell: number, x: number, y: number): void {
  drawCell(g, sheetFor(0), cell, x, y);
}

function glint(g: Ctx, x: number, y: number, i: number, j: number, t: number): void {
  const name = "spr_deco_glint_01_strip6";
  const f = Math.floor(t * 6 + hash2(i, j, 32) * 40) % 40;
  if (f < 6) strip(g, name, x, y, f);
}

// One frame of a horizontal strip at its top-left.
export function strip(g: Ctx, name: string, x: number, y: number, frame: number, flip = false): void {
  const img = images.get(name);
  const s = STRIPS[name];
  if (!img || !s) return;
  const w = img.width / s.frames;
  const f = frame % s.frames;
  if (flip) {
    g.save();
    g.translate(Math.round(x) + w, Math.round(y));
    g.scale(-1, 1);
    g.drawImage(img, f * w, 0, w, img.height, 0, 0, w, img.height);
    g.restore();
  } else g.drawImage(img, f * w, 0, w, img.height, Math.round(x), Math.round(y), w, img.height);
}

// A stamp's columns grouped by their lowest opaque pixel, for a shape with several feet (docs/LAYERS.md).
export interface FootRun { x0: number; x1: number; foot: number } // columns [x0, x1); foot = rows above the stamp's bottom
const FOOT_STEP = 6; // px: smaller steps along a wall's base stay one foot
const footCache = new Map<string, FootRun[]>();
export function footRuns(name: string): FootRun[] {
  const hit = footCache.get(name);
  if (hit) return hit;
  const i = images.get(name);
  if (!i) return [];
  const c = document.createElement("canvas");
  [c.width, c.height] = [i.width, i.height];
  const h = c.getContext("2d", { willReadFrequently: true })!;
  h.drawImage(i, 0, 0);
  const px = h.getImageData(0, 0, i.width, i.height).data;
  const out: FootRun[] = [];
  for (let x = 0; x < i.width; x++) {
    let y = i.height - 1;
    while (y >= 0 && px[(y * i.width + x) * 4 + 3] === 0) y--;
    const foot = i.height - 1 - y;
    const last = out[out.length - 1];
    if (last && Math.abs(last.foot - foot) < FOOT_STEP) last.x1 = x + 1;
    else out.push({ x0: x, x1: x + 1, foot });
  }
  footCache.set(name, out);
  return out;
}

// One run of a stamp standing on (footX, footY).
export function standRun(g: Ctx, name: string, run: FootRun, footX: number, footY: number): void {
  const i = images.get(name);
  if (!i) return;
  const [x, y] = [Math.round(footX - i.width / 2), Math.round(footY - i.height)];
  g.drawImage(i, run.x0, 0, run.x1 - run.x0, i.height, x + run.x0, y, run.x1 - run.x0, i.height);
}

// A sprite or stamp standing on (footX, footY), bottom centre.
export function stand(g: Ctx, name: string, footX: number, footY: number, theme = 0): void {
  const i = images.get(name);
  if (!i) return;
  g.drawImage(theme ? recoloured(i, theme) : i, Math.round(footX - i.width / 2), Math.round(footY - i.height));
}

// Trees sway gently, each at its own moment.
export function drawTree(g: Ctx, seed: number, footX: number, footY: number, t: number, theme: number): void {
  const kind = seed % 5;
  if (kind === 4) return stand(g, "pine", footX, footY, theme);
  // tree_02 is also a conifer in the pack; only tree_01 has a round canopy.
  const name = "spr_deco_tree_01_strip4";
  const img = images.get(name);
  if (!img) return;
  const w = img.width / 4;
  const f = Math.floor(t * 2.5 + seed) % 4;
  g.drawImage(theme ? recoloured(img, theme) : img, f * w, 0, w, img.height, Math.round(footX - w / 2), Math.round(footY - img.height + 2), w, img.height);
}

// Whole-pixel grass over the screen, for what lies around the house picture.
export function drawGrass(g: Ctx, sw: number, sh: number): void {
  const base = sheetFor(0);
  for (let y = 0; y < sh; y += TILE) for (let x = 0; x < sw; x += TILE) drawCell(g, base, tile(3, 1), x, y);
}

// Part of a sprite at full strength, or faded (the roof lifting as you come in).
export function drawFaded(g: Ctx, name: string, x: number, y: number, alpha: number): void {
  const i = images.get(name);
  if (!i || alpha <= 0) return;
  g.globalAlpha = alpha;
  g.drawImage(i, x, y);
  g.globalAlpha = 1;
}

// Repeat a band of a sprite sideways from its edges, so a road in the picture runs on off screen.
export function extendBand(g: Ctx, name: string, x: number, y: number, bandY: number, bandH: number, sw: number): void {
  const i = images.get(name);
  if (!i) return;
  for (let a = x - TILE; a > -TILE; a -= TILE) g.drawImage(i, 0, bandY, TILE, bandH, a, y + bandY, TILE, bandH);
  for (let a = x + i.width; a < sw; a += TILE) g.drawImage(i, i.width - TILE, bandY, TILE, bandH, a, y + bandY, TILE, bandH);
}

export function characterShadow(g: Ctx, footX: number, footY: number): void {
  const i = images.get("spr_deco_charactershadow");
  if (i) g.drawImage(i, Math.round(footX - 8), Math.round(footY - 10));
}

export function drawCropArt(g: Ctx, crop: string, stage: number, footX: number, footY: number): void {
  stand(g, `crop-${crop}-${stage}`, footX, footY);
}

// Clouds drift across a hashed grid of sky cells, wrapping inside their cell; their shadows fall on what is below.
const CLOUD_CELL = 16; // tiles
function eachCloud(camX: number, camY: number, sw: number, sh: number, t: number, salt: number, chance: number, fn: (cells: [number, number, number][], x: number, y: number) => void): void {
  const size = CLOUD_CELL * TILE;
  const drift = t * (salt === 1 ? 2.2 : 1.1);
  const i0 = Math.floor((camX - drift) / size) - 1;
  const j0 = Math.floor(camY / size) - 1;
  for (let j = j0; j <= j0 + Math.ceil(sh / size) + 2; j++)
    for (let i = i0; i <= i0 + Math.ceil(sw / size) + 2; i++) {
      if (hash2(i, j, 40 + salt) > chance || !data.clouds.length) continue;
      const cells = data.clouds[Math.floor(hash2(i, j, 50 + salt) * data.clouds.length)]!;
      const x = Math.round(i * size + hash2(i, j, 60) * size * 0.5 + drift - camX);
      const y = Math.round(j * size + hash2(i, j, 70) * size * 0.5 - camY);
      fn(cells, x, y);
    }
}

// Over everything: a few high clouds, with soft shadows on the ground.
export function drawHighClouds(g: Ctx, camX: number, camY: number, sw: number, sh: number, t: number): void {
  const base = sheetFor(0);
  eachCloud(camX, camY, sw, sh, t, 1, 0.2, (cells, x, y) => {
    for (const [a, b, id] of cells) drawCell(g, base, shifted(id, 6), x + a * TILE + 10, y + b * TILE + 34);
    for (const [a, b, id] of cells) drawCell(g, base, fromRoom(id), x + a * TILE, y + b * TILE);
  });
}

// Room cells keep their flags in GameMaker's bits (28 mirror, 29 flip).
const fromRoom = (v: number): number => (v & 0xffff) | (v >> 28 & 1 ? MIRROR : 0) | (v >> 29 & 1 ? FLIP : 0);
const shifted = (v: number, rows: number): number => fromRoom(v) + rows * 64;
