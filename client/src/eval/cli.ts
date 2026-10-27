// Paired-seed eval from the terminal: `npm run eval` (scripted coach, free, offline)
// or `npm run eval -- --live http://127.0.0.1:8787` (real Meta model through the Worker; costs a few cents).
import { CortexUnavailable, FetchLlmClient, LlmCortex, ScriptedCortex, describeMemo, type Cortex } from "../sim/cortex";
import { makeScenarios, pct, runArm, type PairedResult } from "../sim/evaluate";
import { EMPTY_MEMO, type Memo } from "../sim/memo";
import { baselinePolicy, memoPolicy } from "../sim/policy";
import { HELDOUT_SEEDS, TRAIN_SEEDS, prove } from "../sim/proof";
import { ARCHETYPES } from "../sim/types";

const liveIdx = process.argv.indexOf("--live");
const cortex: Cortex = liveIdx >= 0 ? new LlmCortex(new FetchLlmClient(process.argv[liveIdx + 1] ?? "http://127.0.0.1:8787")) : new ScriptedCortex();
const INSTRUCTION = "Be gentle with hurt enemies and guard when they wind up a heavy hit.";

function line(label: string, r: PairedResult): string {
  const [lo, hi] = r.ci95;
  return `${label.padEnd(8)} n=${String(r.n).padEnd(4)} win ${pct(r.before.winRate)} -> ${pct(r.after.winRate)}  (delta ${pct(r.winRateDelta)}, 95% CI ${pct(lo)}..${pct(hi)}, gained ${r.gained}/lost ${r.lost}, sign-test p=${r.pValue.toExponential(1)})  HP left on win ${pct(r.before.meanHpLeftOnWin, 0)} -> ${pct(r.after.meanHpLeftOnWin, 0)}`;
}

function perEnemy(memo: Memo) {
  for (const enemy of ARCHETYPES) {
    const sc = makeScenarios([enemy], HELDOUT_SEEDS);
    const b = runArm(baselinePolicy, sc).result;
    const a = prove(null, memo, [enemy]).heldout.after;
    console.log(`  ${enemy.padEnd(8)} ${pct(b.winRate, 0).padStart(4)} -> ${pct(a.winRate, 0).padStart(4)}`);
  }
}

async function main() {
  console.log(`coach: ${liveIdx >= 0 ? "live Meta model via Worker" : "scripted double"}`);

  // 1. Teach -> Prove: an untrained pet, one plain-language lesson, same seeded fights before and after.
  const taught = await cortex.teach(EMPTY_MEMO, INSTRUCTION);
  console.log(`
[teach] "${INSTRUCTION}" source=${taught.source} cost=$${taught.costUsd.toFixed(4)} rules=${taught.memo.rules.length} dropped=${taught.dropped.length}`);
  describeMemo(taught.memo).forEach((l) => console.log("  - " + l));
  const r1 = prove(null, taught.memo);
  console.log(line("train", r1.train));
  console.log(line("heldout", r1.heldout));
  perEnemy(taught.memo);
  if (r1.showcase) console.log(`showcase: ${r1.showcase.enemy} seed ${r1.showcase.seed}: ${r1.showcase.before.outcome} -> ${r1.showcase.after.outcome}`);

  // 2. Reflect: the coach reads the taught pet's own fights and refines the memo.
  const replays = runArm(memoPolicy(taught.memo), makeScenarios(ARCHETYPES, TRAIN_SEEDS)).replays;
  const reflected = await cortex.reflect(taught.memo, replays);
  console.log(`
[reflect] source=${reflected.source} cost=$${reflected.costUsd.toFixed(4)} rules=${reflected.memo.rules.length} dropped=${reflected.dropped.length}`);
  describeMemo(reflected.memo).forEach((l) => console.log("  - " + l));
  const r2 = prove(taught.memo, reflected.memo);
  console.log(line("train", r2.train));
  console.log(line("heldout", r2.heldout));
  perEnemy(reflected.memo);
}

main().catch((e) => {
  console.error(e instanceof CortexUnavailable ? `coach unavailable: ${e.message}` : e);
  process.exit(1);
});
