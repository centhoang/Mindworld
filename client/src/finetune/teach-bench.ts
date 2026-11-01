// Teach benchmark for the local coach (docs/archive/FINETUNE.md step 0 and step 6): every held-out lesson is taught
// to an untrained pet, and each memo is scored by Prove (paired held-out seeds vs the uncoached pet).
// Usage: npx tsx src/finetune/teach-bench.ts <coach> [--label x] [--limit n] [--free] [--out file.json] [--resume file.json]
//   --resume keeps the rows of an earlier run and re-asks only lessons the server refused (budget/rate limit).
//   coach = scripted | http://127.0.0.1:8080 (llama-server) | worker:http://127.0.0.1:8787 (Muse Spark Open, the teacher)
// The scripted double and llama-server cost nothing; the worker coach is billed and capped by the Worker's ledger. Results JSON keeps every memo for later comparison.
import { readFileSync, writeFileSync } from "node:fs";
import { CortexUnavailable, FetchLlmClient, LlmCortex, LocalCortex, ScriptedCortex, type Cortex } from "../sim/cortex";
import { EMPTY_MEMO, type Memo } from "../sim/memo";
import { prove } from "../sim/proof";
import { HELDOUT_LESSONS } from "./lessons";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const coachArg = args[0] ?? "scripted";
const free = args.includes("--free");
const limit = Number(opt("--limit") ?? HELDOUT_LESSONS.length);
const label = opt("--label") ?? coachArg;
const out = opt("--out");
const resume = opt("--resume");

const cortex: Cortex =
  coachArg === "scripted" ? new ScriptedCortex()
  : coachArg.startsWith("worker:") ? new LlmCortex(new FetchLlmClient(coachArg.slice("worker:".length)))
  : new LocalCortex(coachArg, { grammar: !free });
const local = coachArg !== "scripted" && !coachArg.startsWith("worker:");

interface Row {
  lesson: string;
  ok: boolean; // a memo came back and kept at least one rule
  clean: boolean; // ok and nothing was dropped by the validator
  error?: string;
  rules: number;
  dropped: number;
  lift: number; // held-out win-rate delta vs the uncoached pet
  latencyMs: number;
  costUsd: number;
  memo?: Memo;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;

async function main() {
  const rows: Row[] = [];
  const lessons = HELDOUT_LESSONS.slice(0, limit);
  const earlier = new Map<string, Row>();
  if (resume) for (const r of (JSON.parse(readFileSync(resume, "utf8")) as { rows: Row[] }).rows) earlier.set(r.lesson, r);
  const refused = (r: Row) => /budget_exhausted|rate_limited|unreachable/.test(r.error ?? "");
  for (const [i, lesson] of lessons.entries()) {
    const kept = earlier.get(lesson);
    if (kept && !refused(kept)) {
      rows.push(kept);
      continue;
    }
    try {
      const r = await cortex.teach(EMPTY_MEMO, lesson);
      const ok = r.memo.rules.length > 0;
      const lift = ok ? prove(null, r.memo).heldout.winRateDelta : 0;
      rows.push({ lesson, ok, clean: ok && r.dropped.length === 0, rules: r.memo.rules.length, dropped: r.dropped.length, lift, latencyMs: r.latencyMs, costUsd: r.costUsd, memo: r.memo });
    } catch (e) {
      // A network failure (server down or restarting) is recorded like a refusal so --resume retries it.
      if (!(e instanceof CortexUnavailable) && !(e instanceof TypeError)) throw e;
      const error = e instanceof CortexUnavailable ? e.message : `unreachable: ${(e as Error).message}`;
      rows.push({ lesson, ok: false, clean: false, error, rules: 0, dropped: 0, lift: 0, latencyMs: 0, costUsd: 0 });
    }
    const last = rows[rows.length - 1]!;
    console.error(`${i + 1}/${lessons.length} ${last.ok ? "ok " : "BAD"} lift ${pct(last.lift).padStart(6)} ${(last.latencyMs / 1000).toFixed(1)}s  ${lesson.slice(0, 60)}`);
  }
  // A lesson that produced no memo counts as zero lift: the pet keeps playing uncoached.
  const lat = rows.filter((r) => r.ok).map((r) => r.latencyMs).sort((a, b) => a - b);
  const summary = {
    label,
    grammar: local && !free,
    n: rows.length,
    validRate: mean(rows.map((r) => Number(r.ok))),
    cleanRate: mean(rows.map((r) => Number(r.clean))),
    meanLift: mean(rows.map((r) => r.lift)),
    meanLiftWhenValid: mean(rows.filter((r) => r.ok).map((r) => r.lift)),
    harmful: rows.filter((r) => r.lift < -0.02).length,
    meanRules: mean(rows.filter((r) => r.ok).map((r) => r.rules)),
    p50LatencyS: (lat[Math.floor(lat.length / 2)] ?? 0) / 1000,
    costUsd: rows.reduce((a, r) => a + r.costUsd, 0),
  };
  console.log(
    `${label}: n=${summary.n} valid ${pct(summary.validRate)} (clean ${pct(summary.cleanRate)}), mean held-out lift ${pct(summary.meanLift)} ` +
      `(${pct(summary.meanLiftWhenValid)} when valid), harmful ${summary.harmful}, rules ${summary.meanRules.toFixed(1)}, p50 ${summary.p50LatencyS.toFixed(1)} s, cost $${summary.costUsd.toFixed(3)}`,
  );
  if (out) writeFileSync(out, JSON.stringify({ summary, rows }, null, 1));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
