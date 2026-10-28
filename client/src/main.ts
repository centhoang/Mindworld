import { Instinct, type Choice } from "./game/instinct";
import { fetchRandomGhost, shareGhost } from "./game/ghost-api";
import { DECOR_ICON, DECOR_LABEL, decorCount, decorSummary, emptyHome, HOME_SLOTS, type DecorKind, type Slot } from "./game/home";
import { nextChatter, pickLine, speakerFor, voiceFor, type Speaker } from "./game/chatter";
import { addCoins, buy, coinsFor, parseCoins, parseOwned, PRICES, SHOP_ITEMS } from "./game/shop";
import { cycle, fromHome, itemAt, ownedItems, parseDecor, plotSlot, plotSlots, porchSlot, porchSlots, PORCH_SLOTS, type Placement, type SlotId } from "./game/decor";
import { Arena, dressPet, makeBossMesh, makeGhostPet, makePet } from "./game/scene";
import { castAll } from "./game/style";
import { EMOTE_ICON, EMOTES, LiveLink, liveName, roomUrl, SAY_MAX, type Emote } from "./world/live";
import { duelCoins, duelView, type DuelResult, type Fighter } from "./sim/duel";
import { askNpc, chatWhoFor, type ChatWho } from "./game/npc-chat";
import { newSeed, parseGenes, randomGenes } from "./game/genes";
import { thinkingLabel } from "./game/thinking";
import { goals, hints, isTouch, parseOnboard, playHatch, playHints, renderGoals, type OnboardSave } from "./game/onboard";
import { transcribe, voiceInputSupported, VoiceRecorder } from "./game/voice-input";
import { CloudVoice, localAccessState, NATIVE_URL, NativeVoice, WebLlmVoice } from "./game/voices";
import { Battle } from "./sim/battle";
import { CortexUnavailable, describeMemo, FetchLlmClient, LlmCortex, LocalCortex, ScriptedCortex, type Cortex, type CortexResult, type CortexSource } from "./sim/cortex";
import { ENEMIES, type EnemyDef } from "./sim/enemies";
import { comparePaired, makeScenarios, pct } from "./sim/evaluate";
import { ghostEnemyDef, LOCAL_SEED_GHOSTS, type Genes, type Ghost } from "./sim/ghost";
import { fetchWildMemos, withTactics, type WildMemos } from "./sim/tactics";
import { generateWorld } from "./world/layout";
import { WorldView, type Entity } from "./world/view";
import { BOSS_ARCHETYPE, BOSS_FOCUS, BOSS_STATS, BOSS_TURNS, makeBoss, type Boss } from "./sim/boss";
import { EMPTY_MEMO, validateMemo, type Memo } from "./sim/memo";
import { baselinePolicy, memoPolicy } from "./sim/policy";
import { HELDOUT_SEEDS, passesGate, prove, type ProofReport } from "./sim/proof";
import { ARCHETYPES, DEFAULT_PET, type ArchetypeId, type Intent, type Replay } from "./sim/types";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------------- state (memo + recent fights persist in this browser only) ----------------

const SAVE_KEY = "petmind.v1";
const MAX_TAMED = 6;
interface Save {
  memo: Memo;
  recent: Replay[];
  shared?: string; // the memo rules last uploaded as a ghost, so the same pet is not re-shared every fight
  mine?: string[]; // ids of ghosts this browser uploaded, to label your own ghost when you meet it
  home: Slot[]; // decor on the pet's home plot (derived from decor; kept for older readers)
  decor: Placement[]; // everything placed in your corner: plot ring + A-frame porch
  coins?: number; // earned from wild wins and befriends, spent at the market
  owned?: DecorKind[]; // decor bought at the market (the starter set is always owned)
  muted?: boolean; // in-world voice off
  steps?: { fought?: boolean; proved?: boolean; boss?: boolean }; // first-steps guide progress
  tamed?: ArchetypeId[]; // wild pets befriended in the meadow; they live in your corner
  genes: Genes; // the pet's looks, rolled at hatch (older saves get one on first load)
  onboard?: OnboardSave; // first-run hatch + hints seen, goals card closed
}

function load(): Save {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null") as Partial<Save> | null;
    if (raw) {
      return {
        memo: validateMemo(raw.memo).memo,
        genes: parseGenes(raw.genes) ?? randomGenes(newSeed()),
        recent: Array.isArray(raw.recent) ? raw.recent.slice(-8) : [],
        ...(() => {
          const decor = Array.isArray(raw.decor) ? parseDecor(raw.decor) : fromHome(raw.home);
          return { decor, home: plotSlots(decor) };
        })(),
        coins: parseCoins(raw.coins),
        owned: parseOwned(raw.owned),
        ...(raw.muted === true ? { muted: true } : {}),
        ...(typeof raw.shared === "string" ? { shared: raw.shared } : {}),
        ...(Array.isArray(raw.mine) ? { mine: raw.mine.filter((x): x is string => typeof x === "string").slice(-20) } : {}),
        ...(Array.isArray(raw.tamed)
          ? { tamed: raw.tamed.filter((a): a is ArchetypeId => (ARCHETYPES as readonly string[]).includes(a as string)).slice(-MAX_TAMED) }
          : {}),
        ...(parseOnboard(raw.onboard) ? { onboard: parseOnboard(raw.onboard) } : {}),
        ...(raw.steps && typeof raw.steps === "object"
          ? { steps: { fought: raw.steps.fought === true, proved: raw.steps.proved === true, boss: raw.steps.boss === true } }
          : {}),
      };
    }
  } catch {
    /* private mode or corrupt save: start fresh */
  }
  return { memo: EMPTY_MEMO, genes: randomGenes(newSeed()), recent: [], home: emptyHome(), decor: [] };
}

const state = load();
const save = () => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: progress lasts for this tab only */
  }
};

const pet = DEFAULT_PET;
const arena = new Arena($<HTMLCanvasElement>("stage"));
arena.setDecor(state.home);

// ---------------- the world (walk around; creatures start fights) ----------------

const world = new WorldView(arena.renderer.domElement);
arena.world = world;
const cornerOwners = (gs: readonly Ghost[]) => gs.map((g) => ({ id: g.id, name: g.name }));
function buildWorld(corners: readonly Ghost[]) {
  world.build(generateWorld(cornerOwners(corners)), { home: state.home, porch: porchSlots(state.decor), tamed: state.tamed ?? [], corners });
}
buildWorld(LOCAL_SEED_GHOSTS);
arena.mode = "world";
arena.resize();
// The pet hatched with random genes: dress both views in its looks (and keep the roll in the save).
function dressMyPet() {
  for (const g of [arena.pet, world.pet]) {
    dressPet(g, state.genes);
    castAll(g);
  }
}
dressMyPet();
save();
// ---------------- live layer: other online players walk around in our world ----------------

