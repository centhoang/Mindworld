import { ACTIONS, ARCHETYPES, INTENTS, SIZES, type Action, type ArchetypeId, type Intent, type Observation, type Size } from "./types";

// The memo is the Cortex's output and the Instinct's input: a few if-then rules the pet follows.
// It stays a small closed DSL so the Cortex's JSON can be validated, rendered into the local model's
// prompt, and also executed directly by the deterministic proxy policy that the eval harness replays.

export type Cond =
  | { k: "enemy"; is: ArchetypeId }
  | { k: "intent"; is: Intent }
  | { k: "size"; is: Size }
  | { k: "last"; is: Action }
  | { k: "myHp" | "enemyHp" | "turn"; op: "<" | ">="; n: number };

export interface Rule {
  if: Cond[];
  do: Action;
  why: string;
}

export interface Memo {
  summary: string;
  rules: Rule[];
}

export const EMPTY_MEMO: Memo = { summary: "", rules: [] };
export const MAX_RULES = 8;
export const MAX_CONDS = 3;

const isOneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === "string" && (list as readonly string[]).includes(v);

function parseCond(c: unknown): Cond | null {
  if (!c || typeof c !== "object") return null;
  const o = c as Record<string, unknown>;
  switch (o.k) {
    case "enemy": return isOneOf(ARCHETYPES, o.is) ? { k: "enemy", is: o.is } : null;
    case "intent": return isOneOf(INTENTS, o.is) ? { k: "intent", is: o.is } : null;
    case "size": return isOneOf(SIZES, o.is) ? { k: "size", is: o.is } : null;
    case "last": return isOneOf(ACTIONS, o.is) ? { k: "last", is: o.is } : null;
    case "myHp":
    case "enemyHp":
    case "turn":
      return (o.op === "<" || o.op === ">=") && typeof o.n === "number" && Number.isFinite(o.n)
        ? { k: o.k, op: o.op, n: Math.max(-1000, Math.min(1000, o.n)) } // never rounded: 2.4 must not become 2
        : null;
    default: return null;
  }
}

// Model text ends up inside the Instinct prompt, so keep it to one plain line: no newlines or control characters.
const oneLine = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/[\x00-\x1f\x7f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";

export interface ValidatedMemo {
  memo: Memo;
  dropped: string[]; // human-readable reasons for rules or fields that were discarded
}

// Accepts anything the Cortex produced and keeps only what is valid. Never throws.
export function validateMemo(input: unknown): ValidatedMemo {
  const dropped: string[] = [];
  if (!input || typeof input !== "object") return { memo: EMPTY_MEMO, dropped: ["not an object"] };
  const o = input as Record<string, unknown>;
  const rules: Rule[] = [];
  const seen = new Set<string>();
  if (!Array.isArray(o.rules)) dropped.push("rules is missing or not an array");
  for (const [i, r] of (Array.isArray(o.rules) ? o.rules : []).entries()) {
    const raw = r as Record<string, unknown> | null;
    const conds = Array.isArray(raw?.if) ? (raw!.if as unknown[]).map(parseCond) : [];
    if (!raw || !isOneOf(ACTIONS, raw.do)) { dropped.push(`rule ${i}: bad action`); continue; }
    if (conds.length === 0 || conds.length > MAX_CONDS || conds.some((c) => c === null)) { dropped.push(`rule ${i}: bad conditions`); continue; }
    const rule: Rule = { if: conds as Cond[], do: raw.do, why: oneLine(raw.why, 120) };
    const key = JSON.stringify([rule.if, rule.do]);
    if (seen.has(key)) { dropped.push(`rule ${i}: duplicate`); continue; }
    if (rules.length >= MAX_RULES) { dropped.push(`rule ${i}: over the ${MAX_RULES}-rule limit`); continue; }
    seen.add(key);
    rules.push(rule);
  }
  const summary = oneLine(o.summary, 200);
  return { memo: { summary, rules }, dropped };
}

// The model may wrap JSON in prose or code fences; take the outermost object.
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function condMatches(c: Cond, o: Observation): boolean {
  switch (c.k) {
    case "enemy": return o.enemy === c.is;
    case "intent": return o.intent === c.is;
    case "size": return o.size === c.is;
    case "last": return o.last === c.is;
    case "myHp": return c.op === "<" ? o.myHpPct < c.n : o.myHpPct >= c.n;
    case "enemyHp": return c.op === "<" ? o.enemyHpPct < c.n : o.enemyHpPct >= c.n;
    case "turn": return c.op === "<" ? o.turn < c.n : o.turn >= c.n;
  }
}

export const ruleMatches = (r: Rule, o: Observation): boolean => r.if.every((c) => condMatches(c, o));

const INTENT_TEXT: Record<Intent, string> = {
  idle: "the enemy shows nothing special",
  heavy: "the enemy is winding up a heavy hit",
  guarding: "the enemy is guarding",
  calm: "the enemy looks calm",
  scared: "the enemy is hurt and scared",
};

export function describeCond(c: Cond): string {
  switch (c.k) {
    case "enemy": return `the enemy is a ${c.is}`;
    case "intent": return INTENT_TEXT[c.is];
    case "size": return `the enemy is ${c.is} than you`;
    case "last": return `your last move was ${c.is}`;
    case "myHp": return `your HP is ${c.op === "<" ? "below" : "at least"} ${c.n}%`;
    case "enemyHp": return `the enemy's HP is ${c.op === "<" ? "below" : "at least"} ${c.n}%`;
    case "turn": return c.op === "<" ? `it is before turn ${c.n}` : `it is turn ${c.n} or later`;
  }
}

export const describeRule = (r: Rule): string => `When ${r.if.map(describeCond).join(" and ")}: ${r.do}.${r.why ? ` (${r.why})` : ""}`;

// Text injected into the Instinct prompt (same wording the spike B memo prompts used).
export function renderMemo(m: Memo): string {
  if (m.rules.length === 0) return "none";
  return m.rules.map((r, i) => `${i + 1}. ${describeRule(r)}`).join("\n");
}

export const memoSize = (m: Memo): number => m.rules.length;
