// Entry for the pixel (v2) build: a low-res game canvas, the scene stack and the CRT presenter.
// S2: overworld walking, wild encounters and the battle screen, with the pet playing its taught memo rules
// (memoPolicy decides at once). Coach/teach, chat and the live room join when main.ts is ported.

import { petLook } from "../game/genes";
import { addCoins, coinsFor } from "../game/shop";
import { load, MAX_TAMED, save } from "../game/save";
import { addToParty, type PartyMon } from "../game/party";
import type { Genes } from "../sim/ghost";
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
import { drawMenu, type MenuRow } from "./menu";
import { TeachScreen } from "./teach";

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

// Who is out with you: 0 = the hatched pet, i = party[i - 1]. Everyone else lives at your corner.
interface Member { name: string; genes: Genes; arch?: PartyMon["arch"] }
const members = (): Member[] => [{ name: pet.name, genes: state.genes }, ...(state.party ?? [])];
const activeMember = (): Member => members()[state.active ?? 0] ?? members()[0]!;
function refreshParty(): void {
  const all = members();
  const a = state.active ?? 0;
  world.setPet(all[a]!.genes, all[a]!.arch);
  world.setResidents(all.filter((_, i) => i !== a));
}
refreshParty();
let menu: { cursor: number } | null = null;
const portraits = new Map<Genes, HTMLCanvasElement>();
const teach = new TeachScreen({
  memo: () => state.memo,
  recent: () => state.recent,
  setMemo: (m) => {
    state.memo = m;
    state.steps = { ...state.steps, proved: true };
    save(state);
  },
  petName: () => activeMember().name,
  portrait: () => {
    const m = activeMember();
    return portraits.get(m.genes) ?? portraits.set(m.genes, drawMonster(petLook(m.genes), 48, "front", m.arch ? BUILDS[m.arch] : undefined)).get(m.genes)!;
  },
});
const iconCache = new Map<Genes, HTMLCanvasElement>();
const icon = (m: Member) => iconCache.get(m.genes) ?? iconCache.set(m.genes, drawMonster(petLook(m.genes), 16, "front", m.arch ? BUILDS[m.arch] : undefined)).get(m.genes)!;
const battleView = new BattleView();
const keys = new Set<string>();
let mode: "world" | "battle" = "world";
let toast: { text: string; who?: string; t: number } | null = { text: "WASD or arrows: walk. Bump a wild pet to battle. P: your pets  T: teach  C: CRT look", who: "Hint", t: 7 };

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
  if (teach.open) {
    if (k === "escape") teach.hide();
    return; // typing in the teach box
  }
  if (k === "c" && !e.repeat) setCrt(!crt);
  if ((k === " " || k === "enter" || k === "z") && mode === "battle") battleView.skip();
  if (mode === "world" && !e.repeat) menuKey(k);
  keys.add(k);
  if (k.startsWith("arrow") || k === " ") e.preventDefault();
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => keys.clear());
out.addEventListener("pointerdown", () => mode === "battle" && battleView.skip());
resize();

function menuKey(k: string): void {
  if (!menu) {
    if (k === "p") menu = { cursor: state.active ?? 0 };
    if (k === "t") {
      keys.clear();
      teach.show();
    }
    return;
  }
  const n = members().length;
  if (k === "arrowup" || k === "w") menu.cursor = (menu.cursor + n - 1) % n;
  if (k === "arrowdown" || k === "s") menu.cursor = (menu.cursor + 1) % n;
  if (k === "enter" || k === " " || k === "z") {
    state.active = menu.cursor;
    save(state);
    refreshParty();
    toast = { text: `${activeMember().name} walks with you now. The others chill at your corner.`, t: 3 };
    menu = null;
  } else if (k === "p" || k === "escape" || k === "x") menu = null;
}

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
    { name: activeMember().name, sprite: drawMonster(petLook(activeMember().genes), 48, "back", activeMember().arch ? BUILDS[activeMember().arch!] : undefined), maxHp: pet.maxHp },
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
      state.tamed = [...(state.tamed ?? []), w.arch].slice(-MAX_TAMED); // v1 readers
      state.party = addToParty(state.party ?? [], w.arch, w.genes);
      state.active = Math.min(state.active ?? 0, state.party.length);
      refreshParty();
      msg = `${state.party.at(-1)!.name} the ${w.arch} is yours now! It waits at your corner. ${msg}`;
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
  if (teach.open) teach.draw(g, low.width, low.height, t);
  else if (mode === "world") {
    const met = world.update(dt, menu ? new Set<string>() : keys);
    world.draw(g, low.width, low.height, t);
    if (met) void fight(met);
    if (menu) {
      const a = state.active ?? 0;
      const rows: MenuRow[] = members().map((m, i) => ({ label: m.name, note: i === a ? "with you" : "at home", icon: icon(m) }));
      drawMenu(g, low.width, low.height, "Your pets", rows, menu.cursor, t, "Enter: take along  P: close");
    } else if (toast) {
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
