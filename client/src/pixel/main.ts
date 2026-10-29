// Entry for the pixel (v2) build: a low-res game canvas, the scene stack and the CRT presenter.
// S2: overworld walking, wild encounters and the battle screen, with the pet playing its taught memo rules
// (memoPolicy decides at once). Coach/teach, chat and the live room join when main.ts is ported.

import { petLook } from "../game/genes";
import { addCoins, coinsFor } from "../game/shop";
import { load, MAX_TAMED, save } from "../game/save";
import { Battle } from "../sim/battle";
import { allowedMoves, cannedLine } from "../game/instinct";
import { withTactics } from "../sim/tactics";
import { ENEMIES } from "../sim/enemies";
import { DEFAULT_PET, type Intent } from "../sim/types";
import { BattleView } from "./battle";
import { makePresenter } from "./crt";
import { BUILDS, drawMonster } from "./monster";
import { Overworld, type Wild } from "./overworld";
import { drawDialogue } from "./text";

export const LOW_H = 216;

// Low-res width follows the window's aspect so phones and wide screens both fill, height stays 216.
export function lowSize(cssW: number, cssH: number): { w: number; h: number } {
  const w = Math.round((LOW_H * cssW) / Math.max(1, cssH));
  return { w: Math.max(216, Math.min(480, w)), h: LOW_H };
}

const TELL: Record<Intent, string> = {
  idle: "is watching you.",
  heavy: "winds up a HEAVY hit!",
  guarding: "hides behind its guard.",
  calm: "looks calm.",
  scared: "looks hurt and scared.",
};

const state = load();
const pet = DEFAULT_PET;
const out = document.getElementById("screen") as HTMLCanvasElement;
const low = document.createElement("canvas");
const g = low.getContext("2d")!;
const presenter = makePresenter(out);
const world = new Overworld(state.genes);
const battleView = new BattleView();
const keys = new Set<string>();
let mode: "world" | "battle" = "world";
let toast: { text: string; who?: string; t: number } | null = { text: "Walk with WASD or the arrow keys. Bump into a wild pet to battle. C switches the CRT look.", who: "Hint", t: 7 };

const CRT_KEY = "mw.crt";
let crt = (() => {
  try {
    return localStorage.getItem(CRT_KEY) !== "0";
  } catch {
    return true;
  }
})();
const crtBtn = document.getElementById("crt") as HTMLButtonElement;
function setCrt(on: boolean): void {
  crt = on;
  try {
    localStorage.setItem(CRT_KEY, on ? "1" : "0");
  } catch {
    /* private mode: setting just isn't remembered */
  }
  crtBtn.textContent = on ? "CRT on" : "CRT off";
}
crtBtn.addEventListener("click", () => setCrt(!crt));
setCrt(crt);

function resize(): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  out.width = Math.round(window.innerWidth * dpr);
  out.height = Math.round(window.innerHeight * dpr);
  const s = lowSize(window.innerWidth, window.innerHeight);
  low.width = s.w;
  low.height = s.h;
  g.imageSmoothingEnabled = false;
}

window.addEventListener("resize", resize);
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k === "c" && !e.repeat) setCrt(!crt);
  if ((k === " " || k === "enter" || k === "z") && mode === "battle") battleView.skip();
  keys.add(k);
  if (k.startsWith("arrow") || k === " ") e.preventDefault();
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => keys.clear());
out.addEventListener("pointerdown", () => mode === "battle" && battleView.skip());
resize();

async function fight(w: Wild): Promise<void> {
  mode = "battle";
  keys.clear();
  const tactic = undefined; // wild re-teach memos (sim/tactics) are fetched in the port step
  const def = withTactics(ENEMIES[w.arch], tactic);
  const battle = new Battle({ enemy: w.arch, seed: Math.floor(Math.random() * 1e9), enemyDef: def });
  const foeName = w.arch[0]!.toUpperCase() + w.arch.slice(1);
  const look = petLook(w.genes);
  await battleView.open(
    { name: foeName, sprite: drawMonster(look, 64, "front", BUILDS[w.arch]), maxHp: def.maxHp },
    { name: pet.name, sprite: drawMonster(petLook(state.genes), 48, "back"), maxHp: pet.maxHp },
  );
  while (!battle.done) {
    const obs = battle.observe();
    await battleView.say(`${foeName} ${TELL[obs.intent]}`);
    const allowed = allowedMoves(state.memo, obs); // moves[0] is exactly memoPolicy's move
    const action = allowed.moves[0]!;
    const tag = allowed.rule !== null ? `memo #${allowed.rule + 1}` : "instinct";
    const rec = battle.step(action);
    await battleView.playTurn(action, cannedLine(action, obs.turn), tag, rec.enemyAct, rec.dealt, rec.taken, rec.myHp, rec.enemyHp);
  }
  const replay = battle.replay();
  await battleView.end(replay.outcome, replay.how);
  if (replay.outcome === "win") {
    const earned = coinsFor(replay.outcome, replay.how);
    state.coins = addCoins(state.coins ?? 0, earned);
    let msg = `+${earned} coins.`;
    if (replay.how === "befriended") {
      state.tamed = [...(state.tamed ?? []), w.arch].slice(-MAX_TAMED);
      msg = `${foeName} joined your corner! ${msg}`;
    }
    await battleView.say(msg);
    world.removeWild(w.id);
    const meadow = world.world.platforms.find((p) => Math.hypot(p.x - w.home.x, p.z - w.home.z) <= p.r);
    if (meadow) setTimeout(() => world.spawnWild(meadow.x, meadow.z, meadow.r), 20000);
  } else w.cool = 8; // give the player time to walk away
  state.recent = [...state.recent, replay].slice(-8);
  state.steps = { ...state.steps, fought: true };
  save(state);
  mode = "world";
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt, now / 1000);
  requestAnimationFrame(frame);
}

function update(dt: number, t: number): void {
  if (mode === "world") {
    const met = world.update(dt, keys);
    world.draw(g, low.width, low.height, t);
    if (met) void fight(met);
    if (toast) {
      toast.t -= dt;
      drawDialogue(g, low.width, low.height, toast.text, toast.who);
      if (toast.t <= 0) toast = null;
    }
  } else {
    battleView.update(dt);
    battleView.draw(g, low.width, low.height, t);
  }
  presenter.present(low, crt ? 1 : 0);
}

// Fonts must be ready before the first text sprite is cached.
document.fonts.load('8px "Press Start 2P"').finally(() => requestAnimationFrame(frame));

// Dev hook: drive frames by hand when the tab is hidden (rAF stalls there).
(window as unknown as { __px: unknown }).__px = { world, battleView, update, keys, setCrt, state, fight };
