// The game's picture, as cells. This reads a Scene and writes one plane: no sprite, no overlay, nothing above or below.
// Bands follow docs/visual/layers.md: ground, beds, things in foot order, night, then names, bubbles and panels.
import type { BubbleFate, Scene, ScenePanel, ScenePerson, ScenePet, SceneProp } from "../../game/ports";
import { T } from "../../world/tilemap";
import { layoutBubbles } from "../bubbles";
import { CELL, PAL, wrap } from "../glyph/atlas";
import { KEEP, type CellGrid } from "./grid";

export const CELLS_PER_TILE = 3;
const rgb = (hex: string) => parseInt(hex.slice(1), 16);
export const C = Object.fromEntries(Object.entries(PAL).map(([k, v]) => [k, rgb(v)])) as Record<keyof typeof PAL, number>;

export const mix = (a: number, b: number, k: number) => {
  const c = (s: number) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k) << s;
  return c(16) | c(8) | c(0);
};
const hash = (a: number, b: number, s = 0) => {
  let h = (a * 374761393 + b * 668265263 + s * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};
const TAG = mix(C.ink, C.grass, 0.15);
const ROOF2 = 0xd96a53;
const BLUE_ROOF = 0x6f93c4;

// How dark the hour is, in whole steps, so night falls a few repaints at a time.
export function nightStep(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  const k = h >= 20 || h < 5 ? 1 : h >= 17 ? (h - 17) / 3 : h < 7 ? (7 - h) / 2 : 0;
  return Math.round(k * 8);
}

// Hair stands for the old sprite's look: the cells of a head, its colour, and whether it falls past the face.
const HAIRS: Record<string, { rows: [string, string]; hair: number; sides?: boolean }> = {
  bowlhair: { rows: [" HHHHH ", "HHHHHHH"], hair: 0x8a5a3c },
  curlyhair: { rows: [" H H H ", "HHHHHHH"], hair: 0xc4663c },
  longhair: { rows: ["  HHH  ", " HHHHH "], hair: C.pink, sides: true },
  mophair: { rows: [" HHHHH ", "HHHHHHH"], hair: C.leaf, sides: true },
  shorthair: { rows: ["  HHH  ", "HHHHHHH"], hair: 0x5a86b8 },
  spikeyhair: { rows: [" H H H ", "HHHHHHH"], hair: 0xf0b64a },
};
const SHIRT: Record<string, number> = { hands: C.plum, rod: 0xd9c27e, axe: C.berry, watering: C.leaf2 };
const TOOL_POSES: Record<string, string> = { fish: "/", chop: "T", water: "U", dig: "T", sweep: "/", cook: "~", serve: "o" };
// Eight coats, by the hue gene.
const COATS = [0xc87f5b, 0xe17276, 0xfeae34, 0x3e8948, 0x63b84d, 0x0099db, 0x8b9bb4, 0xc58a63];
const SHOW_NEEDS = ["hunger", "energy", "fun", "social"] as const;
const FACES = ["o.o", "^w^", "o_o", "owo"];

export function compose(scene: Scene, grid: CellGrid, t: number): BubbleFate[] {
  const cols = grid.cols, rows = grid.rows;
  const camX = Math.round(scene.cam.x * CELLS_PER_TILE) - (cols >> 1);
  const camY = Math.round(scene.cam.z * CELLS_PER_TILE) - (rows >> 1);
  const cellOf = (v: number) => Math.round(v * CELLS_PER_TILE);
  const wave = Math.floor(t * 2.5);
  const put = (x: number, y: number, ch: string, ink: number, bg: number = KEEP) => grid.put(x - camX, y - camY, ch, ink, bg);
  const write = (x: number, y: number, s: string, ink: number, bg: number = KEEP) => {
    for (let i = 0; i < s.length; i++) put(x + i, y, s.charAt(i), ink, bg);
  };
  const shade = (x: number, y: number) => {
    const sx = x - camX, sy = y - camY;
    grid.setBackground(sx, sy, mix(grid.background(sx, sy), C.shadow, 0.28));
  };

  // Ground
  const m = scene.map;
  for (let sy = 0; sy < rows; sy++) for (let sx = 0; sx < cols; sx++) {
    const x = sx + camX, y = sy + camY;
    const i = Math.floor(x / CELLS_PER_TILE) - m.ox, j = Math.floor(y / CELLS_PER_TILE) - m.oz;
    const k = i >= 0 && j >= 0 && i < m.w && j < m.h ? j * m.w + i : -1;
    const kind = k < 0 ? T.water : m.kind[k]!;
    const h = hash(x, y), pick = h & 1;
    if (kind === T.water || kind === T.pool) {
      const w = (((x + (y & 1) * 5 + wave * (1 + (y & 1))) % 11) + 11) % 11;
      grid.put(sx, sy, w === 0 ? "~" : w === 5 ? "-" : " ", C.waterInk, pick ? C.water : C.water2);
    } else if (kind === T.floor) {
      grid.put(sx, sy, y % 3 === 0 ? "_" : " ", C.woodInk, (y >> 1) & 1 ? C.wood : C.wood2);
    } else if (kind === T.wall) {
      grid.put(sx, sy, y % 3 === 0 ? "=" : " ", C.wallInk, C.wall);
    } else if (kind === T.bridge) {
      grid.put(sx, sy, x & 1 ? "|" : " ", C.woodInk, y & 1 ? C.wood : C.wood2);
    } else if (m.soil?.[k]) {
      grid.put(sx, sy, y % 3 === 1 ? "=" : " ", C.soilInk, pick ? C.soil : C.soil2);
    } else if (kind === T.path || kind === T.sand) {
      grid.put(sx, sy, h % 11 === 0 ? ":" : h % 7 === 0 ? "." : " ", C.pathInk, pick ? C.path : C.path2);
    } else {
      const sway = h % 13 === 0 ? ((wave + (h >> 4)) % 6 === 0 ? '"' : "'") : h % 17 === 0 ? "," : h % 19 === 0 ? "." : " ";
      const flower = kind === T.flowers ? h % 5 === 0 : h % 149 === 0;
      const ch = flower ? "*" : kind === T.tall && h % 3 === 0 ? '"' : sway;
      grid.put(sx, sy, ch, flower ? (h & 8 ? C.flowerA : C.flowerB) : C.grassInk, pick ? C.grass : C.grass2);
    }
  }

  // Beds: three cells square, one plant in the middle. The crop's stage is one character.
  for (const b of scene.beds) {
    const x = cellOf(b.x), y = cellOf(b.z);
    if (x < camX - 3 || y < camY - 3 || x > camX + cols || y > camY + rows) continue;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) put(x + c, y + r, r === 1 && c !== 1 ? "=" : " ", C.soilInk, b.wet ? C.soilInk : c === 0 || r === 0 ? mix(C.soil, C.soilInk, 0.5) : (c + r) & 1 ? C.soil : C.soil2);
    if (b.crop) {
      const stage = Math.min(3, b.stage);
      put(x + 1, y + 1, ".,Y@".charAt(stage), stage === 3 ? C.berry : C.sprout);
      if (stage === 3) put(x + 1, y, "Y", C.sprout);
    }
    if (b.dry && Math.floor(t * 2) & 1) put(x + 2, y, "!", C.sky);
  }

  // Things that stand, in foot order
  const things: { foot: number; draw: () => void }[] = [];
  const near = (x: number, y: number) => x > camX - 16 && x < camX + cols + 16 && y > camY - 8 && y < camY + rows + 16;

  const tree = (x0: number, y0: number) => {
    const shape = ["  ####  ", " ###### ", "########", "########", " ###### ", "   ||   ", "   ||   "];
    const x = x0 - 4, y = y0 - 6;
    shape.forEach((row, ry) => [...row].forEach((c, rx) => {
      const h = hash(x + rx, y + ry, 3);
      if (c === "#") put(x + rx, y + ry, "&%#@".charAt(h % 4), C.leafInk, h & 16 ? C.leaf : C.leaf2);
      if (c === "|") put(x + rx, y + ry, "|", C.woodInk, C.wood);
    }));
  };
  const house = (cx: number, foot: number, a: number, b: number, ink: number) => {
    const x = cx - 10, y = foot - 12;
    const smoke = Math.floor(t * 2);
    for (let i = 0; i < 3; i++) put(x + 15 + ((smoke + i) & 1), y - 2 - i, "oO.".charAt((smoke + i) % 3), C.paper);
    put(x + 15, y - 1, "#", C.ink, C.wood2);
    put(x + 15, y, "#", C.ink, C.wood2);
    for (let r = 0; r < 7; r++) for (let c = 6 - r; c < 14 + r; c++) put(x + c, y + r, "^", ink, (c + r) & 1 ? a : b);
    for (let r = 7; r < 13; r++) for (let c = 0; c < 20; c++) {
      const win = ((c >= 3 && c <= 6) || (c >= 13 && c <= 16)) && r >= 8 && r <= 9, door = c >= 8 && c <= 11 && r >= 8;
      if (win) put(x + c, y + r, "+", C.woodInk, C.glow);
      else if (door) put(x + c, y + r, c === 10 && r === 10 ? "." : " ", C.glow, C.woodInk);
      else put(x + c, y + r, r === 12 ? "_" : " ", C.wallInk, C.wall);
    }
  };
  const stall = (cx: number, foot: number) => {
    const x = cx - 7, y = foot - 6;
    for (let c = 0; c < 14; c++) {
      const stripe = (c >> 1) & 1;
      put(x + c, y, "v", stripe ? C.paper : C.roof, stripe ? C.roof : C.paper);
      put(x + c, y + 1, " ", C.ink, stripe ? C.roofInk : C.wallInk);
    }
    for (let r = 2; r < 7; r++) { put(x, y + r, "|", C.woodInk, C.wood2); put(x + 13, y + r, "|", C.woodInk, C.wood2); }
    for (let c = 1; c < 13; c++) {
      put(x + c, y + 5, "@*@o*@".charAt((c - 1) % 6), c & 1 ? C.berry : C.roofInk, C.paperDim);
      put(x + c, y + 6, "=", C.woodInk, C.wood);
    }
  };
  const board = (cx: number, foot: number) => {
    const x = cx - 4, y = foot - 5;
    for (let c = 0; c < 8; c++) for (let r = 0; r < 4; r++) put(x + c, y + r, r === 0 ? "=" : c && c < 7 ? "=" : " ", r ? C.pathInk : C.woodInk, r ? C.paper : C.wood);
    for (let r = 4; r < 6; r++) { put(x + 1, y + r, "|", C.woodInk); put(x + 6, y + r, "|", C.woodInk); }
  };
  const prop = (kind: string, x: number, y: number) => {
    if (kind === "tree") tree(x, y);
    else if (kind === "home") house(x, y, C.roof, ROOF2, C.roofInk);
    else if (kind === "house") house(x, y, BLUE_ROOF, mix(BLUE_ROOF, C.ink, 0.1), mix(BLUE_ROOF, C.ink, 0.4));
    else if (kind === "stall") stall(x, y);
    else if (kind === "board") board(x, y);
    else if (kind === "sign") { write(x - 1, y - 2, "===", C.woodInk, C.paper); put(x, y - 1, "|", C.woodInk); put(x, y, "|", C.woodInk); }
    else if (kind === "bowl") write(x - 1, y, "(o)", C.woodInk, C.paperDim);
    else if (kind === "mess") put(x, y, "@", C.soilInk);
    else if (kind === "bush" || kind === "bush-big") { write(x - 1, y - 1, "&%&", C.leafInk, C.leaf); write(x - 1, y, "%&%", C.leafInk, C.leaf2); }
    else if (kind === "rock" || kind === "rock-big") write(x - 1, y, ".o.", C.shadow, 0xb9b2a4);
    else if (kind === "stump") write(x - 1, y, "(_)", C.woodInk, C.wood);
    else if (kind === "crates" || kind === "jar") write(x - 1, y, "[#]", C.woodInk, C.wood);
    else if (kind === "fence") write(x - 2, y, "+-+-+", C.woodInk);
    else if (kind === "fence-v") { put(x, y - 1, "|", C.woodInk); put(x, y, "+", C.woodInk); }
    else if (kind === "rod") put(x, y, "/", C.ink);
    else if (kind === "blanket") for (let r = 0; r < 3; r++) write(x - 3, y + r, "+ + + +", C.paper, C.flowerA);
    else if (kind === "basket") write(x - 1, y, "\\_/", C.woodInk, C.wood);
    else if (kind === "rug") for (let r = -2; r <= 0; r++) write(x - 4, y + r, "%%%%%%%%%", C.roofInk, C.pink);
    else if (kind === "bed") { for (let r = -5; r <= 0; r++) write(x - 3, y + r, r < -3 ? "       " : "=======", C.roofInk, r < -3 ? C.paper : C.roof); }
    else if (kind === "table") { write(x - 3, y - 2, "#######", C.woodInk, C.wood); write(x - 3, y - 1, "|     |", C.woodInk); write(x - 3, y, "|     |", C.woodInk); }
    else if (kind === "chair") { write(x - 1, y - 1, "[=]", C.woodInk, C.wood); write(x - 1, y, "| |", C.woodInk); }
    else if (kind === "lamp") { write(x - 1, y - 2, "/#\\", C.woodInk, C.glow); put(x, y - 1, "|", C.woodInk); write(x - 1, y, "===", C.woodInk); }
    else if (kind === "plant") { write(x - 1, y - 2, "&%&", C.leafInk, C.leaf); put(x, y - 1, "|", C.leafInk); write(x - 1, y, "\\_/", C.woodInk, C.wood); }
    else if (kind === "shelf") for (let r = -4; r <= 0; r++) write(x - 3, y + r, r & 1 ? "#o#=#O#" : "=======", C.woodInk, C.wood);
    else if (kind === "cushion") write(x - 2, y, "(###)", C.plum, C.pink);
    else if (kind === "cursor") { write(x - 4, y - 3, "+       +", C.berry); write(x - 4, y, "+       +", C.berry); }
    else if (kind === "bench") write(x - 3, y, "=======", C.woodInk, C.wood);
    else if (kind === "well") { write(x - 2, y - 3, "/===\\", C.roofInk, C.roof); put(x - 2, y - 2, "|", C.woodInk); put(x + 2, y - 2, "|", C.woodInk); write(x - 2, y - 1, "[ ~ ]", C.woodInk, 0xb9b2a4); write(x - 2, y, "[___]", C.woodInk, 0xb9b2a4); }
    else if (kind === "statue") { write(x - 1, y - 4, "(o)", C.ink, 0xb9b2a4); write(x - 1, y - 3, "/|\\", C.ink, 0xb9b2a4); write(x - 1, y - 2, " | ", C.ink, 0xb9b2a4); write(x - 2, y - 1, "#####", C.shadow, 0xb9b2a4); write(x - 2, y, "#####", C.shadow, 0x8f897d); }
    else if (kind === "goal") { write(x - 4, y - 3, "+-------+", C.paper); for (let r = 2; r >= 0; r--) { put(x - 4, y - r, "|", C.paper); put(x + 4, y - r, "|", C.paper); } }
    else if (kind === "ball") put(x, y, "o", C.ink, C.paper);
    else if (kind === "slide") { write(x - 2, y - 2, "[=\\", C.woodInk, C.sky); write(x - 2, y - 1, "| =\\", C.woodInk, C.sky); write(x - 2, y, "|  ==", C.woodInk, C.sky); }
  };
  const addProp = (p: SceneProp) => {
    const x = cellOf(p.x), y = cellOf(p.z);
    if (near(x, y)) things.push({ foot: y, draw: () => prop(p.kind, x, y) });
  };

  const person = (p: ScenePerson) => {
    const x = cellOf(p.x), y = cellOf(p.z);
    if (!near(x, y)) return;
    things.push({ foot: y, draw() {
      const look = HAIRS[p.look.hair] ?? HAIRS.bowlhair!;
      const shirt = SHIRT[p.look.tool] ?? C.sky;
      const step = p.walking ? Math.floor(t * 6) & 1 : 0;
      const blink = t % 3 < 0.15 && hash(hash(p.id.length, p.id.charCodeAt(0)), Math.floor(t / 3)) % 4 === 0;
      const asleep = p.pose === "sleep";
      const e = asleep || blink ? "-" : p.pose === "dance" ? "^" : "o";
      const d = p.dir === 1 ? -1 : p.dir === 2 ? 1 : 0, back = p.dir === 3;
      for (let c = -2; c <= 2; c++) shade(x + c, y);
      look.rows.forEach((row, r) => [...row].forEach((c, i) => { if (c === "H") put(x - 3 + i, y - 5 + r, " ", C.ink, look.hair); }));
      for (let c = -3; c <= 3; c++) {
        const side = look.sides && Math.abs(c) === 3;
        put(x + c, y - 3, " ", C.ink, back || side ? look.hair : C.skin);
        if (Math.abs(c) < 3) put(x + c, y - 2, " ", C.ink, back ? look.hair : C.skin);
        else if (side) put(x + c, y - 2, " ", C.ink, look.hair);
      }
      if (!back) {
        put(x - 1 + d, y - 3, e, C.ink, C.skin);
        put(x + 1 + d, y - 3, e, C.ink, C.skin);
        put(x + d, y - 2, asleep ? "_" : ".", C.ink, C.skin);
        put(x - 2 + d, y - 2, " ", C.ink, C.pink);
        put(x + 2 + d, y - 2, " ", C.ink, C.pink);
      }
      for (let c = -2; c <= 2; c++) put(x + c, y - 1, c === 0 ? "#" : " ", mix(shirt, C.ink, 0.3), Math.abs(c) === 2 ? C.skin : shirt);
      put(x - 1, y, " ", C.ink, step ? KEEP : C.ink);
      put(x + 1, y, " ", C.ink, step ? C.ink : KEEP);
      const tool = p.pose && TOOL_POSES[p.pose];
      if (tool) put(x + 3, y - 1, tool, C.ink);
      if (asleep && Math.floor(t * 2) & 1) put(x + 4, y - 5, "z", C.paper);
      if (p.pose === "dance" && Math.floor(t * 3) & 1) put(x - 4, y - 4, "♪", C.paper);
    } });
  };

  // Genes pick the colour, the ears and the face.
  const pet = (p: ScenePet) => {
    const x = cellOf(p.x), y = cellOf(p.z);
    if (!near(x, y)) return;
    things.push({ foot: y, draw() {
      const g = p.genes;
      const hue = g?.hue ?? 0.07;
      const colour = COATS[Math.floor((((hue % 1) + 1) % 1) * COATS.length)]!;
      const earGene = g?.ears ?? 0.5;
      const ears = earGene < 0.34 ? "^" : earGene < 0.67 ? "n" : "|";
      const face = p.pose === "sleep" ? "-w-" : FACES[Math.min(3, Math.floor((g?.build ?? 0.5) * 4))]!;
      const hop = p.pose ? 0 : Math.floor(t * 4 + x) % 7 === 0 ? 1 : 0;
      for (let c = -2; c <= 2; c++) shade(x + c, y);
      const top = y - 3 - hop;
      [-2, 2].forEach((c) => put(x + c, top, ears, C.ink, colour));
      for (let c = -3; c <= 3; c++) {
        put(x + c, top + 1, " ", C.ink, colour);
        if (Math.abs(c) < 3) put(x + c, top + 2, " ", C.ink, colour);
      }
      put(x - 1, top + 1, face.charAt(0), C.ink, colour);
      put(x, top + 2, face.charAt(1), C.ink, colour);
      put(x + 1, top + 1, face.charAt(2), C.ink, colour);
      if (!hop) { put(x - 1, y, "u", C.ink); put(x + 1, y, "u", C.ink); }
      if (p.kind === "wild") put(x, top - 1, "?", C.paper);
    } });
  };

  scene.props.forEach(addProp);
  scene.people.forEach(person);
  scene.pets.forEach(pet);
  things.sort((a, b) => a.foot - b.foot);
  for (const s of things) s.draw();

  // Night: everything recoloured except the lit windows.
  const step = scene.day || scene.indoors ? 0 : nightStep(scene.clock.hour);
  if (step) {
    const k = step * 0.04, memo = new Map<number, number>();
    grid.recolour((c) => {
      if (c === C.glow) return c;
      let v = memo.get(c);
      if (v === undefined) memo.set(c, (v = mix(c, 0x2c2a58, k)));
      return v;
    });
  }

  // Names, under the feet.
  if (scene.showNames) for (const p of scene.people) {
    const x = cellOf(p.x), y = cellOf(p.z);
    if (near(x, y)) write(x - (p.name.length >> 1), y + 1, p.name, C.paper, p.kind === "me" ? C.plum : TAG);
  }

  // Bubbles go on the plane, so they never leave the screen.
  const shown = scene.bubbles.flatMap((b) => {
    const sx = cellOf(b.x) - camX, sy = cellOf(b.z) - camY;
    if (sx < -3 || sy < -3 || sx > cols + 3 || sy > rows + 12) return [];
    const lines = wrap(b.text, Math.min(30, cols - 8)).slice(0, 4);
    return [{ id: b.id, lines, head: b.head, thought: b.thought, sx, bottom: sy - 7, first: b.first, w: Math.max(b.head.length, ...lines.map((l) => l.length)) + 4, h: lines.length + (b.head ? 1 : 0) + 2 }];
  });
  const spots = layoutBubbles(shown.map((s) => ({ cx: s.sx * CELL, bottom: s.bottom * CELL, w: s.w * CELL, h: s.h * CELL, first: s.first })), cols * CELL, rows * CELL);
  const fates: BubbleFate[] = shown.map((s, i) => {
    const spot = spots[i];
    if (spot) box(grid, Math.floor(spot.x / CELL), Math.floor(spot.y / CELL), s, spot.moved);
    else grid.put(s.sx, s.bottom + 1, "*", C.ink, C.paper); // their line waits its turn
    return [s.id, !spot];
  });

  // Panels
  panelLine(grid, cols - scene.clock.label.length - 3, 1, scene.clock.label, C.ink);
  if (scene.showMap) minimap(scene, grid);
  const me = scene.people.find((p) => p.kind === "me");
  if (scene.hint) {
    const x = me ? cellOf(me.x) - camX : cols >> 1, y = me ? cellOf(me.z) - camY + 3 : rows - 6;
    panelLine(grid, Math.max(0, Math.min(cols - scene.hint.length - 2, x - (scene.hint.length >> 1) - 1)), Math.min(rows - 3, y), scene.hint, C.woodInk);
  }
  if (scene.banner) panelLine(grid, (cols - scene.banner.text.length - 2) >> 1, 1, scene.banner.text, C.woodInk);
  for (const p of scene.panels) panel(grid, p, t);
  if (scene.chips) chipSpots(scene.chips).forEach(({ x, label, off }) => {
    for (let c = 0; c < label.length + 2; c++) grid.put(x + c, grid.rows - 1, c && c <= label.length ? label.charAt(c - 1) : " ", off ? C.woodInk : C.paper, off ? C.wood2 : C.woodInk);
  });
  const ins = scene.inspector;
  if (ins) {
    const width = Math.min(38, cols - 6);
    const lines = ins.lines((s) => wrap(s, width - 2));
    const bar = (n: (typeof SHOW_NEEDS)[number]) => `${n.slice(0, 3)} ${"#".repeat(Math.round(Math.max(0, Math.min(100, ins.agent.needs[n])) / 12.5)).padEnd(8, "-")}`;
    const needs = SHOW_NEEDS.map(bar);
    const body = [...lines.slice(0, Math.max(1, rows - 9)), [`${needs[0]}  ${needs[1]}`, PAL.woodInk] as [string, string], [`${needs[2]}  ${needs[3]}`, PAL.woodInk] as [string, string]];
    panel(grid, { place: "right", title: "", width, rows: body.map(([label, ink]) => ({ label, ink })) }, t);
  }
  return fates;
}

