// The game's entry (index.html): a low-res canvas, the scene stack (overworld, battle, interior, teach) and
// the CRT presenter, wired to the save, the pet brain, Meta-model chat/coach and the live room.

import { petLook } from "../game/genes";
import { EMOTES, liveName, type Emote } from "../world/live";
import { newGroundSeed } from "../world/ground";
import { addCoins } from "../game/shop";
import { load, save } from "../game/save";
import { type PartyMon } from "../game/party";
import type { Genes } from "../sim/ghost";
import { fetchWildMemos, type WildMemos } from "../sim/tactics";
import { DEFAULT_PET } from "../sim/types";
import { BattleView, type Side } from "./battle";
import { makePresenter } from "./crt";
import { makeFightFlow } from "./fight-flow";
import { makeChatFlow } from "../game/chat-flow";
import { EMOTE_TEXT, makeRoomFlow } from "../world/room-flow";
import { LOCAL_ONLY } from "../game/test-mode";
import { BUILDS, drawMonster } from "./monster";
import { Overworld, type Wild } from "./overworld";
import { drawFrame, drawText, drawToast } from "./text";
import { humanLook, workSeconds } from "./humans";
import { PIXEL_HINTS, pixelGoals } from "../game/onboard";
import { loadArt } from "./art";
import { loadSunny } from "./sunny";
import { Babbler } from "../game/babble";
import { voiceFor, type Speaker } from "../game/chatter";
import { Instinct } from "../game/instinct";
import { CloudMind, CloudVoice, WebLlmVoice } from "../game/voices";
import { MINDS_KEY, parseMindsSave } from "../mind/hub";
import { MindScheduler } from "../mind/scheduler";
import { chatWhoFor } from "../game/npc-chat";
import { askPets, traitOf } from "../game/pet-chat";
import { Interior } from "./interior";
import { HATCH_TIME } from "../game/pet-mood";
import { defaultRoom } from "../game/room";
import type { Good } from "../mind/economy";
import type { Pocket } from "../mind/npcs";
import { buySeeds, CROP_IDS, CROPS, emptyFarm, harvest, plant, RIPE, sellAll, tick, water, type CropId } from "../game/farm";
import { drawMenu, type MenuRow } from "./menu";
import { chipSpots } from "../view/mosaic/compose";
import { MosaicView } from "../view/mosaic/mosaic-view";
import type { ScenePanel } from "../game/ports";
import { runSetup, storeSetup } from "./setup";
import { TeachScreen } from "./teach";

export const LOW_H = 216;
// The mosaic plane wants about 45 rows of 8-pixel cells. ?look=pixel is the old Sunnyside view.
const pixelLook = new URLSearchParams(location.search).get("look") === "pixel";
const lowRows = pixelLook ? LOW_H : 360;

// One art pixel is always a whole number of screen pixels, or pixels come out in different sizes. The scale that
// shows at least LOW_H rows wins, and the low-res picture takes whatever size fills the screen at that scale.
export function lowSize(devW: number, devH: number, rows = LOW_H): { w: number; h: number; scale: number } {
  const scale = Math.max(1, Math.floor(Math.max(1, devH) / rows));
  return { w: Math.max(1, Math.ceil(devW / scale)), h: Math.max(1, Math.ceil(devH / scale)), scale };
}


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
if (!pixelLook) {
  world.view = new MosaicView();
  document.body.classList.add("cells");
}

