// Procedural pixel monsters from genes: every part (body, head, ears, horns, tail, feet) is stamped into a
// label mask at the target size, then painted with a 3-tone ramp lit from the upper left, a pattern layer
// and a 1 px dark outline. Same genes -> same creature at 16, 48 or 64 px, always on the same rules, so
// every hatch is unique but the set stays consistent.

import type { PetLook } from "../game/genes";
import { PAL } from "./art";

export type Facing = "front" | "back";

const enum L { none = 0, body = 1, accent = 2, eye = 3, cheek = 4, horn = 5, belly = 6, shine = 7 }

// Body proportions per enemy archetype; pets use "pal".
export interface Build {
  w: number; // body width as a fraction of the cell
  h: number; // body height
  head: number; // head radius fraction (0 = head merged in body)
}
export const BUILDS: Record<string, Build> = {
  pal: { w: 0.62, h: 0.5, head: 0.24 },
  brute: { w: 0.78, h: 0.6, head: 0.2 },
  skitter: { w: 0.5, h: 0.36, head: 0.22 },
  turtle: { w: 0.8, h: 0.44, head: 0.17 },
  bully: { w: 0.7, h: 0.56, head: 0.22 },
};

// Palette ramps (shadow, base, light) from docs/STYLE.md; the hue gene picks one, so every monster stays on
// the 28-color palette while hues still read as different bodies.
const RAMPS: [string, string, string][] = [
  ["#B88163", "#D8A67A", "#EBC796"], // fur
  ["#BC756B", "#E69B86", "#F4DEC6"], // coral
  ["#C69A67", "#EDC76A", "#F7E5BA"], // honey
  ["#D8A67A", "#EBC796", "#F7E5BA"], // cream fur
  ["#78A05D", "#9FC66A", "#BFDA82"], // leaf
  ["#537D59", "#78A05D", "#9FC66A"], // moss
  ["#43847C", "#519F95", "#6CBAB2"], // teal
  ["#519F95", "#6CBAB2", "#9ED7CA"], // pool
  ["#7A8F89", "#9CAC9B", "#BFC7AF"], // stone
  ["#795849", "#A57954", "#C69A67"], // bark
];

function ramp(h: number): [string, string, string] {
  return RAMPS[Math.floor((((h % 1) + 1) % 1) * RAMPS.length) % RAMPS.length]!;
}

