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
import { fetchWildMemos, withTactics, type WildMemos } from "../sim/tactics";
import { ENEMIES } from "../sim/enemies";
import { DEFAULT_PET, type Intent } from "../sim/types";
import { BattleView, type Side } from "./battle";
import { makePresenter } from "./crt";
import { BUILDS, drawMonster } from "./monster";
import { Overworld, type Wild } from "./overworld";
import { drawDialogue } from "./text";
import { loadArt } from "./art";
import { Babbler } from "../game/babble";
import { voiceFor, type Speaker } from "../game/chatter";
import { askNpc, chatWhoFor } from "../game/npc-chat";
import { askPets, traitOf } from "../game/pet-chat";
import { Interior } from "./interior";
import { defaultRoom } from "../game/room";
import { buySeeds, CROP_IDS, CROPS, emptyFarm, harvest, plant, RIPE, sellAll, tick, water } from "../game/farm";
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
state.farm ??= emptyFarm();
world.farm = state.farm;
let farmTickAt = 0;

// E at a bed: plant (cheapest seed you have), water, or harvest. Growth runs on real time.
function useBed(i: number): void {
  const f = state.farm!;
  const p = f.plots[i]!;
  const crop = CROP_IDS.find((c) => f.seeds[c]);
  const r = !p.crop ? (crop ? plant(f, i, crop) : null) : p.stage >= RIPE ? harvest(f, i) : water(f, i, Date.now());
  if (!r) toast = { text: "No seeds left. Sell your harvest and buy more at the shipping crate inside.", t: 3 };
  else if (!r.ok) toast = { text: r.reason === "wet" ? "Already watered. It grows on its own now." : "Nothing to do here yet.", t: 2.5 };
  else {
    const verb = !p.crop ? `Planted a ${crop} seed.` : p.stage >= RIPE ? `Picked a ${p.crop}! Ship it from the crate inside.` : "Watered. It grows a stage soon.";
    state.farm = world.farm = r.farm;
    save(state);
    toast = { text: verb, t: 2.5 };
  }
}
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
// Cozy babble voices (WebAudio blips) for battle lines; M mutes (saved).
const babbler = new Babbler();
let foeVoice: Speaker = "pet";
battleView.onLine = (text, who) => {
  if (state.muted || who === "story") return;
  const v = voiceFor(who === "mine" ? "pet" : foeVoice);
  babbler.say(text, { base: 250 * v.pitch ** 0.8, speed: v.rate, wave: "triangle" });
};
// Wild pets' tactics, re-taught by Muse Spark from players' fights (Worker cron); empty = bundled patterns.
let wildMemos: WildMemos = {};
void fetchWildMemos().then((m) => (wildMemos = m)).catch(() => undefined);
const keys = new Set<string>();
let mode: "world" | "battle" | "home" = "world";
state.room ??= defaultRoom();
const interior = new Interior({
  room: () => state.room!,
  setRoom: (r) => {
    state.room = r;
    save(state);
  },
  petSprite: () => world.petSprite,
  residents: () => world.residentSprites(),
  useCrate: () => (crate = { cursor: 0 }),
  leave: () => {
    mode = "world";
    world.exitHouse();
  },
});

// Talking to a wild pet (E when close): Muse Spark answers in character through the Worker (/api/chat,
// capped and cached; scripted lines when offline). The pet stops wandering while you talk.
const chatForm = document.getElementById("chat") as HTMLFormElement;
const chatInput = chatForm.querySelector("input")!;
let chatWith: Wild | null = null;
function openChat(w: Wild): void {
  chatWith = w;
  w.wait = 999;
  keys.clear();
  chatForm.hidden = false;
  chatInput.value = "";
  chatInput.focus();
  world.say(`w${w.id}`, "?", 2);
}
function closeChat(): void {
  if (chatWith) chatWith.wait = 1;
  chatWith = null;
  chatForm.hidden = true;
  chatInput.blur();
}
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const w = chatWith;
  const line = chatInput.value.trim();
  const who = w && chatWhoFor("wild", w.arch);
  if (!w || !who || !line) return;
  chatInput.value = "";
  world.say(`w${w.id}`, "...", 20);
  void askNpc(who, line).then((r) => {
    world.say(`w${w.id}`, r.text, 6);
    if (!state.muted) {
      const v = voiceFor(w.arch);
      babbler.say(r.text, { base: 250 * v.pitch ** 0.8, speed: v.rate, wave: "triangle" });
    }
  });
});
chatForm.querySelector("[data-act=close]")!.addEventListener("click", closeChat);

