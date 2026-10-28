// Voice benchmark for the local coach (docs/FINETUNE.md acceptance: 100% valid with grammar, >= 98% without,
// line <= 8 words). Observations come from simulated fights under val teacher memos (or none), on seeds the
// training set never used; each prompt goes to a llama-server exactly as power mode sends it (NativeVoice).
// Usage: npx tsx src/finetune/voice-bench.ts <llama-server url> [--free] [--n 200] [--label x]
import { allowedMoves, buildVoicePrompt, parseVoice } from "../game/instinct";
import { NativeVoice } from "../game/voices";
import { runBattle } from "../sim/battle";
import { EMPTY_MEMO, type Memo } from "../sim/memo";
import { memoPolicy } from "../sim/policy";
import { mulberry32 } from "../sim/rng";
import { ARCHETYPES } from "../sim/types";
import { DATA_DIR } from "./gen-lessons";
import { keepTeacherRow } from "./build-sft";
import { readRows } from "./teacher";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const url = args[0] ?? "http://127.0.0.1:8080";
const free = args.includes("--free");
const n = Number(opt("--n") ?? 200);
const label = opt("--label") ?? `${url}${free ? " free" : ""}`;

async function main() {
  const memos: Memo[] = [...readRows(`${DATA_DIR}teacher-val.jsonl`).values()].filter(keepTeacherRow).map((r) => r.memo!).filter((m) => m.rules.length > 0);
  const r = mulberry32(99);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const voice = new NativeVoice(url);
  let valid = 0, first = 0, short = 0, choice = 0, choiceFirst = 0, words = 0;
  const lat: number[] = [];
  const bad: string[] = [];
  for (let i = 0; i < n; i++) {
    const memo = r() < 0.3 ? EMPTY_MEMO : pick(memos);
    const replay = runBattle({ enemy: pick(ARCHETYPES), seed: 90_000 + i }, memoPolicy(memo));
    const obs = pick(replay.turns).obs;
    const a = allowedMoves(memo, obs);
    const p = buildVoicePrompt("Mochi", memo, obs, a);
    const t0 = performance.now();
    // Without grammar the request simply has no "grammar" field (JSON.stringify drops undefined).
    const reply = await voice.pick(free ? { ...p, grammar: undefined as unknown as string } : p, AbortSignal.timeout(20_000));
    lat.push(performance.now() - t0);
    const ok = parseVoice(reply, a.moves);
    if (!ok) { if (bad.length < 5) bad.push(`${reply.action}:${reply.line}`); continue; }
    valid++;
    const w = ok.line.split(/\s+/).filter(Boolean).length;
    words += w;
    if (w <= 8 && w > 0) short++;
    if (ok.action === a.moves[0]) first++;
    if (a.moves.length > 1) { choice++; if (ok.action === a.moves[0]) choiceFirst++; }
  }
  lat.sort((x, y) => x - y);
  const pct = (x: number, d: number) => `${((100 * x) / Math.max(1, d)).toFixed(1)}%`;
  console.log(
    `${label}: n=${n} valid ${pct(valid, n)}, line 1-8 words ${pct(short, valid)} (mean ${(words / Math.max(1, valid)).toFixed(1)}), ` +
      `picks memoPolicy move ${pct(first, valid)} (${pct(choiceFirst, choice)} of ${choice} free-choice turns), p50 ${(lat[Math.floor(n / 2)]! / 1000).toFixed(2)} s`,
  );
  if (bad.length) console.log(`invalid examples: ${bad.join(" | ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