// Who is out with you: 0 = the hatched pet, i = party[i - 1]. Everyone else lives at your corner.
interface Member { name: string; genes: Genes; arch?: PartyMon["arch"] }
const members = (): Member[] => [{ name: pet.name, genes: state.genes }, ...(state.party ?? [])];
const activeMember = (): Member => members()[state.active ?? 0] ?? members()[0]!;
let onPetChange = (): void => undefined; // set once the live room exists: others see the pet you walk with
function refreshParty(): void {
  const all = members();
  const a = state.active ?? 0;
  world.setPet(all[a]!.genes, all[a]!.arch);
  world.petName = all[a]!.name ?? "your pet";
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
    world.startWork(!p.crop ? "dig" : p.stage >= RIPE ? "sweep" : "water", 1.4);
  }
}
// E at water, a tree or flowers: a full round of the job, then the goods. Walking off stops it empty-handed.
const GATHER = { fish: { pose: "fish", good: "fish" }, chop: { pose: "chop", good: "wood" }, herbs: { pose: "sweep", good: "herbs" } } as const;
function gather(kind: keyof typeof GATHER): void {
  const { pose, good } = GATHER[kind];
  world.startWork(pose, workSeconds(pose), () => {
    state.pack = { ...state.pack, [good]: (state.pack?.[good] ?? 0) + 1 };
    save(state);
    toast = { text: `+1 ${good} (you have ${state.pack[good]}). Trade it with a villager or at the board.`, t: 3 };
  });
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
  browserCoach: () => (instinct.voice === webBrain ? (req) => webBrain.completeJson(req) : null),
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

// A door closes the picture, swaps the place behind it, and opens again, with the keys let go.
const DOOR_TIME = 0.24; // seconds each way
let door: { t: number; swap: (() => void) | null } | null = null;
function throughDoor(swap: () => void): void {
  door ??= { t: 0, swap };
}
function stepDoor(dt: number): void {
  if (!door) return;
  keys.clear();
  door.t += dt;
  if (door.swap && door.t >= DOOR_TIME) {
    door.swap();
    door.swap = null;
  }
  world.view.wipe = Math.max(0, 1 - Math.abs(door.t / DOOR_TIME - 1));
  if (door.t >= 2 * DOOR_TIME) door = null;
}
state.room ??= defaultRoom();
const interior = new Interior({
  room: () => state.room!,
  setRoom: (r) => {
    state.room = r;
    save(state);
  },
  petSprite: () => world.petSprite,
  residents: () => world.residentSprites(),
  look: () => world.myLook,
  genes: () => world.petGenes,
  residentGenes: () => world.residents.map((r) => r.genes),
  useCrate: () => {
    const no = world.npcs?.shipRefused(myName());
    if (no) toast = { text: no, t: 4 };
    else crate = { cursor: 0 };
  },
  leave: () => throughDoor(() => {
    mode = "world";
    world.exitHouse();
  }),
  around: (g, sw, sh, t, x, y) => world.drawAround(g, sw, sh, t, x, y),
});

const chat = makeChatFlow({
  world, state, keys, babbler, myName,
  live: () => live,
  hostOf: (npc) => room.hostOf(npc),
  renamed: () => {
    showName();
    live.rejoin();
  },
});
const { open: openChat, close: closeChat } = chat;
const say = (text: string, t: number) => void (toast = { text, t });

// Pets chat with each other at home now and then (Muse Spark via /api/petchat, scripted when offline).
let petChatT = 15;
function petChatter(dt: number): void {
  if ((petChatT -= dt) > 0) return;
  petChatT = 30;
  const all = members();
  const a = state.active ?? 0;
  const others = all.filter((_, i) => i !== a);
  if (!others.length || !world.nearHome() || chat.target() || localBrain()) return; // with a local model the pets' minds do the talking
  const r = Math.floor(Math.random() * others.length);
  const them = others[r]!;
  void askPets({ name: all[a]!.name, trait: traitOf(state.memo) }, { name: them.name, trait: "curious" }).then(({ lines: [mine, theirs] }) => {
    if (mode !== "world") return;
    world.say("pet", mine, 3);
    setTimeout(() => mode === "world" && world.say(`r${r}`, theirs, 3), 1600);
  });
}

// The town board: read only.
let board: { cursor: number } | null = null;

// What a villager sees of me in a deal: coins, the harvest basket for crops, the pack for the rest.
const isCrop = (g: Good): g is CropId => (CROP_IDS as readonly string[]).includes(g);
const pocket: Pocket = {
  coins: () => state.coins ?? 0,
  count: (g) => (isCrop(g) ? state.farm?.basket[g] : state.pack?.[g]) ?? 0,
  change(coins, g, n) {
    state.coins = addCoins(state.coins ?? 0, coins);
    if (isCrop(g) && state.farm) state.farm = world.farm = { ...state.farm, basket: { ...state.farm.basket, [g]: Math.max(0, (state.farm.basket[g] ?? 0) + n) } };
    else if (!isCrop(g)) state.pack = { ...state.pack, [g]: Math.max(0, (state.pack?.[g] ?? 0) + n) };
    save(state);
  },
};

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
    const shipped = CROP_IDS.filter((g) => f.basket[g]).map((g) => ({ good: g as Good, qty: f.basket[g]!, price: CROPS[g].sell }));
    const r = sellAll(f, state.coins ?? 0);
    world.npcs?.shipped(myName(), shipped);
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
let toast: { text: string; who?: string; t: number } | null = { text: "WASD: walk. Shift: run. E: use/talk. T: teach. P: pets. B: brain. N: name. M: mute.", who: "Hint", t: 7 };
// First visit: the hatch line, then the control hints one after another (each 6 s, Esc skips), once.
const hintQueue: { text: string; who?: string; t: number }[] = [];
if (!state.onboard?.seen) {
  world.startHatch();
  toast = { text: "Something is wiggling inside your egg...", who: "Hint", t: HATCH_TIME };
  hintQueue.push({ text: `Your egg hatched! Meet ${pet.name}. It learns to fight from what you teach it.`, who: pet.name, t: 6 });
  hintQueue.push(...PIXEL_HINTS.map((text) => ({ text, who: "Hint", t: 6 })));
}
function nextToast(): void {
  toast = hintQueue.shift() ?? null;
  if (!toast && !state.onboard?.seen) {
    state.onboard = { ...state.onboard, seen: true };
    save(state);
  }
}

// The small buttons (bottom left) open and close every panel but the clock; remembered in the save. The plane draws
// them and a click on it presses the real one.
const chips = () => [...document.querySelectorAll<HTMLButtonElement>("#ui button")].filter((b) => !b.hidden).map((button) => ({ button, label: button.textContent!, off: button.classList.contains("off") }));
const hidden = (name: string) => !!state.hide?.[name];
function applyUi(): void {
  for (const b of document.querySelectorAll<HTMLButtonElement>("#ui [data-ui]")) b.classList.toggle("off", hidden(b.dataset.ui!));
  world.ui = { names: !hidden("names"), map: !hidden("map") };
  if (world.view instanceof MosaicView) world.view.grout = !hidden("grid");
}
document.getElementById("ui")!.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest("button");
  if (!b) return;
  b.blur();
  if (b.dataset.ui === "rename") return void (mode === "world" && !chat.target() && openChat("name"));
  if (b.dataset.dev) return fakeIsle(b.dataset.dev === "add");
  const name = b.dataset.ui!;
  state.hide = { ...state.hide, [name]: !hidden(name) };
  if (name === "goals") state.onboard = { ...state.onboard, goalsHidden: false };
  save(state);
  applyUi();
});
applyUi();

