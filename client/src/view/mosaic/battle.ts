// The fight, as cells: the same plane and palette as the village, one panel of text, nothing above it.
import type { SceneBattle, SceneFighter } from "../../game/ports";
import { C, mix, panelBox, printText } from "./compose";
import { KEEP, type CellGrid } from "./grid";

const COATS = [0xc87f5b, 0xe17276, 0xfeae34, 0x3e8948, 0x63b84d, 0x0099db, 0x8b9bb4, 0xc58a63];
const BODY = ["   E     E   ", "  #########  ", " ###a###a### ", " ########### ", " ####mmm#### ", "  #########  ", "   uu   uu   "];
const BACK = ["   E     E   ", "  #########  ", " ########### ", " ########### ", " ########### ", "  #########  ", "   uu   uu   "];
const FOOT = BODY.length;
const hash = (a: number, b: number) => (Math.imul(a * 374761393 + b * 668265263, 1274126177) >>> 8) % 100;

function fighter(grid: CellGrid, f: SceneFighter, cx: number, foot: number, back: boolean, t: number): void {
  if (f.flash || f.gone >= 1) return;
  const g = f.genes;
  const coat = COATS[Math.floor(((((g?.hue ?? 0.07) % 1) + 1) % 1) * COATS.length)]!;
  const ear = (g?.ears ?? 0.5) < 0.34 ? "^" : (g?.ears ?? 0.5) < 0.67 ? "n" : "|";
  const eye = "oo-^".charAt(Math.min(3, Math.floor((g?.build ?? 0.5) * 4)));
  grid.fresh(C.ink);
  const left = cx - 6 + Math.round(f.dx), top = foot - FOOT + 1 + (Math.floor(t * 2 + cx) & 1) + Math.round(f.gone * 3);
  (back ? BACK : BODY).forEach((row, r) => [...row].forEach((c, i) => {
    if (c === " " || hash(left + i, r) < f.gone * 100) return;
    const x = left + i, y = top + r;
    if (c === "E") grid.put(x, y, ear, C.ink, coat);
    else if (c === "a") grid.put(x, y, eye, C.ink, coat);
    else if (c === "m") grid.put(x, y, "w", C.ink, mix(coat, C.paper, 0.4));
    else if (c === "u") grid.put(x, y, " ", C.ink, mix(coat, C.ink, 0.45));
    else grid.put(x, y, " ", C.ink, r > 3 ? mix(coat, C.ink, 0.12) : coat);
  }));
  if ((g?.horns ?? 0) > 0.6) grid.put(left + 6, top, "V", C.paper, coat);
  if ((g?.tail ?? 0) > 0.5) grid.put(back ? left - 1 : left + 13, top + 3, "~", mix(coat, C.ink, 0.45));
  if ((g?.pattern ?? 0) > 0.6) for (const [i, r] of [[3, 3], [9, 3], [5, 5], [7, 5]] as const) grid.put(left + i, top + r, ":", mix(coat, C.ink, 0.45), coat);
  if (f.shield) for (let r = 0; r < FOOT; r++) {
    grid.put(left - 1, top + r, "(", C.sky);
    grid.put(left + 13, top + r, ")", C.sky);
  }
}

function hills(grid: CellGrid, base: number, amp: number, phase: number, bg: number, ink: number, off: number): void {
  grid.fresh(ink);
  for (let x = 0; x < grid.cols; x++) {
    const top = Math.round(base - amp * (0.5 + 0.5 * Math.sin((x + off) / 9 + phase)));
    for (let y = Math.max(0, top); y < grid.rows; y++) grid.put(x, y, hash(x, y) % 19 === 0 ? "," : " ", ink, hash(x, y) & 1 ? bg : mix(bg, ink, 0.08));
  }
}

function platform(grid: CellGrid, cx: number, cy: number, rx: number): void {
  grid.fresh(C.pathInk);
  for (let y = -2; y <= 2; y++) {
    const w = Math.round(rx * Math.sqrt(1 - (y / 2.6) ** 2));
    for (let x = -w; x <= w; x++) grid.put(cx + x, cy + y, " ", C.ink, y > 0 ? mix(C.path, C.leaf, 0.35) : C.path);
  }
}

