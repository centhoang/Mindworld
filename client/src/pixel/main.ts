// The game's entry (index.html): a low-res canvas, the scene stack (overworld, battle, interior, teach) and
// the CRT presenter, wired to the save, the pet brain, Meta-model chat/coach and the live room.

import { parseGenes, petLook, randomGenes } from "../game/genes";
import { fetchRandomGhost, shareGhost } from "../game/ghost-api";
import { GHOST_ARCHETYPE, ghostEnemyDef, type Ghost } from "../sim/ghost";
import { EMOTES, LiveLink, liveName, roomUrl, SAY_MAX, type Emote, type LivePeer } from "../world/live";
import { worldDay, type GroundOwner } from "../world/layout";
import { newGroundSeed } from "../world/ground";
import { duelCoins, duelView, type DuelResult, type Fighter } from "../sim/duel";
import { addCoins, coinsFor } from "../game/shop";
import { load, MAX_TAMED, save } from "../game/save";
import { addToParty, type PartyMon } from "../game/party";
import type { Genes } from "../sim/ghost";
import { Battle } from "../sim/battle";
import { allowedMoves, cannedLine } from "../game/instinct";
import { fetchWildMemos, withTactics, type WildMemos } from "../sim/tactics";
import { ENEMIES } from "../sim/enemies";
import { DEFAULT_PET, type Intent, type Outcome } from "../sim/types";
import { BattleView, type Side } from "./battle";
import { makePresenter } from "./crt";
import { BUILDS, drawMonster } from "./monster";
import { Overworld, type Wild } from "./overworld";
import { drawDialogue, drawFrame, drawText } from "./text";
import { PIXEL_HINTS, pixelGoals } from "../game/onboard";
import { loadArt } from "./art";
import { Babbler } from "../game/babble";
import { voiceFor, type Speaker } from "../game/chatter";
import { Instinct } from "../game/instinct";
import { CloudVoice, localAccessState, NativeVoice, WebLlmVoice } from "../game/voices";
import { MINDS_KEY, parseMindsSave } from "../mind/hub";
import { MindScheduler } from "../mind/scheduler";
import { BOSS_ARCHETYPE, BOSS_FOCUS, BOSS_STATS, BOSS_TURNS, makeBoss, type Boss } from "../sim/boss";
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
if (!state.groundSeed) {
  state.groundSeed = newGroundSeed() || 1;
  save(state);
}
const world = new Overworld(state.genes, state.groundSeed);

