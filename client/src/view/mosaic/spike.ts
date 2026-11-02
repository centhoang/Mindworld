// Mosaic spike: the same scene as ../glyph/spike.ts, on one full-screen plane of cells. No game code is touched.
// There is no sprite, overlay or second canvas: each tick writes the wanted cells and CellGrid paints the ones that differ.
// Same-time rule: compose(t) is pure in t apart from the player's keys, so a frame can be frozen (?t=9) or stepped (window.__draw).
import { CELL, PAL, cell, wrap } from "../glyph/atlas";
import { CellGrid, KEEP } from "./grid";

const rgb = (hex: string) => parseInt(hex.slice(1), 16);
const css = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
const C = Object.fromEntries(Object.entries(PAL).map(([k, v]) => [k, rgb(v)])) as Record<keyof typeof PAL, number>;

const TICK = 12; // grid updates per second; nothing happens between ticks
const LOOP = 16;
const canvas = document.querySelector("canvas")!;
const g = canvas.getContext("2d", { alpha: false })!;
let grid = new CellGrid(1, 1);
let camX = 0, camY = 0;
let grout = true;
let showStats = false;

const hash = (a: number, b: number, s = 0) => {
  let h = (a * 374761393 + b * 668265263 + s * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};
const lerp = (a: number, b: number, k: number) => a + (b - a) * Math.max(0, Math.min(1, k));
const mix = (a: number, b: number, k: number) => {
  const c = (s: number) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k) << s;
  return c(16) | c(8) | c(0);
};
const put = (x: number, y: number, ch: string, ink: number, bg: number = KEEP) => grid.put(x - camX, y - camY, ch, ink, bg);
const shade = (x: number, y: number) => {
  const bg = grid.background(x - camX, y - camY);
  grid.setBackground(x - camX, y - camY, mix(bg, C.shadow, 0.28));
};

function write(x: number, y: number, s: string, ink: number, bg: number = KEEP): void {
  for (let i = 0; i < s.length; i++) put(x + i, y, s.charAt(i), ink, bg);
}

