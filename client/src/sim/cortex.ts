import { MAX_RULES, describeRule, extractJson, ruleMatches, validateMemo, type Memo, type Rule } from "./memo";
import { ACTIONS, ARCHETYPES, INTENTS, SIZES, type Replay } from "./types";

// The Cortex turns replays (and the player's plain-language teaching) into a memo. The live implementation
// calls a Meta model through the Worker proxy; ScriptedCortex is a deterministic offline double for tests,
// dev without keys, and the "budget exhausted" fallback. Results say which one produced them.

export type CortexSource = "muse-spark-open" | "muse-spark" | "local-llama" | "scripted";

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
  "Guard and emote only buy time: a rule that guards or emotes turn after turn stalls the fight into a loss or draw. Every enemy needs a path to a win (attack it down, then befriend).",
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

// One line per enemy instead of turn logs: turn logs made the reasoning model re-simulate every fight and
// run past its output budget. Each line has the record, how fights ended, and in the fights it did not win,
// the (enemy intent -> pet move) situations that cost the most HP, tagged with the memo rule that chose it.
export function summarizeFights(memo: Memo, replays: Replay[]): string {
  const lines: string[] = [];
  for (const enemy of ARCHETYPES) {
    const rs = replays.filter((r) => r.enemy === enemy);
    if (rs.length === 0) continue;
    const ends = new Map<string, number>();
    for (const r of rs) ends.set(`${r.outcome}/${r.how}`, (ends.get(`${r.outcome}/${r.how}`) ?? 0) + 1);
    const hurt = new Map<string, { n: number; took: number }>();
    for (const r of rs) {
      if (r.outcome === "win") continue;
      for (const t of r.turns) {
        const i = memo.rules.findIndex((rule) => ruleMatches(rule, t.obs));
        const key = `intent=${t.obs.intent} -> ${t.action} [${i >= 0 ? `rule ${i + 1}` : "instinct"}]`;
        const h = hurt.get(key) ?? { n: 0, took: 0 };
        h.n += 1;
        h.took += t.taken;
        hurt.set(key, h);
      }
    }
    const wins = rs.filter((r) => r.outcome === "win").length;
    const worst = [...hurt].sort((a, b) => b[1].took - a[1].took).slice(0, 3);
    lines.push(
      `${enemy}: won ${wins}/${rs.length} (${[...ends].map(([k, n]) => `${k} ${n}`).join(", ")})` +
        (worst.length ? `; in non-wins, most HP lost on: ${worst.map(([k, h]) => `${k} ${h.n}x took ${h.took}`).join("; ")}` : ""),
    );
  }
  return lines.join("\n");
}

