import type { Action } from "../sim/types";
import { splitReply, type VoiceReply } from "./instinct";

// WebLLM's xgrammar may reject the `{1,60}` repetition in the voice grammar. The browser voice walks down these
// tiers on a grammar error: strict grammar, then a plain `+` line with a token cap, then no grammar at all with
// the reply validated and clipped here. Tiers are pure so they can be tested without a GPU.

export type GrammarTier = "strict" | "simple" | "none";
export const TIERS: readonly GrammarTier[] = ["strict", "simple", "none"];
export const LINE_MAX = 60;

const moveRule = (moves: readonly Action[]) => `move ::= ${moves.map((m) => `"${m}"`).join(" | ")}`;

// The grammar for a tier, or null for "none".
export function grammarFor(tier: GrammarTier, moves: readonly Action[]): string | null {
  if (tier === "none") return null;
  const line = tier === "strict" ? `[a-zA-Z ,.!?']{1,${LINE_MAX}}` : `[a-zA-Z ,.!?']+`;
  return `root ::= move ": " line\n${moveRule(moves)}\nline ::= ${line}`;
}

export const nextTier = (tier: GrammarTier): GrammarTier | null => TIERS[TIERS.indexOf(tier) + 1] ?? null;

// Heuristic: does this engine error look like a grammar compile/parse failure (vs. abort, OOM, lost device)?
export function isGrammarError(e: unknown): boolean {
  return /grammar|ebnf|gbnf|xgrammar|parse|repetition|rule/i.test(String((e as Error)?.message ?? e));
}

// For ungrammared output: find the first allowed move, keep the text after it as the line, strip to the
// grammar's character set and clip. Returns an empty action if no allowed move appears (parseVoice rejects it).
export function clipReply(text: string, moves: readonly Action[]): VoiceReply {
  const lower = text.toLowerCase();
  let best: { move: Action; at: number } | null = null;
  for (const m of moves) {
    const at = lower.search(new RegExp(`\\b${m}\\b`));
    if (at >= 0 && (!best || at < best.at)) best = { move: m, at };
  }
  if (!best) return { action: "", line: "" };
  const rest = text.slice(best.at + best.move.length).replace(/^\s*[:\-–]\s*/, "");
  const line = rest.split("\n")[0]!.replace(/[^a-zA-Z ,.!?']+/g, " ").replace(/\s+/g, " ").trim().slice(0, LINE_MAX).trim();
  return { action: best.move, line };
}

// Runs one completion, stepping down a tier whenever the engine rejects the grammar. Returns the reply and
// the tier that worked, so the caller can start there next time. Non-grammar errors (abort, lost GPU) rethrow.
export async function completeTiered(
  start: GrammarTier,
  moves: readonly Action[],
  call: (grammar: string | null, tier: GrammarTier) => Promise<string>,
): Promise<{ reply: VoiceReply; tier: GrammarTier }> {
  for (let tier: GrammarTier | null = start; tier; tier = nextTier(tier)) {
    let text: string;
    try {
      text = await call(grammarFor(tier, moves), tier);
    } catch (e) {
      if (tier !== "none" && isGrammarError(e)) continue;
      throw e;
    }
    return { reply: tier === "none" ? clipReply(text, moves) : splitReply(text), tier };
  }
  throw new Error("no grammar tier worked");
}