function box(grid: CellGrid, left: number, top: number, s: { lines: string[]; head: string; thought: boolean; sx: number; w: number; h: number }, moved: boolean): void {
  const ink = C.ink, paper = s.thought ? mix(C.sky, C.paper, 0.75) : C.paper;
  for (let r = 0; r < s.h; r++) for (let c = 0; c < s.w; c++) {
    if ((r === 0 || r === s.h - 1) && (c === 0 || c === s.w - 1)) continue;
    grid.put(left + c, top + r, r === 0 || r === s.h - 1 ? "-" : c === 0 || c === s.w - 1 ? "|" : " ", ink, paper);
  }
  let row = top + 1;
  if (s.head) text(grid, left + 2, row++, s.head, C.roofInk, paper);
  for (const l of s.lines) text(grid, left + 2, row++, l, ink, paper);
  if (!moved) grid.put(s.sx, top + s.h, s.thought ? "o" : "v", ink, paper);
}

function text(grid: CellGrid, x: number, y: number, s: string, ink: number, bg: number): void {
  for (let i = 0; i < s.length; i++) grid.put(x + i, y, s.charAt(i), ink, bg);
}
export const printText = text;

// Where each small button sits on the bottom row, so clicks land on what is drawn.
export function chipSpots<C extends { label: string }>(chips: readonly C[]): (C & { x: number })[] {
  let x = 1;
  return chips.map((c) => {
    const at = { ...c, x };
    x += c.label.length + 3;
    return at;
  });
}