// What goes on the plane next frame, in place of menus drawn over it.
let nextPanels: ScenePanel[] = [];
function showMenu(title: string, rows: readonly MenuRow[], cursor: number, t: number, footer: string): void {
  if (pixelLook) drawMenu(g, low.width, low.height, title, rows, cursor, t, footer);
  else nextPanels.push({ place: "middle", title, rows: rows.map((r) => ({ label: r.label, note: r.note })), cursor, footer });
}

// The goals card (top left, G hides it): what a first visit should try. Gone once all four are done.
function drawGoals(): void {
  if (hidden("goals") || state.onboard?.goalsHidden || world.inspect) return;
  const list = pixelGoals({ taught: !!state.steps?.proved, party: (state.party ?? []).length, shipped: !!state.steps?.shipped, boss: !!state.steps?.boss });
  if (list.every((x) => x.done)) return;
  if (!pixelLook) {
    nextPanels.push({ place: "corner", title: "GOALS  (G)", rows: list.map((x) => ({ label: `${x.done ? "+" : "-"} ${x.label}`.slice(0, 26), ink: x.done ? "#7A8F89" : "#39463F" })) });
    return;
  }
  const w = 150;
  drawFrame(g, 4, 4, w, 18 + list.length * 10);
  drawText(g, "GOALS  (G)", 10, 9, "#795849");
  list.forEach((x, i) => drawText(g, `${x.done ? "+" : "-"} ${x.label}`.slice(0, 22), 10, 20 + i * 10, x.done ? "#7A8F89" : "#39463F"));
}

const CRT_KEY = "mw.crt";
let crt = false; // off for now: the pack's clean pixels are the look we are judging
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

// The canvas has exactly the screen's device pixels, so the browser never resamples it. CSS sizes alone cannot promise
// that at 125% or 150% Windows scaling. The low-res picture runs a little past the edge when the size does not divide.
let lowScale = 1;
function resize(devW = Math.round(window.innerWidth * (window.devicePixelRatio || 1)), devH = Math.round(window.innerHeight * (window.devicePixelRatio || 1))): void {
  const s = lowSize(devW, devH, lowRows);
  lowScale = s.scale;
  low.width = s.w;
  low.height = s.h;
  out.width = devW;
  out.height = devH;
  g.imageSmoothingEnabled = false;
}