const live = new LiveLink(
  roomUrl(location),
  () => ({ name: liveName(state.genes), genes: state.genes, ...world.me }),
  {
    welcome: (_id, _corner, peers) => {
      world.clearPeers();
      for (const p of peers) world.addPeer(p);
      liveCountChanged();
    },
    join: (p) => {
      world.addPeer(p);
      liveCountChanged();
    },
    leave: (id) => {
      world.removePeer(id);
      liveCountChanged();
    },
    pos: (id, x, z, px, pz) => world.movePeer(id, { x, z, px, pz }),
    emote: (id, e) => world.showEmote(id, EMOTE_ICON[e]),
    status: (s) => {
      if (s !== "online") world.clearPeers(); // offline or full: the ghosts keep the world company
      $("emotes").hidden = s !== "online";
      liveCountChanged();
      showChatBar(world.nearEntity);
    },
    say: (id, text) => {
      world.showSpeech(id, text);
      roomLog(world.peerName(id) ?? "Someone", text);
    },
    notice: (text) => roomLog("", text),
    duel: (duel, from, name) => duelInvited(duel, from, name),
    duelStart: (duel, seed, a, b) => void duelStarted(duel, seed, a, b),
    duelEnd: (duel, reason) => duelEnded(duel, reason),
  },
);
function liveCountChanged() {
  $("liveChip").hidden = live.status !== "online";
  $("liveCount").textContent = String(world.liveCount);
}
function sendEmote(e: Emote) {
  if (live.emote(e)) world.showEmote(null, EMOTE_ICON[e]);
}
for (const b of document.querySelectorAll<HTMLButtonElement>("#emotes [data-emote]")) {
  b.addEventListener("click", () => sendEmote(b.dataset.emote as Emote));
}
window.addEventListener("keydown", (ev) => {
  const el = document.activeElement;
  if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
  const i = ["1", "2", "3", "4"].indexOf(ev.key);
  if (i >= 0 && live.status === "online") sendEmote(EMOTES[i]!);
});

if (import.meta.env.DEV) Object.assign(window, { __live: live, __hatch: (seed: number) => ((state.genes = randomGenes(seed)), dressMyPet(), state.genes) });
if (import.meta.env.DEV) Object.assign(window, { __world: world, __arena: arena }); // for browser checks in dev only

// Other players' pets move into the corner plots when the server has some (the built-in ghosts otherwise).
async function loadCorners() {
  const found: Ghost[] = [];
  for (let i = 0; i < 6 && found.length < 3; i++) {
    const { ghost, online } = await fetchRandomGhost();
    if (!online) break;
    if (!found.some((g) => g.id === ghost.id)) found.push(ghost);
  }
  if (found.length === 0 || busy) return;
  const corners = [...found, ...LOCAL_SEED_GHOSTS.filter((g) => !found.some((f) => f.id === g.id))].slice(0, 3);
  buildWorld(corners);
}

const VERB: Record<Entity["kind"], string> = { wild: "Fight or tame", boss: "Challenge", npc: "Talk to", market: "Visit", arena: "Fight a random ghost at", ghost: "Fight", tamed: "", porch: "Sit on", decorate: "Decorate" };
world.onNear = (e) => {
  const hint = $("hint");
  if (world.isChilling) return;
  hint.hidden = !e;
  const who = e ? speakerFor(e.kind, e.archetype) : null;
  if (who && !busy) chatter(who, "enemy", 1800);
  if (e) hint.innerHTML = `<b>E</b> or click: ${VERB[e.kind]} <b>${esc(e.label)}</b>`;
  if (e) $("interactBtn").textContent = `${VERB[e.kind]} ${e.label}`;
  showChatBar(e);
};

// ---------------- talk to the elder and wild pets (Muse Spark via the Worker, capped) ----------------

const chatBar = $<HTMLFormElement>("chatBar");
const chatInput = $<HTMLInputElement>("chatInput");
let chatWith: { who: ChatWho; label: string } | null = null;
let chatPending = false;
let chatQuietUntil = 0; // ambient chatter waits while a chat reply is on screen
function showChatBar(e: Entity | null) {
  const who = e && !busy ? chatWhoFor(e.kind, e.archetype) : null;
  if (who && chatWith?.who === who && !chatBar.hidden) return;
  chatWith = who && e ? { who, label: e.label } : null;
  const roomChat = !chatWith && !busy && live.status === "online";
  chatBar.hidden = !chatWith && !roomChat;
  chatInput.maxLength = chatWith ? 140 : SAY_MAX;
  $("chatNote").textContent = chatWith
    ? "Replies by Muse Spark (Meta AI). Please don't share personal info."
    : "Room chat: everyone online sees it. Be kind, no links or personal info.";
  if (chatWith) chatInput.placeholder = `Say something to ${chatWith.label}...`;
  else if (roomChat) chatInput.placeholder = "Say something to everyone...";
  else if (document.activeElement === chatInput) chatInput.blur();
}

// Room chat: a tiny log of the last few lines above the chat box.
function roomLog(who: string, text: string) {
  const el = $("roomLog");
  const d = document.createElement("div");
  d.innerHTML = who ? `<b>${esc(who)}:</b> ${esc(text)}` : `<span class="dim">${esc(text)}</span>`;
  el.appendChild(d);
  while (el.children.length > 4) el.firstElementChild!.remove();
  el.hidden = false;
}
async function talk(line: string) {
  if (!chatWith || chatPending) return;
  const { who } = chatWith;
  const speaker: Speaker = who;
  chatPending = true;
  if (line) say("pet", line, 2400);
  say("enemy", "...", 20_000);
  try {
    const r = await askNpc(who, line);
    if (chatWith?.who !== who) return; // walked away
    const ms = Math.min(9000, 2500 + r.text.length * 60);
    chatQuietUntil = Date.now() + ms + 1500;
    say("enemy", r.text, ms);
    lastLine[speaker] = r.text;
    speak(r.text, speaker);
  } finally {
    chatPending = false;
  }
}
chatBar.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const line = chatInput.value.trim();
  chatInput.value = "";
  if (chatWith) return void talk(line);
  if (line && live.say(line)) {
    world.showSpeech(null, line);
    roomLog("You", line);
  }
});

// ---------------- live duels: your pet's memo vs another online player's pet ----------------

