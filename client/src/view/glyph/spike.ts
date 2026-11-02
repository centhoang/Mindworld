// Glyph look spike (docs/RESTRUCTURE.md step 2): one screen drawn from a fake scene. No game code is touched.
// draw(t) is pure in t, so a frame can be frozen (?t=9) or stepped for a clip (window.__draw).
import { CELL, PAL as P, cell, glyph, text, textWidth, wrap } from "./atlas";

const W = 416, H = 240;
const COLS = W / CELL, ROWS = H / CELL;

// Tiles are two cells wide and tall. . grass, " flowers, = path, ~ water, b bridge, s soil, d dance floor
const MAP = [
  '..."......====..........~',
  '..........====.........~~',
  '...........===...."...~~~',
  '.....".....===........~~~',
  '...........===.......~~~~',
  '=============================',
  '=============================',
  '....ssssss.====......~~~~',
  '....ssssss.====.dddd.bb==',
  '....ssssss.====.dddd.~~~~',
  '....ssssss.====.dddd.~~~~',
  '...........====......~~~~',
  '.."........====...".~~~~~',
  '...........====.....~~~~~',
  '...........====.....~~~~~',
];
const tileAt = (cx: number, cy: number) => MAP[cy >> 1]?.[cx >> 1] ?? ".";
const hash = (a: number, b: number, s = 0) => {
  let h = (a * 374761393 + b * 668265263 + s * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};

function ground(g: CanvasRenderingContext2D, t: number): void {
  const frame = Math.floor(t * 2.5);
  for (let cy = 0; cy < ROWS; cy++) {
    for (let cx = 0; cx < COLS; cx++) {
      const k = tileAt(cx, cy), h = hash(cx, cy), odd = (cx + cy) & 1;
      if (k === "~" || k === "b") {
        const wave = (cx + (cy & 1) * 5 + (frame * (1 + (cy & 1)))) % 11;
        cell(g, cx, cy, wave === 0 ? "~" : wave === 5 ? "-" : " ", P.waterInk, odd ? P.water : P.water2);
      } else if (k === "=") {
        cell(g, cx, cy, h % 11 === 0 ? ":" : h % 7 === 0 ? "." : " ", P.pathInk, odd ? P.path : P.path2);
      } else if (k === "s") {
        cell(g, cx, cy, cy & 1 ? "=" : " ", P.soilInk, odd ? P.soil : P.soil2);
      } else if (k === "d") {
        const on = ((cx >> 1) + (cy >> 1) + (t > 11 ? frame >> 1 : 0)) & 1;
        cell(g, cx, cy, !on && !(cx & 1) && !(cy & 1) ? "♪" : " ", P.paper, on ? P.plum : P.plum2);
      } else {
        const sway = h % 13 === 0 ? (frame + (h >> 4)) % 6 === 0 ? "\"" : "'" : h % 17 === 0 ? "," : " ";
        cell(g, cx, cy, k === '"' && h % 3 === 0 ? "*" : sway, k === '"' ? (h & 8 ? P.flowerA : P.flowerB) : P.grassInk, odd ? P.grass : P.grass2);
      }
    }
  }
  bridge(g);
}

function bridge(g: CanvasRenderingContext2D): void {
  for (let cx = 42; cx < 46; cx++) for (let cy = 16; cy < 18; cy++) cell(g, cx, cy, cy === 16 ? "=" : "-", P.woodInk, cx & 1 ? P.wood : P.wood2);
}

// Things that stand: each has a foot y, and the frame draws them in foot order (docs/visual/layers.md band 7).
type Standing = { foot: number; draw: (g: CanvasRenderingContext2D) => void };

function tree(cx: number, cy: number): Standing {
  const shape = [" ## ", "####", "####", " || "];
  return { foot: (cy + 4) * CELL, draw(g) {
    shape.forEach((row, y) => [...row].forEach((c, x) => {
      const h = hash(cx + x, cy + y, 3);
      if (c === "#") cell(g, cx + x, cy + y, "&%#@".charAt(h % 4), P.leafInk, h & 16 ? P.leaf : P.leaf2);
      if (c === "|") cell(g, cx + x, cy + y, "|", P.woodInk, P.wood);
    }));
  } };
}

function house(cx: number, cy: number, t: number): Standing {
  const roof = ["   ^^^^   ", "  ^^^^^^  ", " ^^^^^^^^ ", "^^^^^^^^^^"];
  const wall = ["wwWWwwWWww", "wwWWwwDDww", "wwwwwwDDww"];
  return { foot: (cy + 7) * CELL, draw(g) {
    const smoke = Math.floor(t * 2);
    for (let i = 0; i < 3; i++) glyph(g, "oO.".charAt((smoke + i) % 3), (cx + 7) * CELL + ((smoke + i) % 2), (cy - 1 - i) * CELL + 2, P.paper);
    cell(g, cx + 7, cy, "#", P.ink, P.wood2);
    roof.forEach((row, y) => [...row].forEach((c, x) => { if (c === "^") cell(g, cx + x, cy + y, "^", P.roofInk, (x + y) & 1 ? P.roof : "#d96a53"); }));
    wall.forEach((row, y) => [...row].forEach((c, x) => {
      if (c === "w") cell(g, cx + x, cy + 4 + y, y === 2 ? "_" : " ", P.wallInk, P.wall);
      if (c === "W") cell(g, cx + x, cy + 4 + y, "+", P.woodInk, P.glow);
      if (c === "D") cell(g, cx + x, cy + 4 + y, x === 7 && y === 2 ? "." : " ", P.glow, P.woodInk);
    }));
  } };
}

function stall(cx: number, cy: number): Standing {
  return { foot: (cy + 5) * CELL, draw(g) {
    for (let x = 0; x < 8; x++) {
      cell(g, cx + x, cy, "v", x & 1 ? P.paper : P.roof, x & 1 ? P.roof : P.paper);
      cell(g, cx + x, cy + 1, " ", P.ink, x & 1 ? P.roofInk : P.wallInk);
    }
    for (let y = 2; y < 4; y++) { cell(g, cx, cy + y, "|", P.woodInk, P.wood2); cell(g, cx + 7, cy + y, "|", P.woodInk, P.wood2); }
    const goods = "@*@o*@";
    for (let x = 1; x < 7; x++) {
      cell(g, cx + x, cy + 3, goods.charAt(x - 1), x & 1 ? P.berry : P.roofInk, P.paperDim);
      cell(g, cx + x, cy + 4, "=", P.woodInk, P.wood);
    }
    cell(g, cx, cy + 4, "=", P.woodInk, P.wood);
    cell(g, cx + 7, cy + 4, "=", P.woodInk, P.wood);
  } };
}

function board(cx: number, cy: number): Standing {
  return { foot: (cy + 4) * CELL, draw(g) {
    for (let x = 0; x < 4; x++) for (let y = 0; y < 3; y++) cell(g, cx + x, cy + y, y === 0 ? "=" : x && x < 3 ? "=" : " ", y ? P.pathInk : P.woodInk, y ? P.paper : P.wood);
    cell(g, cx, cy + 3, "|", P.woodInk, P.grass);
    cell(g, cx + 3, cy + 3, "|", P.woodInk, P.grass);
  } };
}

// Growth stages, one character each: the crop is a letter that changes.
function crops(g: CanvasRenderingContext2D, t: number): void {
  for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) {
    const cx = 9 + x * 2, cy = 14 + y * 2;
    const stage = Math.min(3, Math.floor(t / 4 + hash(x, y, 7) % 3));
    glyph(g, ".,Y@".charAt(stage), cx * CELL + 1, cy * CELL + 7, stage === 3 ? P.berry : P.sprout);
    if (stage === 3) glyph(g, "Y", cx * CELL + 1, cy * CELL + 2, P.sprout);
  }
}

