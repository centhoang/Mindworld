import { Instinct, type Choice } from "./game/instinct";
import { fetchRandomGhost, shareGhost } from "./game/ghost-api";
import { cycleSlot, DECOR_ICON, DECOR_LABEL, decorCount, decorSummary, emptyHome, HOME_SLOTS, parseHome, type Slot } from "./game/home";
import { Arena, makeGhostPet } from "./game/scene";
import { thinkingLabel } from "./game/thinking";
import { NativeVoice, WebLlmVoice } from "./game/voices";
import { Battle } from "./sim/battle";
import { CortexUnavailable, describeMemo, FetchLlmClient, LlmCortex, ScriptedCortex, type Cortex, type CortexResult } from "./sim/cortex";
import { ENEMIES, type EnemyDef } from "./sim/enemies";
import { comparePaired, makeScenarios, pct } from "./sim/evaluate";
import { ghostEnemyDef, ghostHue, PET_GENES, type Ghost } from "./sim/ghost";
import { EMPTY_MEMO, validateMemo, type Memo } from "./sim/memo";
import { baselinePolicy, memoPolicy } from "./sim/policy";
import { HELDOUT_SEEDS, passesGate, prove, type ProofReport } from "./sim/proof";
import { ARCHETYPES, DEFAULT_PET, type ArchetypeId, type Intent, type Replay } from "./sim/types";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------------- state (memo + recent fights persist in this browser only) ----------------

const SAVE_KEY = "petmind.v1";
interface Save {
  memo: Memo;
  recent: Replay[];
  shared?: string; // the memo rules last uploaded as a ghost, so the same pet is not re-shared every fight
  mine?: string[]; // ids of ghosts this browser uploaded, to label your own ghost when you meet it
  home: Slot[]; // decor on the pet's home plot
}

function load(): Save {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null") as Partial<Save> | null;
    if (raw) {
      return {
        memo: validateMemo(raw.memo).memo,
        recent: Array.isArray(raw.recent) ? raw.recent.slice(-8) : [],
        home: parseHome(raw.home),
        ...(typeof raw.shared === "string" ? { shared: raw.shared } : {}),
        ...(Array.isArray(raw.mine) ? { mine: raw.mine.filter((x): x is string => typeof x === "string").slice(-20) } : {}),
      };
    }
  } catch {
    /* private mode or corrupt save: start fresh */
  }
  return { memo: EMPTY_MEMO, recent: [], home: emptyHome() };
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
const instinct = new Instinct(null);
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

async function fight() {
  if (busy) return;
  busy = true;
  setButtons();
  const pick = $<HTMLSelectElement>("enemy").value;
  let ghost: Ghost | null = null;
  let ghostOnline = false;
  if (pick === "ghost") ({ ghost, online: ghostOnline } = await fetchRandomGhost());
  const enemy: ArchetypeId = ghost
    ? "bully"
    : pick === "random"
      ? ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)]!
      : (pick as ArchetypeId);
  const def: EnemyDef = ghost ? ghostEnemyDef(ghost, pet) : ENEMIES[enemy];
  const opp: Opponent = ghost ? { label: `${ghost.name} (ghost)`, maxHp: def.maxHp } : archetypeOpp(enemy);
  const battle = new Battle({ enemy, seed: Math.floor(Math.random() * 1e9), ...(ghost ? { enemyDef: def } : {}) });
  arena.setEnemy(ghost ? makeGhostPet(ghostHue(ghost.genes)) : enemy);
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
  } else logLine(`<b>${pet.name}</b> vs <b>${enemy}</b>`);
  setHp(pet.maxHp, opp, def.maxHp);
  await banner(ghost ? `vs ${ghost.name}'s ghost` : `vs ${enemy}`, 900);
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
    await arena.playTurn(choice.action, rec.enemyAct, rec.dealt, rec.taken, outcome);
    setHp(rec.myHp, opp, rec.enemyHp);
  }
  const replay = battle.replay();
  await arena.playEnd(replay.outcome);
  logLine(`<b>${OUTCOME[replay.outcome]}</b> <span class="dim">(${replay.how})</span>`);
  await banner(OUTCOME[replay.outcome]);
  // Ghost fights are not archetype fights, so they stay out of what the coach reviews.
  if (!ghost) state.recent = [...state.recent, replay].slice(-8);
  save();
  busy = false;
  setButtons();
  // After a win with a coached memo the pet joins the ghost pool (once per memo version).
  if (!ghost && replay.outcome === "win" && state.memo.rules.length > 0 && state.shared !== memoKey()) void share(true);
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
  const box = $("homeSlots");
  box.innerHTML = "";
  state.home.forEach((s, i) => {
    const b = document.createElement("button");
    b.textContent = s ? DECOR_ICON[s] : "·";
    b.title = s ? `${DECOR_LABEL[s]} (click to change)` : "Empty spot (click to place decor)";
    b.setAttribute("aria-label", `Spot ${i + 1}: ${s ? DECOR_LABEL[s] : "empty"}`);
    b.disabled = busy;
    b.onclick = () => {
      if (busy) return;
      state.home = cycleSlot(state.home, i);
      save();
      arena.setDecor(state.home);
      showGhostCard(null);
      renderHome();
    };
    box.appendChild(b);
  });
  $("homeInfo").textContent = `${decorCount(state.home)}/${HOME_SLOTS} spots decorated. Click a spot to place or change decor; your shared ghost carries your plot.`;
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
  const res = await shareGhost(pet.name, PET_GENES, state.memo, state.home);
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
}

