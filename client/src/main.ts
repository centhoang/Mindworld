import { Instinct, type Choice } from "./game/instinct";
import { Arena } from "./game/scene";
import { NativeVoice, WebLlmVoice } from "./game/voices";
import { Battle } from "./sim/battle";
import { CortexUnavailable, describeMemo, FetchLlmClient, LlmCortex, ScriptedCortex, type Cortex, type CortexResult } from "./sim/cortex";
import { ENEMIES } from "./sim/enemies";
import { comparePaired, makeScenarios, pct } from "./sim/evaluate";
import { EMPTY_MEMO, validateMemo, type Memo } from "./sim/memo";
import { baselinePolicy, memoPolicy } from "./sim/policy";
import { HELDOUT_SEEDS, prove, type ProofReport } from "./sim/proof";
import { ARCHETYPES, DEFAULT_PET, type ArchetypeId, type Intent, type Replay } from "./sim/types";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------------- state (memo + recent fights persist in this browser only) ----------------

const SAVE_KEY = "petmind.v1";
interface Save {
  memo: Memo;
  recent: Replay[];
}

function load(): Save {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null") as Partial<Save> | null;
    if (raw) return { memo: validateMemo(raw.memo).memo, recent: Array.isArray(raw.recent) ? raw.recent.slice(-8) : [] };
  } catch {
    /* private mode or corrupt save: start fresh */
  }
  return { memo: EMPTY_MEMO, recent: [] };
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

function setHp(myHp: number, enemy: ArchetypeId | null, enemyHp: number | null) {
  $("petHp").style.width = `${(100 * myHp) / pet.maxHp}%`;
  $("petHpTxt").textContent = String(myHp);
  if (!enemy || enemyHp === null) {
    $("enemyName").textContent = "-";
    $("enemyHpTxt").textContent = "-";
    $("enemyHp").style.width = "100%";
    return;
  }
  $("enemyName").textContent = enemy;
  $("enemyHp").style.width = `${(100 * enemyHp) / ENEMIES[enemy].maxHp}%`;
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
  const enemy: ArchetypeId = pick === "random" ? ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)]! : (pick as ArchetypeId);
  const battle = new Battle({ enemy, seed: Math.floor(Math.random() * 1e9) });
  arena.setEnemy(enemy);
  log.innerHTML = "";
  logLine(`<b>${pet.name}</b> vs <b>${enemy}</b>`);
  setHp(pet.maxHp, enemy, ENEMIES[enemy].maxHp);
  await banner(`vs ${enemy}`, 900);
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
    setHp(rec.myHp, enemy, rec.enemyHp);
  }
  const replay = battle.replay();
  await arena.playEnd(replay.outcome);
  logLine(`<b>${OUTCOME[replay.outcome]}</b> <span class="dim">(${replay.how})</span>`);
  await banner(OUTCOME[replay.outcome]);
  state.recent = [...state.recent, replay].slice(-8);
  save();
  busy = false;
  setButtons();
}

// Replays a recorded fight (used by the proof panel). No model calls: the moves are already decided.
async function playReplay(r: Replay, title: string) {
  arena.setEnemy(r.enemy);
  setHp(pet.maxHp, r.enemy, ENEMIES[r.enemy].maxHp);
  await banner(title, 1200);
  for (const [i, t] of r.turns.entries()) {
    say("enemy", TELL[t.obs.intent]);
    say("pet", t.action);
    const outcome = i === r.turns.length - 1 ? r.outcome : null;
    await arena.playTurn(t.action, t.enemyAct, t.dealt, t.taken, outcome);
    setHp(t.myHp, r.enemy, t.enemyHp);
  }
  await arena.playEnd(r.outcome);
  await banner(OUTCOME[r.outcome], 1100);
}

// ---------------- coach (Cortex) + proof ----------------

const liveCortex = new LlmCortex(new FetchLlmClient(""));
const offlineCortex = new ScriptedCortex();
let lastProof: ProofReport | null = null;

async function coach(run: (c: Cortex) => Promise<CortexResult>, what: string) {
  if (busy) return;
  busy = true;
  setButtons();
  const status = $("coachStatus");
  status.textContent = `${what}… (Muse Spark is thinking)`;
  let res: CortexResult;
  try {
    res = await run(liveCortex);
    $("coachSrc").textContent = res.source === "muse-spark" ? "Muse Spark" : "Muse Spark (open weights)";
  } catch (e) {
    // Budget refusal, network down, or a reply we could not validate: the scripted coach keeps the game going.
    res = await run(offlineCortex);
    $("coachSrc").textContent = "offline coach";
    status.textContent = `Live coach unavailable (${e instanceof CortexUnavailable ? e.message : "offline"}); used the offline coach.`;
  }
  const before = state.memo;
  state.memo = res.memo;
  save();
  renderMemo();
  if (!status.textContent?.startsWith("Live coach unavailable"))
    status.textContent = `Memo updated by ${res.source}${res.dropped.length ? ` (${res.dropped.length} invalid parts dropped)` : ""}.`;
  showProof(before, res.memo);
  busy = false;
  setButtons();
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
  for (const id of ["go", "teach", "reflect", "reset", "watchProof"]) $<HTMLButtonElement>(id).disabled = busy;
  if (!busy && !lastProof?.showcase) $<HTMLButtonElement>("watchProof").disabled = true;
  if (!busy) $<HTMLButtonElement>("reflect").disabled = state.recent.length === 0;
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
$("reflect").onclick = () => void coach((c) => c.reflect(state.memo, state.recent), "Reviewing your fights");
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
$("loadWeb").onclick = () => void loadWeb();
$("probeNative").onclick = () => void probeNative();
$("petName").textContent = pet.name;

renderMemo();
setHp(pet.maxHp, null, null);
setButtons();
void probeNative(true);