type Who = { name: string; x: number; y: number; hair: string; shirt: string; hat: "cap" | "bucket" | "scarf" | "hood" | "star"; eyes?: string; mouth?: string; walk?: boolean; dir?: number };

// Big head, small body. The face is two eyes and a mouth, so a mood is one character change.
function person(p: Who, t: number): Standing {
  return { foot: p.y, draw(g) {
    const step = p.walk ? Math.floor(t * 6) & 1 : 0;
    const blink = hash(p.name.length, Math.floor(t / 3)) % 4 === 0 && t % 3 < 0.15;
    const x = Math.round(p.x) - 8, y = Math.round(p.y) - 21 - (p.walk ? step : Math.floor(t * 1.5 + p.x) & 1 ? 0 : 0);
    g.fillStyle = "rgba(43,58,58,.28)";
    g.fillRect(x + 3, p.y - 2, 10, 3);
    g.fillRect(x + 2, p.y - 1, 12, 1);
    g.fillStyle = P.ink;
    g.fillRect(x + 5, y + 18 + (step ? 0 : 1), 2, 2 - (step ? 0 : 1));
    g.fillRect(x + 9, y + 18 + (step ? 1 : 0), 2, 2 - (step ? 1 : 0));
    g.fillStyle = p.shirt;
    g.fillRect(x + 4, y + 13, 8, 6);
    g.fillStyle = P.skin;
    g.fillRect(x + 2, y + 15 + step, 2, 2);
    g.fillRect(x + 12, y + 16 - step, 2, 2);
    g.fillRect(x + 2, y + 3, 12, 10);
    g.fillRect(x + 1, y + 4, 14, 8);
    g.fillStyle = p.hair;
    if (p.hat === "cap") { g.fillRect(x + 2, y + 1, 12, 4); g.fillRect(x + 1, y + 3, 15, 2); }
    if (p.hat === "bucket") { g.fillRect(x + 3, y, 10, 4); g.fillRect(x, y + 4, 16, 2); }
    if (p.hat === "scarf") { g.fillRect(x + 2, y + 1, 12, 4); g.fillRect(x + 1, y + 3, 2, 8); g.fillRect(x + 13, y + 3, 2, 8); }
    if (p.hat === "hood") { g.fillRect(x + 2, y, 12, 4); g.fillRect(x + 1, y + 2, 2, 11); g.fillRect(x + 13, y + 2, 2, 11); g.fillStyle = P.paper; g.fillRect(x + 4, y + 10, 8, 4); g.fillRect(x + 6, y + 14, 4, 2); }
    if (p.hat === "star") { g.fillRect(x + 2, y + 1, 12, 4); g.fillRect(x + 1, y + 3, 3, 3); g.fillRect(x + 12, y + 3, 3, 3); g.fillRect(x + 6, y, 3, 2); }
    g.fillStyle = P.ink;
    const eyes = blink ? "-" : p.eyes ?? ".";
    const ey = y + 7, lx = x + 4 + (p.dir ?? 0), rx = x + 10 + (p.dir ?? 0);
    if (eyes === ".") { g.fillRect(lx, ey, 2, 3); g.fillRect(rx, ey, 2, 3); }
    if (eyes === "-") { g.fillRect(lx, ey + 1, 2, 1); g.fillRect(rx, ey + 1, 2, 1); }
    if (eyes === "^") { for (const e of [lx, rx]) { g.fillRect(e, ey + 1, 1, 1); g.fillRect(e + 1, ey, 1, 1); g.fillRect(e + 2, ey + 1, 1, 1); } }
    if (p.mouth === "o") g.fillRect(x + 7 + (p.dir ?? 0), y + 10, 2, 2);
    else if (p.mouth !== "-" && p.hat !== "hood") { g.fillRect(x + 7 + (p.dir ?? 0), y + 11, 2, 1); }
    g.fillStyle = P.pink;
    g.fillRect(x + 2 + (p.dir ?? 0), y + 10, 2, 1);
    g.fillRect(x + 12 + (p.dir ?? 0), y + 10, 2, 1);
  } };
}