window.addEventListener("resize", () => resize());
try {
  new ResizeObserver(([e]) => {
    const box = e?.devicePixelContentBoxSize?.[0];
    if (box && (box.inlineSize !== out.width || box.blockSize !== out.height)) resize(box.inlineSize, box.blockSize);
  }).observe(out, { box: "device-pixel-content-box" });
} catch {
  /* Safari has no such box: window size times the pixel ratio it is */
}
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (teach.open) {
    if (k === "escape") teach.hide();
    if (k === "tab") {
      e.preventDefault();
      teach.review();
    }
    return; // typing in the teach box
  }
  if (chat.target()) {
    if (k === "escape") closeChat();
    return; // typing in the chat box
  }
  if (k === "b" && !e.repeat && mode === "world" && !menu) void switchBrain();
  if (k === "i" && !e.repeat && mode === "world" && !menu && !crate) world.toggleInspect();
  if (k === "g" && !e.repeat && mode === "world" && !chat.target()) {
    state.onboard = { ...state.onboard, goalsHidden: !state.onboard?.goalsHidden };
    save(state);
  }
  if (k === "escape" && mode === "world" && toast && !menu && !crate) nextToast();
  if (k === "n" && !e.repeat && mode === "world" && !menu && !crate && !board && !peerMenu && !duelIn) {
    keys.clear();
    e.preventDefault(); // the letter is not part of the name
    return void openChat("name");
  }
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
    else if (board) {
      if (["escape", "x", "e", "enter"].includes(k)) board = null;
    } else {
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
  const r = out.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * low.width;
  const y = ((e.clientY - r.top) / r.height) * low.height;
  if (chat.target() || teach.open) e.preventDefault(); // the hidden form keeps the keyboard
  if (!pixelLook && mode !== "battle" && Math.floor(y / 8) === Math.ceil(low.height / 8) - 1) {
    const hit = chipSpots(chips()).find((c) => x / 8 >= c.x && x / 8 < c.x + c.label.length + 2);
    return hit?.button.click();
  }
  if (mode !== "battle") return;
  if (!(pixelLook ? battleView.cmdAt(x, y, low.width, low.height) : battleView.cmdAtCells(x, y, low.width, low.height))) battleView.skip();
});
resize();

// The stall is a person: closed outside the keeper's hours, and the keeper may refuse you (then you can talk it out).
function openStall(): void {
  const deal = world.npcs?.dealWith(myName());
  if (!deal || deal.ok) crate = { cursor: 0 };
  else if (deal.refused) openChat(deal.npc);
  else world.say("me", deal.text, 4);
}

