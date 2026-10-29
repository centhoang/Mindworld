// The classic two-platform battle screen: the foe on the upper-right platform (front sprite), your pet on
// the lower-left one (back sprite), HP boxes, and the text box that narrates each turn. The fight rules
// stay in ../sim/battle; this view only plays a turn record as a short script of timed steps.

import type { Action, EnemyAct, Outcome } from "../sim/types";
import { drawProp, PAL, TREE } from "./art";
import { drawDialogue, drawFrame, drawText, GLYPH } from "./text";

export interface Side {
  name: string;
  sprite: HTMLCanvasElement;
  maxHp: number;
  portrait?: HTMLCanvasElement; // 32x32 face for the text box
  level?: number;
}

export const COMMANDS = ["fight", "teach", "swap", "run"] as const;
export type Command = (typeof COMMANDS)[number];
const CMD_LABEL: Record<Command, string> = { fight: "Fight", teach: "Teach", swap: "Swap", run: "Run" };
const MENU_W = 144;

interface Step {
  dur: number;
  start?: () => void;
  tick?: (p: number) => void;
  done?: () => void;
}

const ease = (p: number) => 1 - (1 - p) ** 2;

export class BattleView {
  private foe: Side | null = null;
  private mine: Side | null = null;
  private foeHp = 0;
  private myHp = 0;
  private foeHpShown = 0;
  private myHpShown = 0;
  private text = "";
  private typed = 0; // characters revealed so far
  private tag = ""; // small label after the text, e.g. which memo rule fired
  private readonly script: Step[] = [];
  private stepT = 0;
  private started = false;
  private resolve: (() => void) | null = null;
  // Animation offsets.
  private intro = 0; // 0..1 sprites slide in
  private foeDx = 0;
  private myDx = 0;
  private foeFlash = 0;
  private myFlash = 0;
  private shake = 0;
  private foeGone = 0; // 0..1 faint / flee fade
  private myGone = 0;
  private foeShield = false;
  private myShield = false;
  private hearts = 0;
  private cmd: { cursor: number; pick: (c: Command) => void } | null = null;
  private cursor = 0;

  open(foe: Side, mine: Side): Promise<void> {
    this.foe = foe;
    this.mine = mine;
    this.foeHp = this.foeHpShown = foe.maxHp;
    this.myHp = this.myHpShown = mine.maxHp;
    this.foeGone = this.myGone = 0;
    this.foeShield = this.myShield = false;
    this.text = "";
    this.tag = "";
    this.push({ dur: 0.7, tick: (p) => (this.intro = ease(p)) });
    this.sayStep(`A wild ${foe.name} appears!`);
    return this.run();
  }

  say(text: string, tag = ""): Promise<void> {
    this.sayStep(text, tag);
    return this.run();
  }

  // One turn: the pet's move, then the foe's, then HP settles.
  // The command menu: resolves with what the player picked (2x2 grid, Fight top-left).
  choose(): Promise<Command> {
    this.text = `What will ${this.mine!.name} do?`;
    this.typed = this.text.length;
    this.tag = "";
    return new Promise((res) => {
      this.cmd = { cursor: this.cursor, pick: (c) => { this.cursor = this.cmd?.cursor ?? 0; this.cmd = null; res(c); } };
    });
  }

  get choosing(): boolean {
    return this.cmd !== null;
  }

  cmdKey(k: string): void {
    const c = this.cmd;
    if (!c) return;
    if (k === "arrowleft" || k === "a" || k === "arrowright" || k === "d") c.cursor ^= 1;
    if (k === "arrowup" || k === "w" || k === "arrowdown" || k === "s") c.cursor ^= 2;
    if (k === "enter" || k === " " || k === "z") c.pick(COMMANDS[c.cursor]!);
    if (k === "x" || k === "escape") c.cursor = 3;
  }

  // Pointer pick in low-res screen coords; true when it hit a command.
  cmdAt(x: number, y: number, sw: number, sh: number): boolean {
    const c = this.cmd;
    if (!c) return false;
    const mx = sw - MENU_W - 8;
    const my = sh - 56;
    if (x < mx || y < my || x > mx + MENU_W || y > my + 48) return false;
    c.cursor = (x > mx + MENU_W / 2 ? 1 : 0) + (y > my + 24 ? 2 : 0);
    c.pick(COMMANDS[c.cursor]!);
    return true;
  }