export function buildReflectPrompt(memo: Memo, replays: Replay[]): { system: string; prompt: string } {
  return {
    system: SYSTEM_PROMPT,
    prompt:
      `Current memo:\n${memoJson(memo)}\n\nResults of the pet's recent fights with this memo, per enemy:\n${summarizeFights(memo, replays)}\n\n` +
      "Keep every rule unless these results show it failing. Add or change at most two rules, aimed at the enemy with the fewest wins. " +
      "Do not simulate fights in detail. Return the updated memo JSON.",
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
  complete(req: { kind: "memo" | "teach"; system: string; prompt: string; maxTokens: number; provider?: "baseten" | "meta"; effort?: "low" }): Promise<LlmReply>;
}

export class CortexUnavailable extends Error {}

export class LlmCortex implements Cortex {
  // Reflect goes to Meta's Muse Spark: on the open-weights model its reasoning ran past 4000 output tokens
  // (docs/archive/SPIKES.md "Live eval"); Teach stays on the open-weights model, which handles it well and cheaper.
  constructor(
    private readonly llm: LlmClient,
    private readonly provider: "baseten" | "meta" = "baseten",
    private readonly reflectProvider: "baseten" | "meta" = "meta",
  ) {}

  reflect(memo: Memo, replays: Replay[]): Promise<CortexResult> {
    return this.run("memo", memo, buildReflectPrompt(memo, replays), this.reflectProvider, "low");
  }

  teach(memo: Memo, instruction: string): Promise<CortexResult> {
    // Low effort too: at full effort ~1 in 8 teach replies ran out of tokens while reasoning (docs/archive/SPIKES.md).
    return this.run("teach", memo, buildTeachPrompt(memo, instruction), this.provider, "low");
  }

  private async run(kind: "memo" | "teach", before: Memo, p: { system: string; prompt: string }, provider: "baseten" | "meta", effort?: "low"): Promise<CortexResult> {
    // Low reasoning effort keeps replies inside the budget (Muse Spark accepts reasoning.effort).
    const reply = await this.llm.complete({ kind, ...p, maxTokens: 4000, provider, ...(effort ? { effort } : {}) });
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

// ---------------- local coach (llama.cpp) ----------------

// JSON schema of the memo DSL. llama-server turns it into a grammar, so a small model can only emit memos
// that parse; validateMemo still runs after it (the schema cannot express "no duplicate rules").
const enumOf = (xs: readonly string[]) => ({ type: "string", enum: [...xs] });
const condSchema = (k: string, is: object) => ({ type: "object", properties: { k: { const: k }, is }, required: ["k", "is"], additionalProperties: false });
export const MEMO_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", maxLength: 160 },
    rules: {
      type: "array",
      maxItems: MAX_RULES,
      items: {
        type: "object",
        properties: {
          if: {
            type: "array",
            minItems: 1,
            maxItems: 3,
            items: {
              anyOf: [
                condSchema("enemy", enumOf(ARCHETYPES)),
                condSchema("intent", enumOf(INTENTS)),
                condSchema("size", enumOf(SIZES)),
                condSchema("last", enumOf(ACTIONS)),
                {
                  type: "object",
                  properties: { k: enumOf(["myHp", "enemyHp", "turn"]), op: enumOf(["<", ">="]), n: { type: "integer", minimum: 0, maximum: 100 } },
                  required: ["k", "op", "n"],
                  additionalProperties: false,
                },
              ],
            },
          },
          do: enumOf(ACTIONS),
          why: { type: "string", maxLength: 100 },
        },
        required: ["if", "do", "why"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "rules"],
  additionalProperties: false,
};

// A JSON-schema constrained completion from a model outside llama-server (the browser's WebLLM engine).
export type JsonCompletion = (req: { system: string; user: string; maxTokens: number; schema: object }) => Promise<{ text: string; truncated: boolean }>;

// Teach/Reflect on a local Llama, served by llama.cpp's llama-server (OpenAI-compatible endpoint) or by `complete`: free,
// offline, no key. Same prompts as the Muse Spark path, so the two can be compared on the same lessons.
export class LocalCortex implements Cortex {
  constructor(
    private readonly baseUrl = "http://127.0.0.1:8080",
    private readonly opts: { grammar?: boolean; maxTokens?: number; fetchFn?: typeof fetch; complete?: JsonCompletion } = {},
  ) {}

  reflect(memo: Memo, replays: Replay[]): Promise<CortexResult> {
    return this.run(memo, buildReflectPrompt(memo, replays));
  }

  teach(memo: Memo, instruction: string): Promise<CortexResult> {
    return this.run(memo, buildTeachPrompt(memo, instruction));
  }

  private async run(before: Memo, p: { system: string; prompt: string }): Promise<CortexResult> {
    const fetchFn = this.opts.fetchFn ?? ((...a) => fetch(...a));
    const t0 = performance.now();
    let text: string;
    let truncated: boolean;
    try {
      if (this.opts.complete) {
        ({ text, truncated } = await this.opts.complete({ system: p.system, user: p.prompt, maxTokens: this.opts.maxTokens ?? 700, schema: MEMO_JSON_SCHEMA }));
      } else {
        const res = await fetchFn(`${this.baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            messages: [
              { role: "system", content: p.system },
              { role: "user", content: p.prompt },
            ],
            temperature: 0,
            max_tokens: this.opts.maxTokens ?? 700,
            ...(this.opts.grammar === false ? {} : { json_schema: MEMO_JSON_SCHEMA }),
          }),
        });
        if (!res.ok) throw new CortexUnavailable(`llama-server HTTP ${res.status}`);
        const body = (await res.json()) as { choices?: { message?: { content?: string }; finish_reason?: string }[] };
        text = body.choices?.[0]?.message?.content ?? "";
        truncated = body.choices?.[0]?.finish_reason === "length";
      }
    } catch (e) {
      throw e instanceof CortexUnavailable ? e : new CortexUnavailable(`local coach unreachable: ${(e as Error).message}`);
    }
    const parsed = extractJson(text);
    if (parsed === null) throw new CortexUnavailable(truncated ? "reply cut off (token budget)" : "reply was not JSON");
    const { memo, dropped } = validateMemo(parsed);
    if (memo.rules.length === 0 && before.rules.length > 0 && dropped.length > 0) throw new CortexUnavailable("reply had no valid rules");
    return { memo, dropped, source: "local-llama", costUsd: 0, latencyMs: performance.now() - t0 };
  }
}

// ---------------- scripted double ----------------


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
