import { describeRule, extractJson, validateMemo, type Memo, type Rule } from "./memo";
import { ACTIONS, ARCHETYPES, INTENTS, SIZES, type Replay } from "./types";

// The Cortex turns replays (and the player's plain-language teaching) into a memo. The live implementation
// calls a Meta model through the Worker proxy; ScriptedCortex is a deterministic offline double for tests,
// dev without keys, and the "budget exhausted" fallback. Results say which one produced them.

export type CortexSource = "muse-spark-open" | "muse-spark" | "scripted";

export interface CortexResult {
  memo: Memo;
  dropped: string[];
  source: CortexSource;
  costUsd: number;
  latencyMs: number;
}

export interface Cortex {
  reflect(memo: Memo, replays: Replay[]): Promise<CortexResult>;
  teach(memo: Memo, instruction: string): Promise<CortexResult>;
}

export const SYSTEM_PROMPT = [
  "You coach a small pet that fights turn-based duels. You maintain the pet's MEMO: a few if-then rules it follows.",
  "Reply with ONLY one JSON object, no prose: {\"summary\": string (max 160 chars), \"rules\": Rule[]} with at most 8 rules, most important first.",
  "Rule = {\"if\": Cond[] (1-3 conditions, all must hold), \"do\": Action, \"why\": string (max 100 chars)}.",
  `Action is one of: ${ACTIONS.join(", ")}.`,
  "Cond is one of:",
  `  {\"k\":\"enemy\",\"is\":${ARCHETYPES.map((a) => `\"${a}\"`).join("|")}}`,
  `  {\"k\":\"intent\",\"is\":${INTENTS.map((a) => `\"${a}\"`).join("|")}}   (heavy = telegraphed heavy hit)`,
  `  {\"k\":\"size\",\"is\":${SIZES.map((a) => `\"${a}\"`).join("|")}}   (enemy size relative to the pet)`,
  `  {\"k\":\"last\",\"is\":Action}   (the pet's previous move)`,
  "  {\"k\":\"myHp\"|\"enemyHp\"|\"turn\",\"op\":\"<\"|\">=\",\"n\":number}   (HP in percent)",
  "Facts: guard cuts damage taken to 40%. Attacking a guarding enemy does 40% damage. Attacking is how an enemy gets hurt.",
  "Befriend ends the fight as a win. On a hurt enemy (<40% HP, it usually shows intent \"scared\") befriend almost always works at once: befriend it, never emote at it.",
  "Emote never wins by itself; it only makes a later befriend likelier on a healthy enemy, and the enemy may hit you meanwhile. Flee ends the fight without a win.",
  "Keep rules that still work, fix or drop ones the replays show are hurting, and obey the player's instruction.",
  "Keep your reasoning brief; the JSON is all that matters.",
].join("\n");

export function compactReplay(r: Replay): string {
  const head = `vs ${r.enemy} (seed ${r.seed}): ${r.outcome} by ${r.how}, pet HP left ${r.myHpEnd}`;
  const lines = r.turns.map(
    (t) => `T${t.obs.turn} me${t.obs.myHpPct}% en${t.obs.enemyHpPct}% ${t.obs.size} intent=${t.obs.intent} -> ${t.action} (dealt ${t.dealt}, took ${t.taken})`,
  );
  return [head, ...lines].join("\n");
}

const memoJson = (m: Memo) => JSON.stringify({ summary: m.summary, rules: m.rules });

export function buildReflectPrompt(memo: Memo, replays: Replay[]): { system: string; prompt: string } {
  const picked = [...replays].sort((a, b) => Number(a.outcome === "win") - Number(b.outcome === "win")).slice(0, 2); // losses first; two keep the reasoning (and the reply) inside the token budget
  return {
    system: SYSTEM_PROMPT,
    prompt:
      `Current memo:\n${memoJson(memo)}\n\nRecent fights:\n${picked.map(compactReplay).join("\n\n")}\n\n` +
      "Change at most two rules, only where these fights show a rule failing or missing; otherwise return the memo unchanged. Return the updated memo JSON.",
  };
}

export function buildTeachPrompt(memo: Memo, instruction: string): { system: string; prompt: string } {
  return {
    system: SYSTEM_PROMPT,
    prompt: `Current memo:\n${memoJson(memo)}\n\nThe player teaches: "${instruction.slice(0, 300)}"\n\nReturn the updated memo JSON that carries out this teaching.`,
  };
}

export interface LlmReply {
  text: string;
  truncated: boolean;
  model: string;
  provider: string;
  costUsd: number;
  latencyMs: number;
}

export interface LlmClient {
  complete(req: { kind: "memo" | "teach"; system: string; prompt: string; maxTokens: number; provider?: "baseten" | "meta" }): Promise<LlmReply>;
}

export class CortexUnavailable extends Error {}

export class LlmCortex implements Cortex {
  constructor(private readonly llm: LlmClient, private readonly provider: "baseten" | "meta" = "baseten") {}

  reflect(memo: Memo, replays: Replay[]): Promise<CortexResult> {
    return this.run("memo", memo, buildReflectPrompt(memo, replays));
  }

  teach(memo: Memo, instruction: string): Promise<CortexResult> {
    return this.run("teach", memo, buildTeachPrompt(memo, instruction));
  }