  swapMine(mine: Side): Promise<void> {
    this.push({ dur: 0.35, tick: (p) => (this.myGone = p) });
    this.push({ dur: 0, start: () => { this.mine = mine; this.myHp = this.myHpShown = mine.maxHp; } });
    this.push({ dur: 0.35, tick: (p) => (this.myGone = 1 - p) });
    this.sayStep(`Go, ${mine.name}!`);
    return this.run();
  }

  playTurn(action: Action, line: string, tag: string, enemyAct: EnemyAct, dealt: number, taken: number, myHp: number, foeHp: number): Promise<void> {
    const me = this.mine!.name;
    const foe = this.foe!.name;
    this.push({ dur: 0, start: () => { this.myShield = action === "guard"; this.foeShield = enemyAct === "guard"; } });
    this.sayStep(`${me}: ${MOVE_TEXT[action]}`, tag);
    if (line) this.sayStep(`"${line}"`);
    if (action === "attack") {
      this.push({ dur: 0.25, tick: (p) => (this.myDx = Math.sin(p * Math.PI) * 14) });
      if (dealt) this.hit("foe", () => (this.foeHp = foeHp));
    } else if (action === "befriend" || action === "emote") {
      this.push({ dur: 0.7, tick: (p) => (this.hearts = p) , done: () => (this.hearts = 0) });
    }
    if (enemyAct === "strike" || enemyAct === "heavy") {
      this.sayStep(enemyAct === "heavy" ? `${foe} lands a HEAVY hit!` : `${foe} strikes!`);
      this.push({ dur: 0.25, tick: (p) => (this.foeDx = -Math.sin(p * Math.PI) * 14) });
      if (taken) this.hit("me", () => (this.myHp = myHp), enemyAct === "heavy");
      else this.sayStep(`${me} shrugs it off.`);
    } else if (enemyAct === "guard") this.sayStep(`${foe} hides behind its guard.`);
    else if (enemyAct === "flee") this.sayStep(`${foe} tries to run!`);
    this.push({ dur: 0.35, tick: () => { this.foeHp = foeHp; this.myHp = myHp; }, done: () => { this.myShield = this.foeShield = false; } });
    return this.run();
  }

  end(outcome: Outcome, how: string): Promise<void> {
    const foe = this.foe!.name;
    const me = this.mine!.name;
    if (outcome === "win" && how === "befriended") {
      this.push({ dur: 0.9, tick: (p) => (this.hearts = p), done: () => (this.hearts = 0) });
      this.sayStep(`${foe} wants to come home with you!`);
    } else if (outcome === "win") {
      this.push({ dur: 0.6, tick: (p) => (this.foeGone = p) });
      this.sayStep(`${foe} fainted. ${me} wins!`);
    } else if (outcome === "loss") {
      this.push({ dur: 0.6, tick: (p) => (this.myGone = p) });
      this.sayStep(`${me} is out of breath...`);
    } else if (outcome === "fled") this.sayStep(`${me} ran away safely.`);
    else if (outcome === "escaped") {
      this.push({ dur: 0.5, tick: (p) => (this.foeGone = p) });
      this.sayStep(`${foe} ran off.`);
    } else this.sayStep("Both are too tired to go on. A draw.");
    return this.run();
  }

  private hit(who: "foe" | "me", apply: () => void, heavy = false): void {
    this.push({
      dur: heavy ? 0.45 : 0.3,
      start: apply,
      tick: (p) => {
        const f = Math.floor(p * 6) % 2 ? 1 : 0;
        if (who === "foe") this.foeFlash = f;
        else this.myFlash = f;
        this.shake = heavy ? (1 - p) * 3 : who === "me" ? (1 - p) * 1.5 : 0;
      },
      done: () => { this.foeFlash = this.myFlash = 0; this.shake = 0; },
    });
  }

  private sayStep(text: string, tag = ""): void {
    // Typewriter at ~60 chars/s, then a hold long enough to read.
    const dur = Math.min(2.2, 0.45 + text.length / 60 + text.length * 0.018);
    this.push({ dur, start: () => { this.text = text; this.tag = tag; this.typed = 0; }, tick: (p) => (this.typed = Math.ceil(text.length * Math.min(1, p * 2.2))) });
  }

  private push(s: Step): void {
    this.script.push(s);
  }

  private run(): Promise<void> {
    return new Promise((res) => {
      const prev = this.resolve;
      this.resolve = () => { prev?.(); res(); };
    });
  }

  // Click / key: finish the current text line at once (and skip its hold).
  skip(): void {
    const s = this.script[0];
    if (!s) return;
    if (this.typed < this.text.length) this.stepT = Math.max(this.stepT, s.dur * 0.46);
    else this.stepT = s.dur;
  }