const DUEL_WAIT_MS = 30_000;
let duelOut: { to: string; name: string; timer: number } | null = null;
let duelIn: { duel: string; from: string; name: string; timer: number } | null = null;

function duelChallenge() {
  const p = world.nearPeer();
  if (!p || busy || duelOut) return;
  if (!live.challenge(p.id, state.memo, state.genes)) return;
  duelOut = { to: p.id, name: p.name, timer: window.setTimeout(() => duelEnded("", "gone"), DUEL_WAIT_MS) };
  roomLog("", `You challenged ${p.name}. Waiting for an answer...`);
  say("pet", "A duel? I'm ready!", 2000);
}
function duelInvited(duel: string, from: string, name: string) {
  if (busy || duelIn) return void live.decline(duel);
  const timer = window.setTimeout(() => answerInvite(false), DUEL_WAIT_MS - 3000);
  duelIn = { duel, from, name, timer };
  $("duelInviteText").textContent = `${name} challenges your pet to a duel!`;
  $("duelInvite").hidden = false;
}
function answerInvite(yes: boolean) {
  if (!duelIn) return;
  clearTimeout(duelIn.timer);
  if (yes) live.accept(duelIn.duel, state.memo, state.genes);
  else live.decline(duelIn.duel);
  duelIn = null;
  $("duelInvite").hidden = true;
}
$("duelYes").addEventListener("click", () => answerInvite(true));
$("duelNo").addEventListener("click", () => answerInvite(false));
$("duelBtn").addEventListener("click", duelChallenge);
function duelEnded(_duel: string, reason: "declined" | "gone") {
  if (duelIn && reason === "gone") {
    clearTimeout(duelIn.timer);
    duelIn = null;
    $("duelInvite").hidden = true;
    roomLog("", "The challenge was withdrawn.");
  }
  if (!duelOut) return;
  clearTimeout(duelOut.timer);
  roomLog("", reason === "declined" ? `${duelOut.name} said no thanks.` : `${duelOut.name} did not answer.`);
  duelOut = null;
}

const DUEL_BANNER: Record<DuelResult, string> = { win: "You won the duel!", loss: "You lost the duel...", draw: "A draw!", friends: "They became friends!" };
async function duelStarted(_duel: string, seed: number, a: Fighter, b: Fighter) {
  const me = live.myId === a.id ? "a" : live.myId === b.id ? "b" : null;
  if (!me || busy) return; // not ours, or we are mid-fight (the other side still sees the full duel)
  if (duelOut) clearTimeout(duelOut.timer);
  duelOut = null;
  const them = me === "a" ? b : a;
  const v = duelView(a, b, seed, me);
  busy = true;
  setButtons();
  world.paused = true;
  arena.mode = "battle";
  arena.setEnemy(makePet(them.genes));
  arena.setDecor(state.home);
  showGhostCard(null);
  log.innerHTML = "";
  const opp: Opponent = { label: `${them.name} (live)`, maxHp: v.theirMaxHp };
  logLine(`<b>Live duel</b>: <b>${esc(liveName(state.genes))}</b> vs <b>${esc(them.name)}</b>. <span class="dim">Both pets follow their own memo rules; both players see this same fight (seed ${seed}).</span>`);
  setHp(v.myMaxHp, opp, v.theirMaxHp);
  await banner(`Duel vs ${them.name}`, 900);
  for (const [i, t] of v.turns.entries()) {
    const last = i === v.turns.length - 1;
    say("enemy", t.theirs === "attack" ? (t.theirAct === "heavy" ? "*HEAVY hit!*" : "Hyah!") : t.theirs === "guard" ? "*guards*" : t.theirs === "flee" ? "*runs*" : "*waves*");
    say("pet", t.mine);
    logLine(`T${i + 1} <b>${t.mine}</b> vs <b>${t.theirs}</b> <span class="dim">${t.dealt ? `hit ${t.dealt}` : ""}${t.taken ? ` took ${t.taken}` : ""}</span>`);
    const anim = last ? (v.result === "win" ? "win" : v.result === "loss" ? "loss" : null) : null;
    await arena.playTurn(t.mine, t.theirAct, t.dealt, t.taken, anim);
    setHp(t.myHp, opp, t.theirHp);
  }
  await arena.playEnd(v.result === "friends" ? "win" : v.result === "draw" ? "timeout" : v.result);
  const earned = duelCoins(v.result);
  logLine(`<b>${DUEL_BANNER[v.result]}</b>${earned ? ` <b>+${earned} coins</b>` : ""}`);
  await banner(DUEL_BANNER[v.result]);
  if (earned) {
    state.coins = addCoins(state.coins ?? 0, earned);
    renderCoins();
  }
  roomLog("", `Duel vs ${them.name}: ${DUEL_BANNER[v.result]}`);
  arena.setEnemy(null);
  toWorld();
  save();
  busy = false;
  setButtons();
}

const ELDER_TIPS = [
  "Teach your pet in plain words, or press Speak and say it.",
  "Every lesson is tested on fights it never saw. Watch the Proof panel.",
  "Befriend a hurt wild pet and it will move into your corner.",
  "The Reader in the boss room reads your pet's memo. Surprise it.",
  "Other players' pets live in the corners. Their minds are their owners' lessons.",
];
let tip = 0;
world.onInteract = (e) => {
  if (busy) return;
  switch (e.kind) {
    case "wild": return void fight({ pick: e.archetype!, entity: e });
    case "boss": return void fight({ pick: "boss" });
    case "ghost": return void fight({ pick: "ghost", ghost: e.ghost! });
    case "arena": return void fight({ pick: "ghost" });
    case "npc":
      if (chatWith) {
        chatInput.focus();
        return void talk(""); // the elder greets you (Muse Spark), then you can ask anything
      }
      return say("enemy", ELDER_TIPS[tip++ % ELDER_TIPS.length]!, 3200);
    case "market": return openShop();
    case "porch": return world.setChill(true);
    case "decorate": return openDecorate();
  }
};
world.onChill = (on) => {
  const hint = $("hint");
  if (on) {
    hint.hidden = false;
    hint.innerHTML = `Chilling on the porch with <b>${esc(pet.name)}</b> · move, click or <b>E</b> to get up`;
    say("pet", "So cozy here.", 2200);
  } else world.onNear(world.nearEntity);
};

// ---------------- chatter, voice, coins, shop ----------------

