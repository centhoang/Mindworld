// The villager's cloud study of the player's memo (worker /api/rival, Muse Spark). Rules come back in the memo DSL
// and go through the client validator; the sim then rehearses them against the bundled plans (sim/rivals.ts).
// Offline, LOCAL_ONLY, or no answer in time: no rules, and the bundled plans play.
import { validateMemo, type Memo, type Rule } from "../sim/memo";
import type { RivalOwner } from "../sim/rivals";
import type { Action } from "../sim/types";
import { LOCAL_ONLY } from "./test-mode";

export interface CloudPlan {
  rules: Rule[];
  summary: string;
  source: string;
}

const WAIT_MS = 25_000; // the model reasons first (4-10 s); asked ahead, when a chat with the villager opens
const NONE: CloudPlan = { rules: [], summary: "", source: "none" };

export async function fetchRivalPlan(npc: RivalOwner, memo: Memo, moves: Record<Action, number>, fetchFn: typeof fetch = (i, o) => fetch(i, o)): Promise<CloudPlan> {
  if (LOCAL_ONLY) return NONE;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), WAIT_MS);
  try {
    const res = await fetchFn("/api/rival", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ npc, rules: memo.rules.map((r) => ({ if: r.if, do: r.do, why: "" })), moves }),
      signal: ctl.signal,
    });
    if (!res.ok) return NONE;
    const body = (await res.json()) as { rules?: unknown; summary?: unknown; source?: unknown };
    const rules = validateMemo({ rules: body.rules }).memo.rules.slice(0, 3);
    const summary = typeof body.summary === "string" ? body.summary.replace(/[^\p{L}\p{N} ,.!?'-]+/gu, "").slice(0, 80) : "";
    return { rules, summary, source: typeof body.source === "string" ? body.source : "none" };
  } catch {
    return NONE;
  } finally {
    clearTimeout(timer);
  }
}

// One ask per (villager, memo) while it is useful: a plan that came back is kept for the session, a failed one may be
// asked again later (the Worker's quota and caps bound that).
const plans = new Map<string, Promise<CloudPlan>>();
export function rivalPlanFor(npc: RivalOwner, memo: Memo, moves: Record<Action, number>): Promise<CloudPlan> {
  const key = `${npc}:${JSON.stringify(memo.rules.map((r) => [r.if, r.do]))}`;
  const known = plans.get(key);
  if (known) return known;
  const p = fetchRivalPlan(npc, memo, moves).then((plan) => {
    if (!plan.rules.length) plans.delete(key);
    return plan;
  });
  plans.set(key, p);
  return p;
}
