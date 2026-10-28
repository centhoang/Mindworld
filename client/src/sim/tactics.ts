import type { EnemyDef } from "./enemies";
import { ghostObservation, toEnemyAct } from "./ghost";
import { ruleMatches, validateMemo, type Memo } from "./memo";
import { ARCHETYPES, type Action, type ArchetypeId, type EnemyAct } from "./types";

// Wild-pet tactics: a few memo rules per archetype that Muse Spark re-writes every 6 h on the server
// (worker/src/wild-memos.ts) from what players' shared pets learned. A wild pet follows a matching
// tactic, otherwise its own readable pattern. Only live world fights use them; the Proof keeps the
// fixed archetypes so before/after numbers stay comparable.

export const WILD_KEYS = [...ARCHETYPES, "boss"] as const;
export type WildKey = (typeof WILD_KEYS)[number];
export const WILD_MAX_RULES = 3;
export type WildMemos = Partial<Record<WildKey, Memo>>;

// Same limits as the server; anything else is dropped (bundled default = no tactics).
export function parseWildMemos(raw: unknown): WildMemos {
  const out: WildMemos = {};
  const memos = raw && typeof raw === "object" ? (raw as { memos?: unknown }).memos : null;
  if (!memos || typeof memos !== "object") return out;
  for (const key of WILD_KEYS) {
    const v = (memos as Record<string, unknown>)[key];
    if (!v) continue;
    const { memo, dropped } = validateMemo(v);
    if (dropped.length || memo.rules.length === 0 || memo.rules.length > WILD_MAX_RULES) continue;
    if (memo.rules.some((r) => r.if.some((c) => c.k === "enemy" || c.k === "size"))) continue;
    out[key] = memo;
  }
  return out;
}

const asAction = (a: EnemyAct): Action => (a === "heavy" || a === "strike" ? "attack" : a === "guard" ? "guard" : a === "flee" ? "flee" : "emote");

// Build a fresh one per battle: it remembers the wild pet's own last move.
export function withTactics(def: EnemyDef, memo: Memo | undefined): EnemyDef {
  if (!memo || memo.rules.length === 0) return def;
  let last: Action | "none" = "none";
  return {
    ...def,
    act: (c) => {
      const o = ghostObservation(c, last, "similar");
      const rule = memo.rules.find((r) => ruleMatches(r, o));
      const act = rule ? toEnemyAct(rule.do, last) : def.act(c);
      last = rule ? rule.do : asAction(act);
      return act;
    },
  };
}

export async function fetchWildMemos(base = "", fetchFn: typeof fetch = (i, o) => fetch(i, o)): Promise<WildMemos> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 4000);
  try {
    const res = await fetchFn(`${base}/api/wild-memos`, { signal: ctl.signal });
    return res.ok ? parseWildMemos(await res.json()) : {};
  } catch {
    return {}; // offline: wild pets keep their bundled patterns
  } finally {
    clearTimeout(timer);
  }
}

export const isWildKey = (k: string): k is ArchetypeId => (ARCHETYPES as readonly string[]).includes(k);