// Who is out with you: 0 = the hatched pet, i = party[i - 1]. Everyone else lives at your corner.
interface Member { name: string; genes: Genes; arch?: PartyMon["arch"] }
const members = (): Member[] => [{ name: pet.name, genes: state.genes }, ...(state.party ?? [])];
const activeMember = (): Member => members()[state.active ?? 0] ?? members()[0]!;
let onPetChange = (): void => undefined; // set once the live room exists: others see the pet you walk with
function refreshParty(): void {
  const all = members();
  const a = state.active ?? 0;
  world.setPet(all[a]!.genes, all[a]!.arch);
  onPetChange();
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
let chatWith: Wild | "elder" | "room" | null = null;
const chatKey = (w: Wild | "elder" | "room") => (w === "elder" ? "elder" : w === "room" ? "me" : `w${w.id}`);
function openChat(w: Wild | "elder" | "room"): void {
  chatWith = w;
  if (typeof w !== "string") w.wait = 999;
  keys.clear();
  chatForm.hidden = false;
  chatInput.value = "";
  chatInput.focus();
  if (w !== "room") world.say(chatKey(w), w === "elder" ? "Ah, a visitor. Ask me anything." : "?", 3);
}
function closeChat(): void {
  if (chatWith && typeof chatWith !== "string") chatWith.wait = 1;
  chatWith = null;
  chatForm.hidden = true;
  chatInput.blur();
}
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const w = chatWith;
  const line = chatInput.value.trim();
  if (w === "room") {
    if (line && live.say(line.slice(0, SAY_MAX))) world.say("me", line.slice(0, SAY_MAX), 5);
    chatInput.value = "";
    return;
  }
  const who = w === "elder" ? "elder" : w && chatWhoFor("wild", w.arch);
  if (!w || !who || !line) return;
  chatInput.value = "";
  world.say(chatKey(w), "...", 20);
  void askNpc(who, line).then((r) => {
    world.say(chatKey(w), r.text, 6);
    if (!state.muted) {
      const v = voiceFor(w === "elder" ? "elder" : w.arch);
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

// The shipping crate inside (and the market stall outside): ship the basket for coins, or buy seeds.
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
    if (r.earned > 0) state.steps = { ...state.steps, shipped: true };
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
let toast: { text: string; who?: string; t: number } | null = { text: "WASD: walk. E: use/talk. T: teach. P: pets. B: brain. G: goals. M: mute. C: CRT.", who: "Hint", t: 7 };
// First visit: the hatch line, then the control hints one after another (each 6 s, Esc skips), once.
const hintQueue: { text: string; who?: string; t: number }[] = [];
if (!state.onboard?.seen) {
  toast = { text: `Your egg hatched! Meet ${pet.name}. It learns to fight from what you teach it.`, who: pet.name, t: 6 };
  hintQueue.push(...PIXEL_HINTS.map((text) => ({ text, who: "Hint", t: 6 })));
}
function nextToast(): void {
  toast = hintQueue.shift() ?? null;
  if (!toast && !state.onboard?.seen) {
    state.onboard = { ...state.onboard, seen: true };
    save(state);
  }
}

// The goals card (top left, G hides it): what a first visit should try. Gone once all four are done.
function drawGoals(): void {
  if (state.onboard?.goalsHidden || world.inspect) return;
  const list = pixelGoals({ taught: !!state.steps?.proved, party: (state.party ?? []).length, shipped: !!state.steps?.shipped, boss: !!state.steps?.boss });
  if (list.every((x) => x.done)) return;
  const w = 150;
  drawFrame(g, 4, 4, w, 18 + list.length * 10);
  drawText(g, "GOALS  (G)", 10, 9, "#795849");
  list.forEach((x, i) => drawText(g, `${x.done ? "+" : "-"} ${x.label}`.slice(0, 22), 10, 20 + i * 10, x.done ? "#7A8F89" : "#39463F"));
}

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
  if (k === "b" && !e.repeat && mode === "world" && !menu) void switchBrain();
  if (k === "i" && !e.repeat && mode === "world" && !menu && !crate) world.toggleInspect();
  if (k === "g" && !e.repeat && mode === "world" && !chatWith) {
    state.onboard = { ...state.onboard, goalsHidden: !state.onboard?.goalsHidden };
    save(state);
  }
  if (k === "escape" && mode === "world" && toast && !menu && !crate) nextToast();
  if (k === "m" && !e.repeat) {
    state.muted = !state.muted;
    save(state);
    toast = { text: state.muted ? "Voices off (M)." : "Voices on (M).", t: 1.5 };
  }
  if (mode === "battle" && battleView.choosing) battleView.cmdKey(k);
  else if ((k === " " || k === "enter" || k === "z") && mode === "battle") battleView.skip();
  if (mode === "world" && !e.repeat) {
    if (duelIn) inviteKey(k);
    else if (peerMenu) peerKey(k);
    else if (crate) crateKey(k);
    else {
      const em = !menu && live.status === "online" ? EMOTES[Number(k) - 1] : undefined;
      if (em) sendEmote(em);
      else menuKey(k);
    }
  }
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
      // Same order as the hint over your head (overworld.ts): door, bed, Elder, stall, poop, player, wild pet.
      const bed = world.bedNear();
      if (world.atDoor()) {
        mode = "home";
        keys.clear();
        toast = null;
        interior.enter();
      } else if (bed >= 0) useBed(bed);
      else if (world.nearElder()) openChat("elder");
      else if (world.nearStall()) crate = { cursor: 0 };
      else if (world.messNear() !== null) {
        world.cleanMess(world.messNear()!);
        world.say("me", "All clean!", 1.5);
      }
      else if (world.peerNear()) peerMenu = { id: world.peerNear()!, cursor: 0 };
      else if (world.wildNear() && chatWhoFor("wild", world.wildNear()!.arch)) openChat(world.wildNear()!);
      else if (live.status === "online" && world.peers.size) openChat("room");
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

// A fight against a wild pet, or "boss": The Reader, which reads your memo rules and counters them until
// it runs out of focus (sim/boss.ts); a dazed boss can be befriended.
// ---- pet brain: rules only by default; B switches to Llama 3.2 1B in the browser (WebGPU) or power mode
// (Llama 3.2 3B via llama.cpp on 127.0.0.1:8080). Per-move cloud picks are opt-in with ?cloudmoves.
const instinct = new Instinct(null);
const webBrain = new WebLlmVoice();
const nativeBrain = new NativeVoice();
const brainTag = () => (instinct.voice === nativeBrain ? "llama 3b" : instinct.voice === webBrain ? "llama 1b" : "cloud");
async function switchBrain(): Promise<void> {
  if (instinct.voice) {
    instinct.voice = null;
    toast = { text: "Brain: rules only (the measured memo policy).", who: "Brain", t: 3 };
    return;
  }
  toast = { text: "Looking for power mode (llama.cpp on this computer)... allow local access if Chrome asks.", who: "Brain", t: 30 };
  if (await nativeBrain.probe(20_000)) {
    instinct.voice = nativeBrain;
    toast = { text: "Power mode: Llama 3.2 3B on this computer picks moves the memo allows and talks.", who: "Brain", t: 5 };
    return;
  }
  if (!WebLlmVoice.supported()) {
    toast = { text: "No power mode and no WebGPU here, so your pet stays on rules.", who: "Brain", t: 5 };
    return;
  }
  try {
    await webBrain.load((_text, frac) => (toast = { text: `Loading Llama 3.2 1B in this tab: ${Math.round(100 * frac)}%`, who: "Brain", t: 30 }));
    instinct.voice = webBrain;
    toast = { text: "Llama 3.2 1B runs in this tab now. B again: back to rules only.", who: "Brain", t: 5 };
  } catch (e) {
    toast = { text: `Could not load the model (${(e as Error).message}). Rules only.`, who: "Brain", t: 5 };
  }
}
void (async () => {
  if ((await localAccessState()) === "granted" && (await nativeBrain.probe(800))) instinct.voice = nativeBrain;
  if (!instinct.voice && new URLSearchParams(location.search).has("cloudmoves")) {
    const cloud = new CloudVoice({ provider: "modal" });
    if (await cloud.probe()) instinct.voice = cloud;
  }
})();

// ---- village minds: every pet at your corner has a mind (persona, plan, memory, friends). The same local
// Llama the B key loads for fights thinks for them through one queue; without it they run on needs + rules.
const localBrain = () => (instinct.voice === nativeBrain ? nativeBrain : instinct.voice === webBrain ? webBrain : null);
const mindSched = new MindScheduler(() => localBrain(), { paused: () => mode === "battle" });
world.attachMinds(mindSched, () => localBrain() !== null, (() => {
  try {
    return parseMindsSave(JSON.parse(localStorage.getItem(MINDS_KEY) ?? "null"));
  } catch {
    return null;
  }
})());
const saveMinds = () => {
  try {
    if (world.minds) localStorage.setItem(MINDS_KEY, JSON.stringify(world.minds.snapshot()));
  } catch {
    // storage full or blocked: minds just start fresh next time
  }
};
setInterval(saveMinds, 20_000);
window.addEventListener("beforeunload", saveMinds);

const memoKey = () => JSON.stringify([state.memo.rules.map((r) => [r.if, r.do]), state.home]);
function coolFoe(foe: Wild | "boss" | "ghost"): void {
  if (foe === "boss") world.boss!.cool = 10;
  else if (foe === "ghost") world.ghostStone!.cool = 10;
  else foe.cool = 8;
}

// Live room: other players online walk around this world (WebSocket Durable Object, ~10 Hz while moving).
// Room chat goes through the same Say box when nobody is near. Others see (and duel) your active pet.
// Your own other tabs (same save, so the same pet) are left out of the world.
const myGenes = () => activeMember().genes;
const sameSave = (g: Genes) => JSON.stringify(g) === JSON.stringify(myGenes());
const addPeer = (p: LivePeer) => {
  if (!sameSave(p.genes)) world.addPeer(p.id, p.name, p.genes, p.x, p.z, p.px, p.pz);
};
// Grounds: every player in the room holds a slot on the ring; their ground is drawn from the seed in their
// hello. A player who leaves leaves a ghost ground for 10 min. Any change rebuilds the map (same on every
// client); so does the shared day (in-between grounds) and a ghost ground expiring.
const grounds = new Map<string, GroundOwner>(); // live id -> ground
const aways = new Map<number, { g: GroundOwner; until: number }>(); // slot -> ghost ground
let mySlot = 0;
const ROOM_SEED = [...roomUrl(location)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
const relayoutGrounds = () => {
  const now = Date.now();
  for (const [slot, a] of aways) if (a.until <= now) aways.delete(slot);
  world.relayout({ me: { seed: state.groundSeed!, slot: mySlot }, others: [...grounds.values(), ...[...aways.values()].map((a) => a.g)], roomSeed: ROOM_SEED, day: worldDay(now) });
};
const trackGround = (p: LivePeer) => {
  if (p.corner === null || sameSave(p.genes)) return;
  aways.delete(p.corner);
  grounds.set(p.id, { id: p.id, name: p.name, seed: p.seed || ([...p.id].reduce((h, c) => h * 33 + c.charCodeAt(0), 5) % 2 ** 31) + 1, slot: p.corner });
};
setInterval(() => {
  const due = [...aways.values()].some((a) => a.until <= Date.now());
  if (due || worldDay() !== world.day) relayoutGrounds();
}, 5000);
const live = new LiveLink(roomUrl(location), () => ({ name: liveName(myGenes()), genes: myGenes(), groundSeed: state.groundSeed, ...world.me }), {
  welcome: (_id, corner, peers, awayList) => {
    world.peers.clear();
    grounds.clear();
    aways.clear();
    mySlot = corner ?? 0;
    for (const a of awayList) aways.set(a.slot, { g: { id: `away${a.slot}`, name: a.name, seed: a.seed || 1, slot: a.slot, away: true }, until: Date.now() + a.ttl });
    for (const p of peers) (addPeer(p), trackGround(p));
    relayoutGrounds();
  },
  join: (p) => {
    addPeer(p);
    trackGround(p);
    relayoutGrounds();
  },
  leave: (id) => {
    world.peers.delete(id);
    if (grounds.delete(id)) relayoutGrounds();
  },
  away: (a) => {
    aways.set(a.slot, { g: { id: `away${a.slot}`, name: a.name, seed: a.seed || 1, slot: a.slot, away: true }, until: Date.now() + a.ttl });
    relayoutGrounds();
  },
  pos: (id, x, z, px, pz) => world.movePeer(id, x, z, px, pz),
  emote: (id, e) => world.say(`p:${id}`, EMOTE_TEXT[e], 3),
  status: (s) => {
    if (s === "online") return;
    world.peers.clear();
    if (grounds.size || aways.size) {
      grounds.clear();
      aways.clear();
      relayoutGrounds();
    }
  },
  say: (id, text) => world.say(`p:${id}`, text, 5),
  duel: (duel, from, name) => duelInvited(duel, from, name),
  duelStart: (_duel, seed, a, b) => void duelStarted(seed, a, b),
  duelEnd: (_duel, reason) => duelEnded(reason),
});
live.connect();
onPetChange = () => live.rejoin();

// ---- live room extras: emotes (1-4 or the peer menu) and duels. A duel is pet vs pet, both following their
// own memo rules on a shared seed (sim/duel.ts), so both players watch the same fight.
const EMOTE_TEXT: Record<Emote, string> = { wave: "*waves*", heart: "<3 <3", dance: "*dances*", laugh: "haha!" };
function sendEmote(e: Emote): void {
  if (live.emote(e)) world.say("me", EMOTE_TEXT[e], 3);
}
const DUEL_WAIT_MS = 20_000;
let peerMenu: { id: string; cursor: number } | null = null;
let duelOut: { name: string; timer: number } | null = null;
let duelIn: { duel: string; name: string; cursor: number; timer: number } | null = null;
const PEER_ROWS = ["Duel", "Wave", "Heart", "Dance", "Laugh", "Say something", "Close"] as const;
function peerKey(k: string): void {
  const m = peerMenu!;
  const n = PEER_ROWS.length;
  if (k === "arrowup" || k === "w") m.cursor = (m.cursor + n - 1) % n;
  if (k === "arrowdown" || k === "s") m.cursor = (m.cursor + 1) % n;
  if (k === "escape" || k === "x") peerMenu = null;
  if (k !== "enter" && k !== " " && k !== "z" && k !== "e") return;
  const row = PEER_ROWS[m.cursor]!;
  const p = world.peers.get(m.id);
  peerMenu = null;
  if (row === "Duel" && p && !duelOut && live.challenge(m.id, state.memo, myGenes())) {
    duelOut = { name: p.name, timer: window.setTimeout(() => duelEnded("gone"), DUEL_WAIT_MS) };
    toast = { text: `You challenged ${p.name}. Waiting for an answer...`, t: 4 };
    world.say("pet", "A duel? I'm ready!", 2);
  } else if (row === "Say something") openChat("room");
  else if (row !== "Close" && row !== "Duel") sendEmote(row.toLowerCase() as Emote);
}
function duelInvited(duel: string, _from: string, name: string): void {
  if (mode !== "world" || duelIn || teach.open) return void live.decline(duel);
  duelIn = { duel, name, cursor: 0, timer: window.setTimeout(() => answerInvite(false), DUEL_WAIT_MS) };
}
function answerInvite(yes: boolean): void {
  if (!duelIn) return;
  clearTimeout(duelIn.timer);
  if (yes) live.accept(duelIn.duel, state.memo, myGenes());
  else live.decline(duelIn.duel);
  duelIn = null;
}
function inviteKey(k: string): void {
  const d = duelIn!;
  if (k === "arrowup" || k === "w" || k === "arrowdown" || k === "s") d.cursor = 1 - d.cursor;
  if (k === "escape" || k === "x") answerInvite(false);
  if (k === "enter" || k === " " || k === "z" || k === "e") answerInvite(d.cursor === 0);
}
function duelEnded(reason: "declined" | "gone"): void {
  if (duelIn && reason === "gone") {
    clearTimeout(duelIn.timer);
    duelIn = null;
  }
  if (!duelOut) return;
  clearTimeout(duelOut.timer);
  toast = { text: reason === "declined" ? `${duelOut.name} said no thanks.` : `${duelOut.name} did not answer.`, t: 3 };
  duelOut = null;
}
const DUEL_END: Record<DuelResult, [Outcome, string]> = { win: ["win", "ko"], loss: ["loss", "ko"], draw: ["timeout", ""], friends: ["win", "befriended"] };
async function duelStarted(seed: number, a: Fighter, b: Fighter): Promise<void> {
  const me = live.myId === a.id ? "a" : live.myId === b.id ? "b" : null;
  if (!me || mode !== "world") return; // not ours, or busy (the other side still sees the whole duel)
  if (duelOut) clearTimeout(duelOut.timer);
  duelOut = null;
  mode = "battle";
  keys.clear();
  const them = me === "a" ? b : a;
  const v = duelView(a, b, seed, me);
  const mine = { ...side(activeMember()), maxHp: v.myMaxHp };
  await battleView.open({ name: them.name.slice(0, 12), sprite: drawMonster(petLook(them.genes), 64, "front"), maxHp: v.theirMaxHp, level: 3 }, mine);
  await battleView.say(`Live duel! Both pets follow their own memo rules. Same fight on both screens.`);
  for (const t of v.turns) await battleView.playTurn(t.mine, "", "duel", t.theirAct, t.dealt, t.taken, t.myHp, t.theirHp);
  await battleView.end(...DUEL_END[v.result]);
  const earned = duelCoins(v.result);
  if (earned) {
    state.coins = addCoins(state.coins ?? 0, earned);
    await battleView.say(`+${earned} coins.`);
  }
  save(state);
  mode = "world";
}

async function fight(foe: Wild | "boss" | "ghost"): Promise<void> {
  mode = "battle";
  keys.clear();
  const w = typeof foe === "string" ? null : foe;
  const boss: Boss | null = foe === "boss" ? makeBoss(state.memo, pet) : null;
  // A ghost: another player's shared pet (looks + memo rules) from the Worker, or a bundled one offline.
  const ghost: Ghost | null = foe === "ghost" ? (await fetchRandomGhost()).ghost : null;
  const arch = w ? w.arch : ghost ? GHOST_ARCHETYPE : BOSS_ARCHETYPE;
  const tactic = w ? wildMemos[w.arch] : undefined;
  foeVoice = ghost ? "ghost" : arch;
  const def = boss ? boss.def : ghost ? ghostEnemyDef(ghost, pet) : withTactics(ENEMIES[arch], tactic);
  const battle = new Battle({ enemy: arch, seed: Math.floor(Math.random() * 1e9), enemyDef: def, ...(boss ? { maxTurns: BOSS_TURNS } : {}) });
  const foeName = boss ? BOSS_STATS.label : ghost ? ghost.name.slice(0, 12) : arch[0]!.toUpperCase() + arch.slice(1);
  const foeSprite = boss
    ? drawMonster(petLook(randomGenes(4242)), 80, "front", BUILDS.bully)
    : ghost
      ? drawMonster(petLook(parseGenes(ghost.genes) ?? randomGenes(1)), 64, "front")
      : drawMonster(petLook(w!.genes), 64, "front", BUILDS[arch]);
  await battleView.open({ name: foeName, sprite: foeSprite, maxHp: def.maxHp, level: boss ? 9 : ghost ? 5 : 2 + (w!.id % 3) }, side(activeMember()));
  if (ghost) await battleView.say(`${ghost.name}'s ghost fights with its owner's memo: ${ghost.memo.rules.length} rule${ghost.memo.rules.length === 1 ? "" : "s"}.`);
  if (boss) {
    await battleView.say(wildMemos.boss?.summary ? `"${wildMemos.boss.summary}"` : `"I can read your pet's memo. Every rule. Surprise me."`);
    await battleView.say(`It loses focus after ${BOSS_FOCUS} reads. A dazed boss might make friends.`);
  }
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
      coolFoe(foe);
      mode = "world";
      return;
    }
  }
  // The pet's brain: a firing memo rule decides at once; otherwise a local Llama (if loaded) picks among
  // the moves the memo allows and gives the line, with the reflex as fallback. The next pick is prefetched
  // while the current turn animates.
  const name = activeMember().name;
  let next = instinct.decide(name, state.memo, battle.observe());
  while (!battle.done) {
    const obs = battle.observe();
    await battleView.say(`${foeName} ${TELL[obs.intent]}`);
    const choice = await next;
    const tag = choice.source === "rule" ? `memo #${choice.rule! + 1}` : choice.source === "model" ? brainTag() : "instinct";
    const rec = battle.step(choice.action);
    if (!battle.done) next = instinct.decide(name, state.memo, battle.observe());
    await battleView.playTurn(choice.action, choice.line, tag, rec.enemyAct, rec.dealt, rec.taken, rec.myHp, rec.enemyHp);
    const read = boss?.reads.find((r) => r.turn === obs.turn);
    if (read) await battleView.say(`It read memo #${read.rule + 1}! ${read.did === "idle" ? "It faked the tell." : "It hit hard anyway."}`, "boss read");
    else if (boss?.dazedTurns.includes(obs.turn)) await battleView.say(`${foeName} is dazed: it can't read you now.`, "dazed");
  }
  const replay = battle.replay();
  await battleView.end(replay.outcome, replay.how);
  if (replay.outcome === "win") {
    const earned = coinsFor(replay.outcome, replay.how);
    state.coins = addCoins(state.coins ?? 0, earned);
    let msg = `+${earned} coins.`;
    if (replay.how === "befriended" && w) {
      state.tamed = [...(state.tamed ?? []), w.arch].slice(-MAX_TAMED); // v1 readers
      state.party = addToParty(state.party ?? [], w.arch, w.genes);
      state.active = Math.min(state.active ?? 0, state.party.length);
      refreshParty();
      msg = `${state.party.at(-1)!.name} the ${w.arch} is yours now! It waits at your corner. ${msg}`;
    }
    if (boss) msg = `You outsmarted The Reader! ${msg}`;
    await battleView.say(msg);
    if (w) {
      world.removeWild(w.id);
      const meadow = world.world.platforms.find((p) => Math.hypot(p.x - w.home.x, p.z - w.home.z) <= p.r);
      if (meadow) setTimeout(() => world.spawnWild(meadow.x, meadow.z, meadow.r), 20000);
    } else coolFoe(foe);
  } else {
    if (boss) await battleView.say("Tip: it reads your rules. Teach a plan it can't predict, then come back.");
    coolFoe(foe); // give the player time to walk away
  }
  if (w) state.recent = [...state.recent, replay].slice(-8);
  // Winning wild fights with a taught memo shares your pet as a ghost others can fight (rules only).
  if (w && replay.outcome === "win" && state.memo.rules.length > 0 && state.shared !== memoKey()) {
    void shareGhost(pet.name, state.genes, state.memo, state.home).then((r) => {
      if (!r.ok) return;
      state.shared = memoKey();
      state.mine = [...(state.mine ?? []), r.id].slice(-20);
      save(state);
      toast = { text: `${pet.name}'s ghost is out there now: other players can fight its memo.`, t: 4 };
    });
  }
  state.steps = { ...state.steps, fought: true, ...(boss && replay.outcome === "win" ? { boss: true } : {}) };
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
    const met = world.update(dt, menu || crate || peerMenu || duelIn ? new Set<string>() : keys);
    petChatter(dt);
    live.tick(performance.now(), world.me);
    if ((farmTickAt -= dt) <= 0) {
      farmTickAt = 1;
      const next = tick(state.farm!, Date.now());
      if (next !== state.farm) {
        state.farm = world.farm = next;
        save(state);
      }
    }
    world.draw(g, low.width, low.height, t);
    if (!menu && !crate && !peerMenu && !duelIn) drawGoals();
    if (met) void fight(met);
    if (menu) {
      const a = state.active ?? 0;
      const rows: MenuRow[] = members().map((m, i) => ({ label: m.name, note: i === a ? "with you" : "at home", icon: icon(m) }));
      drawMenu(g, low.width, low.height, "Your pets", rows, menu.cursor, t, "Enter: take along  P: close");
    } else if (duelIn) drawMenu(g, low.width, low.height, `${duelIn.name} wants a duel!`, [{ label: "Accept" }, { label: "Decline" }], duelIn.cursor, t, "Your pet fights with its memo rules");
    else if (peerMenu) drawMenu(g, low.width, low.height, world.peers.get(peerMenu.id)?.name ?? "Player", PEER_ROWS.map((label) => ({ label })), peerMenu.cursor, t, "Enter: pick  Esc: close  1-4: emotes");
    else if (crate) drawMenu(g, low.width, low.height, `Market  ${state.coins ?? 0}c`, crateRows(), crate.cursor, t, "Enter: pick  Esc: close");
    else if (toast) {
      toast.t -= dt;
      drawDialogue(g, low.width, low.height, toast.text, toast.who);
      if (toast.t <= 0) nextToast();
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
(window as unknown as { __px: unknown }).__px = { world, battleView, interior, update, keys, setCrt, state, fight, live, mindSched, webBrain };
