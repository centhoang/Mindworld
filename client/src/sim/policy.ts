import { ruleMatches, type Memo } from "./memo";
import type { Action, Observation, Policy } from "./types";

// The pet with no coaching: brave, simple, and runs when badly hurt. This is both the fallback when a
// local-model reply is invalid and the "uncoached" arm of every comparison.
export const baselinePolicy: Policy = (o) => (o.myHpPct < 25 ? "flee" : "attack");

// Deterministic proxy for the local-model Instinct: obey the first matching memo rule, else act as the
// baseline. The live Instinct (a small model reading the same rules as text) is measured separately and
// its numbers are reported as such; this proxy is what lets the harness run thousands of paired seeds.
export function memoPolicy(memo: Memo, fallback: Policy = baselinePolicy): Policy {
  return (o: Observation): Action => {
    const rule = memo.rules.find((r) => ruleMatches(r, o));
    return rule ? rule.do : fallback(o);
  };
}