const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
const lastLine: Partial<Record<Speaker, string>> = {};
function speak(text: string, who: Speaker) {
  if (!canSpeak || state.muted) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    const v = voiceFor(who);
    u.pitch = v.pitch;
    u.rate = v.rate;
    u.volume = 0.35; // quiet by default
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    /* no voices on this browser: bubbles only */
  }
}
function chatter(who: Speaker, bubble: "pet" | "enemy", ms = 2200) {
  const line = pickLine(who, Math.random, lastLine[who]);
  lastLine[who] = line;
  say(bubble, line, ms);
  speak(line, who);
}
function nearSpeaker(): Speaker | null {
  const e = world.nearEntity;
  return e ? speakerFor(e.kind, e.archetype) : null;
}
// Ambient: every few seconds the creature you stand next to, or else your pet, says something.
function ambient() {
  if (arena.mode === "world" && !busy && !document.hidden && !chatPending && Date.now() > chatQuietUntil) {
    const who = nearSpeaker();
    if (who) chatter(who, "enemy");
    else if (!world.isChilling || Math.random() < 0.5) chatter("pet", "pet");
  }
  setTimeout(ambient, nextChatter(Math.random) * 1000);
}
setTimeout(ambient, 4000);

const muteBtn = $("mute");
muteBtn.hidden = !canSpeak;
const renderMute = () => {
  muteBtn.textContent = state.muted ? "🔇 Voices off" : "🔊 Voices on";
  muteBtn.setAttribute("aria-pressed", String(!state.muted));
};
muteBtn.onclick = () => {
  state.muted = !state.muted;
  if (state.muted && canSpeak) speechSynthesis.cancel();
  save();
  renderMute();
};
renderMute();

function renderCoins() {
  $("coins").textContent = String(state.coins ?? 0);
}
renderCoins();

function openShop() {
  chatter("merchant", "enemy", 2600);
  renderShop();
  $("shop").hidden = false;
}
function renderShop(note = "") {
  const list = $("shopList");
  list.innerHTML = "";
  for (const item of SHOP_ITEMS) {
    const have = (state.owned ?? []).includes(item);
    const row = document.createElement("div");
    row.className = "shopRow";
    row.innerHTML = `<span class="shopIcon">${DECOR_ICON[item]}</span><b>${DECOR_LABEL[item]}</b><span class="dim">🪙 ${PRICES[item]}</span>`;
    const b = document.createElement("button");
    b.textContent = have ? "Owned" : "Buy";
    b.disabled = have || (state.coins ?? 0) < PRICES[item]!;
    b.onclick = () => {
      const r = buy(state.coins ?? 0, state.owned ?? [], item);
      if (!r.ok) return renderShop(r.reason === "poor" ? "Not enough coins yet: win or befriend wild pets." : "");
      state.coins = r.coins;
      state.owned = r.owned;
      save();
      renderCoins();
      renderShop(`${DECOR_LABEL[item]} is yours! Place it from "Decorate your corner".`);
      say("enemy", "Thank you, come again!", 2000);
    };
    row.appendChild(b);
    list.appendChild(row);
  }
  $("shopNote").textContent = note || `You have 🪙 ${state.coins ?? 0}. Wild wins pay 3, befriending pays 5.`;
}
$("shopClose").onclick = () => ($("shop").hidden = true);

// The signpost at your corner opens the decorate panel.
function openDecorate() {
  const box = $("decorBox");
  box.scrollIntoView({ behavior: "smooth", block: "center" });
  box.classList.remove("flash");
  void box.offsetWidth;
  box.classList.add("flash");
}

function toWorld() {
  arena.mode = "world";
  world.paused = false;
  showGhostCard(null);
}
const instinct = new Instinct(null);
let wildMemos: WildMemos = {}; // fetched below; empty = bundled patterns
void fetchWildMemos().then((m) => (wildMemos = m));
let busy = false;

// ---------------- speech bubbles ----------------

const bubbles = { pet: $("bubblePet"), enemy: $("bubbleEnemy") };
const bubbleTimers: Record<string, number> = {};
function say(who: "pet" | "enemy", text: string, ms = 1400) {
  const el = bubbles[who];
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(bubbleTimers[who]);
  bubbleTimers[who] = window.setTimeout(() => el.classList.remove("show"), ms / arena.speed);
}
function placeBubbles() {
  for (const who of ["pet", "enemy"] as const) {
    const a = arena.anchor(who);
    const el = bubbles[who];
    const canvas = arena.renderer.domElement.getBoundingClientRect();
    if (a) {
      el.style.left = `${canvas.left + a.x}px`;
      el.style.top = `${canvas.top + a.y}px`;
    }
  }
  requestAnimationFrame(placeBubbles);
}
placeBubbles();

function banner(text: string, ms = 1500) {
  const el = $("banner");
  el.textContent = text;
  el.classList.add("show");
  return new Promise<void>((r) =>
    setTimeout(() => {
      el.classList.remove("show");
      r();
    }, ms / arena.speed),
  );
}

// ---------------- fight ----------------

const TELL: Record<Intent, string> = {
  idle: "Grr.",
  heavy: "*winds up a HEAVY hit*",
  guarding: "*hides behind its guard*",
  calm: "*looks calm*",
  scared: "*looks hurt and scared*",
};

interface Opponent {
  label: string;
  maxHp: number;
}
const archetypeOpp = (id: ArchetypeId): Opponent => ({ label: id, maxHp: ENEMIES[id].maxHp });

function setHp(myHp: number, enemy: Opponent | null, enemyHp: number | null) {
  $("petHp").style.width = `${(100 * myHp) / pet.maxHp}%`;
  $("petHpTxt").textContent = String(myHp);
  if (!enemy || enemyHp === null) {
    $("enemyName").textContent = "-";
    $("enemyHpTxt").textContent = "-";
    $("enemyHp").style.width = "100%";
    return;
  }
  $("enemyName").textContent = enemy.label;
  $("enemyHp").style.width = `${(100 * enemyHp) / enemy.maxHp}%`;
  $("enemyHpTxt").textContent = String(enemyHp);
}

