// The classic two-platform battle screen: the foe on the upper-right platform (front sprite), your pet on
// the lower-left one (back sprite), HP boxes, and the text box that narrates each turn. The fight rules
// stay in ../sim/battle; this view only plays a turn record as a short script of timed steps.

import { CHARGE_MAX } from "../sim/battle";
import { ACTIONS, type Action, type EnemyAct, type Outcome, type TurnFx } from "../sim/types";
import { PAL } from "./art";
import { drawDialogue, drawFrame, drawText, GLYPH } from "./text";
import { MENU_H, MENU_W as CELL_MENU_W } from "../view/mosaic/battle";
import { wrap } from "../view/glyph/atlas";
import type { SceneBattle, SceneFighter } from "../game/ports";
import type { Genes } from "../sim/ghost";
import { HUMAN_ACTIONS, humanSprites, type HumanAction, type HumanLook } from "./humans";
import { BAR_H, packBar, strip } from "./sunny";

export interface Side {
  name: string;
  sprite: HTMLCanvasElement;
  maxHp: number;
  portrait?: HTMLCanvasElement; // 32x32 face for the text box
  genes?: Genes;
  level?: number;
  trainer?: HumanLook; // the person standing beside the pet (none for a wild pet)
}

export const COMMANDS = ["fight", "teach", "swap", "run"] as const;
export type Command = (typeof COMMANDS)[number];
const CMD_LABEL: Record<Command, string> = { fight: "Fight", teach: "Teach", swap: "Swap", run: "Run" };
const MENU_W = 144;

// What made a turn special (sim/battle.ts), and whether the trainer called the move.
export interface TurnExtra {
  fx?: readonly TurnFx[];
  charge?: number;
  shout?: boolean;
}

// Each pet's charged attack has its own name, from its genes (or its name, for a pet with none).
const SIGNATURES = ["Star Pounce", "Comet Tackle", "Puff Burst", "Leaf Whirl", "Bubble Slam", "Ember Hop", "Moon Bonk", "Pebble Roll"];
export function signatureName(side: Pick<Side, "name" | "genes">): string {
  const genes = Object.values(side.genes ?? {});
  const k = genes.length ? Math.floor(genes.reduce((a, b) => a + b, 0) * 7.31) : [...side.name].reduce((a, c) => a + c.charCodeAt(0), 0);
  return SIGNATURES[k % SIGNATURES.length]!;
}
const SHOUT_TEXT: Record<Action, string> = { attack: "Go!", guard: "Guard!", flee: "Run!", emote: "Be nice!", befriend: "Make friends!" };
export const SHOUTS_PER_FIGHT = 2;

interface Step {
  dur: number;
  start?: () => void;
  tick?: (p: number) => void;
  done?: () => void;
}

const ease = (p: number) => 1 - (1 - p) ** 2;
const TRAINER_FRAME = 0.1; // seconds per strip frame
const GLINT_SECONDS = 0.7;
const GLINT_SPOTS: readonly [number, number][] = [[-9, -7], [8, -3], [-3, 7]]; // around the pet's middle, scene pixels

