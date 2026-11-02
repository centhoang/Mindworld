// Variants of the mosaic plane. A skin rewrites the finished world cells before they are compared with the screen,
// so every variant keeps the rule: one plane of cells, and only changed cells repaint. Bubbles and panels go on after.
import { PAL } from "../glyph/atlas";
import { CellGrid, type Restyle } from "./grid";

const rgb = (hex: string) => parseInt(hex.slice(1), 16);
export const STITCH = 0xe100; // draws a full-cell cross in the ink
export const QUAD = 0xe000; // QUAD + mask: quadrants of the cell (1 top-left, 2 top-right, 4 bottom-left, 8 bottom-right) take the ink

const DARK = 0x1d1a26, PAPER = rgb(PAL.paper), INK = rgb(PAL.ink), LINEN = 0xf1e6cf, SHADOW = rgb(PAL.shadow);

export const mix = (a: number, b: number, k: number) => {
  const c = (s: number) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k) << s;
  return c(16) | c(8) | c(0);
};
const luma = (c: number) => 0.3 * ((c >> 16) & 255) + 0.59 * ((c >> 8) & 255) + 0.11 * (c & 255);
const hash = (a: number, b: number) => {
  const h = Math.imul(Math.imul(a, 374761393) + Math.imul(b, 668265263), 1274126177);
  return (h ^ (h >>> 15)) >>> 0;
};

// Ground and buildings: the characters a blank cell of that material may take. Anything else (people, pets) is unknown.
const MATERIALS: [string[], string][] = [
  [["grass", "grass2"], "\",'."], [["path", "path2"], ".:"], [["water", "water2"], "~-"], [["soil", "soil2"], "=-"],
  [["leaf", "leaf2"], "&%#@"], [["wood", "wood2"], "|="], [["plum", "plum2"], "+."], [["roof"], "^"], [["wall"], "_"],
];
const material = new Map<number, number>();
MATERIALS.forEach(([names], i) => names.forEach((n) => material.set(rgb(PAL[n as keyof typeof PAL]), i)));
material.set(0xd96a53, MATERIALS.findIndex(([n]) => n[0] === "roof"));
const fill = (bg: number, x: number, y: number): string | null => {
  const m = material.get(bg);
  if (m === undefined) return null;
  const set = MATERIALS[m]![1];
  return set.charAt(hash(x, y) % set.length);
};
const LAND = new Set(["grass", "path", "water", "soil", "leaf"].map((n) => material.get(rgb(PAL[n as keyof typeof PAL]))!));
const group = (bg: number) => material.get(bg) ?? bg + 100;
const code = (s: string) => s.charCodeAt(0);

export type Skin = { name: string; note: string; shadows: boolean; grout: boolean; apply?: (grid: CellGrid, ox: number, oy: number) => void };

const each = (grid: CellGrid, ox: number, oy: number, f: Restyle) => grid.restyle((c, x, y, bgAt) => f(c, x + ox, y + oy, bgAt));

export const SKINS: Skin[] = [
  { name: "Tile", note: "colour blocks, sparse characters", shadows: true, grout: true },
  {
    name: "Dense", note: "every world cell carries a character", shadows: true, grout: false,
    apply: (grid, ox, oy) => each(grid, ox, oy, (c, x, y) => {
      if (c.ch !== 32) return;
      const f = fill(c.bg, x, y);
      if (f) { c.ch = code(f); c.ink = mix(c.bg, SHADOW, 0.2); }
    }),
  },
  {
    name: "Night", note: "dark plane, land is coloured characters, people and buildings stay solid", shadows: false, grout: false,
    apply: (grid, ox, oy) => each(grid, ox, oy, (c, x, y) => {
      if (!LAND.has(material.get(c.bg) ?? -1)) return;
      const f = fill(c.bg, x, y)!;
      if (c.ch === 32 && hash(x, y) % 5 > 1) c.ch = code(f);
      c.ink = c.ch !== 32 && luma(c.ink) > luma(c.bg) ? c.ink : c.bg;
      c.bg = DARK;
    }),
  },
  {
    name: "Sketch", note: "land is pencil characters on paper, people and buildings keep their colour", shadows: false, grout: false,
    apply: (grid, ox, oy) => each(grid, ox, oy, (c, x, y) => {
      if (!LAND.has(material.get(c.bg) ?? -1)) return;
      const f = fill(c.bg, x, y)!, dark = luma(c.bg) < 150;
      if (c.ch === 32 && (dark || hash(x, y) % 7 === 0)) c.ch = code(f);
      c.ink = c.ink === c.bg || luma(c.ink) > 200 ? mix(PAPER, INK, 0.45) : mix(c.ink, PAPER, 0.15);
      c.bg = PAPER;
    }),
  },
  {
    name: "Stitch", note: "cross-stitch: every cell is one coloured cross on linen", shadows: true, grout: false,
    apply: (grid, ox, oy) => each(grid, ox, oy, (c) => {
      if (c.ch !== 32 && !material.has(c.bg)) return; // a face keeps its eyes
      c.ink = c.ch === 32 ? c.bg : c.ink;
      c.ch = STITCH;
      c.bg = LINEN;
    }),
  },
  {
    name: "Soft", note: "corners between materials split into quadrants, so edges round off", shadows: true, grout: true,
    apply: (grid, ox, oy) => each(grid, ox, oy, (c, x, y, bgAt) => {
      if (c.ch !== 32 && !material.has(c.bg)) return; // windows and faces stay whole
      const sx = x - ox, sy = y - oy, own = group(c.bg);
      const up = bgAt(sx, sy - 1), down = bgAt(sx, sy + 1), left = bgAt(sx - 1, sy), right = bgAt(sx + 1, sy);
      const corner = (a: number, b: number) => group(a) === group(b) && group(a) !== own;
      let mask = 0, other = 0;
      if (corner(up, left)) { mask |= 1; other = up; }
      if (corner(up, right)) { mask |= 2; other = up; }
      if (corner(down, left)) { mask |= 4; other = down; }
      if (corner(down, right)) { mask |= 8; other = down; }
      if (mask) { c.ch = QUAD + mask; c.ink = other; }
    }),
  },
];