const log = $("log");
function logLine(html: string) {
  const d = document.createElement("div");
  d.innerHTML = html;
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

function sourceTag(c: Choice): string {
  if (c.source === "rule") return `<span class="tag rule" title="${esc(describeMemo(state.memo)[c.rule!] ?? "")}">memo #${c.rule! + 1}</span>`;
  if (c.source === "model") return `<span class="tag model">${esc(instinct.voice?.label.split(" (")[0] ?? "model")}</span>`;
  return `<span class="tag reflex" title="${esc(c.note ?? "no rule matched")}">instinct</span>`;
}

const OUTCOME: Record<Replay["outcome"], string> = { win: "WIN!", loss: "Defeated...", fled: "Ran away", escaped: "It ran off", timeout: "Draw" };

async function fight(from: { pick?: string; ghost?: Ghost; entity?: Entity } = {}) {
  if (busy) return;
  busy = true;
  setButtons();
  world.paused = true;
  const pick = from.pick ?? $<HTMLSelectElement>("enemy").value;
  let ghost: Ghost | null = from.ghost ?? null;
  let ghostOnline = !!from.ghost && !from.ghost.seed;
  if (pick === "ghost" && !ghost) ({ ghost, online: ghostOnline } = await fetchRandomGhost());
  const boss: Boss | null = pick === "boss" ? makeBoss(state.memo, pet) : null;
  const enemy: ArchetypeId = ghost
    ? "bully"
    : boss
      ? BOSS_ARCHETYPE
    : pick === "random"
      ? ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)]!
      : (pick as ArchetypeId);
  const tactic = ghost || boss ? undefined : wildMemos[enemy];
  const def: EnemyDef = ghost ? ghostEnemyDef(ghost, pet) : boss ? boss.def : withTactics(ENEMIES[enemy], tactic);
  const opp: Opponent = ghost
    ? { label: `${ghost.name} (ghost)`, maxHp: def.maxHp }
    : boss
      ? { label: `${BOSS_STATS.label} (boss)`, maxHp: def.maxHp }
      : archetypeOpp(enemy);
  const battle = new Battle({
    enemy,
    seed: Math.floor(Math.random() * 1e9),
    ...(ghost || boss || tactic ? { enemyDef: def } : {}),
    ...(boss ? { maxTurns: BOSS_TURNS } : {}),
  });
  arena.mode = "battle";
  arena.setEnemy(ghost ? makeGhostPet(ghost.genes) : boss ? makeBossMesh() : enemy);
  arena.setDecor(ghost ? ghost.decor : state.home); // a ghost fight happens on its owner's plot
  showGhostCard(ghost);
  log.innerHTML = "";
  if (ghost) {
    const who = ghost.seed ? "a built-in ghost" : state.mine?.includes(ghost.id) ? "your own ghost" : "another player's ghost";
    logLine(
      `<b>${pet.name}</b> vs <b>${esc(ghost.name)}</b>, ${who}` +
        `${ghostOnline ? "" : " <span class=\"dim\">(offline: local ghost)</span>"}. ` +
        `<span class="dim">It follows ${ghost.seed ? "its" : "its owner's"} ${ghost.memo.rules.length} memo rules.</span>`,
    );
  } else if (boss) {
    logLine(
      `<b>${pet.name}</b> vs <b>${BOSS_STATS.label}</b>. <span class="dim">It has read your ${state.memo.rules.length} memo rules: ` +
        `when a rule would fire it fakes the tell and counters. It can read ${BOSS_FOCUS} times, then it needs a turn to recover.</span>`,
    );
    if (wildMemos.boss?.summary) logLine(`<span class="dim">🧠 Lately it boasts: “${esc(wildMemos.boss.summary)}” (Muse Spark)</span>`);
  } else {
    logLine(`<b>${pet.name}</b> vs <b>${enemy}</b>`);
    if (tactic) logLine(`<span class="dim">🧠 New wild tactic: ${esc(tactic.summary || `${tactic.rules.length} rules`)} (Muse Spark re-teaches wild pets from shared fights every 6 h)</span>`);
  }
  setHp(pet.maxHp, opp, def.maxHp);
  await banner(ghost ? `vs ${ghost.name}'s ghost` : boss ? `Boss: ${BOSS_STATS.label}` : `vs ${enemy}`, 900);
  while (!battle.done) {
    const obs = battle.observe();
    say("enemy", TELL[obs.intent]);
    const choice = await instinct.decide(pet.name, state.memo, obs);
    say("pet", choice.line);
    const rec = battle.step(choice.action);
    const outcome = battle.done ? battle.replay().outcome : null;
    logLine(
      `T${obs.turn} <span class="dim">${obs.intent}</span> → <b>${choice.action}</b>${sourceTag(choice)} ` +
        `<span class="dim">${rec.dealt ? `hit ${rec.dealt}` : ""}${rec.taken ? ` took ${rec.taken}` : ""}</span>`,
    );
    if (boss) logBossTurn(boss, obs.turn);
    await arena.playTurn(choice.action, rec.enemyAct, rec.dealt, rec.taken, outcome);
    setHp(rec.myHp, opp, rec.enemyHp);
  }
  const replay = battle.replay();
  await arena.playEnd(replay.outcome);
  logLine(`<b>${OUTCOME[replay.outcome]}</b> <span class="dim">(${replay.how})</span>`);
  await banner(OUTCOME[replay.outcome]);
  if (from.entity?.kind === "wild" && replay.outcome === "win") {
    world.removeEntity(from.entity.id);
    const earned = coinsFor(replay.outcome, replay.how);
    state.coins = addCoins(state.coins ?? 0, earned);
    renderCoins();
    logLine(`<b>+${earned} coins</b> <span class="dim">(spend them at the market, south)</span>`);
    if (replay.how === "befriended") {
      state.tamed = [...(state.tamed ?? []), enemy].slice(-MAX_TAMED);
      world.addTamed(enemy, state.tamed.length);
      logLine(`<b>The ${enemy} joined your corner!</b> <span class="dim">Befriended pets live on your home plot.</span>`);
    }
  }
  toWorld();
  state.steps = { ...state.steps, fought: true, ...(boss && replay.outcome === "win" ? { boss: true } : {}) };
  renderSteps();
  if (boss && replay.outcome !== "win") {
    logLine(`<span class="dim">Tip: it only reads your memo rules. Rules it counters cost it focus; when it runs out it looks calm, and a dazed boss is open to friendship (a chance, better after a couple of emotes). Teach your pet a plan for that.</span>`);
  }
  // Ghost and boss fights are not archetype fights, so they stay out of what the coach reviews.
  if (!ghost && !boss) state.recent = [...state.recent, replay].slice(-8);
  save();
  busy = false;
  setButtons();
  // After a win with a coached memo the pet joins the ghost pool (once per memo version).
  if (!ghost && !boss && replay.outcome === "win" && state.memo.rules.length > 0 && state.shared !== memoKey()) void share(true);
}