// --- The ground: every cell is worked out from its position, so the map has no edge and always fills the screen. ---
const riverLeft = (y: number) => 60 + Math.round(Math.sin(y / 7) * 2 + Math.sin(y / 3));
const inRect = (x: number, y: number, x0: number, y0: number, x1: number, y1: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

function ground(x: number, y: number, t: number): void {
  const h = hash(x, y), pick = h & 1;
  const left = riverLeft(y);
  const river = x >= left && x < left + 13;
  const road = y >= 17 && y <= 22;
  if (river && road) {
    put(x, y, y === 17 || y === 22 ? "=" : x & 1 ? "|" : " ", C.woodInk, y & 1 ? C.wood : C.wood2);
  } else if (river) {
    const wave = (x + (y & 1) * 5 + Math.floor(t * 2.5) * (1 + (y & 1))) % 11;
    put(x, y, wave === 0 ? "~" : wave === 5 ? "-" : " ", C.waterInk, pick ? C.water : C.water2);
  } else if (road || (x >= 36 && x <= 43)) {
    put(x, y, h % 11 === 0 ? ":" : h % 7 === 0 ? "." : " ", C.pathInk, pick ? C.path : C.path2);
  } else if (inRect(x, y, 10, 26, 29, 37)) {
    put(x, y, (y - 26) % 3 === 1 ? "=" : " ", C.soilInk, pick ? C.soil : C.soil2);
  } else if (inRect(x, y, 46, 27, 57, 35)) {
    const tx = (x - 46) / 3 | 0, ty = (y - 27) / 3 | 0;
    const on = (tx + ty + (t > 11 ? Math.floor(t * 2.5) >> 1 : 0)) & 1;
    put(x, y, !on && (x - 46) % 3 === 1 && (y - 27) % 3 === 1 ? "♪" : " ", C.paper, on ? C.plum : C.plum2);
  } else {
    const sway = h % 13 === 0 ? ((Math.floor(t * 2.5) + (h >> 4)) % 6 === 0 ? '"' : "'") : h % 17 === 0 ? "," : h % 19 === 0 ? "." : " ";
    const flower = h % 149 === 0;
    put(x, y, flower ? "*" : sway, flower ? (h & 8 ? C.flowerA : C.flowerB) : C.grassInk, pick ? C.grass : C.grass2);
  }
}

// --- Things that stand: each writes its cells, in foot order (docs/visual/layers.md band 7). ---
type Standing = { foot: number; draw: () => void };

function tree(x: number, y: number): Standing {
  const shape = ["  ####  ", " ###### ", "########", "########", " ###### ", "   ||   ", "   ||   "];
  return { foot: y + 6, draw() {
    shape.forEach((row, ry) => [...row].forEach((c, rx) => {
      const h = hash(x + rx, y + ry, 3);
      if (c === "#") put(x + rx, y + ry, "&%#@".charAt(h % 4), C.leafInk, h & 16 ? C.leaf : C.leaf2);
      if (c === "|") put(x + rx, y + ry, "|", C.woodInk, C.wood);
    }));
  } };
}

function house(x: number, y: number, t: number): Standing {
  return { foot: y + 12, draw() {
    const smoke = Math.floor(t * 2);
    for (let i = 0; i < 3; i++) put(x + 15 + ((smoke + i) & 1), y - 2 - i, "oO.".charAt((smoke + i) % 3), C.paper);
    put(x + 15, y - 1, "#", C.ink, C.wood2);
    put(x + 15, y, "#", C.ink, C.wood2);
    for (let r = 0; r < 7; r++) for (let c = 6 - r; c < 14 + r; c++) put(x + c, y + r, "^", C.roofInk, (c + r) & 1 ? C.roof : 0xd96a53);
    for (let r = 7; r < 13; r++) for (let c = 0; c < 20; c++) {
      const win = (c >= 3 && c <= 6 || c >= 9 && c <= 10) && r >= 8 && r <= 9, door = c >= 13 && c <= 16 && r >= 8;
      if (win) put(x + c, y + r, "+", C.woodInk, C.glow);
      else if (door) put(x + c, y + r, c === 15 && r === 10 ? "." : " ", C.glow, C.woodInk);
      else put(x + c, y + r, r === 12 ? "_" : " ", C.wallInk, C.wall);
    }
  } };
}

function stall(x: number, y: number): Standing {
  return { foot: y + 7, draw() {
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
  } };
}

function board(x: number, y: number): Standing {
  return { foot: y + 5, draw() {
    for (let c = 0; c < 8; c++) for (let r = 0; r < 4; r++) put(x + c, y + r, r === 0 ? "=" : c && c < 7 ? "=" : " ", r ? C.pathInk : C.woodInk, r ? C.paper : C.wood);
    for (let r = 4; r < 6; r++) { put(x + 1, y + r, "|", C.woodInk); put(x + 6, y + r, "|", C.woodInk); }
  } };
}

function crops(t: number): void {
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
    const x = 12 + c * 3, y = 27 + r * 3;
    const stage = Math.min(3, Math.floor(t / 4 + hash(c, r, 7) % 3));
    put(x, y, ".,Y@".charAt(stage), stage === 3 ? C.berry : C.sprout);
    if (stage === 3) put(x, y - 1, "Y", C.sprout);
  }
}

type Who = { name: string; x: number; y: number; hair: number; shirt: number; hat: keyof typeof HATS; sides?: boolean; eyes?: string; mouth?: string; walk?: boolean; dir?: number };

// Two rows of hair over a seven-wide face. H is a hair cell; the other cells stay ground.
const HATS = { cap: [" HHHHH ", "HHHHHHH"], bucket: ["  HHH  ", "HHHHHHH"], crown: [" H H H ", "HHHHHHH"], bun: ["  HHH  ", " HHHHH "], hood: [" HHHHH ", "HHHHHHH"] };

// A person is seven cells wide and six tall: big head, small body. A mood is one character changed.
function person(p: Who, t: number): Standing {
  const x = Math.round(p.x), y = Math.round(p.y);
  return { foot: y, draw() {
    const step = p.walk ? Math.floor(t * 6) & 1 : 0;
    const blink = t % 3 < 0.15 && hash(p.name.length, Math.floor(t / 3)) % 4 === 0;
    const e = blink ? "-" : p.eyes ?? "o", d = p.dir ?? 0;
    for (let c = -2; c <= 2; c++) shade(x + c, y);
    HATS[p.hat].forEach((row, r) => [...row].forEach((c, i) => { if (c === "H") put(x - 3 + i, y - 5 + r, " ", C.ink, p.hair); }));
    for (let c = -3; c <= 3; c++) {
      const side = p.sides && Math.abs(c) === 3;
      put(x + c, y - 3, " ", C.ink, side ? p.hair : C.skin);
      if (Math.abs(c) < 3) put(x + c, y - 2, " ", C.ink, side ? p.hair : C.skin);
      else if (side) put(x + c, y - 2, " ", C.ink, p.hair);
    }
    put(x - 1 + d, y - 3, e, C.ink, C.skin);
    put(x + 1 + d, y - 3, e, C.ink, C.skin);
    put(x + d, y - 2, p.mouth ?? ".", C.ink, C.skin);
    put(x - 2 + d, y - 2, " ", C.ink, C.pink);
    put(x + 2 + d, y - 2, " ", C.ink, C.pink);
    for (let c = -2; c <= 2; c++) put(x + c, y - 1, c === 0 ? "#" : " ", mix(p.shirt, C.ink, 0.3), Math.abs(c) === 2 ? C.skin : p.shirt);
    put(x - 1, y, " ", C.ink, step ? KEEP : C.ink);
    put(x + 1, y, " ", C.ink, step ? C.ink : KEEP);
    if (p.walk) { put(x - 1, y, step ? "." : " ", C.ink); put(x + 1, y, step ? " " : ".", C.ink); }
  } };
}

