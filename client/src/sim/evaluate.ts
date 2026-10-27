import { isWin, runBattle } from "./battle";
import { mulberry32 } from "./rng";
import { DEFAULT_PET, type ArchetypeId, type Policy, type Replay } from "./types";

// Paired-seed evaluation. A "scenario" is (enemy, seed). Both arms play the identical scenarios and get
// identical luck turn by turn (see rng.roll), so any difference comes from the policy, not from the dice.

export interface Scenario {
  enemy: ArchetypeId;
  seed: number;
}

export function makeScenarios(enemies: readonly ArchetypeId[], seeds: readonly number[]): Scenario[] {
  return enemies.flatMap((enemy) => seeds.map((seed) => ({ enemy, seed })));
}

export const seedRange = (from: number, count: number): number[] => Array.from({ length: count }, (_, i) => from + i);

export interface ArmResult {
  n: number;
  wins: number;
  winRate: number;
  meanHpLeftOnWin: number; // 0..1 of max HP; 0 when there are no wins
  meanTurns: number;
  outcomes: Record<Replay["outcome"], number>;
}

export function runArm(policy: Policy, scenarios: Scenario[]): { replays: Replay[]; result: ArmResult } {
  const replays = scenarios.map((s) => runBattle({ enemy: s.enemy, seed: s.seed }, policy));
  const winsR = replays.filter(isWin);
  const outcomes = { win: 0, loss: 0, fled: 0, escaped: 0, timeout: 0 };
  for (const r of replays) outcomes[r.outcome] += 1;
  const maxHp = DEFAULT_PET.maxHp; // the harness always uses the default pet
  return {
    replays,
    result: {
      n: replays.length,
      wins: winsR.length,
      winRate: replays.length ? winsR.length / replays.length : 0,
      meanHpLeftOnWin: winsR.length ? winsR.reduce((a, r) => a + r.myHpEnd / maxHp, 0) / winsR.length : 0,
      meanTurns: replays.length ? replays.reduce((a, r) => a + r.turns.length, 0) / replays.length : 0,
      outcomes,
    },
  };
}

export interface PairedResult {
  n: number;
  before: ArmResult;
  after: ArmResult;
  gained: number; // scenarios lost before, won after
  lost: number; // scenarios won before, lost after
  winRateDelta: number;
  ci95: [number, number]; // bootstrap over scenarios
  pValue: number; // exact two-sided sign test on the discordant pairs
  flips: { scenario: Scenario; before: Replay; after: Replay }[]; // loss -> win examples
}

export function comparePaired(before: Policy, after: Policy, scenarios: Scenario[], bootstrapSeed = 1): PairedResult {
  const a = runArm(before, scenarios);
  const b = runArm(after, scenarios);
  const diffs = scenarios.map((_, i) => Number(isWin(b.replays[i]!)) - Number(isWin(a.replays[i]!)));
  const gained = diffs.filter((d) => d > 0).length;
  const lost = diffs.filter((d) => d < 0).length;
  const flips = scenarios
    .map((scenario, i) => ({ scenario, before: a.replays[i]!, after: b.replays[i]! }))
    .filter((x) => !isWin(x.before) && isWin(x.after));
  return {
    n: scenarios.length,
    before: a.result,
    after: b.result,
    gained,
    lost,
    winRateDelta: b.result.winRate - a.result.winRate,
    ci95: bootstrapMeanCi(diffs, bootstrapSeed),
    pValue: signTestP(gained, lost),
    flips,
  };
}

export function bootstrapMeanCi(xs: number[], seed: number, resamples = 2000): [number, number] {
  if (xs.length === 0) return [0, 0];
  const rand = mulberry32(seed);
  const means: number[] = [];
  for (let r = 0; r < resamples; r++) {
    let sum = 0;
    for (let i = 0; i < xs.length; i++) sum += xs[Math.floor(rand() * xs.length)]!;
    means.push(sum / xs.length);
  }
  means.sort((x, y) => x - y);
  return [means[Math.floor(0.025 * resamples)]!, means[Math.min(resamples - 1, Math.floor(0.975 * resamples))]!];
}

// Exact two-sided binomial sign test (p = 0.5) on discordant pairs; ties carry no information.
export function signTestP(gained: number, lost: number): number {
  const n = gained + lost;
  if (n === 0) return 1;
  const k = Math.min(gained, lost);
  // Sum C(n,i) / 2^n for i <= k in log space so large n neither overflows nor turns into NaN.
  const logTerms: number[] = [];
  let logC = 0; // log C(n, 0)
  for (let i = 0; i <= k; i++) {
    logTerms.push(logC - n * Math.LN2);
    logC += Math.log((n - i) / (i + 1));
  }
  const top = Math.max(...logTerms);
  const tail = Math.exp(top) * logTerms.reduce((a, t) => a + Math.exp(t - top), 0);
  return Math.min(1, 2 * tail);
}

export const pct = (x: number, digits = 1): string => `${(100 * x).toFixed(digits)}%`;