function logBossTurn(boss: Boss, turn: number) {
  const read = boss.reads.find((r) => r.turn === turn);
  if (read) {
    const rule = describeMemo(state.memo)[read.rule] ?? "";
    logLine(
      `<span class="tag boss" title="${esc(rule)}">read memo #${read.rule + 1}</span> ` +
        `<span class="dim">${read.did === "idle" ? "it faked the tell and held back" : read.feint === "heavy" ? "it knew your answer and hit hard anyway" : `it looked "${read.feint}" but did a heavy hit`}</span>`,
    );
  } else if (boss.dazedTurns.includes(turn)) logLine(`<span class="tag boss">dazed</span> <span class="dim">out of focus: it could not read this turn. Befriending works about half the time now, more after emotes or once it is badly hurt.</span>`);
}

// ---------------- ghosts (share + fight other players' pets) ----------------

function showGhostCard(g: Ghost | null) {
  const card = $("ghostCard");
  card.hidden = !g;
  if (!g) return;
  const build = g.genes.build ?? 0.5;
  card.innerHTML =
    `<b>${esc(g.name)}</b> <span class="dim">${g.seed ? "built-in ghost" : "player ghost"}</span><br>` +
    `<span class="dim">Build:</span> ${build < 0.35 ? "small and quick" : build > 0.65 ? "big and sturdy" : "balanced"} · ` +
    `<span class="dim">Memo:</span> ${g.memo.rules.length} rules<br>` +
    `<span class="dim">Home plot:</span> ${decorSummary(g.decor)}`;
}

function renderHome() {
  const slotButton = (slot: SlotId, name: string) => {
    const s = itemAt(state.decor, slot);
    const b = document.createElement("button");
    b.textContent = s ? DECOR_ICON[s] : "·";
    b.title = s ? `${DECOR_LABEL[s]} (click to change)` : "Empty spot (click to place decor)";
    b.setAttribute("aria-label", `${name}: ${s ? DECOR_LABEL[s] : "empty"}`);
    b.disabled = busy;
    b.onclick = () => {
      if (busy) return;
      state.decor = cycle(state.decor, slot, ownedItems(state.owned));
      state.home = plotSlots(state.decor);
      save();
      arena.setDecor(state.home);
      world.setHomeDecor(state.home, porchSlots(state.decor));
      showGhostCard(null);
      renderHome();
    };
    return b;
  };
  const plot = $("homeSlots");
  plot.innerHTML = "";
  for (let i = 0; i < HOME_SLOTS; i++) plot.appendChild(slotButton(plotSlot(i), `Plot spot ${i + 1}`));
  const porch = $("porchSlots");
  porch.innerHTML = "";
  for (let i = 0; i < PORCH_SLOTS; i++) porch.appendChild(slotButton(porchSlot(i), `Porch spot ${i + 1}`));
  const onPorch = porchSlots(state.decor).filter(Boolean).length;
  renderGoalsCard();
  $("homeInfo").textContent = `${decorCount(state.home)}/${HOME_SLOTS} plot spots, ${onPorch}/${PORCH_SLOTS} porch spots decorated. Click a spot to cycle its item; your shared ghost carries your plot.`;
}

// What a shared ghost carries: its rules and its plot. A change to either makes the pet worth re-sharing.
const memoKey = () => JSON.stringify([state.memo.rules.map((r) => [r.if, r.do]), state.home]);

async function share(auto = false) {
  const status = $("ghostStatus");
  if (state.memo.rules.length === 0) {
    status.textContent = "Teach your pet something first; a ghost with no memo is just instinct.";
    return;
  }
  $<HTMLButtonElement>("shareGhost").disabled = true;
  status.textContent = auto ? "Sharing your pet as a ghost…" : "Sharing…";
  const res = await shareGhost(pet.name, state.genes, state.memo, state.home);
  if (res.ok) {
    state.shared = memoKey();
    state.mine = [...(state.mine ?? []), res.id].slice(-20);
    save();
    status.textContent = `${pet.name}'s ghost is out there: other players can now fight its memo (rules only, kept 30 days).`;
  } else {
    status.textContent =
      res.reason === "rate_limited"
        ? "Shared enough for now; try again later."
        : res.reason === "offline"
          ? "Offline: could not share the ghost."
          : "The server did not accept this ghost.";
  }
  $<HTMLButtonElement>("shareGhost").disabled = busy;
}

// Replays a recorded fight (used by the proof panel). No model calls: the moves are already decided.
async function playReplay(r: Replay, title: string) {
  world.paused = true;
  arena.mode = "battle";
  arena.setEnemy(r.enemy);
  setHp(pet.maxHp, archetypeOpp(r.enemy), ENEMIES[r.enemy].maxHp);
  await banner(title, 1200);
  for (const [i, t] of r.turns.entries()) {
    say("enemy", TELL[t.obs.intent]);
    say("pet", t.action);
    const outcome = i === r.turns.length - 1 ? r.outcome : null;
    await arena.playTurn(t.action, t.enemyAct, t.dealt, t.taken, outcome);
    setHp(t.myHp, archetypeOpp(r.enemy), t.enemyHp);
  }
  await arena.playEnd(r.outcome);
  await banner(OUTCOME[r.outcome], 1100);
  toWorld();
}

// ---------------- coach (Cortex) + proof ----------------

const liveCortex = new LlmCortex(new FetchLlmClient(""));
const offlineCortex = new ScriptedCortex();
// Free coach: the Llama 3.2 3B distilled from Muse Spark Teach (docs/FINETUNE.md), served by power mode's llama-server.
const localCortex = new LocalCortex(NATIVE_URL);
const COACH_LABEL: Record<CortexSource, string> = {
  "muse-spark": "Muse Spark",
  "muse-spark-open": "Muse Spark (open weights)",
  "local-llama": "Llama coach (local, free)",
  scripted: "offline coach",
};
// Who to ask, in order: the player's free-coach choice skips the cloud; the scripted coach always answers.
function coachChain(): Cortex[] {
  const localOk = native.ready();
  if (localOk && $<HTMLInputElement>("freeCoach").checked) return [localCortex, offlineCortex];
  return localOk ? [liveCortex, localCortex, offlineCortex] : [liveCortex, offlineCortex];
}
let lastProof: ProofReport | null = null;

