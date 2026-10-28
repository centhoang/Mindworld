// Server-side mirror of the client memo DSL (client/src/sim/memo.ts). Ghost memos come from untrusted
// clients, so unlike the client validator (which drops bad rules from model output) this one rejects
// the whole memo on any violation. Keep the vocabularies and limits in sync with client/src/sim/types.ts.

export const ACTIONS = ["attack", "guard", "flee", "emote", "befriend"] as const;
export const ARCHETYPES = ["brute", "skitter", "turtle", "pal", "bully"] as const;
export const INTENTS = ["idle", "heavy", "guarding", "calm", "scared"] as const;
export const SIZES = ["smaller", "similar", "bigger"] as const;
export const MAX_RULES = 8;
export const MAX_CONDS = 3;
const MAX_WHY = 120;
const MAX_SUMMARY = 200;

type Cond =
  | { k: "enemy" | "intent" | "size" | "last"; is: string }
  | { k: "myHp" | "enemyHp" | "turn"; op: "<" | ">="; n: number };

export interface GhostRule {
  if: Cond[];
  do: (typeof ACTIONS)[number];
  why: string;
}

export interface GhostMemo {
  summary: string;
  rules: GhostRule[];
}

const ENUMS: Record<string, readonly string[]> = { enemy: ARCHETYPES, intent: INTENTS, size: SIZES, last: ACTIONS };

// URLs, e-mail addresses and domain-like tokens are removed; markup characters too. Ghost text is shown
// to strangers, so it must not carry links, HTML or contact details.
const LINKISH = /(?:[a-z][a-z0-9+.-]*:\/\/\S*|www\.\S*|\S+@\S+|\S+\.(?:[a-z]{2,}|\d+)(?:[/:?#]\S*)?)/gi;
export function cleanText(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v
    .replace(/[\x00-\x1f\x7f]+/g, " ")
    .replace(LINKISH, " ")
    .replace(/[<>&"'`\\{}[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
}

function parseCond(c: unknown): Cond | null {
  if (!c || typeof c !== "object" || Array.isArray(c)) return null;
  const o = c as Record<string, unknown>;
  if (typeof o.k !== "string") return null;
  const list = Object.hasOwn(ENUMS, o.k) ? ENUMS[o.k] : undefined; // "constructor" etc. are not enums
  if (list) return typeof o.is === "string" && list.includes(o.is) ? { k: o.k as "enemy", is: o.is } : null;
  if (o.k === "myHp" || o.k === "enemyHp" || o.k === "turn") {
    return (o.op === "<" || o.op === ">=") && typeof o.n === "number" && Number.isFinite(o.n) && Math.abs(o.n) <= 1000
      ? { k: o.k, op: o.op, n: o.n }
      : null;
  }
  return null;
}

// Returns a normalized copy (only known fields, cleaned text) or null.
export function parseGhostMemo(input: unknown): GhostMemo | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const o = input as Record<string, unknown>;
  if (!Array.isArray(o.rules) || o.rules.length > MAX_RULES) return null;
  const rules: GhostRule[] = [];
  for (const r of o.rules) {
    if (!r || typeof r !== "object") return null;
    const raw = r as Record<string, unknown>;
    if (typeof raw.do !== "string" || !(ACTIONS as readonly string[]).includes(raw.do)) return null;
    if (!Array.isArray(raw.if) || raw.if.length === 0 || raw.if.length > MAX_CONDS) return null;
    const conds = raw.if.map(parseCond);
    if (conds.some((c) => c === null)) return null;
    rules.push({ if: conds as Cond[], do: raw.do as GhostRule["do"], why: cleanText(raw.why, MAX_WHY) });
  }
  return { summary: cleanText(o.summary, MAX_SUMMARY), rules };
}