function hpBox(grid: CellGrid, x: number, y: number, w: number, f: SceneFighter, numbers: boolean): void {
  const h = numbers ? 5 : 4, frac = Math.max(0, Math.min(1, f.hp / f.maxHp));
  panelBox(grid, x, y, w, h);
  printText(grid, x + 2, y + 1, f.name.slice(0, w - 8), C.ink, C.paper);
  const lv = `L${f.level}`;
  printText(grid, x + w - 2 - lv.length, y + 1, lv, C.woodInk, C.paper);
  printText(grid, x + 2, y + 2, "HP", C.woodInk, C.paper);
  const bar = w - 7, full = Math.round(bar * frac), colour = frac > 0.5 ? C.leaf2 : frac > 0.2 ? C.glow : C.berry;
  for (let c = 0; c < bar; c++) grid.put(x + 5 + c, y + 2, c < full ? "=" : "-", c < full ? C.ink : C.pathInk, c < full ? colour : C.paperDim);
  if (numbers) {
    const n = `${Math.max(0, Math.round(f.hp))}/${f.maxHp}`;
    printText(grid, x + w - 2 - n.length, y + 3, n, C.ink, C.paper);
  }
}

export const MENU_W = 26, MENU_H = 4;

export function composeBattle(b: SceneBattle, grid: CellGrid, t: number): void {
  const { cols, rows } = grid;
  grid.restart();
  grid.fresh(C.ink);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) grid.put(x, y, " ", C.ink, y < rows * 0.2 ? mix(C.sky, C.paper, 0.45) : mix(C.sky, C.paper, 0.7));
  hills(grid, rows * 0.3, 4, 0, mix(C.grass, C.paper, 0.45), C.grassInk, 0);
  hills(grid, rows * 0.42, 3, 1.7, mix(C.grass, C.paper, 0.2), C.grassInk, 13);
  hills(grid, rows * 0.54, 2, 3.1, C.grass, C.grassInk, 27);
  const slide = Math.round((1 - b.slide) * cols * 0.5);
  const foeAt = Math.round(cols * 0.7), foeFoot = Math.round(rows * 0.5);
  const myAt = Math.round(cols * 0.27), myFoot = Math.round(rows * 0.72);
  platform(grid, foeAt, foeFoot, 11);
  platform(grid, myAt, myFoot, 13);
  if (b.foe) fighter(grid, b.foe, foeAt + slide, foeFoot, false, t);
  if (b.mine) fighter(grid, b.mine, myAt - slide, myFoot, true, t);
  grid.penId = 0;
  if (b.hearts > 0) for (let i = 0; i < 3; i++) grid.put(myAt + (i - 1) * 4, myFoot - 9 - Math.round(b.hearts * 3) - i, "♥", C.berry, KEEP);
  const boxW = Math.min(30, cols - 4);
  if (b.foe) hpBox(grid, 2, 1, boxW, b.foe, false);
  if (b.mine) hpBox(grid, cols - boxW - 2, Math.round(rows * 0.58), boxW, b.mine, true);

  if (b.text) {
    const w = cols - 4, h = 5;
    panelBox(grid, 2, rows - h - 1, w, h);
    b.lines(w - 4).slice(0, 3).forEach((l, i) => printText(grid, 4, rows - h + i, l, C.ink, C.paper));
  }
  if (b.tag && !b.menu) {
    panelBox(grid, cols - b.tag.length - 6, rows - 9, b.tag.length + 4, 3);
    printText(grid, cols - b.tag.length - 4, rows - 8, b.tag, C.woodInk, C.paper);
  }
  if (b.menu) {
    const left = cols - MENU_W - 2, top = rows - MENU_H - 7;
    panelBox(grid, left, top, MENU_W, MENU_H);
    b.menu.labels.forEach((l, i) => {
      const x = left + 3 + (i % 2) * 12, y = top + 1 + (i >> 1), on = i === b.menu!.cursor, bg = on ? mix(C.grass, C.paper, 0.5) : C.paper;
      if (on) for (let c = -1; c < 10; c++) grid.put(x + c, y, " ", C.ink, bg);
      if (on && Math.floor(t * 3) % 3 !== 2) grid.put(x - 1, y, ">", C.woodInk, bg);
      printText(grid, x, y, l, C.ink, bg);
    });
  }
}