export function panelBox(grid: CellGrid, left: number, top: number, w: number, h: number): void {
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    if ((r === 0 || r === h - 1) && (c === 0 || c === w - 1)) continue;
    grid.put(left + c, top + r, r === 0 || r === h - 1 ? "-" : c === 0 || c === w - 1 ? "|" : " ", C.pathInk, C.paper);
  }
}

function panelLine(grid: CellGrid, x: number, y: number, s: string, ink: number): void {
  for (let c = 0; c < s.length + 2; c++) {
    grid.put(x + c, y - 1, "-", C.pathInk, C.paper);
    grid.put(x + c, y + 1, "-", C.pathInk, C.paper);
    grid.put(x + c, y, c && c <= s.length ? s.charAt(c - 1) : " ", ink, C.paper);
  }
}

function minimap(scene: Scene, grid: CellGrid): void {
  const m = scene.map, step = Math.max(2, Math.ceil(m.w / 14));
  const w = Math.ceil(m.w / step), h = Math.ceil(m.h / step), left = grid.cols - w - 1, top = 4;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = m.kind[Math.min(m.h - 1, y * step) * m.w + Math.min(m.w - 1, x * step)]!;
    grid.put(left + x, top + y, " ", C.ink, k === T.water || k === T.pool ? C.water : k === T.path || k === T.sand ? C.path : k === T.bridge ? C.wood : C.grass);
  }
  const me = scene.people.find((p) => p.kind === "me");
  if (me) grid.put(left + Math.floor((me.x - m.ox) / step), top + Math.floor((me.z - m.oz) / step), "@", C.berry, C.paper);
}