async function coach(run: (c: Cortex) => Promise<CortexResult>, what: string, gated = false) {
  if (busy) return;
  busy = true;
  setButtons();
  const status = $("coachStatus");
  const t0 = performance.now();
  const chain = coachChain();
  let coachName = chain[0] === localCortex ? "your local coach" : "Muse Spark";
  const tick = () => {
    const label = thinkingLabel(performance.now() - t0);
    status.textContent = `${what}… ${coachName} is ${label}`;
    say("pet", label, 1000);
  };
  tick();
  const timer = window.setInterval(tick, 400);
  arena.thinking = true;
  let note = "";
  let res: CortexResult | null = null;
  try {
    // Budget refusal, network down, or a reply we could not validate: the next coach in the chain takes over,
    // ending with the scripted coach, which always answers.
    const failed: string[] = [];
    for (const c of chain) {
      try {
        res = await run(c);
        break;
      } catch (e) {
        if (c === offlineCortex) throw e;
        failed.push(`${c === localCortex ? "local coach" : "live coach"}: ${e instanceof CortexUnavailable ? e.message : "offline"}`);
        if (c === liveCortex && chain.includes(localCortex)) coachName = "your local coach";
      }
    }
    if (res) {
      $("coachSrc").textContent = COACH_LABEL[res.source];
      if (failed.length) note = `${failed.join("; ")}. Used the ${COACH_LABEL[res.source]}.`;
    }
  } catch (e) {
    note = `Coach failed (${(e as Error).message}). Memo unchanged.`;
  } finally {
    clearInterval(timer);
    arena.thinking = false;
    bubbles.pet.classList.remove("show");
    busy = false;
    setButtons();
  }
  status.textContent = note;
  if (!res) return;
  const before = state.memo;
  if (gated && !passesGate(before, res.memo)) {
    status.textContent = `${note ? note + " " : ""}The coach's revision did worse in practice fights, so your pet keeps its current memo.`;
    say("pet", "I'll stick with what works.", 1600);
    return;
  }
  state.memo = res.memo;
  save();
  renderMemo();
  if (!note) status.textContent = `Memo updated by the ${COACH_LABEL[res.source]}${res.dropped.length ? ` (${res.dropped.length} invalid parts dropped)` : ""}.`;
  say("pet", "Got it!", 1400);
  showProof(before, res.memo);
}

function showProof(before: Memo, after: Memo) {
  const report = prove(before.rules.length ? before : null, after);
  lastProof = report;
  state.steps = { ...state.steps, proved: true };
  save();
  renderSteps();
  const h = report.heldout;
  $("proofBox").hidden = false;
  const d = h.winRateDelta;
  $("proofDelta").textContent = `${d >= 0 ? "+" : ""}${(100 * d).toFixed(1)} pts`;
  $("proofDelta").style.color = d > 0 ? "var(--good)" : d < 0 ? "var(--bad)" : "var(--dim)";
  $("pBefore").style.width = pct(h.before.winRate);
  $("pBeforeTxt").textContent = pct(h.before.winRate, 0);
  $("pAfter").style.width = pct(h.after.winRate);
  $("pAfterTxt").textContent = pct(h.after.winRate, 0);
  const beforeP = before.rules.length ? memoPolicy(before) : baselinePolicy;
  const afterP = memoPolicy(after);
  $("proofPer").innerHTML = ARCHETYPES.map((e) => {
    const r = comparePaired(beforeP, afterP, makeScenarios([e], HELDOUT_SEEDS));
    return `<div class="proof"><span>${e}</span><div class="bar"><i style="width:${pct(r.after.winRate)}"></i></div><span>${pct(r.before.winRate, 0)}→${pct(r.after.winRate, 0)}</span></div>`;
  }).join("");
  $("proofStats").textContent =
    `${h.n} paired fights on seeds the coach never saw. 95% CI ${(100 * h.ci95[0]).toFixed(1)}..${(100 * h.ci95[1]).toFixed(1)} pts, ` +
    `sign test p=${h.pValue < 0.001 ? "<0.001" : h.pValue.toFixed(3)}. Decisions here use the memo rules directly.`;
  $<HTMLButtonElement>("watchProof").disabled = !report.showcase;
}

async function watchProof() {
  const s = lastProof?.showcase;
  if (!s || busy) return;
  busy = true;
  setButtons();
  await playReplay(s.before, `Before: vs ${s.enemy}`);
  await playReplay(s.after, `After: same fight`);
  busy = false;
  setButtons();
}

// First-steps guide for a new player: the next step is highlighted, finished ones get a check.
function renderSteps() {
  const steps: [string, boolean][] = [
    ["Fight once", !!state.steps?.fought],
    ["Teach a lesson", state.memo.rules.length > 0],
    ["See the proof", !!state.steps?.proved],
    ["Beat the boss", !!state.steps?.boss],
  ];
  renderGoalsCard();
  const next = steps.findIndex(([, done]) => !done);
  $("steps").innerHTML = steps
    .map(([label, done], i) => `<li class="${done ? "done" : i === next ? "now" : ""}">${done ? "✓ " : `${i + 1}. `}${label}</li>`)
    .join("");
}

function renderMemo() {
  const lines = describeMemo(state.memo);
  $("memo").innerHTML = lines.map((l) => `<li>${esc(l)}</li>`).join("");
  $("memoEmpty").hidden = lines.length > 0;
  // The coach's own one-line take on the memo (model-written; the rule lines are rendered from the DSL).
  $("memoSummary").textContent = lines.length && state.memo.summary ? `Coach: "${state.memo.summary}"` : "";
}

// ---------------- pet brain (local model) ----------------

const web = new WebLlmVoice();
const native = new NativeVoice();

async function loadWeb() {
  const status = $("brainStatus");
  if (!WebLlmVoice.supported()) {
    status.textContent = "This browser has no WebGPU, so the pet stays on rules only.";
    return;
  }
  $<HTMLButtonElement>("loadWeb").disabled = true;
  try {
    await web.load((text, frac) => (status.textContent = `Loading (${Math.round(100 * frac)}%): ${text.slice(0, 90)}`));
    instinct.voice = web;
    $("brain").textContent = "Llama 3.2 1B (browser)";
    status.textContent = "Llama 3.2 1B runs in this tab. It picks among moves the memo allows and gives your pet a voice.";
  } catch (e) {
    status.textContent = `Could not load the model (${(e as Error).message}). Rules only.`;
    $<HTMLButtonElement>("loadWeb").disabled = false;
  }
}

async function probeNative(quiet = false) {
  const status = $("brainStatus");
  if (quiet && (await localAccessState()) !== "granted") return; // never pop Chrome's local-network prompt on page load
  if (!quiet) status.textContent = "Looking for power mode on this computer… If Chrome asks to let this site reach apps on your device, click Allow.";
  if (await native.probe(quiet ? 800 : 60_000)) {
    instinct.voice = native;
    $("brain").textContent = "Llama 3.2 3B (power mode)";
    $("freeCoachRow").hidden = false;
    status.textContent = "Power mode: Llama 3.2 3B on this computer (llama.cpp). Faster and smarter than the in-browser model.";
  } else if (!quiet) {
    status.textContent =
      (await localAccessState()) === "denied"
        ? "Chrome is blocking this site from reaching your computer. Allow local network access in the site settings (the icon left of the address), then press Power mode again."
        : "No local llama.cpp server found on 127.0.0.1:8080. See the README for the one-line power-mode setup.";
  }
}

