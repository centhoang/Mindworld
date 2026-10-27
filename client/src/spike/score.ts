import { ACTIONS, type Action } from "./scenarios";

export interface Parsed {
  strict: Action | null; // the whole reply is exactly one action word
  lenient: Action | null; // first action word found anywhere in the reply
}

const ACTION_WORD = new RegExp(`\\b(${ACTIONS.join("|")})\\b`);

export function parseAction(text: string): Parsed {
  const t = text.trim().toLowerCase();
  const bare = t.replace(/^[\s"'*]+|[\s"'*.!]+$/g, "");
  const strict = (ACTIONS as readonly string[]).includes(bare) ? (bare as Action) : null;
  const hit = ACTION_WORD.exec(t);
  return { strict, lenient: (hit?.[1] as Action | undefined) ?? null };
}

export interface Sample {
  kind: "plain" | "memo";
  ok: Action[];
  text: string;
  ms: number;
  prefillTps?: number;
  decodeTps?: number;
}

export interface Summary {
  n: number;
  strictValidPct: number;
  lenientValidPct: number;
  sensiblePlainPct: number; // lenient action is in the scenario's sanity set (plain scenarios)
  memoCompliancePct: number; // lenient action obeys the memo (memo scenarios)
  latencyMs: { mean: number; p50: number; p95: number; min: number; max: number };
  prefillTps: number | null;
  decodeTps: number | null;
  invalidSamples: string[];
}

const pct = (num: number, den: number) => (den === 0 ? 0 : Math.round((1000 * num) / den) / 10);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round1 = (x: number) => Math.round(x * 10) / 10;

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx]!;
}

export function summarize(samples: Sample[]): Summary {
  const parsed = samples.map((s) => ({ s, p: parseAction(s.text) }));
  const plain = parsed.filter((x) => x.s.kind === "plain");
  const memo = parsed.filter((x) => x.s.kind === "memo");
  const lat = samples.map((s) => s.ms).sort((a, b) => a - b);
  const tps = (key: "prefillTps" | "decodeTps") => {
    const xs = samples.map((s) => s[key]).filter((v): v is number => typeof v === "number");
    return xs.length ? round1(mean(xs)) : null;
  };
  return {
    n: samples.length,
    strictValidPct: pct(parsed.filter((x) => x.p.strict).length, samples.length),
    lenientValidPct: pct(parsed.filter((x) => x.p.lenient).length, samples.length),
    sensiblePlainPct: pct(plain.filter((x) => x.p.lenient && x.s.ok.includes(x.p.lenient)).length, plain.length),
    memoCompliancePct: pct(memo.filter((x) => x.p.lenient && x.s.ok.includes(x.p.lenient)).length, memo.length),
    latencyMs: {
      mean: round1(mean(lat)),
      p50: round1(percentile(lat, 50)),
      p95: round1(percentile(lat, 95)),
      min: round1(lat[0] ?? 0),
      max: round1(lat[lat.length - 1] ?? 0),
    },
    prefillTps: tps("prefillTps"),
    decodeTps: tps("decodeTps"),
    invalidSamples: parsed.filter((x) => !x.p.strict).slice(0, 5).map((x) => x.s.text.slice(0, 80)),
  };
}