// Genes pick the ears, the colour and the face. The face is a tiny kaomoji, so a mood reads at a glance.
function pet(x: number, y: number, t: number, colour: string, ears: "cat" | "bun" | "none", face: string): Standing {
  const hop = Math.floor(t * 4) % 3 === 0 ? 2 : 0;
  return { foot: y, draw(g) {
    const px = Math.round(x) - 8, py = Math.round(y) - 14 - hop;
    g.fillStyle = "rgba(43,58,58,.28)";
    g.fillRect(px + 2, y - 1, 12, 2);
    g.fillStyle = colour;
    if (ears === "cat") { g.fillRect(px + 2, py, 3, 3); g.fillRect(px + 11, py, 3, 3); }
    if (ears === "bun") { g.fillRect(px + 3, py - 4, 3, 7); g.fillRect(px + 10, py - 4, 3, 7); }
    g.fillRect(px + 2, py + 2, 12, 12);
    g.fillRect(px + 1, py + 4, 14, 8);
    g.fillRect(px, py + 6, 16, 5);
    text(g, face, px + 8 - textWidth(face) / 2, py + 4, P.ink);
  } };
}

function bubble(g: CanvasRenderingContext2D, s: string, x: number, footY: number): void {
  const lines = wrap(s, 26);
  const w = Math.max(...lines.map(textWidth)) + 8, h = lines.length * 9 + 5;
  const bx = Math.min(W - w - 4, Math.max(4, Math.round(x - w / 2))), by = Math.round(footY) - h;
  g.fillStyle = P.ink;
  g.fillRect(bx + 1, by - 1, w - 2, h + 2);
  g.fillRect(bx - 1, by + 1, w + 2, h - 2);
  g.fillRect(bx, by, w, h);
  g.fillRect(Math.round(x) - 2, by + h, 5, 3);
  g.fillStyle = P.paper;
  g.fillRect(bx + 1, by, w - 2, h);
  g.fillRect(bx, by + 1, w, h - 2);
  g.fillRect(Math.round(x) - 1, by + h, 3, 2);
  lines.forEach((l, i) => text(g, l, bx + 4, by + 3 + i * 9, P.ink));
}