// What a trainer is doing: a strip played once (then idle again), or looped.
interface TrainerPose { action: HumanAction; t: number; loop: boolean }
const idlePose = (): TrainerPose => ({ action: "idle", t: 0, loop: true });

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
  private charge = 0; // my pet's signature charge, shown as pips
  private pops: { side: "foe" | "me"; text: string; ink: string; t: number }[] = []; // damage numbers rising
  private glints: { side: "foe" | "me"; t: number }[] = []; // the pack's glint around a pet a crit or signature hit
  private shoutsLeft = 0;
  private shoutNext: Action | null = null;
  private cmd: { cursor: number; labels: readonly string[]; face: boolean; pick: (i: number) => void } | null = null;
  private cursor = 0;
  private trainers: Record<"foe" | "me", TrainerPose> = { foe: idlePose(), me: idlePose() };
  onLine: ((text: string, who: "mine" | "foe" | "story") => void) | null = null; // babble hook

  open(foe: Side, mine: Side, intro = `A wild ${foe.name} appears!`): Promise<void> {
    this.foe = foe;
    this.mine = mine;
    this.foeHp = this.foeHpShown = foe.maxHp;
    this.myHp = this.myHpShown = mine.maxHp;
    this.foeGone = this.myGone = 0;
    this.foeShield = this.myShield = false;
    this.charge = 0;
    this.pops = [];
    this.glints = [];
    this.shoutsLeft = 0;
    this.shoutNext = null;
    this.text = "";
    this.tag = "";
    this.trainers = { foe: idlePose(), me: idlePose() };
    this.push({ dur: 0.7, tick: (p) => (this.intro = ease(p)) });
    this.sayStep(intro);
    return this.run();
  }

  say(text: string, tag = ""): Promise<void> {
    this.sayStep(text, tag);
    return this.run();
  }

  // One turn: the pet's move, then the foe's, then HP settles.
  // The command menu: resolves with what the player picked (2x2 grid, Fight top-left).
  choose(): Promise<Command> {
    return this.menu(`What will ${this.mine!.name} do?`, COMMANDS.map((c) => CMD_LABEL[c]), this.cursor, true).then((i) => COMMANDS[(this.cursor = i)]!);
  }

  // A question with up to 4 answers in the same box (8 letters each); resolves with the answer's index. Esc picks the last.
  // No portrait beside it, so about 50 letters fit even on a 4:3 screen.
  ask(text: string, labels: readonly string[]): Promise<number> {
    return this.menu(text, labels, 0, false);
  }

  private menu(text: string, labels: readonly string[], cursor: number, face: boolean): Promise<number> {
    this.text = text;
    this.typed = this.text.length;
    this.tag = "";
    return new Promise((res) => {
      this.cmd = { cursor, labels, face, pick: (i) => { this.cmd = null; res(i); } };
    });
  }

  get choosing(): boolean {
    return this.cmd !== null;
  }

  cmdKey(k: string): void {
    const c = this.cmd;
    if (!c) return;
    const flip = k === "arrowleft" || k === "a" || k === "arrowright" || k === "d" ? 1 : k === "arrowup" || k === "w" || k === "arrowdown" || k === "s" ? 2 : 0;
    if (flip && (c.cursor ^ flip) < c.labels.length) c.cursor ^= flip;
    if (k === "enter" || k === " " || k === "z") c.pick(c.cursor);
    if (k === "x" || k === "escape") c.cursor = c.labels.length - 1;
  }

  // Pointer pick in low-res screen coords; true when it hit a command.
  cmdAt(x: number, y: number, sw: number, sh: number): boolean {
    const c = this.cmd;
    if (!c) return false;
    const mx = sw - MENU_W - 8;
    const my = sh - 56;
    if (x < mx || y < my || x > mx + MENU_W || y > my + 48) return false;
    return this.pickAt((x > mx + MENU_W / 2 ? 1 : 0) + (y > my + 24 ? 2 : 0));
  }

  // The same pick on the cell menu (view/mosaic/battle.ts), in low-res pixels.
  cmdAtCells(x: number, y: number, sw: number, sh: number): boolean {
    const c = this.cmd;
    if (!c) return false;
    const [col, row, cols, rows] = [Math.floor(x / 8), Math.floor(y / 8), Math.ceil(sw / 8), Math.ceil(sh / 8)];
    const left = cols - CELL_MENU_W - 2, top = rows - MENU_H - 7;
    if (col < left || col >= left + CELL_MENU_W || row <= top || row >= top + MENU_H - 1) return false;
    return this.pickAt((col >= left + 14 ? 1 : 0) + (row > top + 1 ? 2 : 0));
  }

  private pickAt(i: number): boolean {
    const c = this.cmd!;
    if (i >= c.labels.length) return true; // an empty cell: inside the box, so no skip either
    c.cursor = i;
    c.pick(i);
    return true;
  }

  // Plain data for a view that draws cells.
  scene(): SceneBattle {
    const side = (s: Side | null, hp: number, dx: number, flash: number, gone: number, shield: boolean): SceneFighter | null =>
      s && { name: s.name.toUpperCase(), level: s.level ?? 1, hp, maxHp: s.maxHp, genes: s.genes ?? null, dx: dx / 4, flash: !!flash, gone, shield };
    const text = this.cmd ? this.text : this.text.slice(0, this.typed);
    return {
      foe: side(this.foe, this.foeHpShown, this.foeDx, this.foeFlash, this.foeGone, this.foeShield),
      mine: side(this.mine, this.myHpShown, this.myDx, this.myFlash, this.myGone, this.myShield),
      slide: this.intro,
      hearts: this.hearts,
      text,
      lines: (w) => wrap(text, w),
      tag: this.typed >= this.text.length ? this.tag.toUpperCase() : "",
      menu: this.cmd && { labels: this.cmd.labels, cursor: this.cmd.cursor },
    };
  }

  swapMine(mine: Side): Promise<void> {
    this.push({ dur: 0.35, tick: (p) => (this.myGone = p) });
    this.push({ dur: 0, start: () => { this.mine = mine; this.myHp = this.myHpShown = mine.maxHp; } });
    this.push({ dur: 0.35, tick: (p) => (this.myGone = 1 - p) });
    this.sayStep(`Go, ${mine.name}!`);
    return this.run();
  }

  // Trainer shouts: a few per fight, keys 1-5 call the pet's next move over its memo (wild and village fights).
  allowShouts(n = SHOUTS_PER_FIGHT): void {
    this.shoutsLeft = n;
    this.shoutNext = null;
  }
  get shouts(): number {
    return this.shoutsLeft;
  }
  shoutKey(k: string): boolean {
    const a = ACTIONS[Number(k) - 1];
    if (!a || this.shoutsLeft <= 0 || this.cmd) return false;
    this.shoutNext = a;
    return true;
  }
  takeShout(): Action | null {
    const a = this.shoutNext;
    this.shoutNext = null;
    if (a) this.shoutsLeft -= 1;
    return a;
  }

  playTurn(action: Action, line: string, tag: string, enemyAct: EnemyAct, dealt: number, taken: number, myHp: number, foeHp: number, extra: TurnExtra = {}): Promise<void> {
    const me = this.mine!.name;
    const foe = this.foe!.name;
    const fx = new Set(extra.fx ?? []);
    this.push({ dur: 0, start: () => { this.myShield = action === "guard"; this.foeShield = enemyAct === "guard"; } });
    if (extra.shout) {
      this.push({ dur: 0, start: () => this.pose("me", "attack") });
      this.sayStep(`You shout: "${SHOUT_TEXT[action]}"`);
    }
    this.sayStep(`${me}: ${MOVE_TEXT[action]}`, extra.shout ? "your call" : tag);
    if (line) this.sayStep(`"${line}"`);
    if (action === "attack") {
      if (fx.has("signature")) this.sayStep(`${me} unleashes ${signatureName(this.mine!).toUpperCase()}!`);
      else if (fx.has("counter")) this.sayStep(`${me} counters!`);
      this.push({ dur: 0.25, tick: (p) => (this.myDx = Math.sin(p * Math.PI) * 14) });
      if (dealt) {
        this.hit("foe", () => (this.foeHp = foeHp), fx.has("signature") || fx.has("crit"));
        this.push({ dur: 0, start: () => {
          this.pop("foe", `-${dealt}`, fx.has("crit") || fx.has("signature") ? PAL.flowerY : PAL.coral);
          if (fx.has("crit") || fx.has("signature")) this.glints.push({ side: "foe", t: 0 });
        } });
        if (fx.has("crit")) this.sayStep("A critical hit!");
      }
    } else if (action === "befriend" || action === "emote") {
      this.push({ dur: 0.7, tick: (p) => (this.hearts = p) , done: () => (this.hearts = 0) });
    }
    if (foeHp <= 0) {
      // fainted on my hit: it does not get its move
    } else if (enemyAct === "strike" || enemyAct === "heavy") {
      if (fx.has("foe-counter")) this.sayStep(`${foe} counters!`);
      this.sayStep(enemyAct === "heavy" ? `${foe} lands a HEAVY hit!` : `${foe} strikes!`);
      this.push({ dur: 0.25, tick: (p) => (this.foeDx = -Math.sin(p * Math.PI) * 14) });
      if (taken) {
        this.hit("me", () => (this.myHp = myHp), enemyAct === "heavy" || fx.has("foe-crit"));
        this.push({ dur: 0, start: () => {
          this.pop("me", `-${taken}`, fx.has("foe-crit") ? PAL.flowerY : PAL.coral);
          if (fx.has("foe-crit")) this.glints.push({ side: "me", t: 0 });
        } });
        if (fx.has("foe-crit")) this.sayStep("A critical hit!");
      } else this.sayStep(`${me} shrugs it off.`);
      if (fx.has("block")) this.sayStep(extra.charge === CHARGE_MAX ? `${me} blocks it! ${signatureName(this.mine!)} is charged!` : `${me} blocks it!`);
    } else if (enemyAct === "guard") this.sayStep(`${foe} hides behind its guard.`);
    else if (enemyAct === "flee") this.sayStep(`${foe} tries to run!`);
    this.push({ dur: 0.35, tick: () => { this.foeHp = foeHp; this.myHp = myHp; this.charge = extra.charge ?? 0; }, done: () => { this.myShield = this.foeShield = false; } });
    return this.run();
  }

  private pop(side: "foe" | "me", text: string, ink: string): void {
    this.pops.push({ side, text, ink, t: 0 });
  }

  end(outcome: Outcome, how: string): Promise<void> {
    const foe = this.foe!.name;
    const me = this.mine!.name;
    const won = outcome === "win";
    const friends = outcome === "win" && (how === "befriended" || how === "friends");
    this.push({ dur: 0, start: () => {
      if (won || friends) this.pose("me", "jump", true);
      if (outcome === "loss" || friends) this.pose("foe", "jump", true);
      if (outcome === "loss") this.pose("me", "hurt");
      else if (won && !friends) this.pose("foe", "hurt");
    } });
    if (outcome === "win" && (how === "befriended" || how === "friends")) {
      this.push({ dur: 0.9, tick: (p) => (this.hearts = p), done: () => (this.hearts = 0) });
      this.sayStep(how === "friends" ? `${foe} and ${me} are friends now!` : `${foe} wants to come home with you!`); // "friends": someone's pet, it stays theirs
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

  private pose(side: "foe" | "me", action: HumanAction, loop = false): void {
    this.trainers[side] = { action, t: 0, loop };
  }

  private hit(who: "foe" | "me", apply: () => void, heavy = false): void {
    this.push({
      dur: heavy ? 0.45 : 0.3,
      start: () => {
        apply();
        if (heavy) this.pose(who, "hurt"); // a hard hit makes its trainer flinch
      },
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
    const who = text.startsWith('"') ? "mine" : this.foe && text.startsWith(this.foe.name) ? "foe" : "story";
    this.push({ dur, start: () => { this.text = text; this.tag = tag; this.typed = 0; this.onLine?.(text, who); }, tick: (p) => (this.typed = Math.ceil(text.length * Math.min(1, p * 2.2))) });
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

  private trainer(g: CanvasRenderingContext2D, side: "foe" | "me", look: HumanLook, x: number, y: number, flip: boolean): void {
    const tr = this.trainers[side];
    const n = HUMAN_ACTIONS[tr.action];
    const f = Math.floor(tr.t / TRAINER_FRAME);
    humanSprites.drawAction(g, look, tr.action, tr.loop ? f % n : Math.min(n - 1, f), x, y, flip);
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
    for (const p of this.pops) p.t += dt;
    for (const side of ["foe", "me"] as const) {
      const tr = this.trainers[side];
      tr.t += dt;
      if (!tr.loop && tr.t >= HUMAN_ACTIONS[tr.action] * TRAINER_FRAME) this.trainers[side] = idlePose();
    }
    this.pops = this.pops.filter((p) => p.t < 1);
    for (const s of this.glints) s.t += dt;
    this.glints = this.glints.filter((s) => s.t < GLINT_SECONDS);
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
    const L = battleLayout(sw, sh);
    // The whole scene on a half-size canvas, then doubled: one pixel size for everything in it (bug 59).
    const h = sceneCanvas(L.hw, L.hh);
    if (h) this.drawScene(h, L, t);
    const sx = SCENE * Math.round((Math.random() - 0.5) * this.shake);
    const sy = SCENE * Math.round((Math.random() - 0.5) * this.shake);
    g.save();
    g.imageSmoothingEnabled = false;
    if (h) g.drawImage(h.canvas, sx, sy, L.hw * SCENE, L.hh * SCENE);
    for (const p of this.pops) {
      const base = p.side === "foe" ? L.foe : L.mine;
      const w = p.text.length * GLYPH;
      drawText(g, p.text, base.x * SCENE - Math.round(w / 2) + sx, (base.y - 32) * SCENE - Math.round(p.t * 18) + sy, p.ink);
    }
    g.restore();
    // The panels: a bar along the top, mine on my side (left), the foe's on its side (right), clear of both pets (bug 58).
    if (this.mine) {
      hpBox(g, L.myPanel.x, L.myPanel.y, L.myPanel.w, this.mine, this.myHpShown, true);
      chargePips(g, L.myPanel.x + 8, L.myPanel.y + 28, this.charge);
    }
    if (this.foe) hpBox(g, L.foePanel.x, L.foePanel.y, L.foePanel.w, this.foe, this.foeHpShown, false);
    const face = this.mine?.portrait ? headOf(this.mine.portrait) : undefined;
    const mx = sw - MENU_W - 8;
    const my = sh - 56;
    if (this.cmd) {
      drawDialogue(g, sw, sh, this.text, undefined, this.cmd.face ? face : undefined, sw - 16 - MENU_W - 8);
      drawFrame(g, mx, my, MENU_W, 48);
      this.cmd.labels.forEach((label, i) => {
        const cx = mx + 10 + (i % 2) * 66;
        const cy = my + 11 + Math.floor(i / 2) * 18;
        if (i === this.cmd!.cursor) {
          g.fillStyle = PAL.grassM;
          g.fillRect(cx - 5, cy - 4, 62, 15);
          if (Math.floor(t * 3) % 3 !== 2) drawText(g, ">", cx - 3, cy, PAL.ink);
        }
        drawText(g, label.toUpperCase(), cx + 5, cy);
      });
    } else if (this.shoutsLeft > 0) {
      // While a shout is open, the command box shows what keys 1-5 call (bug 57); a tap on one calls it too.
      drawDialogue(g, sw, sh, this.text.slice(0, this.typed), undefined, face, sw - 16 - MENU_W - 8);
      drawFrame(g, mx, my, MENU_W, 48);
      drawText(g, `SHOUTS: ${this.shoutsLeft}`, mx + 8, my + 8, PAL.wood);
      ACTIONS.forEach((a, i) => {
        const [cx, cy] = shoutCell(mx, my, i);
        if (this.shoutNext === a) {
          g.fillStyle = PAL.grassM;
          g.fillRect(cx - 3, cy - 2, 64, 11);
        }
        drawText(g, `${i + 1} ${SHOUT_KEY[a]}`, cx, cy);
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

  // A tap on the shout box (phones have no 1-5 keys): true when it hit the box.
  shoutAt(x: number, y: number, sw: number, sh: number): boolean {
    if (this.cmd || this.shoutsLeft <= 0) return false;
    const mx = sw - MENU_W - 8;
    const my = sh - 56;
    if (x < mx || y < my || x > mx + MENU_W || y > my + 48) return false;
    const i = ACTIONS.findIndex((_, k) => {
      const [cx, cy] = shoutCell(mx, my, k);
      return x >= cx - 4 && x < cx + 64 && y >= cy - 4 && y < cy + 10;
    });
    if (i >= 0) this.shoutKey(String(i + 1));
    return true;
  }

  // Background, pads, trainers and pets, in scene pixels (one art pixel each).
  private drawScene(h: CanvasRenderingContext2D, L: BattleLayout, t: number): void {
    h.imageSmoothingEnabled = false;
    const back = battleArt("backdrop"), ground = battleArt("ground");
    if (back && ground) {
      const top = L.horizon - back.height;
      if (top > 0) for (let x = 0; x < L.hw; x += back.width) h.drawImage(back, 0, 0, back.width, 1, x, 0, back.width, top); // the sky's own colour
      for (let x = 0; x < L.hw; x += back.width) h.drawImage(back, x, top);
      for (let y = L.horizon; y < L.hh; y += ground.height) for (let x = 0; x < L.hw; x += ground.width) h.drawImage(ground, x, y);
    } else {
      h.fillStyle = PAL.foam;
      h.fillRect(0, 0, L.hw, L.hh);
      hills(h, L.hw, L.horizon - 8, PAL.grassL, 0, 5);
      hills(h, L.hw, L.horizon, PAL.grassM, 1.7, 3);
      hills(h, L.hw, L.horizon + 10, PAL.grass, 3.1, 2);
    }
    const slide = 1 - this.intro;
    const foeX = L.foe.x + Math.round(slide * L.hw * 0.5), myX = L.mine.x - Math.round(slide * L.hw * 0.5);
    pad(h, "pad-far", L.foe.x, L.foe.y, 24, 5);
    pad(h, "pad-near", L.mine.x, L.mine.y, 30, 6);
    // Trainers first, so their pets stand in front of them.
    if (this.foe?.trainer) this.trainer(h, "foe", this.foe.trainer, foeX + 24, L.foe.y - 1, true);
    if (this.mine?.trainer) this.trainer(h, "me", this.mine.trainer, myX - 24, L.mine.y + 1, false);
    if (this.foe) {
      const s = this.foe.sprite;
      const bob = Math.round(Math.sin(t * 3) * 0.6);
      const x = foeX - Math.round(s.width / 2) + Math.round(this.foeDx / SCENE);
      const y = L.foe.y - s.height + 2 + bob + Math.round(this.foeGone * 12);
      sprite(h, s, x, y, this.foeFlash, this.foeGone);
      if (this.foeShield) shield(h, x + s.width / 2, y + s.height / 2 + 2, s.width * 0.5);
    }
    if (this.mine) {
      const s = this.mine.sprite;
      const bob = Math.round(Math.sin(t * 3 + 1) * 0.6);
      const x = myX - Math.round(s.width / 2) + Math.round(this.myDx / SCENE);
      const y = L.mine.y - s.height + 2 + bob + Math.round(this.myGone * 10);
      sprite(h, s, x, y, this.myFlash, this.myGone);
      if (this.myShield) shield(h, x + s.width / 2, y + s.height / 2 + 2, s.width * 0.55);
      if (this.hearts > 0) hearts(h, x + s.width / 2, y + 6, this.hearts);
    }
    // Three pack glints pop in turn around the pet.
    for (const s of this.glints) {
      const base = s.side === "foe" ? L.foe : L.mine;
      const ph = (s.side === "foe" ? this.foe?.sprite.height : this.mine?.sprite.height) ?? 32;
      GLINT_SPOTS.forEach(([dx, dy], i) => {
        const f = Math.floor((s.t - i * 0.12) / 0.06);
        if (f < 0 || f >= 6) return;
        strip(h, "spr_deco_glint_01_strip6", base.x + dx - 3, base.y - Math.round(ph / 2) + dy - 3, f);
      });
    }
  }
}

// Scene pixels per screen pixel: the trainers' pixel, which the pets and the background share (bug 59).
const SCENE = 2;
// The top bar's panels, in screen pixels.
const PANEL_Y = 4;
const MY_PANEL_W = 146;
const FOE_PANEL_W = 132;
const MY_PANEL_H = 40;

export interface BattleLayout {
  hw: number; // the scene canvas, in scene pixels
  hh: number;
  horizon: number;
  foe: { x: number; y: number }; // where each pet's feet stand (scene pixels)
  mine: { x: number; y: number };
  myPanel: { x: number; y: number; w: number; h: number }; // screen pixels
  foePanel: { x: number; y: number; w: number; h: number };
}

// Where everything goes on a screen sw x sh (low-res pixels). Pure, so the layout is tested without a canvas.
export function battleLayout(sw: number, sh: number): BattleLayout {
  const hw = Math.ceil(sw / SCENE), hh = Math.ceil(sh / SCENE);
  const top = Math.ceil((PANEL_Y + MY_PANEL_H) / SCENE); // below the panels
  const bottom = Math.floor((sh - 56) / SCENE); // the text box's top
  const mine = { x: Math.round(hw * 0.3), y: bottom - 4 };
  // The foe stands a little further back; on a tall screen no further than 36 scene pixels behind my pet.
  const foe = { x: Math.round(hw * 0.7), y: Math.max(Math.round(top + (mine.y - top) * 0.55), mine.y - 36) };
  return {
    hw, hh, horizon: foe.y - 18, foe, mine,
    myPanel: { x: 8, y: PANEL_Y, w: MY_PANEL_W, h: MY_PANEL_H },
    foePanel: { x: sw - 8 - FOE_PANEL_W, y: PANEL_Y, w: FOE_PANEL_W, h: 32 },
  };
}

// The shout box's five cells after its title: two columns, the title in the first cell.
const shoutCell = (mx: number, my: number, i: number): [number, number] => [mx + 8 + ((i + 1) % 2) * 68, my + 8 + Math.floor((i + 1) / 2) * 12];
const SHOUT_KEY: Record<Action, string> = { attack: "GO!", guard: "GUARD!", flee: "RUN!", emote: "BE NICE!", befriend: "FRIENDS!" };

let scene: CanvasRenderingContext2D | null = null;
function sceneCanvas(w: number, h: number): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!scene) scene = document.createElement("canvas").getContext("2d");
  if (!scene) return null;
  if (scene.canvas.width !== w || scene.canvas.height !== h) {
    scene.canvas.width = w;
    scene.canvas.height = h;
  }
  scene.clearRect(0, 0, w, h);
  return scene;
}

// The battle art (Codex, P4 bug 59): backdrop, ground and the two pads, in public/art/gen/battle/.
const battleImages = new Map<string, HTMLImageElement>();
function battleArt(name: string): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  let i = battleImages.get(name);
  if (!i) {
    const img = (i = new Image());
    img.onerror = () => setTimeout(() => battleImages.get(name) === img && battleImages.delete(name), 2000); // asked for again later
    img.src = `/art/gen/battle/${name}.png`;
    battleImages.set(name, img);
  }
  return i.complete && i.naturalWidth ? i : null;
}

function pad(h: CanvasRenderingContext2D, name: string, cx: number, cy: number, rx: number, ry: number): void {
  const i = battleArt(name);
  if (i) h.drawImage(i, cx - Math.floor(i.width / 2), cy - Math.floor(i.height / 2));
  else platform(h, cx, cy, rx, ry);
}

// The portrait in the text box: the pet's head, 16 x 16 of its 32 px front art, shown doubled like the scene.
let head: CanvasRenderingContext2D | null = null;
function headOf(p: HTMLCanvasElement): HTMLCanvasElement | undefined {
  if (!head) head = document.createElement("canvas").getContext("2d");
  const pg = p.getContext("2d", { willReadFrequently: true });
  if (!head || !pg) return undefined;
  head.canvas.width = head.canvas.height = 16;
  const { data } = pg.getImageData(0, 0, p.width, p.height);
  let top = -1, x0 = p.width, x1 = 0;
  for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) if (data[(y * p.width + x) * 4 + 3]) {
    if (top < 0) top = y;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
  }
  if (top < 0) return undefined;
  const sx = Math.max(0, Math.min(p.width - 16, Math.round((x0 + x1) / 2) - 8)), sy = Math.max(0, Math.min(p.height - 16, top + 2));
  head.clearRect(0, 0, 16, 16);
  head.drawImage(p, sx, sy, 16, 16, 0, 0, 16, 16);
  return head.canvas;
}

// The signature charge under my HP: one pip per blocked hit, all lit = the next attack is the signature move.
function chargePips(g: CanvasRenderingContext2D, x: number, y: number, charge: number): void {
  if (packBar(g, "blue", x, y - 2, 32, charge / CHARGE_MAX)) return;
  for (let i = 0; i < CHARGE_MAX; i++) {
    g.fillStyle = i < charge ? PAL.flowerY : PAL.stoneM;
    g.fillRect(x + i * 6, y, 4, 3);
  }
}

// A soft rolling band: a sine outline filled to the bottom of the screen.
function hills(g: CanvasRenderingContext2D, sw: number, y0: number, col: string, phase: number, amp: number): void {
  g.fillStyle = col;
  for (let x = -2; x < sw + 2; x++) {
    const y = Math.round(y0 - amp * (0.5 + 0.5 * Math.sin(x / 18 + phase)) - Math.sin(x / 6.5 + phase * 2));
    g.fillRect(x, y, 1, 300);
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
    g.fillRect(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r * 0.9), 1, 1);
  }
}

function hearts(g: CanvasRenderingContext2D, cx: number, top: number, p: number): void {
  // In scene pixels: a 5 x 4 heart.
  const heart = (x: number, y: number) => {
    g.fillStyle = PAL.flowerP;
    g.fillRect(x - 2, y, 2, 1); g.fillRect(x + 1, y, 2, 1);
    g.fillRect(x - 2, y + 1, 5, 1); g.fillRect(x - 1, y + 2, 3, 1); g.fillRect(x, y + 3, 1, 1);
  };
  for (let i = 0; i < 3; i++) heart(Math.round(cx + (i - 1) * 6), Math.round(top - 2 - p * 8 - i * 2));
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
  const f = Math.max(0, Math.min(1, hp / max));
  // The pack bar: green, red once at or under 40% (a hurt pet: befriending works far better).
  if (!packBar(g, f > 0.4 ? "green" : "red", bx, by - Math.floor((BAR_H - 3) / 2), bw, f)) {
    g.fillStyle = PAL.stoneM;
    g.fillRect(bx, by, bw, 3);
    g.fillStyle = f > 0.5 ? PAL.grassD : f > 0.2 ? PAL.flowerY : PAL.coral;
    g.fillRect(bx, by, Math.round(bw * f), 3);
  }
  if (showNum) {
    const n = `${Math.max(0, Math.round(hp))}/${max}`;
    drawText(g, n, x + w - 8 - n.length * GLYPH, y + 28);
  }
}