// Genes pick the ears, the colour and the face, as they would in the game.
function pet(px: number, py: number, t: number, colour: number, ears: string, face: string): Standing {
  const x = Math.round(px), y = Math.round(py), hop = Math.floor(t * 4) % 3 === 0 ? 1 : 0;
  return { foot: y, draw() {
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
  } };
}

function tag(name: string, x: number, y: number): void {
  write(Math.round(x) - (name.length >> 1), Math.round(y) + 1, name, C.paper, mix(C.ink, C.grass, 0.15));
}

// Placed on the plane, not the world, so a bubble never leaves the screen.
function bubble(s: string, wx: number, wy: number, paper = C.paper, ink = C.ink): void {
  const lines = wrap(s, 28), w = Math.max(...lines.map((l) => l.length)) + 4, h = lines.length + 2;
  const sx = Math.round(wx) - camX, top = Math.round(wy) - camY - h;
  const left = Math.max(1, Math.min(grid.cols - w - 1, sx - (w >> 1)));
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    if ((r === 0 || r === h - 1) && (c === 0 || c === w - 1)) continue;
    const edge = r === 0 || r === h - 1 ? "-" : c === 0 || c === w - 1 ? "|" : " ";
    grid.put(left + c, top + r, edge, ink, paper);
  }
  lines.forEach((l, i) => { for (let c = 0; c < l.length; c++) grid.put(left + 2 + c, top + 1 + i, l.charAt(c), ink, paper); });
  grid.put(sx, top + h, "v", ink, paper);
}

function thought(s: string, wx: number, wy: number): void {
  const x = Math.round(wx) - camX, y = Math.round(wy) - camY, w = s.length + 2;
  grid.put(x + 1, y - 1, "o", C.sky);
  grid.put(x + 2, y - 2, "O", C.sky);
  const left = Math.max(0, Math.min(grid.cols - w, x - (w >> 1)));
  for (let c = 0; c < w; c++) grid.put(left + c, y - 3, c && c <= s.length ? s.charAt(c - 1) : " ", C.paper, C.sky);
}

function panel(x: number, y: number, s: string, ink = C.ink): void {
  const w = s.length + 2;
  for (let c = 0; c < w; c++) {
    grid.put(x + c, y, "-", C.pathInk, C.paper);
    grid.put(x + c, y + 2, "-", C.pathInk, C.paper);
    grid.put(x + c, y + 1, c && c <= s.length ? s.charAt(c - 1) : " ", ink, C.paper);
  }
}

const SAY = "My birthday is tonight at the dance floor, come?";
const ANSWER = "Tonight? I'll close the stall early. Save me a dance!";

// The player. Null until a key is pressed: then Kai leaves the script and the camera follows.
let me: { x: number; y: number; dirX: number; moved: number } | null = null;
let typing: string | null = null;
let said = "";
let saidUntil = 0;
let clock = 0;

const stats = { cells: 0, ticks: 0, painted: 0, composeMs: 0, paintMs: 0, last: 0 };

function dusk(step: number): void {
  const memo = new Map<number, number>();
  const k = step * 0.05;
  grid.recolour((c) => {
    if (c === C.glow) return c;
    let v = memo.get(c);
    if (v === undefined) memo.set(c, (v = mix(c, 0x46388c, k)));
    return v;
  });
}