async function probeCloud() {
  const provider = (import.meta.env.VITE_CLOUD_PROVIDER ?? "modal") as "modal" | "glimmer";
  const cloud = new CloudVoice({ provider, label: provider === "glimmer" ? "Muse Glimmer 30B (cloud)" : undefined });
  // A manually selected WebLLM voice keeps precedence even while generating (not ready).
  if (await cloud.probe() && instinct.voice !== web && (!instinct.voice || !instinct.voice.ready())) {
    instinct.voice = cloud;
    $("brain").textContent = cloud.label;
  }
}

// ---------------- wiring ----------------

function setButtons() {
  if (busy && !chatBar.hidden) showChatBar(null);
  for (const id of ["go", "teach", "speak", "reflect", "reset", "watchProof", "shareGhost"]) $<HTMLButtonElement>(id).disabled = busy;
  if (!busy && !lastProof?.showcase) $<HTMLButtonElement>("watchProof").disabled = true;
  if (!busy) $<HTMLButtonElement>("reflect").disabled = state.recent.length === 0;
  for (const b of document.querySelectorAll<HTMLButtonElement>("#homeSlots button, #porchSlots button")) b.disabled = busy;
}

$("go").onclick = () => void fight();
$("speed").onclick = () => {
  arena.speed = arena.speed === 1 ? 2 : arena.speed === 2 ? 4 : 1;
  $("speed").textContent = `${arena.speed}x`;
};
$("teach").onclick = () => {
  const text = $<HTMLTextAreaElement>("teachText").value.trim();
  if (text) void coach((c) => c.teach(state.memo, text), "Teaching");
};

// Voice teaching: Speak -> (speak) -> Stop -> transcript in the Teach box -> Teach as usual.
const recorder = new VoiceRecorder();
const speakBtn = $<HTMLButtonElement>("speak");
speakBtn.hidden = !voiceInputSupported();
async function stopAndTeach() {
  if (!recorder.recording) return;
  const status = $("coachStatus");
  speakBtn.textContent = "Speak";
  speakBtn.classList.remove("recording");
  speakBtn.disabled = true;
  status.textContent = "Writing down what you said (Muse Voice Transcribe)…";
  try {
    const { transcript } = await transcribe(await recorder.stop());
    if (!transcript.trim()) {
      status.textContent = "I didn't catch any words. Try again a little closer to the mic.";
      return;
    }
    $<HTMLTextAreaElement>("teachText").value = transcript;
    status.textContent = "";
    void coach((c) => c.teach(state.memo, transcript), "Teaching");
  } catch (e) {
    status.textContent = `Could not transcribe (${(e as Error).message}). Type the lesson instead.`;
  } finally {
    speakBtn.disabled = busy;
  }
}
speakBtn.onclick = async () => {
  if (recorder.recording) return void stopAndTeach();
  try {
    await recorder.start(() => void stopAndTeach());
    speakBtn.textContent = "Stop";
    speakBtn.classList.add("recording");
    $("coachStatus").textContent = "Listening… say your lesson, then press Stop.";
  } catch (e) {
    $("coachStatus").textContent = `Microphone unavailable (${(e as Error).message}). Type the lesson instead.`;
  }
};
$("reflect").onclick = () => void coach((c) => c.reflect(state.memo, state.recent), "Reviewing your fights", true);
$("reset").onclick = () => {
  if (busy || !confirm("Forget everything your pet learned?")) return;
  state.memo = EMPTY_MEMO;
  state.recent = [];
  save();
  renderMemo();
  $("proofBox").hidden = true;
  lastProof = null;
  renderSteps();
  setButtons();
};
$("watchProof").onclick = () => void watchProof();
$("shareGhost").onclick = () => void share();
$("loadWeb").onclick = () => void loadWeb();
$("probeNative").onclick = () => void probeNative();
$("petName").textContent = pet.name;

renderMemo();
renderSteps();
void loadCorners();
renderHome();
setHp(pet.maxHp, null, null);
setButtons();
void probeNative(true);
void probeCloud();

// ---------------- first run: hatch, three hints, goals (shown once; "?" replays) ----------------

function renderGoalsCard() {
  const card = $("goals");
  card.hidden = !state.onboard?.seen || !!state.onboard.goalsHidden;
  renderGoals(card, goals({ tamed: state.tamed?.length ?? 0, decor: state.decor.length, boss: !!state.steps?.boss }));
}
$("goals").addEventListener("click", (ev) => {
  if ((ev.target as HTMLElement).closest("button")?.dataset.a !== "close") return;
  state.onboard = { ...state.onboard, goalsHidden: true };
  save();
  renderGoalsCard();
});
let onboarding = false;
async function onboard(withHatch: boolean) {
  if (onboarding) return;
  onboarding = true;
  world.paused = true;
  try {
    if (withHatch) {
      await playHatch($("hatch"), pet.name);
      say("pet", "Hi! Let's explore!", 2400);
    }
    await playHints($("hints"), hints(isTouch()));
  } finally {
    world.paused = arena.mode !== "world";
    onboarding = false;
  }
  state.onboard = { ...state.onboard, seen: true, goalsHidden: false };
  save();
  renderGoalsCard();
}
$("helpBtn").addEventListener("click", () => void onboard(false));
$("interactBtn").addEventListener("click", () => world.interact());
setInterval(() => {
  $("interactBtn").hidden = arena.mode !== "world" || busy || onboarding || world.paused || (!world.nearEntity && !world.isChilling);
  if (world.isChilling) $("interactBtn").textContent = "Get up";
}, 150);
if (!state.onboard?.seen) void onboard(state.recent.length === 0);
if (import.meta.env.DEV) Object.assign(window, { __onboard: onboard });

// Connect last: the live handlers touch UI state declared above.
if (import.meta.env.VITE_LIVE !== "0") {
  live.connect();
  setInterval(() => {
    if (arena.mode !== "world") return;
    live.tick(performance.now(), world.me);
    const p = live.status === "online" && !busy && !duelOut ? world.nearPeer() : null;
    const btn = $<HTMLButtonElement>("duelBtn");
    btn.hidden = !p;
    if (p) btn.textContent = `\u2694\uFE0F Duel ${p.name}`;
  }, 50);
}