  private async run(kind: "memo" | "teach", before: Memo, p: { system: string; prompt: string }): Promise<CortexResult> {
    const reply = await this.llm.complete({ kind, ...p, maxTokens: 4000, provider: this.provider });
    // A mock server (LLM_MOCK=1) never coaches; let the caller fall back to the scripted coach instead.
    if (reply.model === "mock") throw new CortexUnavailable("server is in mock mode");
    const parsed = extractJson(reply.text);
    if (parsed === null) throw new CortexUnavailable(reply.truncated ? "reply cut off (token budget)" : "reply was not JSON");
    const { memo, dropped } = validateMemo(parsed);
    // An answer that kept nothing from a non-empty memo is far more likely a bad reply than an intended wipe.
    if (memo.rules.length === 0 && before.rules.length > 0 && dropped.length > 0) throw new CortexUnavailable("reply had no valid rules");
    return {
      memo,
      dropped,
      source: reply.provider === "meta" ? "muse-spark" : "muse-spark-open",
      costUsd: reply.costUsd,
      latencyMs: reply.latencyMs,
    };
  }
}

// Browser-side client for the Worker proxy. Budget/rate refusals come back with fallback:"reflex".
export class FetchLlmClient implements LlmClient {
  constructor(private readonly baseUrl = "", private readonly fetchFn: typeof fetch = (...a) => fetch(...a)) {}

  async complete(req: Parameters<LlmClient["complete"]>[0]): Promise<LlmReply> {
    const res = await this.fetchFn(`${this.baseUrl}/api/llm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new CortexUnavailable(String(body.error ?? `HTTP ${res.status}`));
    return body as unknown as LlmReply;
  }
}

// ---------------- scripted double ----------------

const MAX_RULES = 8;

function addRules(memo: Memo, fresh: Rule[], summaryNote: string): Memo {
  const rules = [...fresh];
  for (const r of memo.rules) if (!rules.some((x) => JSON.stringify([x.if, x.do]) === JSON.stringify([r.if, r.do]))) rules.push(r);
  const kept = rules.slice(0, MAX_RULES);
  const summary = [summaryNote, memo.summary].filter(Boolean).join(" ").slice(0, 200);
  return { summary, rules: kept };
}

const has = (memo: Memo, r: Rule) => memo.rules.some((x) => JSON.stringify([x.if, x.do]) === JSON.stringify([r.if, r.do]));

const R = {
  guardHeavy: { if: [{ k: "intent", is: "heavy" }], do: "guard", why: "a telegraphed heavy hit hurts; guard cuts it to 40%" } as Rule,
  emoteGuard: { if: [{ k: "intent", is: "guarding" }], do: "emote", why: "attacking a guard is wasted; calm it instead" } as Rule,
  befriendHurt: { if: [{ k: "enemyHp", op: "<", n: 40 }], do: "befriend", why: "hurt enemies are easy to befriend, ending the fight safely" } as Rule,
  palBefriend: { if: [{ k: "enemy", is: "pal" }, { k: "last", is: "emote" }], do: "befriend", why: "a calmed pal can be befriended" } as Rule,
  palEmote: { if: [{ k: "enemy", is: "pal" }], do: "emote", why: "pals calm down when you act cute" } as Rule,
};

export class ScriptedCortex implements Cortex {
  async reflect(memo: Memo, replays: Replay[]): Promise<CortexResult> {
    const fresh: Rule[] = [];
    const turns = replays.flatMap((r) => r.turns);
    if (turns.some((t) => t.enemyAct === "heavy" && t.action !== "guard" && t.taken >= 5)) fresh.push(R.guardHeavy);
    if (turns.some((t) => t.obs.intent === "guarding" && t.action === "attack")) fresh.push(R.emoteGuard);
    if (replays.some((r) => r.outcome !== "win" && r.turns.some((t) => t.obs.enemyHpPct < 40))) fresh.push(R.befriendHurt);
    if (replays.some((r) => r.enemy === "pal")) fresh.push(R.palBefriend, R.palEmote);
    const added = fresh.filter((r) => !has(memo, r));
    return this.result(addRules(memo, added, added.length ? "Learned from recent fights." : ""), "reflect");
  }

  async teach(memo: Memo, instruction: string): Promise<CortexResult> {
    const t = instruction.toLowerCase();
    const fresh: Rule[] = [];
    const why = (r: Rule): Rule => ({ ...r, why: `taught: ${instruction.slice(0, 80)}` });
    if (/heavy|wind|big hit|telegraph|bigger|big |charg/.test(t)) fresh.push(why(R.guardHeavy));
    if (/friend|befriend|hurt|weak|scared|spare/.test(t)) fresh.push(why(R.befriendHurt));
    if (/calm|emote|cute|guarding|turtle/.test(t)) fresh.push(why(R.emoteGuard));
    if (/\bpal\b|friendly/.test(t)) fresh.push(why(R.palBefriend), why(R.palEmote));
    if (/flee|run away|retreat/.test(t)) fresh.push(why({ if: [{ k: "myHp", op: "<", n: 25 }], do: "flee", why: "" }));
    return this.result(addRules(memo, fresh, fresh.length ? `Taught: "${instruction.slice(0, 60)}".` : ""), "teach");
  }

  private result(memo: Memo, _kind: string): CortexResult {
    return { memo, dropped: [], source: "scripted", costUsd: 0, latencyMs: 0 };
  }
}

export const describeMemo = (m: Memo): string[] => m.rules.map(describeRule);