// A framed list: goals, a menu, a dialogue or a toast.
function panel(grid: CellGrid, p: ScenePanel, t: number): void {
  const wanted = p.width ?? Math.max(p.title.length, p.footer?.length ?? 0, ...p.rows.map((r) => r.label.length + (r.note ? r.note.length + 2 : 0))) + 2;
  const inner = Math.min(grid.cols - 6, wanted);
  const rows = p.rows.flatMap((r, i) => wrap(r.label, inner - (r.note ? r.note.length + 2 : 0) - 2).map((label, n) => ({ label, note: n ? undefined : r.note, ink: r.ink, at: i })));
  const h = rows.length + 2 + (p.title ? 1 : 0) + (p.footer ? 1 : 0), w = inner + 2;
  const left = p.place === "corner" ? 1 : p.place === "right" ? grid.cols - w - 1 : (grid.cols - w) >> 1;
  const top = p.place === "corner" ? 1 : p.place === "right" ? 4 : p.place === "bottom" ? grid.rows - h - 1 : Math.max(1, (grid.rows - h) >> 1);
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    if ((r === 0 || r === h - 1) && (c === 0 || c === w - 1)) continue;
    grid.put(left + c, top + r, r === 0 || r === h - 1 ? "-" : c === 0 || c === w - 1 ? "|" : " ", C.pathInk, C.paper);
  }
  let y = top + 1;
  if (p.title) text(grid, left + 2, y++, p.title.slice(0, inner), C.roofInk, C.paper);
  for (const r of rows) {
    const on = r.at === p.cursor, bg = on ? mix(C.grass, C.paper, 0.5) : C.paper;
    if (on) for (let c = 1; c < w - 1; c++) grid.put(left + c, y, " ", C.ink, bg);
    if (on && Math.floor(t * 3) % 2 === 0) grid.put(left + 1, y, ">", C.woodInk, bg);
    text(grid, left + 2, y, r.label, r.ink ? rgb(r.ink) : C.ink, bg);
    if (r.note) text(grid, left + w - 2 - r.note.length, y, r.note, C.woodInk, bg);
    y++;
  }
  if (p.footer) text(grid, left + 2, y, p.footer.slice(0, inner), C.woodInk, C.paper);
}
