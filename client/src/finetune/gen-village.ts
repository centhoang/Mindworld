// Teacher data for the village minds (docs/FINETUNE.md "Stage 5"): seeded scenarios for the five mind decisions
// (plan, choose, line, emote, reflect), each prompt built by the game's own builders in mind/brain.ts, answered by
// Muse Spark Open on Modal through the capped ModalClient (ledger kind "village"), and kept only if the answer
// passes the same check the game applies (the grammar's option sets, parseLine, word limits). Each kept row holds
// the exact system + user text the browser model sees, so the student learns the game's real format.
// Usage: npx tsx src/finetune/gen-village.ts [--limit 40] [--cap 0.5] [--max-calls n] [--concurrency 4] [--seed 1] [--split train|val] [--dry-run]
// Resumable: rows are appended to data/finetune/village-<split>.jsonl; a rerun skips ids that already have a row
// and retries ones that failed for transient reasons. --dry-run sends nothing and prints sample prompts + the cap.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ACTIVITIES } from "../life/activities";
import type { Phase } from "../life/clock";
import { NEEDS, type Needs } from "../life/needs";
import { randomGenes } from "../game/genes";
import { mulberry32 } from "../sim/rng";
import { EMOTES } from "../world/live";
import { choosePrompt, emotePrompt, eventText, LINE_MAX, linePrompt, parseChoice, parseLine, parsePlan, petLinePrompt, planPrompt, reflectPrompt, replyPrompt, type LmRequest } from "../mind/brain";
import { emptyMemory, addFact, remember, type MindMemory } from "../mind/memory";
import { petPersona, VILLAGERS, type Persona } from "../mind/persona";
import { DATA_DIR } from "./gen-lessons";
import { BudgetExceeded, ModalClient, pool } from "./modal-client";

export const TASKS = ["plan", "choose", "line", "petline", "reply", "emote", "reflect"] as const;
export type Task = (typeof TASKS)[number];
// Share of each task in a run (the game asks choose and line most often).
const MIX: [Task, number][] = [["plan", 0.12], ["choose", 0.28], ["line", 0.2], ["petline", 0.08], ["reply", 0.1], ["emote", 0.08], ["reflect", 0.14]];
const WORDS: Partial<Record<Task, number>> = { line: 15, petline: 12, reply: 25, reflect: 15 };

export interface VillageItem {
  id: string;
  task: Task;
  who: string;
  req: LmRequest;
  options?: string[]; // plan/choose/emote: the grammar's alternatives
}

export interface VillageRow {
  id: string;
  task: Task;
  who: string;
  system: string;
  user: string;
  target?: string; // the validated answer (what the student learns)
  ok: boolean;
  error?: string;
  raw?: string;
  costUsd: number;
  latencyMs: number;
}

const PET_NAMES = ["Sprig", "Mallow", "Pebble", "Biscuit", "Fern", "Nib", "Tofu", "Clover", "Ziggy", "Moss", "Juniper", "Puddle", "Kiwi", "Bramble", "Dot", "Waffle"];
const PLAYERS = ["Kai", "Lena", "Rio", "Sam", "Noor", "Theo", "Yuki", "Ana"];
const QUESTIONS = [
  "what are you up to today?", "where is the best fishing spot?", "do you like my pet?", "is there a picnic later?", "what did you eat today?",
  "who is the oldest here?", "can you teach me something?", "why is the pond so quiet?", "are you tired?", "what is your favourite food?",
  "have you seen my pet around?", "tell me a story", "what happened yesterday?", "do you ever leave the islands?", "hi!",
];
const TIMES = ["07:10", "08:30", "09:40", "11:20", "12:05", "13:30", "15:10", "16:45", "18:20", "19:30", "20:50"];
const FACTS = ["likes picnics best", "is afraid of deep water", "makes friends quickly", "naps after lunch", "loves the pond at dawn", "thinks Pip is too loud", "keeps losing the ball"];

