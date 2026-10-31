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
const SINGLES = ["tiles", "spr_deco_charactershadow", "spr_deco_shadow", "spr_deco_well", "spr_deco_campfire", "expression_chat", "label_left", "label_middle", "label_right", "itemdisc_01", "itemdisc_02", "interior", "interior-roof", "spr_deco_rug_01",
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
  seaLife: SeaLife[];
}

export function buildSunny(m: TileMap): SunnyWorld {
  return { terrain: buildTerrain(m), ...bridgeLayers(m), seaLife: placeSeaLife(m) };
}

export interface SeaLife {
  kind: "boat" | "duck";
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
  const candidates: [number, number][] = [];
  for (let j = 2; j < m.h - 2; j++) for (let i = 2; i < m.w - 2; i++) {
    let clear = true;
    // Include diagonals and bridges: even a boat's full native canvas stays clear of the deck.
    for (let dz = -2; dz <= 2 && clear; dz++) for (let dx = -2; dx <= 2; dx++) {
      if (m.kind[(j + dz) * m.w + i + dx] !== T.water) { clear = false; break; }
    }
    if (clear) candidates.push([m.ox + i + 0.5, m.oz + j + 0.5]);
  }
  const out: SeaLife[] = [];
  const boats = 2 + Math.floor(rng() * 3);
  const ducks = 3 + Math.floor(rng() * 4);
  // Sample without replacement, with room between silhouettes. Tiny/no-sea maps can run out.
  while (candidates.length && out.length < boats + ducks) {
    const at = Math.floor(rng() * candidates.length);
    const [x, z] = candidates[at]!;
    candidates[at] = candidates[candidates.length - 1]!;
    candidates.pop();
    if (out.some((p) => Math.hypot(x - p.x, z - p.z) < 3)) continue;
    out.push({ kind: out.length < boats ? "boat" : "duck", x, z, phase: rng(), flip: rng() < 0.5 });
  }
  return out;
}

export function drawSeaLife(g: Ctx, life: SeaLife[], camX: number, camY: number, sw: number, sh: number, t: number): void {
  for (const p of life) {
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

const SKY = tile(18, 1);
const FLOWERS = [tile(3, 35), tile(3, 34), tile(3, 28)];

const mod4 = (n: number) => ((n % 4) + 4) % 4;

// The tiles on screen; past the map's edge the world ends in cloud.
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
    if (k < 0) return drawCell(g, base, SKY, x, y);
    drawCell(g, base, tile(18 + mod4(j), 11 + mod4(i)), x, y);
    if (m.kind[k] === T.water && hash2(i, j, 31) < 0.012) glint(g, x + 4, y + 4, i, j, t);
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
    if (w.deck[k]) drawCell(g, base, w.deck[k]!, x, y);
    if (w.rail[k]) drawCell(g, base, w.rail[k]!, x, y);
    if (m.look[k]! & AWAY && w.terrain.land[k]) {
      g.fillStyle = "rgba(57,70,63,0.45)"; // the owner is away
      g.fillRect(x, y, TILE, TILE);
    }
  });
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

// A sprite or stamp standing on (footX, footY), bottom centre.
export function stand(g: Ctx, name: string, footX: number, footY: number, theme = 0): void {
  const i = images.get(name);
  if (!i) return;
  g.drawImage(theme ? recoloured(i, theme) : i, Math.round(footX - i.width / 2), Math.round(footY - i.height));
}

// Trees sway gently, each at its own moment.
export function drawTree(g: Ctx, seed: number, footX: number, footY: number, t: number, theme: number): void {
  const kind = seed % 5;
  if (kind >= 3) return stand(g, "pine", footX, footY, theme);
  const name = kind === 2 ? "spr_deco_tree_02_strip4" : "spr_deco_tree_01_strip4";
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

// Under the land: low cloud over the sea, grey underside first.
export function drawLowClouds(g: Ctx, m: TileMap, camX: number, camY: number, sw: number, sh: number, t: number): void {
  const base = sheetFor(0);
  const puff = (cells: [number, number, number][], x: number, y: number) => {
    for (const [a, b, id] of cells) drawCell(g, base, shifted(id, 3), x + a * TILE + 4, y + b * TILE + 6);
    for (const [a, b, id] of cells) drawCell(g, base, fromRoom(id), x + a * TILE, y + b * TILE);
  };
  eachCloud(camX, camY, sw, sh, t, 0, 0.55, puff);
  // A bank of cloud along the map's edge, so the sea does not stop on a straight line.
  const edge = (i: number, j: number) => {
    const x = i * TILE - camX;
    const y = j * TILE - camY;
    if (x < -160 || y < -160 || x > sw + 32 || y > sh + 32 || !data.clouds.length) return;
    puff(data.clouds[Math.floor(hash2(i, j, 90) * data.clouds.length)]!, x, y);
  };
  for (let n = -8; n < m.w + 8; n += 5) {
    edge(m.ox + n, m.oz - 4);
    edge(m.ox + n, m.oz + m.h - 3);
  }
  for (let n = -8; n < m.h + 8; n += 5) {
    edge(m.ox - 5, m.oz + n);
    edge(m.ox + m.w - 3, m.oz + n);
  }
}

// Over everything: a few high clouds, with soft shadows on the ground.
export function drawHighClouds(g: Ctx, camX: number, camY: number, sw: number, sh: number, t: number): void {
  const base = sheetFor(0);
  eachCloud(camX, camY, sw, sh, t, 1, 0.14, (cells, x, y) => {
    for (const [a, b, id] of cells) drawCell(g, base, shifted(id, 6), x + a * TILE + 10, y + b * TILE + 34);
    for (const [a, b, id] of cells) drawCell(g, base, fromRoom(id), x + a * TILE, y + b * TILE);
  });
}

// Room cells keep their flags in GameMaker's bits (28 mirror, 29 flip).
const fromRoom = (v: number): number => (v & 0xffff) | (v >> 28 & 1 ? MIRROR : 0) | (v >> 29 & 1 ? FLIP : 0);
const shifted = (v: number, rows: number): number => fromRoom(v) + rows * 64;