// Pets chat with each other at home now and then (Muse Spark via /api/petchat, scripted when offline).
let petChatT = 15;
function petChatter(dt: number): void {
  if ((petChatT -= dt) > 0) return;
  petChatT = 30;
  const all = members();
  const a = state.active ?? 0;
  const others = all.filter((_, i) => i !== a);
  if (!others.length || !world.nearHome() || chatWith) return;
  const r = Math.floor(Math.random() * others.length);
  const them = others[r]!;
  void askPets({ name: all[a]!.name, trait: traitOf(state.memo) }, { name: them.name, trait: "curious" }).then(({ lines: [mine, theirs] }) => {
    if (mode !== "world") return;
    world.say("pet", mine, 3);
    setTimeout(() => mode === "world" && world.say(`r${r}`, theirs, 3), 1600);
  });
}

// The shipping crate inside: ship the basket for coins, or buy seeds.
let crate: { cursor: number } | null = null;
const crateRows = (): MenuRow[] => {
  const f = state.farm!;
  const n = CROP_IDS.reduce((s, c) => s + (f.basket[c] ?? 0), 0);
  return [
    { label: `Ship harvest (${n})`, note: n ? `+${sellAll(f, 0).earned}c` : "" },
    ...CROP_IDS.map((c) => ({ label: `${c[0]!.toUpperCase()}${c.slice(1)} seed x${f.seeds[c] ?? 0}`, note: `${CROPS[c].seed}c` })),
    { label: "Close" },
  ];
};
function crateKey(k: string): void {
  const c = crate!;
  const n = crateRows().length;
  if (k === "arrowup" || k === "w") c.cursor = (c.cursor + n - 1) % n;
  if (k === "arrowdown" || k === "s") c.cursor = (c.cursor + 1) % n;
  if (k === "escape" || k === "x") crate = null;
  if (k !== "enter" && k !== " " && k !== "z" && k !== "e") return;
  const f = state.farm!;
  if (c.cursor === 0) {
    const r = sellAll(f, state.coins ?? 0);
    state.farm = world.farm = r.farm;
    state.coins = r.coins;
  } else if (c.cursor <= CROP_IDS.length) {
    const r = buySeeds(f, state.coins ?? 0, CROP_IDS[c.cursor - 1]!);
    if (r.ok) {
      state.farm = world.farm = r.farm;
      state.coins = r.coins;
    }
  } else crate = null;
  save(state);
}
let toast: { text: string; who?: string; t: number } | null = { text: "WASD or arrows: walk. Bump a wild pet to battle. E: use/talk  M: mute  P: your pets  T: teach  C: CRT look", who: "Hint", t: 7 };

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
  if (chatWith) {
    if (k === "escape") closeChat();
    return; // typing in the chat box
  }
  if (k === "c" && !e.repeat) setCrt(!crt);
  if (k === "m" && !e.repeat) {
    state.muted = !state.muted;
    save(state);
    toast = { text: state.muted ? "Voices off (M)." : "Voices on (M).", t: 1.5 };
  }
  if (mode === "battle" && battleView.choosing) battleView.cmdKey(k);
  else if ((k === " " || k === "enter" || k === "z") && mode === "battle") battleView.skip();
  if (mode === "world" && !e.repeat) menuKey(k);
  if (mode === "home" && !e.repeat) {
    if (crate) crateKey(k);
    else interior.key(k);
  }
  if (k === "tab") e.preventDefault();
  keys.add(k);
  if (k.startsWith("arrow") || k === " ") e.preventDefault();
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => keys.clear());
out.addEventListener("pointerdown", (e) => {
  if (mode !== "battle") return;
  const r = out.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * low.width;
  const y = ((e.clientY - r.top) / r.height) * low.height;
  if (!battleView.cmdAt(x, y, low.width, low.height)) battleView.skip();
});
resize();