function thought(g: CanvasRenderingContext2D, s: string, x: number, footY: number): void {
  const w = textWidth(s) + 10, bx = Math.round(x - w / 2), by = Math.round(footY) - 15;
  g.fillStyle = P.ink;
  g.fillRect(bx, by, w, 13);
  g.fillRect(Math.round(x) + 2, by + 14, 3, 2);
  g.fillRect(Math.round(x), by + 17, 2, 2);
  g.fillStyle = P.sky;
  g.fillRect(bx + 1, by + 1, w - 2, 11);
  text(g, s, bx + 5, by + 3, P.paper);
}

function tag(g: CanvasRenderingContext2D, name: string, x: number, y: number): void {
  const w = textWidth(name);
  const tx = Math.round(x - w / 2);
  g.fillStyle = "rgba(59,44,53,.72)";
  g.fillRect(tx - 2, y, w + 4, 9);
  text(g, name, tx, y + 1, P.paper);
}

function panel(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  g.fillStyle = P.ink;
  g.fillRect(x + 1, y, w - 2, h);
  g.fillRect(x, y + 1, w, h - 2);
  g.fillStyle = P.paper;
  g.fillRect(x + 1, y + 1, w - 2, h - 2);
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * Math.max(0, Math.min(1, k));
const SAY = "My birthday is tonight at the dance floor, come?";
const ANSWER = "Tonight? I'll close the stall early. Save me a dance!";

function draw(g: CanvasRenderingContext2D, t: number): void {
  const kaiX = lerp(120, 236, t / 3), kaiY = lerp(100, 110, t / 3);
  const walking = t < 3;
  const amaHappy = t > 7.5;
  const close = lerp(0, 1, (t - 11) / 3);
  const amaX = lerp(272, 312, close), amaY = lerp(108, 168, close);
  const pipX = 276 + Math.sin(t * 2) * 8, pipY = 178;
  const typed = SAY.slice(0, Math.floor(lerp(0, SAY.length, (t - 0.6) / 2.4)));
  ground(g, t);
  crops(g, t);
  const things: Standing[] = [
    tree(1, 2), tree(4, 7), tree(16, 1), tree(39, 1), tree(24, 2), tree(2, 24), tree(38, 24),
    house(8, 2, t), stall(30, 5), board(19, 22),
    person({ name: "Pip", x: pipX, y: pipY, hair: "#8a5a3c", shirt: P.berry, hat: "cap", walk: true, eyes: "^" }, t),
    person({ name: "Mo", x: 358, y: 118, hair: "#5a86b8", shirt: "#d9c27e", hat: "bucket", mouth: "-", dir: 1 }, t),
    person({ name: "Elder", x: 120, y: 200, hair: P.leaf, shirt: P.leaf2, hat: "hood" }, t),
    person({ name: "Ama", x: amaX, y: amaY, hair: P.pink, shirt: P.plum, hat: "scarf", eyes: amaHappy ? "^" : ".", mouth: amaHappy ? "o" : undefined, walk: close > 0 && close < 1, dir: -1 }, t),
    person({ name: "Kai", x: kaiX, y: kaiY, hair: "#f0b64a", shirt: P.sky, hat: "star", walk: walking, dir: 1 }, t),
    pet(kaiX - 22 + Math.sin(t * 2) * 2, kaiY + 8, t, P.flowerB, "cat", amaHappy ? "^w^" : "o.o"),
    pet(60, 208, t * 0.5, P.pink, "bun", "-w-"),
  ];
  things.sort((a, b) => a.foot - b.foot);
  for (const s of things) s.draw(g);
  g.fillStyle = P.ink;
  for (let i = 0; i < 12; i++) g.fillRect(366 + i, 98 + (i * i) / 12, 1, 1);
  glyph(g, "o", 377, 110 + (Math.floor(t * 2) & 1), P.berry);

  const dusk = lerp(0, 0.3, (t - 10) / 5);
  if (dusk > 0) {
    g.fillStyle = `rgba(70,56,140,${dusk})`;
    g.fillRect(0, 0, W, H);
    g.globalAlpha = dusk * 2.8;
    for (const cx of [10, 11, 14, 15]) for (const cy of [6, 7]) cell(g, cx, cy, "+", P.woodInk, P.glow);
    g.globalAlpha = 1;
  }

  tag(g, "Pip", pipX, pipY + 3);
  tag(g, "Mo", 358, 121);
  tag(g, "Elder", 120, 203);
  tag(g, "Ama", amaX, amaY + 3);
  tag(g, "Kai", kaiX, kaiY + 3);
  if (t > 3.2 && t < 5.4) bubble(g, SAY, kaiX, kaiY - 26);
  if (t > 5.4 && t < 7.2) bubble(g, ".".repeat(1 + (Math.floor(t * 3) % 3)), amaX, amaY - 26);
  if (t > 7.2 && t < 11) bubble(g, ANSWER, amaX, amaY - 26);
  if (t > 11 && t < 15.5) thought(g, "♪ Kai, dusk ♥", amaX, amaY - 24);
  if (t > 9 && t < 13) thought(g, "tell Pip?", 340, 92);

  panel(g, 4, 4, 96, 15);
  text(g, "Day 3  5:40 pm", 9, 8, P.ink);
  panel(g, W - 56, 4, 52, 15);
  glyph(g, "@", W - 51, 8, P.berry);
  text(g, "128", W - 42, 8, P.ink);
  panel(g, 92, H - 19, 232, 15);
  const box = t < 3.2 ? typed : "";
  text(g, `> ${box}`.slice(0, 36) + (Math.floor(t * 3) & 1 ? "_" : ""), 97, H - 15, box ? P.ink : P.pathInk);
}

const canvas = document.querySelector("canvas")!;
const g = canvas.getContext("2d")!;
canvas.width = W;
canvas.height = H;
const scale = Math.max(1, Math.floor(Math.min(innerWidth / W, innerHeight / H)));
canvas.style.width = `${W * scale}px`;
canvas.style.height = `${H * scale}px`;
const LOOP = 16;
const frozen = new URLSearchParams(location.search).get("t");
(window as unknown as { __draw: (t: number) => string }).__draw = (t) => {
  draw(g, t);
  return canvas.toDataURL("image/png");
};
if (frozen !== null) draw(g, Number(frozen));
else {
  const tick = (ms: number) => {
    draw(g, (ms / 1000) % LOOP);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