function menuKey(k: string): void {
  if (!menu) {
    if (k === "e" || k === "enter") {
      // Same order as the hint over your head (overworld.ts): door, bed, Elder, stall, poop, player, wild pet.
      const bed = world.bedNear();
      if (world.atDoor()) {
        throughDoor(() => {
          mode = "home";
          toast = null;
          interior.enter();
        });
      } else if (bed >= 0) useBed(bed);
      else if (world.nearStall()) openStall();
      else if (world.nearBoard() && world.npcs) board = { cursor: 0 };
      else if (world.npcNear()) openChat(world.npcNear()!);
      else if (world.messNear() !== null) {
        world.cleanMess(world.messNear()!);
        world.say("me", "All clean!", 1.5);
        world.startWork("sweep", 1.2);
      }
      else if (world.peerNear()) peerMenu = { id: world.peerNear()!, cursor: 0 };
      else if (world.wildNear() && chatWhoFor("wild", world.wildNear()!.arch)) openChat(world.wildNear()!);
      else if (world.gatherNear()) gather(world.gatherNear()!);
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
  return { name: m.name, genes: m.genes, sprite: drawMonster(petLook(m.genes), 48, "back", build), portrait: drawMonster(petLook(m.genes), 32, "front", build), maxHp: pet.maxHp, level: 3 };
}

// A fight against a wild pet, or "boss": The Reader, which reads your memo rules and counters them until
// it runs out of focus (sim/boss.ts); a dazed boss can be befriended.
// ---- pet brain: rules only by default; B switches to our tuned Llama 3.2 1B in the browser (WebGPU).
// Per-move cloud picks are opt-in with ?cloudmoves.
const instinct = new Instinct(null);
const webBrain = new WebLlmVoice();
const brainTag = () => (instinct.voice === webBrain ? "llama 1b" : "cloud");
async function switchBrain(): Promise<void> {
  if (instinct.voice) {
    instinct.voice = null;
    toast = { text: "Brain: rules only (the measured memo policy).", who: "Brain", t: 3 };
    return;
  }
  if (!WebLlmVoice.supported()) {
    toast = { text: "No WebGPU here, so your pet stays on rules.", who: "Brain", t: 5 };
    return;
  }
  try {
    await webBrain.load((_text, frac) => (toast = { text: `Loading Llama 3.2 1B in this tab: ${Math.round(100 * frac)}%`, who: "Brain", t: 30 }));
    instinct.voice = webBrain;
    toast = { text: "Llama 3.2 1B runs in this tab now. B again: back to rules only.", who: "Brain", t: 5 };
  } catch (e) {
    storeSetup(null, false); // next visit runs the setup gate again
    toast = { text: `Could not load the model (${(e as Error).message}). Rules only.`, who: "Brain", t: 5 };
  }
}
void (async () => {
  if (new URLSearchParams(location.search).has("cloudmoves")) {
    const cloud = new CloudVoice({ provider: "modal" });
    if (await cloud.probe()) instinct.voice = cloud;
  }
})();

// ---- village minds: every pet at your corner has a mind (persona, plan, memory, friends). The same local
// Llama the B key loads for fights thinks for them through one queue; without it they run on needs + rules.
const localBrain = () => (instinct.voice === webBrain ? webBrain : null);
// Local model first, then Muse Spark, then the rules (the scheduler's fallback).
const cloudMind = new CloudMind();
void cloudMind.probe();
webBrain.onLost = () => {
  if (instinct.voice === webBrain) instinct.voice = null;
  toast = { text: "The GPU dropped the model. Your pet goes on with rules.", who: "Brain", t: 6 };
};
const mindSched = new MindScheduler(() => localBrain() ?? (!LOCAL_ONLY && cloudMind.ready() ? cloudMind : null), { paused: () => mode === "battle" });
world.attachMinds(mindSched, () => localBrain() !== null || (!LOCAL_ONLY && cloudMind.available()), (() => {
  try {
    return parseMindsSave(JSON.parse(localStorage.getItem(MINDS_KEY) ?? "null"));
  } catch {
    return null;
  }
})());
// The NPC's host logs every line said to a player, so a play-test can be read afterwards.
world.npcs!.onChat = (e) => void fetch("/api/chatlog", { method: "POST", body: JSON.stringify(e) }).catch(() => {});
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
function myName(): string {
  return state.name || liveName(myGenes());
}
const showName = () => {
  world.myName = myName();
  world.myLook = humanLook(liveName(myGenes()));
};
showName();
const room = makeRoomFlow({
  world, state, chat, myName, myGenes, toast: say,
  speed: () => (localBrain() ? mindSched.tps(12) : 0),
  duel: { invited: duelInvited, started: (seed, a, b) => fights.duel(seed, a, b), ended: duelEnded },
});
const live = room.live;
const { fakeIsle, shareState } = room;
onPetChange = () => {
  showName();
  live.rejoin();
};

// ---- live room extras: emotes (1-4 or the peer menu) and duels. A duel is pet vs pet, both following their
// own memo rules on a shared seed (sim/duel.ts), so both players watch the same fight.
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
  } else if (row === "Say something") openChat({ peer: m.id });
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
const fights = makeFightFlow({
  world, state, pet, live: () => live, keys, battleView, teach, instinct,
  mode: () => mode,
  setMode: (m) => void (mode = m),
  setFoeVoice: (v) => void (foeVoice = v),
  wildMemos: () => wildMemos,
  members, activeMember, side, refreshParty, coolFoe, memoKey, brainTag,
  duelBegun: () => {
    if (duelOut) clearTimeout(duelOut.timer);
    duelOut = null;
  },
  toast: say,
});
const fight = fights.fight;

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  stepDoor(dt);
  last = now;
  update(dt, now / 1000);
  requestAnimationFrame(frame);
}
// A hidden tab gets no frames, but other players still see my villagers and me: the world runs on without drawing.
setInterval(() => {
  if (!document.hidden || mode !== "world") return;
  const now = performance.now();
  const steps = Math.min(40, Math.floor((now - last) / 50));
  if (!steps) return;
  last = now;
  for (let i = 0; i < steps; i++) world.update(0.05, new Set<string>());
  live.tick(now, world.me);
  shareState(now);
}, 500);