function compose(t: number): void {
  const walking = t < 3;
  const kaiX = me?.x ?? lerp(24, 42, t / 3), kaiY = me?.y ?? lerp(16, 20, t / 3);
  const amaHappy = t > 7.5;
  const close = lerp(0, 1, (t - 11) / 3);
  const amaX = lerp(52, 54, close), amaY = lerp(20, 33, close);
  const pipX = 48 + Math.sin(t * 2) * 1.5, pipY = 33;

  if (me) {
    // A dead zone: the plane only shifts when the player nears its edge, and it shifts by whole cells.
    const margin = 14;
    if (me.x - camX < margin) camX = me.x - margin;
    if (me.x - camX > grid.cols - margin) camX = me.x - grid.cols + margin;
    if (me.y - camY < margin - 4) camY = me.y - margin + 4;
    if (me.y - camY > grid.rows - margin + 4) camY = me.y - grid.rows + margin - 4;
  } else {
    camX = 39 - (grid.cols >> 1);
    camY = 22 - (grid.rows >> 1);
  }

  for (let y = 0; y < grid.rows; y++) for (let x = 0; x < grid.cols; x++) ground(x + camX, y + camY, t);
  crops(t);

  const kaiWalks = me ? clock - me.moved < 0.2 : walking;
  const things: Standing[] = [
    tree(1, 4), tree(29, 2), tree(28, 9), tree(1, 27), tree(50, -3), tree(61, 40), tree(32, 40),
    tree(-6, 12), tree(-10, 30), tree(82, 8), tree(86, 28), tree(10, -6), tree(24, 42), tree(76, 42),
    house(8, 3, t), stall(46, 6), board(31, 27),
    person({ name: "Pip", x: pipX, y: pipY, hair: 0x8a5a3c, shirt: C.berry, hat: "cap", walk: true, eyes: "^" }, t),
    person({ name: "Mo", x: 65, y: 20, hair: 0x5a86b8, shirt: 0xd9c27e, hat: "bucket", mouth: "_", dir: 1 }, t),
    person({ name: "Elder", x: 19, y: 41, hair: C.leaf, shirt: C.leaf2, hat: "hood", sides: true, mouth: "w" }, t),
    person({ name: "Ama", x: amaX, y: amaY, hair: C.pink, shirt: C.plum, hat: "bun", sides: true, eyes: amaHappy ? "^" : "o", mouth: amaHappy ? "o" : ".", walk: close > 0 && close < 1, dir: -1 }, t),
    person({ name: "Kai", x: kaiX, y: kaiY, hair: 0xf0b64a, shirt: C.sky, hat: "crown", walk: kaiWalks, dir: me ? me.dirX : 1 }, t),
    pet(kaiX - 9 * (me ? me.dirX || 1 : 1), kaiY + 1, t, C.flowerB, "^", amaHappy ? "^w^" : "o.o"),
    pet(8, 41, t * 0.5, C.pink, "|", "-w-"),
  ];
  things.sort((a, b) => a.foot - b.foot);
  for (const s of things) s.draw();

  // Mo's rod and bobber: characters in cells, like everything else.
  [[69, 15, "_"], [70, 15, "_"], [71, 16, "\\"], [71, 17, ":"], [71, 18, ":"], [71, 19, ":"], [71, 20, ":"], [71, 21, ":"], [71, 22, ":"]].forEach(([x, y, c]) => put(x as number, y as number, c as string, C.ink));
  put(71, 23 + (Math.floor(t * 2) & 1), "o", C.berry);

  const step = Math.round(lerp(0, 6, (t - 10) / 5));
  if (step > 0) dusk(step);

  tag("Pip", pipX, pipY);
  tag("Mo", 65, 20);
  tag("Elder", 19, 41);
  tag("Ama", amaX, amaY);
  tag("Kai", kaiX, kaiY);
  if (clock < saidUntil) bubble(said, kaiX, kaiY - 6);
  else if (!me && t > 3.2 && t < 5.4) bubble(SAY, kaiX, kaiY - 6);
  if (t > 5.4 && t < 7.2) bubble(".".repeat(1 + (Math.floor(t * 3) % 3)), amaX, amaY - 6);
  if (t > 7.2 && t < 11) bubble(ANSWER, amaX, amaY - 6);
  if (t > 11 && t < 15.5) thought("♪ Kai, dusk ♥", amaX, amaY - 5);
  if (t > 9 && t < 13) thought("tell Pip?", 65, 15);

  panel(1, 1, "Day 3  5:40 pm");
  const coins = " @ 128 ";
  panel(grid.cols - coins.length - 3, 1, coins, C.berry);
  const cursor = Math.floor(t * 3) & 1 ? "_" : " ";
  const typed = typing ?? (me ? "" : SAY.slice(0, Math.floor(lerp(0, SAY.length, (t - 0.6) / 2.4)) * (t < 3.2 ? 1 : 0)));
  const box = Math.min(60, grid.cols - 8);
  panel((grid.cols - box - 2) >> 1, grid.rows - 4, `> ${typed}${cursor}`.slice(-box).padEnd(box));

  if (showStats) {
    const perTick = stats.ticks ? Math.round(stats.painted / stats.ticks) : 0;
    const lines = [`plane ${grid.cols}x${grid.rows} = ${stats.cells} cells`, `painted now ${stats.last}`, `painted avg ${perTick}`, `compose ${(stats.composeMs / Math.max(1, stats.ticks)).toFixed(2)} ms`, `paint   ${(stats.paintMs / Math.max(1, stats.ticks)).toFixed(2)} ms`];
    lines.forEach((l, i) => { for (let c = 0; c < 32; c++) grid.put(1 + c, 5 + i, l.charAt(c) || " ", C.paper, C.ink); });
  }
}

