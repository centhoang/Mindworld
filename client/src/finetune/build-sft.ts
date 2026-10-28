// SFT dataset for the local coach (docs/FINETUNE.md steps 3-4): chat examples in the exact prompts the game sends.
//   teach: teacher rows that are valid, pass the train-seed gate, and fit MEMO_JSON_SCHEMA (what grammar-constrained
//          decoding can emit) -> system/user from buildTeachPrompt, assistant = the memo as compact JSON.
//   voice: observations from simulated fights under random teacher memos -> buildVoicePrompt, assistant =
//          "<allowedMoves()[0]>: <line>"; lines come from Muse Spark Open (cached in voice-lines.json) plus the canned bank.
// Voice examples are about a quarter of the total, so one model does both jobs.
// Usage: npx tsx src/finetune/build-sft.ts [--voice-ratio 0.25] [--seed 11] [--cap 1]
// Writes data/finetune/sft-{train,val}.jsonl ({"messages": [...], "task": "teach"|"voice"}).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { allowedMoves, buildVoicePrompt, CANNED, PERSONALITY } from "../game/instinct";
import { runBattle } from "../sim/battle";
import { buildTeachPrompt } from "../sim/cortex";
import { EMPTY_MEMO, extractJson, type Memo } from "../sim/memo";
import { memoPolicy } from "../sim/policy";
import { mulberry32 } from "../sim/rng";
import { ACTIONS, ARCHETYPES, type Action, type Observation } from "../sim/types";
import { DATA_DIR } from "./gen-lessons";
import { ModalClient, pool } from "./modal-client";
import { readRows, type TeacherRow } from "./teacher";

export interface Example {
  task: "teach" | "voice";
  messages: { role: "system" | "user" | "assistant"; content: string }[];
}

// What the memo grammar (MEMO_JSON_SCHEMA) can produce; validateMemo is looser (longer text, any finite n).
export function fitsSchema(m: Memo): boolean {
  if (m.summary.length > 160) return false;
  return m.rules.every((r) => r.why.length <= 100 && r.if.every((c) => !("n" in c) || (Number.isInteger(c.n) && c.n >= 0 && c.n <= 100)));
}

export function teachExample(lesson: string, start: Memo | null, memo: Memo): Example {
  const p = buildTeachPrompt(start ?? EMPTY_MEMO, lesson);
  return {
    task: "teach",
    messages: [
      { role: "system", content: p.system },
      { role: "user", content: p.prompt },
      { role: "assistant", content: JSON.stringify({ summary: memo.summary, rules: memo.rules }) },
    ],
  };
}

export const keepTeacherRow = (r: TeacherRow): boolean => r.ok && r.gate && !!r.memo && fitsSchema(r.memo);

// ---------------- voice lines ----------------

const SITUATIONS = [
  "neutral, mid-fight",
  "the pet is winning and confident",
  "the pet is low on HP and nervous",
  "the enemy is winding up a heavy hit",
  "the enemy looks scared or calm",
  "following the coach's rule",
];
type Lines = Record<Action, string[]>;
const LINES_PATH = `${DATA_DIR}voice-lines.json`;