function menuKey(k: string): void {
  if (!menu) {
    if (k === "e" || k === "enter") {
      const bed = world.bedNear();
      if (bed >= 0) useBed(bed);
      else if (world.wildNear() && chatWhoFor("wild", world.wildNear()!.arch)) openChat(world.wildNear()!);
      else if (world.atDoor()) {
        mode = "home";
        keys.clear();
        toast = null;
        interior.enter();
      }
    }
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

function side(m: Member): Side {
  const build = m.arch ? BUILDS[m.arch] : undefined;
  return { name: m.name, sprite: drawMonster(petLook(m.genes), 48, "back", build), portrait: drawMonster(petLook(m.genes), 32, "front", build), maxHp: pet.maxHp, level: 3 };
}

async function fight(w: Wild): Promise<void> {
  mode = "battle";
  keys.clear();
  const tactic = wildMemos[w.arch];
  foeVoice = w.arch;
  const def = withTactics(ENEMIES[w.arch], tactic);
  const battle = new Battle({ enemy: w.arch, seed: Math.floor(Math.random() * 1e9), enemyDef: def });
  const foeName = w.arch[0]!.toUpperCase() + w.arch.slice(1);
  const look = petLook(w.genes);
  await battleView.open({ name: foeName, sprite: drawMonster(look, 64, "front", BUILDS[w.arch]), maxHp: def.maxHp, level: 2 + (w.id % 3) }, side(activeMember()));
  // Fight = watch the pet play its memo; Teach = change the memo first; Swap = next party member; Run = leave.
  for (;;) {
    const c = await battleView.choose();
    if (c === "fight") break;
    if (c === "teach") {
      keys.clear();
      teach.show();
      while (teach.open) await new Promise((r) => setTimeout(r, 100));
    } else if (c === "swap") {
      const n = members().length;
      if (n < 2) await battleView.say("No one else is with you yet. Befriend a wild pet!");
      else {
        state.active = ((state.active ?? 0) + 1) % n;
        save(state);
        refreshParty();
        await battleView.swapMine(side(activeMember()));
      }
    } else {
      await battleView.say("You slip away safely.");
      w.cool = 8;
      mode = "world";
      return;
    }
  }
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
    petChatter(dt);
    if ((farmTickAt -= dt) <= 0) {
      farmTickAt = 1;
      const next = tick(state.farm!, Date.now());
      if (next !== state.farm) {
        state.farm = world.farm = next;
        save(state);
      }
    }
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
  } else if (mode === "home") {
    interior.update(dt, crate || interior.deco ? new Set<string>() : keys);
    interior.draw(g, low.width, low.height, t);
    if (crate) drawMenu(g, low.width, low.height, `Crate  ${state.coins ?? 0}c`, crateRows(), crate.cursor, t, "Enter: pick  Esc: close");
  } else {
    battleView.update(dt);
    battleView.draw(g, low.width, low.height, t);
  }
  presenter.present(low, crt ? 1 : 0);
}

// Tiles, props, frame and font PNGs (docs/STYLE.md) load before the first frame.
void loadArt().then(() => requestAnimationFrame(frame));

// Dev hook: drive frames by hand when the tab is hidden (rAF stalls there).
(window as unknown as { __px: unknown }).__px = { world, battleView, interior, update, keys, setCrt, state, fight };
