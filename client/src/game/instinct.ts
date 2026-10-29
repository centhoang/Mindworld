import { describeRule, ruleMatches, type Memo } from "../sim/memo";
import { baselinePolicy } from "../sim/policy";
import { ACTIONS, type Action, type Observation } from "../sim/types";
import { grammarFor } from "./grammar";

// The live Instinct = guarded chooser. The memo rules (and a few reflex sanity checks) compute the set of
// allowed moves; an optional local model picks among them by personality and writes a one-line voice.
// The first allowed move is always what the deterministic memoPolicy would play, so "rules-only" mode
// (no model, timeout, invalid reply, lost GPU) plays exactly the policy the eval harness measures.

export interface Allowed {
  moves: Action[]; // moves[0] = memoPolicy's move
  rule: number | null; // index of the memo rule that fired, if any
}

export function allowedMoves(memo: Memo, o: Observation): Allowed {
  const rule = memo.rules.findIndex((r) => ruleMatches(r, o));
  if (rule >= 0) return { moves: [memo.rules[rule]!.do], rule }; // a coached rule binds: the model only voices it
  const base = baselinePolicy(o);
  const extra: Action[] = [];
  if (o.myHpPct >= 25) extra.push("attack");
  if (o.intent === "heavy") extra.push("guard");
  if (o.intent === "guarding" || o.intent === "calm") extra.push("emote");
  if (o.enemyHpPct < 40 || o.intent === "calm" || o.intent === "scared") extra.push("befriend");
  return { moves: [...new Set([base, ...extra])], rule: null };
}

export interface VoiceReply {
  action: string;
  line: string;
}

// A local-model backend (WebLLM in the tab, or a native llama.cpp server on this machine).
export interface VoiceBackend {
  readonly label: string;
  readonly timeoutMs?: number;
  ready(): boolean;
  pick(prompt: VoicePrompt, signal: AbortSignal): Promise<VoiceReply>;
}

export interface VoicePrompt {
  system: string;
  user: string;
  grammar: string;
  moves: Action[];
}

export interface Choice {
  action: Action;
  line: string;
  source: "rule" | "model" | "reflex";
  rule: number | null;
  ms: number;
  note?: string; // why the model was not used, when it was not
}

export const PERSONALITY = "curious, a little cheeky, loyal to its coach";

export function buildVoicePrompt(petName: string, memo: Memo, o: Observation, a: Allowed): VoicePrompt {
  const system =
    `You are ${petName}, a small pet in a turn-based duel (${PERSONALITY}). ` +
    `Pick one of the allowed moves and say a short line (max 8 words) in character. Format: move: line`;
  const coached = a.rule !== null ? `Coach's rule: ${describeRule(memo.rules[a.rule]!)}\n` : "";
  const user =
    `${coached}Your HP ${o.myHpPct}%. Enemy ${o.enemy} (${o.size}), HP ${o.enemyHpPct}%, ${o.intent}. ` +
    `Allowed: ${a.moves.join(", ")}.`;
  return { system, user, grammar: grammarFor("strict", a.moves)!, moves: a.moves };
}

export const CANNED: Record<Action, string[]> = {
  attack: ["Hyaa!", "Take that!", "My turn!"],
  guard: ["Not today!", "Shields up!", "Bracing..."],
  flee: ["Nope, nope, nope!", "Tactical retreat!"],
  emote: ["*wiggles*", "Look how cute I am!", "*happy hop*"],
  befriend: ["Friends?", "Let's be pals!", "Truce?"],
};
export const cannedLine = (a: Action, turn: number): string => CANNED[a][turn % CANNED[a].length]!;

export function parseVoice(r: VoiceReply, allowed: Action[]): { action: Action; line: string } | null {
  const action = r.action.trim().toLowerCase();
  if (!(ACTIONS as readonly string[]).includes(action) || !allowed.includes(action as Action)) return null;
  const line = r.line.replace(/[\x00-\x1f\x7f]+/g, " ").trim().slice(0, 80);
  return { action: action as Action, line };
}

// Split "guard: Not today!" into move and line.
export function splitReply(text: string): VoiceReply {
  const i = text.indexOf(":");
  return i < 0 ? { action: text, line: "" } : { action: text.slice(0, i), line: text.slice(i + 1) };
}

export class Instinct {
  constructor(public voice: VoiceBackend | null, private readonly timeoutMs = 1500) {}

  async decide(petName: string, memo: Memo, o: Observation): Promise<Choice> {
    const t0 = performance.now();
    const a = allowedMoves(memo, o);
    const fallback = (note?: string): Choice => ({
      action: a.moves[0]!,
      line: cannedLine(a.moves[0]!, o.turn),
      source: a.rule !== null ? "rule" : "reflex",
      rule: a.rule,
      ms: performance.now() - t0,
      note,
    });
    if (!this.voice || !this.voice.ready()) return fallback(this.voice ? "model loading" : undefined);
    // A firing memo rule decides at once (it is the measured policy); the model only fills the gaps, so turns stay snappy.
    if (a.rule !== null) return fallback();
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), this.voice.timeoutMs ?? this.timeoutMs);
    try {
      const reply = await this.voice.pick(buildVoicePrompt(petName, memo, o, a), ctl.signal);
      const ok = parseVoice(reply, a.moves);
      if (!ok) return fallback("invalid model reply");
      return { ...ok, line: ok.line || cannedLine(ok.action, o.turn), source: a.rule !== null ? "rule" : "model", rule: a.rule, ms: performance.now() - t0 };
    } catch (e) {
      return fallback(ctl.signal.aborted ? "model timeout" : `model error: ${(e as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }
}