async function museLines(capUsd: number): Promise<Lines> {
  const lines: Lines = existsSync(LINES_PATH) ? JSON.parse(readFileSync(LINES_PATH, "utf8")) : { attack: [], guard: [], flee: [], emote: [], befriend: [] };
  if (Object.values(lines).every((xs) => xs.length >= 100)) return lines;
  const jobs = ACTIONS.flatMap((a) => SITUATIONS.map((s) => [a, s] as const));
  const llm = new ModalClient({ kind: "voice-lines", capUsd, maxCalls: jobs.length + 5, effort: "low" });
  const system =
    `You write dialogue for a small pet in a cute turn-based duel game. The pet is ${PERSONALITY}. ` +
    `Reply with ONLY one JSON object: {"lines": string[]}. Each line is what the pet says while making its move: 1 to 8 words, no quotes, no emoji, all different.`;
  await pool(jobs, 5, async ([action, situation]) => {
    const reply = await llm.complete({ kind: "teach", system, prompt: `Write 35 lines for the move "${action}". Situation: ${situation}.`, maxTokens: 3000 });
    const got = (extractJson(reply.text) as { lines?: unknown } | null)?.lines;
    const ok = (Array.isArray(got) ? got : []).filter((x): x is string => typeof x === "string").map((x) => x.replace(/[\x00-\x1f\x7f"]+/g, "").trim())
      .filter((x) => x.length > 0 && x.split(/\s+/).length <= 8 && !x.includes(":"));
    lines[action].push(...ok);
    console.error(`${action} / ${situation}: ${ok.length} lines, $${reply.costUsd.toFixed(4)}`);
  });
  for (const a of ACTIONS) lines[a] = [...new Set(lines[a])];
  writeFileSync(LINES_PATH, JSON.stringify(lines, null, 1));
  console.error(`voice lines spend: $${llm.spentUsd.toFixed(3)}`);
  return lines;
}

const PET_NAMES = ["Mochi", "Mochi", "Mochi", "Pip", "Biscuit", "Nugget", "Luna", "Taro", "Bean", "Ziggy", "Pumpkin", "Kiwi"];

// Observations a real fight reaches: simulate fights under a random memo and sample turns from them.
export function voiceExamples(n: number, memos: Memo[], lines: Lines, seed: number): Example[] {
  const r = mulberry32(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const out: Example[] = [];
  for (let s = 0; out.length < n; s++) {
    const memo = r() < 0.3 ? EMPTY_MEMO : pick(memos);
    const replay = runBattle({ enemy: pick(ARCHETYPES), seed: 50_000 + seed * 10_000 + s }, memoPolicy(memo)); // far from train/held-out seeds
    const obs: Observation = pick(replay.turns).obs;
    const a = allowedMoves(memo, obs);
    const move = a.moves[0]!;
    const p = buildVoicePrompt(pick(PET_NAMES), memo, obs, a);
    const line = r() < 0.1 ? pick(CANNED[move]) : pick(lines[move].length ? lines[move] : CANNED[move]);
    out.push({ task: "voice", messages: [{ role: "system", content: p.system }, { role: "user", content: p.user }, { role: "assistant", content: `${move}: ${line}` }] });
  }
  return out;
}

function shuffle<T>(xs: T[], seed: number): T[] {
  const r = mulberry32(seed);
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [xs[i], xs[j]] = [xs[j]!, xs[i]!];
  }
  return xs;
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (name: string, d: number) => {
    const i = args.indexOf(name);
    return i >= 0 ? Number(args[i + 1]) : d;
  };
  const ratio = opt("--voice-ratio", 0.25);
  const seed = opt("--seed", 11);
  const lines = await museLines(opt("--cap", 1));
  for (const split of ["train", "val"] as const) {
    const rows = [...readRows(`${DATA_DIR}teacher-${split}.jsonl`).values()];
    const kept = rows.filter(keepTeacherRow);
    const teach = kept.map((r) => teachExample(r.lesson, r.start, r.memo!));
    const memos = kept.map((r) => r.memo!).filter((m) => m.rules.length > 0);
    const voice = voiceExamples(Math.round((teach.length * ratio) / (1 - ratio)), memos, lines, seed + (split === "val" ? 1 : 0));
    const all = shuffle([...teach, ...voice], seed);
    writeFileSync(`${DATA_DIR}sft-${split}.jsonl`, all.map((e) => JSON.stringify(e)).join("\n") + "\n");
    const offSchema = rows.filter((r) => r.ok && r.gate && r.memo && !fitsSchema(r.memo)).length;
    console.log(`${split}: teach ${teach.length} (of ${rows.length}; ${offSchema} gate-pass rows dropped as off-schema), voice ${voice.length}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