  get busy(): boolean {
    return this.script.length > 0;
  }

  update(dt: number): void {
    // HP bars drain smoothly toward the real value.
    const k = Math.min(1, dt * 6);
    this.foeHpShown += (this.foeHp - this.foeHpShown) * k;
    this.myHpShown += (this.myHp - this.myHpShown) * k;
    let budget = dt;
    while (budget > 0 && this.script.length) {
      const s = this.script[0]!;
      if (!this.started) {
        this.started = true;
        this.stepT = 0;
        s.start?.();
      }
      const take = Math.min(budget, s.dur - this.stepT);
      this.stepT += take;
      budget -= take;
      s.tick?.(s.dur ? Math.min(1, this.stepT / s.dur) : 1);
      if (this.stepT >= s.dur) {
        s.done?.();
        this.script.shift();
        this.started = false;
        if (!take && !s.dur) continue;
      } else break;
    }
    if (!this.script.length && this.resolve) {
      const r = this.resolve;
      this.resolve = null;
      r();
    }
  }

  draw(g: CanvasRenderingContext2D, sw: number, sh: number, t: number): void {
    const sx = Math.round((Math.random() - 0.5) * 2 * this.shake);
    const sy = Math.round((Math.random() - 0.5) * 2 * this.shake);
    g.save();
    g.translate(sx, sy);
    // Pale sky, soft hill bands and a meadow floor (STYLE.md battle mockup).
    const horizon = 48;
    g.fillStyle = PAL.foam;
    g.fillRect(-4, -4, sw + 8, sh + 8);
    hills(g, sw, horizon, PAL.grassL, 0, 10);
    drawProp(g, TREE, 8, horizon + 22);
    drawProp(g, TREE, sw - 8, horizon + 18);
    hills(g, sw, horizon + 16, PAL.grassM, 1.7, 6);
    hills(g, sw, horizon + 36, PAL.grass, 3.1, 4);
    g.fillStyle = PAL.panel;
    for (let i = 0; i < 6; i++) g.fillRect(((i * 97 + 40) % (sw - 40)) + 20, horizon + 60 + ((i * 41) % 50), 1, 1);

    const foeBase = { x: Math.round(sw * 0.7), y: 100 };
    const myBase = { x: Math.round(sw * 0.27), y: 146 };
    platform(g, foeBase.x, foeBase.y, 48, 9);
    platform(g, myBase.x, myBase.y, 56, 10);

    const slide = 1 - this.intro;
    if (this.foe) {
      const s = this.foe.sprite;
      const bob = Math.round(Math.sin(t * 3) * 1);
      const x = foeBase.x - s.width / 2 + Math.round(slide * sw * 0.5) + Math.round(this.foeDx);
      const y = foeBase.y - s.height + 4 + bob + Math.round(this.foeGone * 24);
      sprite(g, s, x, y, this.foeFlash, this.foeGone);
      if (this.foeShield) shield(g, x + s.width / 2, y + s.height / 2, s.width * 0.55);
      hpBox(g, 16, 14, 132, this.foe, this.foeHpShown, false);
    }
    if (this.mine) {
      const s = this.mine.sprite;
      const bob = Math.round(Math.sin(t * 3 + 1) * 1);
      const x = myBase.x - s.width / 2 - Math.round(slide * sw * 0.5) + Math.round(this.myDx);
      const y = myBase.y - s.height + 6 + bob + Math.round(this.myGone * 20);
      sprite(g, s, x, y, this.myFlash, this.myGone);
      if (this.myShield) shield(g, x + s.width / 2, y + s.height / 2, s.width * 0.6);
      if (this.hearts > 0) hearts(g, x + s.width / 2, y, this.hearts);
      hpBox(g, sw - 154, 108, 146, this.mine, this.myHpShown, true);
    }
    g.restore();
    const face = this.mine?.portrait;
    if (this.cmd) {
      drawDialogue(g, sw, sh, this.text, undefined, face, sw - 16 - MENU_W - 8);
      const mx = sw - MENU_W - 8;
      const my = sh - 56;
      drawFrame(g, mx, my, MENU_W, 48);
      COMMANDS.forEach((c, i) => {
        const cx = mx + 10 + (i % 2) * 66;
        const cy = my + 11 + Math.floor(i / 2) * 18;
        if (i === this.cmd!.cursor) {
          g.fillStyle = PAL.grassM;
          g.fillRect(cx - 5, cy - 4, 62, 15);
          if (Math.floor(t * 3) % 3 !== 2) drawText(g, ">", cx - 3, cy, PAL.ink);
        }
        drawText(g, CMD_LABEL[c].toUpperCase(), cx + 5, cy);
      });
    } else if (this.text) {
      drawDialogue(g, sw, sh, this.text.slice(0, this.typed), undefined, face);
      if (this.tag && this.typed >= this.text.length) {
        const w = this.tag.length * GLYPH + 12;
        drawFrame(g, sw - w - 12, sh - 74, w, 16);
        drawText(g, this.tag.toUpperCase(), sw - w - 6, sh - 70, PAL.wood);
      }
    }
  }
}