const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
const shuffle = <T>(r: () => number, xs: readonly T[]): T[] => xs.map((x) => [r(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);

function someone(r: () => number): Persona {
  if (r() < 0.45) return pick(r, VILLAGERS);
  const g = randomGenes(Math.floor(r() * 1e9));
  return petPersona(pick(r, PET_NAMES), g);
}

// The activities the game offers this persona (hub.ts plan options: no poop/sleep, by kind).
const forKind = (p: Persona) => ACTIVITIES.filter((a) => a.id !== "poop" && a.id !== "sleep" && (a.who === "any" || a.who === p.kind)).map((a) => a.id);

function memoryFor(r: () => number, p: Persona, day: number): MindMemory {
  const m = emptyMemory();
  const n = Math.floor(r() * 7);
  const acts = forKind(p);
  const old = Math.floor(r() * n); // the first few memories are from yesterday, in time order
  shuffle(r, TIMES).slice(0, n).sort().forEach((time, k) => {
    const mates = r() < 0.5 ? [pick(r, [...VILLAGERS.map((v) => v.name), ...PET_NAMES].filter((x) => x !== p.name))] : [];
    remember(m, k < old ? day - 1 : day, time, eventText(pick(r, acts), mates));
  });
  if (r() < 0.35) addFact(m, `${p.name} ${pick(r, FACTS)}`);
  return m;
}

function needs(r: () => number): Needs {
  return Object.fromEntries(NEEDS.map((k) => [k, Math.round(r() < 0.3 ? r() * 40 : 40 + r() * 60)])) as Needs;
}

// One scenario per index, deterministic from (seed, i): the same id always gets the same prompt.
export function villageItem(seed: number, i: number): VillageItem {
  const r = mulberry32((Math.imul(seed + 1, 2654435761) ^ Math.imul(i + 7, 40503)) >>> 0);
  let u = r();
  const task = MIX.find(([, w]) => (u -= w) < 0)?.[0] ?? "choose";
  const p = task === "line" || task === "reply" || task === "petline" ? (task === "line" ? someone(r) : pick(r, VILLAGERS)) : someone(r);
  const day = 1 + Math.floor(r() * 5);
  const m = memoryFor(r, p, day);
  const id = `v${seed}-${i}`;
  const base = { id, task, who: p.name };
  switch (task) {
    case "plan": {
      const options = forKind(p);
      return { ...base, req: planPrompt(p, m, options), options };
    }
    case "choose": {
      const phase = pick<Phase>(r, ["morning", "noon", "evening"]);
      const choices = shuffle(r, forKind(p)).slice(0, 2 + Math.floor(r() * 4));
      const company = r() < 0.5 ? `Nearby: ${shuffle(r, [...VILLAGERS.map((v) => v.name), ...PET_NAMES].filter((x) => x !== p.name)).slice(0, 1 + Math.floor(r() * 2)).join(", ")}.` : "";
      if (r() < 0.4) m.plan[phase] = [pick(r, forKind(p))];
      return { ...base, req: choosePrompt(p, m, needs(r), phase, choices, company), options: choices };
    }
    case "line": {
      let other = someone(r);
      while (other.name === p.name) other = someone(r);
      const aff = Math.round(r() * 100 - 40);
      const said = r() < 0.4 ? [`${other.name}: ${pick(r, ["Nice day, right?", "Want to play later?", "I caught a big fish!", "Have you eaten?", "Let's have a picnic."])}`] : [];
      const topic = said.length ? "what was just said" : m.log.at(-1)?.text ?? "the day on the islands";
      return { ...base, req: linePrompt(p, m, other, aff, topic, said) };
    }
    case "petline":
      return { ...base, req: petLinePrompt(p, m, pick(r, PET_NAMES)) };
    case "reply":
      return { ...base, req: replyPrompt(p, m, pick(r, PLAYERS), pick(r, QUESTIONS)) };
    case "emote": {
      const options = [...EMOTES, "none"];
      const mates = [pick(r, [...VILLAGERS.map((v) => v.name), ...PET_NAMES].filter((x) => x !== p.name))];
      return { ...base, req: emotePrompt(p, `${p.name} just ${eventText(pick(r, forKind(p)), mates)}.`), options };
    }
    case "reflect":
      return { ...base, req: reflectPrompt(p, m, day) };
  }
}

// The game's check for each task. Returns the answer the student should learn, or null.
export function validate(item: VillageItem, raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (item.task === "plan") {
    const plan = parsePlan(t, item.options!);
    return plan && t.split(/\s*,\s*/).length === 3 ? `${plan.morning![0]},${plan.noon![0]},${plan.evening![0]}` : null;
  }
  if (item.task === "choose") {
    const c = parseChoice(t, item.options!);
    return c && t.toLowerCase().replace(/[.!]$/, "") === c ? c : null;
  }
  if (item.task === "emote") {
    const e = t.toLowerCase().replace(/[.!]$/, "");
    return item.options!.includes(e) ? e : null;
  }
  const line = parseLine(t, item.who);
  if (!line || line.endsWith("...") || line.length > LINE_MAX) return null;
  // the grammar only allows letters and simple punctuation: reject answers that needed heavy cleaning
  if (line.length < 0.85 * t.replace(new RegExp(`^${item.who}\\s*:\\s*`, "i"), "").replace(/^["']|["']$/g, "").length) return null;
  if (line.split(/\s+/).length > (WORDS[item.task] ?? 15)) return null;
  return line;
}

// For the teacher only: the game's prompt plus a reminder to answer bare (the student is trained on the game's text).
const TEACHER_NOTE = " Reply with the answer only: no quotes, no labels, no explanation.";

export interface RunOptions {
  limit: number;
  seed: number;
  out: string;
  llm: Pick<ModalClient, "complete" | "spentUsd">;
  concurrency: number;
  log?: (s: string) => void;
}

const transient = (err = "") => /HTTP (408|409|425|429|5\d\d)|unreachable|fetch failed|timeout|aborted|ECONN|ETIMEDOUT/i.test(err);

export function readVillageRows(path: string): Map<string, VillageRow> {
  const rows = new Map<string, VillageRow>();
  if (!existsSync(path)) return rows;
  for (const line of readFileSync(path, "utf8").split("\n")) if (line.trim()) {
    const r = JSON.parse(line) as VillageRow;
    rows.set(r.id, r);
  }
  return rows;
}

export async function runVillage(o: RunOptions): Promise<{ rows: VillageRow[]; finished: boolean }> {
  const rows = readVillageRows(o.out);
  const items = Array.from({ length: o.limit }, (_, i) => villageItem(o.seed, i)).filter((it) => {
    const r = rows.get(it.id);
    return !r || (!r.ok && transient(r.error));
  });
  const finished = await pool(items, o.concurrency, async (it) => {
    let row: VillageRow;
    const base = { id: it.id, task: it.task, who: it.who, system: it.req.system, user: it.req.user };
    try {
      const rep = await o.llm.complete({ kind: "teach", system: it.req.system + TEACHER_NOTE, prompt: it.req.user, maxTokens: 1500 });
      const target = rep.truncated ? null : validate(it, rep.text);
      row = { ...base, ok: !!target, ...(target ? { target } : { error: rep.truncated ? "cut off" : "invalid", raw: rep.text.slice(0, 200) }), costUsd: rep.costUsd, latencyMs: rep.latencyMs };
    } catch (e) {
      if (e instanceof BudgetExceeded) throw e;
      row = { ...base, ok: false, error: (e as Error).message.slice(0, 200), costUsd: 0, latencyMs: 0 };
    }
    rows.set(it.id, row);
    appendFileSync(o.out, JSON.stringify(row) + "\n");
    o.log?.(`${row.ok ? "ok " : "BAD"} ${row.task.padEnd(7)} ${row.who.padEnd(8)} ${row.target ?? `${row.error}: ${row.raw ?? ""}`}`.slice(0, 160));
  });
  const all = Array.from({ length: o.limit }, (_, i) => rows.get(`v${o.seed}-${i}`)).filter((r): r is VillageRow => !!r);
  return { rows: all, finished };
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const limit = Number(opt("--limit") ?? 40);
  const seed = Number(opt("--seed") ?? 1);
  const cap = Number(opt("--cap") ?? 0.5);
  const split = opt("--split") ?? "train";
  const out = `${DATA_DIR}village-${split}.jsonl`;
  if (args.includes("--dry-run")) {
    const counts: Record<string, number> = {};
    for (let i = 0; i < limit; i++) counts[villageItem(seed, i).task] = (counts[villageItem(seed, i).task] ?? 0) + 1;
    for (const i of [0, 1, 2]) console.log(JSON.stringify(villageItem(seed, i), null, 1).slice(0, 900), "\n");
    console.log(`dry run: ${limit} items ${JSON.stringify(counts)}, cap $${cap} (ledger kind "village"), out ${out}; nothing sent`);
    return;
  }
  const llm = new ModalClient({ kind: "village", capUsd: cap, maxCalls: Number(opt("--max-calls") ?? limit + 20), effort: "low" });
  const start = llm.spentUsd;
  const { rows, finished } = await runVillage({ limit, seed, out, llm, concurrency: Number(opt("--concurrency") ?? 4), log: (s) => console.error(s) });
  const ok = rows.filter((r) => r.ok);
  const by = Object.fromEntries(TASKS.map((t) => [t, `${ok.filter((r) => r.task === t).length}/${rows.filter((r) => r.task === t).length}`]));
  console.log(`${split}: ${rows.length}/${limit} rows, ok ${ok.length} ${JSON.stringify(by)}, this run $${(llm.spentUsd - start).toFixed(4)}, village total $${llm.spentUsd.toFixed(4)}${finished ? "" : " (stopped early)"}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
