// The coach chain shared by the UIs: ask the coaches in order (Muse Spark via the Worker, the free local
// Llama coach, the scripted coach that always answers) and report who answered and who failed. A review
// of past fights is "gated": the new memo is only kept if it does not do worse in practice fights.

import { CortexUnavailable, type Cortex, type CortexResult, type CortexSource } from "../sim/cortex";
import type { Memo } from "../sim/memo";
import { passesGate } from "../sim/proof";

export const COACH_LABEL: Record<CortexSource, string> = {
  "muse-spark": "Muse Spark",
  "muse-spark-open": "Muse Spark (open weights)",
  "local-llama": "Llama coach (local, free)",
  scripted: "offline coach",
};

// A lesson has to be about fighting, or the model makes up rules from nothing. The prompts are frozen, so this is checked here.
const FIGHT_WORDS = /\b(attack|hit|strike|bite|punch|guard|block|defend|shield|dodge|heal|rest|befriend|friend|pal|emote|enemy|enemies|foe|opponent|hp|health|hurt|turn|weak|strong|heavy|fight|battle|wind|charge|run|flee|win|lose)/i;
export const isFightLesson = (text: string) => FIGHT_WORDS.test(text);

// Same rules in any order: new wording in a rule's "why" or the summary changes nothing in a fight.
const ruleKeys = (m: Memo) => m.rules.map((r) => JSON.stringify([r.if, r.do])).sort().join();
export const sameRules = (a: Memo, b: Memo) => ruleKeys(a) === ruleKeys(b);

export interface CoachOutcome {
  memo: Memo | null; // the memo to keep, or null when nothing changes
  unchanged?: boolean; // the coach answered with the rules the pet already has
  res: CortexResult | null;
  note: string; // what happened, for the status line
  failed: string[]; // coaches that could not answer, with the reason
}

export async function runCoach(
  chain: readonly Cortex[],
  run: (c: Cortex) => Promise<CortexResult>,
  current: Memo,
  opts: { gated?: boolean; names?: Map<Cortex, string> } = {},
): Promise<CoachOutcome> {
  const failed: string[] = [];
  let res: CortexResult | null = null;
  for (const [i, c] of chain.entries()) {
    try {
      res = await run(c);
      break;
    } catch (e) {
      if (i === chain.length - 1) return { memo: null, res: null, failed, note: `Coach failed (${(e as Error).message}). Memo unchanged.` };
      failed.push(`${opts.names?.get(c) ?? "coach"}: ${e instanceof CortexUnavailable ? e.message : "offline"}`);
    }
  }
  if (!res) return { memo: null, res: null, failed, note: "No coach answered. Memo unchanged." };
  const used = COACH_LABEL[res.source];
  const prefix = failed.length ? `${failed.join("; ")}. Used the ${used}. ` : "";
  if (sameRules(current, res.memo)) return { memo: null, unchanged: true, res, failed, note: `${prefix}The ${used} found nothing to change, so the memo stays as it was.` };
  if (opts.gated && !passesGate(current, res.memo)) {
    return { memo: null, res, failed, note: `${prefix}The revision did worse in practice fights, so your pet keeps its current memo.` };
  }
  const dropped = res.dropped.length ? ` (${res.dropped.length} invalid parts dropped)` : "";
  return { memo: res.memo, res, failed, note: `${prefix}Memo updated by the ${used}${dropped}.` };
}