// A soft rolling band: a sine outline filled to the bottom of the screen.
function hills(g: CanvasRenderingContext2D, sw: number, y0: number, col: string, phase: number, amp: number): void {
  g.fillStyle = col;
  for (let x = -4; x < sw + 4; x += 2) {
    const y = Math.round(y0 - amp * (0.5 + 0.5 * Math.sin(x / 37 + phase)) - 2 * Math.sin(x / 13 + phase * 2));
    g.fillRect(x, y, 2, 300);
  }
}

const MOVE_TEXT: Record<Action, string> = {
  attack: "tackles!",
  guard: "braces and guards.",
  flee: "tries to run away!",
  emote: "does a happy little dance.",
  befriend: "offers a snack, gently.",
};

function platform(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number): void {
  const ell = (rx2: number, ry2: number, col: string, dy = 0) => {
    g.fillStyle = col;
    for (let y = -ry2; y <= ry2; y++) {
      const w = Math.round(rx2 * Math.sqrt(1 - (y / ry2) ** 2));
      g.fillRect(cx - w, cy + y + dy, w * 2, 1);
    }
  };
  ell(rx, ry, PAL.grassS, 1);
  ell(rx, ry, PAL.grassM);
  ell(rx - 6, ry - 3, PAL.grassL, -1);
}

function sprite(g: CanvasRenderingContext2D, s: HTMLCanvasElement, x: number, y: number, flash: number, gone: number): void {
  if (gone >= 1) return;
  g.globalAlpha = 1 - gone;
  if (flash) {
    g.globalAlpha *= 0.35; // blink on hit
  }
  g.drawImage(s, Math.round(x), Math.round(y));
  g.globalAlpha = 1;
}

function shield(g: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  g.fillStyle = PAL.foam;
  for (let a = 0; a < 24; a++) {
    if (a % 3 === 2) continue;
    const ang = (a / 24) * Math.PI * 2;
    g.fillRect(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r * 0.9), 2, 2);
  }
}

function hearts(g: CanvasRenderingContext2D, cx: number, top: number, p: number): void {
  const heart = (x: number, y: number) => {
    g.fillStyle = PAL.flowerP;
    g.fillRect(x - 3, y - 2, 2, 2); g.fillRect(x + 1, y - 2, 2, 2);
    g.fillRect(x - 3, y, 6, 2); g.fillRect(x - 2, y + 2, 4, 1); g.fillRect(x - 1, y + 3, 2, 1);
  };
  for (let i = 0; i < 3; i++) heart(Math.round(cx + (i - 1) * 12), Math.round(top - 4 - p * 16 - i * 3));
}

// Name + level on one row, then HP: a 3 px bar plus the number (STYLE.md: never color alone).
function hpBox(g: CanvasRenderingContext2D, x: number, y: number, w: number, side: Side, hp: number, showNum: boolean): void {
  const h = showNum ? 40 : 32;
  const max = side.maxHp;
  drawFrame(g, x, y, w, h);
  drawText(g, side.name.slice(0, 12).toUpperCase(), x + 8, y + 7);
  const lv = `L${side.level ?? 1}`;
  drawText(g, lv, x + w - 8 - lv.length * GLYPH, y + 7, PAL.wood);
  const bx = x + 22;
  const by = y + 20;
  const bw = w - 30;
  drawText(g, "HP", x + 8, by - 3, PAL.wood);
  g.fillStyle = PAL.stoneM;
  g.fillRect(bx, by, bw, 3);
  const f = Math.max(0, Math.min(1, hp / max));
  g.fillStyle = f > 0.5 ? PAL.grassD : f > 0.2 ? PAL.flowerY : PAL.coral;
  g.fillRect(bx, by, Math.round(bw * f), 3);
  if (showNum) {
    const n = `${Math.max(0, Math.round(hp))}/${max}`;
    drawText(g, n, x + w - 8 - n.length * GLYPH, y + 28);
  }
}
