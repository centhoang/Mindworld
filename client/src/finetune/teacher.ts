// Teacher data for the local coach (docs/FINETUNE.md step 2): every training lesson is taught by Muse Spark Open
// on Modal through the same LlmCortex code path as the game. Each row keeps the validated memo and its score on
// the 40 train seeds against the memo it started from (the Reflect gate: delta >= 0). Rejection sampling happens
// later, at training time, from these rows; held-out seeds are never touched here.
// A quarter of the lessons are taught on top of an existing memo (the game teaches incrementally); that start memo
// is a gate-passing teacher memo from an earlier lesson, so those run after the empty-memo lessons.
// Usage: npx tsx src/finetune/teacher.ts [--split train|val] [--limit n] [--cap 30] [--max-calls n] [--concurrency 6] [--effort low|none]
// Resumable: rows are appended to data/finetune/teacher-<split>.jsonl; a rerun skips lessons that already have a
// final row and retries ones that failed for transient reasons (HTTP 429/5xx, network, timeout).
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CortexUnavailable, LlmCortex } from "../sim/cortex";
import { comparePaired, makeScenarios } from "../sim/evaluate";
import { EMPTY_MEMO, type Memo } from "../sim/memo";
import { memoPolicy } from "../sim/policy";
import { TRAIN_SEEDS } from "../sim/proof";
import { ARCHETYPES } from "../sim/types";
import { DATA_DIR, type Lesson } from "./gen-lessons";
import { BudgetExceeded, ModalClient, pool } from "./modal-client";

export interface TeacherRow {
  id: string;
  lesson: string;
  start: Memo | null; // null = taught to an untrained pet
  ok: boolean; // a memo came back with at least one rule (or an intended no-op on a non-empty start)
  error?: string;
  memo?: Memo;
  dropped: string[];
  trainDelta: number; // win-rate delta on the train seeds vs the start memo
  gate: boolean; // trainDelta >= 0
  costUsd: number;
  latencyMs: number;
  effort: string;
}

const TRAIN_SCENARIOS = makeScenarios(ARCHETYPES, TRAIN_SEEDS);
export const trainDelta = (start: Memo, memo: Memo): number => comparePaired(memoPolicy(start), memoPolicy(memo), TRAIN_SCENARIOS).winRateDelta;
const transient = (err = "") => /HTTP (408|409|425|429|5\d\d)|unreachable|fetch failed|timeout|aborted|ECONN|ETIMEDOUT/i.test(err);

export function readRows(path: string): Map<string, TeacherRow> {
  const rows = new Map<string, TeacherRow>();
  if (!existsSync(path)) return rows;
  for (const line of readFileSync(path, "utf8").split("\n")) if (line.trim()) {
    const r = JSON.parse(line) as TeacherRow;
    rows.set(r.id, r); // the last row for an id wins
  }
  return rows;
}

// Deterministic pick of a start memo for a lesson, from gate-passing empty-start rows.
function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const split = opt("--split") ?? "train";
  const effortArg = opt("--effort") ?? "low";
  const effort = effortArg === "none" ? undefined : (effortArg as "low" | "medium" | "high");
  const lessons = readFileSync(`${DATA_DIR}lessons-${split}.jsonl`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Lesson)
    .slice(0, Number(opt("--limit") ?? Infinity));
  const out = `${DATA_DIR}teacher-${split}.jsonl`;
  const rows = readRows(out);
  const llm = new ModalClient({ kind: "teacher", capUsd: Number(opt("--cap") ?? 30), maxCalls: Number(opt("--max-calls") ?? lessons.length + 50), effort });
  const cortex = new LlmCortex(llm);
  const concurrency = Number(opt("--concurrency") ?? 6);
  let done = 0;
  const startSpend = llm.spentUsd;

  const teachOne = async (l: Lesson, start: Memo | null) => {
    const base = start ?? EMPTY_MEMO;
    let row: TeacherRow;
    try {
      const r = await cortex.teach(base, l.text);
      // An empty memo from an empty start is a refusal to coach (off-topic lessons); keep it, it is a valid answer.
      const ok = r.memo.rules.length > 0 || base.rules.length === 0;
      const delta = trainDelta(base, r.memo);
      row = { id: l.id, lesson: l.text, start, ok, memo: r.memo, dropped: r.dropped, trainDelta: delta, gate: delta >= 0, costUsd: r.costUsd, latencyMs: r.latencyMs, effort: effortArg };
    } catch (e) {
      if (e instanceof BudgetExceeded) throw e;
      if (!(e instanceof CortexUnavailable) && !(e instanceof Error)) throw e;
      row = { id: l.id, lesson: l.text, start, ok: false, error: (e as Error).message.slice(0, 200), dropped: [], trainDelta: 0, gate: false, costUsd: 0, latencyMs: 0, effort: effortArg };
    }
    rows.set(l.id, row);
    appendFileSync(out, JSON.stringify(row) + "\n");
    done++;
    if (done % 10 === 0 || !row.ok)
      console.error(`${done} ${row.ok ? "ok " : "BAD"} d=${(100 * row.trainDelta).toFixed(1).padStart(5)} $${(llm.spentUsd - startSpend).toFixed(3)}  ${row.error ?? l.text.slice(0, 50)}`);
  };

  const pending = (l: Lesson) => {
    const r = rows.get(l.id);
    return !r || (!r.ok && transient(r.error));
  };
  // Phase 1: lessons taught to an untrained pet.
  let finished = await pool(lessons.filter((l) => !l.withMemo && pending(l)), concurrency, (l) => teachOne(l, null));
  // Phase 2: lessons taught on top of an earlier gate-passing memo with at least one rule.
  const starts = [...rows.values()].filter((r) => r.start === null && r.ok && r.gate && r.memo && r.memo.rules.length > 0).sort((a, b) => a.id.localeCompare(b.id));
  if (finished && starts.length)
    finished = await pool(lessons.filter((l) => l.withMemo && pending(l)), concurrency, (l) => {
      const prev = rows.get(l.id)?.start; // keep the same start memo on a retry
      return teachOne(l, prev ?? starts[hash(l.id) % starts.length]!.memo!);
    });

  const all = lessons.map((l) => rows.get(l.id)).filter((r): r is TeacherRow => !!r);
  const n = all.length;
  const okRows = all.filter((r) => r.ok);
  console.log(
    `${split}: ${n}/${lessons.length} lessons, ok ${okRows.length}, gate-pass ${okRows.filter((r) => r.gate).length}, ` +
      `cut off ${all.filter((r) => /cut off/.test(r.error ?? "")).length}, mean train delta ${(100 * okRows.reduce((a, r) => a + r.trainDelta, 0) / Math.max(1, okRows.length)).toFixed(1)} pts, ` +
      `this run $${(llm.spentUsd - startSpend).toFixed(3)}, teacher total $${llm.spentUsd.toFixed(3)}${finished ? "" : " (stopped early)"}`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