// ---------------- coach (Cortex) + proof ----------------

const liveCortex = new LlmCortex(new FetchLlmClient(""));
const offlineCortex = new ScriptedCortex();
let lastProof: ProofReport | null = null;

async function coach(run: (c: Cortex) => Promise<CortexResult>, what: string, gated = false) {
  if (busy) return;
  busy = true;
  setButtons();
  const status = $("coachStatus");
  const t0 = performance.now();
  const tick = () => {
    const label = thinkingLabel(performance.now() - t0);
    status.textContent = `${what}… Muse Spark is ${label}`;
    say("pet", label, 1000);
  };
  tick();
  const timer = window.setInterval(tick, 400);
  arena.thinking = true;
  let note = "";
  let res: CortexResult | null = null;
  try {
    try {
      res = await run(liveCortex);
      $("coachSrc").textContent = res.source === "muse-spark" ? "Muse Spark" : "Muse Spark (open weights)";
    } catch (e) {
      // Budget refusal, network down, or a reply we could not validate: the scripted coach keeps the game going.
      res = await run(offlineCortex);
      $("coachSrc").textContent = "offline coach";
      note = `Live coach unavailable (${e instanceof CortexUnavailable ? e.message : "offline"}); used the offline coach.`;
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
  if (!note) status.textContent = `Memo updated by ${res.source}${res.dropped.length ? ` (${res.dropped.length} invalid parts dropped)` : ""}.`;
  say("pet", "Got it!", 1400);
  showProof(before, res.memo);
}

function showProof(before: Memo, after: Memo) {
  const report = prove(before.rules.length ? before : null, after);
  lastProof = report;
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

function renderMemo() {
  const lines = describeMemo(state.memo);
  $("memo").innerHTML = lines.map((l) => `<li>${esc(l)}</li>`).join("");
  $("memoEmpty").hidden = lines.length > 0;
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
  if (await native.probe()) {
    instinct.voice = native;
    $("brain").textContent = "Llama 3.2 3B (power mode)";
    status.textContent = "Power mode: Llama 3.2 3B on this computer (llama.cpp). Faster and smarter than the in-browser model.";
  } else if (!quiet) {
    status.textContent = "No local llama.cpp server found on 127.0.0.1:8080. See the README for the one-line power-mode setup.";
  }
}

// ---------------- wiring ----------------

function setButtons() {
  for (const id of ["go", "teach", "reflect", "reset", "watchProof", "shareGhost"]) $<HTMLButtonElement>(id).disabled = busy;
  if (!busy && !lastProof?.showcase) $<HTMLButtonElement>("watchProof").disabled = true;
  if (!busy) $<HTMLButtonElement>("reflect").disabled = state.recent.length === 0;
  for (const b of $("homeSlots").querySelectorAll("button")) b.disabled = busy;
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
$("reflect").onclick = () => void coach((c) => c.reflect(state.memo, state.recent), "Reviewing your fights", true);
$("reset").onclick = () => {
  if (busy || !confirm("Forget everything your pet learned?")) return;
  state.memo = EMPTY_MEMO;
  state.recent = [];
  save();
  renderMemo();
  $("proofBox").hidden = true;
  lastProof = null;
  setButtons();
};
$("watchProof").onclick = () => void watchProof();
$("shareGhost").onclick = () => void share();
$("loadWeb").onclick = () => void loadWeb();
$("probeNative").onclick = () => void probeNative();
$("petName").textContent = pet.name;

renderMemo();
renderHome();
setHp(pet.maxHp, null, null);
setButtons();
void probeNative(true);