function paintCell(x: number, y: number, ch: string, ink: number, bg: number): void {
  cell(g, x, y, ch, css(ink), css(bg));
  if (grout) {
    g.fillStyle = "rgba(43,58,58,.08)";
    g.fillRect(x * CELL + CELL - 1, y * CELL, 1, CELL);
    g.fillRect(x * CELL, y * CELL + CELL - 1, CELL - 1, 1);
  }
}

const frozenT = () => { const v = new URLSearchParams(location.search).get("t"); return v === null ? null : Number(v); };
let lastT = 0;
function tick(t: number): void {
  lastT = t;
  const a = performance.now();
  compose(t);
  const b = performance.now();
  const painted = grid.flush(paintCell);
  const c = performance.now();
  stats.composeMs += b - a;
  stats.paintMs += c - b;
  stats.painted += painted;
  stats.last = painted;
  stats.ticks++;
}

// Whole device pixels per art pixel, about 45 rows or more; the plane then takes as many cells as the window holds.
function fit(): void {
  const dpr = devicePixelRatio || 1;
  const k = Math.max(1, Math.floor((innerHeight * dpr) / (45 * CELL)));
  const size = (CELL * k) / dpr;
  const cols = Math.ceil(innerWidth / size), rows = Math.ceil(innerHeight / size);
  grid = new CellGrid(cols, rows);
  stats.cells = cols * rows;
  canvas.width = cols * CELL;
  canvas.height = rows * CELL;
  canvas.style.width = `${cols * size}px`;
  canvas.style.height = `${rows * size}px`;
  tick(lastT);
}

function key(e: KeyboardEvent): void {
  if (typing !== null) {
    if (e.key === "Enter") {
      if (typing) { said = typing; saidUntil = clock + 4; }
      typing = null;
    } else if (e.key === "Escape") typing = null;
    else if (e.key === "Backspace") typing = typing.slice(0, -1);
    else if (e.key.length === 1 && typing.length < 56) typing += e.key;
    e.preventDefault();
    return;
  }
  const dir: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1] };
  const d = dir[e.key];
  if (d) {
    me ??= { x: 42, y: 20, dirX: 1, moved: 0 };
    me.x += d[0];
    me.y += d[1];
    if (d[0]) me.dirX = d[0];
    me.moved = clock;
    e.preventDefault();
  } else if (e.key === "Enter") { me ??= { x: 42, y: 20, dirX: 1, moved: 0 }; typing = ""; }
  else if (e.key === "g") { grout = !grout; fit(); }
  else if (e.key === "i") { showStats = !showStats; stats.ticks = stats.painted = stats.composeMs = stats.paintMs = 0; }
}

if (frozenT() !== null) lastT = frozenT()!;
fit();
addEventListener("resize", fit);
addEventListener("keydown", key);

const w = window as unknown as Record<string, unknown>;
w.__stats = stats;
w.__resetStats = () => { stats.ticks = stats.painted = stats.composeMs = stats.paintMs = 0; };
w.__draw = (t: number) => { tick(t); return canvas.toDataURL("image/png"); };
w.__tick = tick;

if (frozenT() === null) {
  let last = -1;
  const frame = (ms: number) => {
    const n = Math.floor((ms / 1000) * TICK);
    if (n !== last) {
      last = n;
      clock = ms / 1000;
      tick((ms / 1000) % LOOP);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