export function drawMonster(look: PetLook, size: number, facing: Facing, build: Build = BUILDS.pal!): HTMLCanvasElement {
  const n = size;
  const m = new Uint8Array(n * n);
  const set = (x: number, y: number, v: L) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < n && y < n) m[y * n + x] = v;
  };
  const ellipse = (cx: number, cy: number, rx: number, ry: number, v: L | ((x: number, y: number) => L)) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) set(x, y, typeof v === "function" ? v(x, y) : v);
      }
  };
  const tri = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number, v: L) => {
    const minX = Math.floor(Math.min(ax, bx, cx)), maxX = Math.ceil(Math.max(ax, bx, cx));
    const minY = Math.floor(Math.min(ay, by, cy)), maxY = Math.ceil(Math.max(ay, by, cy));
    const s = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) => (px - rx) * (qy - ry) - (qx - rx) * (py - ry);
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const p = [x + 0.5, y + 0.5] as const;
        const d1 = s(p[0], p[1], ax, ay, bx, by), d2 = s(p[0], p[1], bx, by, cx, cy), d3 = s(p[0], p[1], cx, cy, ax, ay);
        if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) set(x, y, v);
      }
  };

  const k = n * look.size;
  const cx = n / 2;
  const ground = n - Math.max(2, n * 0.06);
  const bw = (k * build.w) / 2;
  const bh = (k * build.h) / 2;
  const by = ground - bh;
  const hr = k * build.head;
  const hy = by - bh * 0.55;
  const back = facing === "back";

  // Tail first so the body covers its root.
  const tx = cx + bw * 0.85;
  const ty = by + bh * 0.1;
  if (look.tail === "puff") ellipse(tx, ty - k * 0.04, k * 0.1, k * 0.1, L.accent);
  if (look.tail === "nub") ellipse(tx, ty, k * 0.06, k * 0.05, L.body);
  if (look.tail === "curl") { ellipse(tx + k * 0.06, ty - k * 0.12, k * 0.08, k * 0.08, L.body); ellipse(tx + k * 0.06, ty - k * 0.12, k * 0.035, k * 0.035, L.none); }
  if (look.tail === "fox") { tri(tx - k * 0.05, ty + k * 0.05, tx + k * 0.22, ty - k * 0.22, tx + k * 0.05, ty + k * 0.08, L.body); ellipse(tx + k * 0.17, ty - k * 0.17, k * 0.05, k * 0.05, L.accent); }

  // Feet, body, head.
  for (const f of [-0.5, 0.5]) ellipse(cx + f * bw, ground - k * 0.03, k * 0.09, k * 0.05, L.body);
  ellipse(cx, by, bw, bh, L.body);
  if (hr > 0) ellipse(cx, hy, hr * 1.15, hr, L.body);
  const headTop = hr > 0 ? hy - hr : by - bh;
  const headR = hr > 0 ? hr * 1.15 : bw;
  const headY = hr > 0 ? hy : by;

  // Ears.
  for (const sgn of [-1, 1]) {
    const ex = cx + sgn * headR * 0.62;
    const ey = headTop + k * 0.04;
    if (look.ears === "pointy") { tri(ex - k * 0.08, ey + k * 0.04, ex + k * 0.08, ey + k * 0.04, ex + sgn * k * 0.05, ey - k * 0.16, L.body); tri(ex - k * 0.035, ey + k * 0.02, ex + k * 0.035, ey + k * 0.02, ex + sgn * k * 0.035, ey - k * 0.09, L.accent); }
    if (look.ears === "round") { ellipse(ex, ey - k * 0.02, k * 0.08, k * 0.08, L.body); ellipse(ex, ey - k * 0.02, k * 0.04, k * 0.04, L.accent); }
    if (look.ears === "floppy") ellipse(cx + sgn * headR * 0.95, headY - hr * 0.1, k * 0.06, k * 0.13, L.accent);
    if (look.ears === "bunny") { ellipse(ex, ey - k * 0.13, k * 0.05, k * 0.15, L.body); ellipse(ex, ey - k * 0.12, k * 0.022, k * 0.1, L.accent); }
    if (look.ears === "tuft") tri(ex - k * 0.05, ey + k * 0.03, ex + k * 0.05, ey + k * 0.03, ex + sgn * k * 0.09, ey - k * 0.09, L.accent);
  }
  // Horns.
  if (look.horns === "nubs") for (const sgn of [-1, 1]) ellipse(cx + sgn * headR * 0.3, headTop + k * 0.01, k * 0.035, k * 0.04, L.horn);
  if (look.horns === "unicorn") tri(cx - k * 0.035, headTop + k * 0.03, cx + k * 0.035, headTop + k * 0.03, cx, headTop - k * 0.15, L.horn);
  if (look.horns === "antlers") for (const sgn of [-1, 1]) {
    const ax = cx + sgn * headR * 0.35;
    tri(ax - k * 0.02, headTop + k * 0.02, ax + k * 0.02, headTop + k * 0.02, ax + sgn * k * 0.06, headTop - k * 0.13, L.horn);
    tri(ax + sgn * k * 0.02, headTop - k * 0.06, ax + sgn * k * 0.03, headTop - k * 0.04, ax + sgn * k * 0.12, headTop - k * 0.09, L.horn);
  }

  // Pattern on the body (the back view shows stripes/spots too, the belly only from the front).
  const bodyCells = (fn: (x: number, y: number) => boolean, v: L) => {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (m[y * n + x] === L.body && fn(x, y)) m[y * n + x] = v;
  };
  if (look.pattern === "belly" && !back) bodyCells((x, y) => ((x + 0.5 - cx) / (bw * 0.55)) ** 2 + ((y + 0.5 - by - bh * 0.25) / (bh * 0.6)) ** 2 <= 1, L.belly);
  if (look.pattern === "stripes") bodyCells((x, y) => y > headY + hr * 0.5 && Math.floor((x - cx + n) / Math.max(2, k * 0.08)) % 3 === 0, L.accent);
  if (look.pattern === "spots") bodyCells((x, y) => {
    const s = Math.max(3, Math.round(k * 0.14));
    const gx = Math.floor(x / s), gy = Math.floor(y / s);
    const ox = (gx * 7 + gy * 3) % s, oy = (gx * 5 + gy * 11) % s;
    return (x % s - ox) ** 2 + (y % s - oy) ** 2 <= (s * 0.22) ** 2 && y > headY;
  }, L.accent);

  // Face (front only): eyes, cheeks.
  if (!back && hr > 0) {
    const er = Math.max(1, Math.round(k * 0.035));
    const ey = Math.round(headY + hr * 0.05);
    for (const sgn of [-1, 1]) {
      const ex = Math.round(cx + sgn * headR * 0.42);
      for (let y = 0; y < er + 1; y++) for (let x = 0; x < er; x++) set(ex + x - (sgn < 0 ? er - 1 : 0), ey + y, L.eye);
      if (n >= 32 && er > 1) set(ex + (sgn < 0 ? -er + 1 : 0), ey, L.shine);
      if (n >= 24) set(cx + sgn * headR * 0.66, ey + er + 1, L.cheek);
    }
  } else if (!back) {
    for (const sgn of [-1, 1]) set(cx + sgn * bw * 0.35, by - bh * 0.3, L.eye);
  }

  // Paint.
  const [d, b, l] = ramp(look.hue);
  const [ad, ab] = ramp(look.accentHue);
  const c = document.createElement("canvas");
  c.width = n;
  c.height = n;
  const g = c.getContext("2d")!;
  const put = (x: number, y: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
  };
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= n || y >= n ? L.none : m[y * n + x]!);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const v = at(x, y);
      if (v === L.none) {
        // Outline: any empty pixel touching a filled one (4-neighbourhood).
        if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) put(x, y, PAL.ink);
        continue;
      }
      // Light from the upper left: pixels whose up-left neighbour is empty catch light, down-right is shade.
      const lit = !at(x - 1, y - 1) || !at(x - 2, y - 2);
      const shade = !at(x + 1, y + 1) || !at(x + 2, y + 2) || y > ground - bh * 0.35;
      if (v === L.body) put(x, y, lit ? l : shade ? d : b);
      else if (v === L.accent) put(x, y, shade ? ad : ab);
      else if (v === L.belly) put(x, y, shade ? b : l);
      else if (v === L.horn) put(x, y, lit ? PAL.sandL : shade ? PAL.sandD : PAL.sand);
      else if (v === L.eye) put(x, y, PAL.ink);
      else if (v === L.cheek) put(x, y, PAL.flowerP);
      else put(x, y, PAL.sandL); // shine: eye catchlight
    }
  }
  return c;
}