function update(dt: number, t: number): void {
  if (!pixelLook) world.chips = chips();
  if (teach.open) {
    if (pixelLook) teach.draw(g, low.width, low.height, t);
    else {
      world.panels = [teach.panel(t)];
      world.draw(g, low.width, low.height, t);
    }
  } else if (mode === "world") {
    const met = world.update(dt, menu || crate || board || peerMenu || duelIn ? new Set<string>() : keys);
    petChatter(dt);
    live.tick(performance.now(), world.me);
    shareState(performance.now());
    if ((farmTickAt -= dt) <= 0) {
      farmTickAt = 1;
      const next = tick(state.farm!, Date.now());
      if (next !== state.farm) {
        state.farm = world.farm = next;
        save(state);
      }
    }
    world.underBubbles = () => {
      if (!menu && !crate && !board && !peerMenu && !duelIn) drawGoals();
    };
    world.panels = nextPanels;
    nextPanels = [];
    if (!pixelLook && !menu && !crate && !board && !peerMenu && !duelIn) drawGoals();
    world.draw(g, low.width, low.height, t);
    if (world.npcs) world.npcs.pocket = pocket;
    if (met) void fight(met);
    if (menu) {
      const a = state.active ?? 0;
      const rows: MenuRow[] = members().map((m, i) => ({ label: m.name, note: i === a ? "with you" : "at home", icon: icon(m) }));
      showMenu("Your pets", rows, menu.cursor, t, "Enter: take along  P: close");
    } else if (duelIn) showMenu(`${duelIn.name} wants a duel!`, [{ label: "Accept" }, { label: "Decline" }], duelIn.cursor, t, "Your pet fights with its memo rules");
    else if (peerMenu) showMenu(world.peers.get(peerMenu.id)?.name ?? "Player", PEER_ROWS.map((label) => ({ label })), peerMenu.cursor, t, "Enter: pick  Esc: close  1-4: emotes");
    else if (crate) showMenu(`Market  ${state.coins ?? 0}c`, crateRows(), crate.cursor, t, "Enter: pick  Esc: close");
    else if (board) showMenu("Town board", world.npcs?.board() ?? [], -1, t, "Prices move with real trades. Esc: close");
    else if (chat.target() && !pixelLook) nextPanels.push({ place: "bottom", title: chat.target() === "name" ? "Your name" : "Say", rows: [{ label: `> ${chat.draft()}${Math.floor(t * 2) & 1 ? "_" : " "}` }], width: 60, footer: "Enter: send  Esc: bye" });
    else if (toast) {
      toast.t -= dt;
      if (!hidden("hints")) {
        const who = toast.who === "Hint" ? undefined : toast.who;
        if (pixelLook) drawToast(g, low.width, low.height, toast.text, who);
        else nextPanels.push({ place: "bottom", title: who ?? "", rows: [{ label: toast.text }], width: 60 });
      }
      if (toast.t <= 0) nextToast();
    }
  } else if (mode === "home") {
    interior.update(dt, crate || interior.deco ? new Set<string>() : keys);
    if (pixelLook) interior.draw(g, low.width, low.height, t);
    else {
      world.panels = nextPanels;
      nextPanels = [];
      world.view.draw(interior.scene(world.buildScene()), g, low.width, low.height, t);
    }
    if (crate) showMenu(`Crate  ${state.coins ?? 0}c`, crateRows(), crate.cursor, t, "Enter: pick  Esc: close");
  } else {
    battleView.update(dt);
    if (pixelLook) battleView.draw(g, low.width, low.height, t);
    else world.view.battle?.(battleView.scene(), g, low.width, low.height, t);
  }
  presenter.present(low, crt ? 1 : 0, lowScale);
}

// Tiles, props, frame and font PNGs (docs/visual/style.md) load before the first frame, and the setup gate runs first.
const setup = runSetup({
  load: (progress) => webBrain.load(progress),
  ready: () => (instinct.voice = webBrain),
  background: () => void switchBrain(),
});
void Promise.all([loadArt(), loadSunny(), setup]).then(() => requestAnimationFrame(frame));

// Dev hook: drive frames by hand when the tab is hidden (rAF stalls there).
(window as unknown as { __px: unknown }).__px = { world, battleView, interior, update, keys, setCrt, state, fight, live, mindSched, webBrain, fakeIsle };
