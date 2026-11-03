import type { Deps } from "./app";
import { parseGhostMemo, type GhostMemo, type GhostRule } from "./memo-dsl";
import { actualCostUsd, estimateInputTokens, worstCaseCostUsd } from "./pricing";
import { complete, UpstreamError, type Completion } from "./providers";
import { extractObject } from "./wild-memos";

// A villager's pet studies the player's memo before a duel: Muse Spark writes a few counter-rules in the memo DSL,
// from the villager pet's side and in the villager's style. The client rehearses them against the player's memo in
// its sim next to its bundled counter-plans, so a bad plan only loses the vote. Cached in KV per (villager, memo),
// capped per UTC day (KV) and by the global ledger. Any failure answers 200 with no rules: the bundled plans play.

export const RIVALS = ["elder", "mo", "ama", "pip"] as const;
export type RivalOwner = (typeof RIVALS)[number];
const STYLE: Record<RivalOwner, string> = {
  elder: "Elder's pet Sage: balanced and wise, finishes a weak foe, strikes hard after a block, guards when hurt",
  mo: "Mo's pet Ripple: a patient counter-puncher, guards first, then hits back hard right after a guard",
  ama: "Ama's pet Honey: friendly but no pushover, answers kindness with kindness, blocks a bully and hits back",
  pip: "Pip's pet Zip: reckless and fast, attacks every turn and never runs",
};
const CACHE_PREFIX = "rival:plan:";
const SPEND_PREFIX = "rival:spend:";
const CACHE_TTL_S = 2 * 86400;
export const RIVAL_DAILY_USD = 1; // hard cap for this feature, per UTC day
export const RIVAL_MAX_TOKENS = 3200; // the model reasons first (~900-1300 tokens when told to keep it brief, 2400+ if not)
export const RIVAL_MAX_RULES = 3;
export const RIVAL_QUOTA = { pool: "rival", perClient: 20, total: 400 };
const MAX_MOVES = 999;

export interface RivalAsk {
  npc: RivalOwner;
  memo: GhostMemo; // the player's memo (rules only)
  moves: Record<string, number>; // what the player's pet did in its last fights
}

export function parseRivalAsk(body: unknown): RivalAsk | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.npc !== "string" || !(RIVALS as readonly string[]).includes(b.npc)) return null;
  const memo = parseGhostMemo({ summary: "", rules: b.rules });
  if (!memo) return null;
  const moves: Record<string, number> = {};
  if (b.moves && typeof b.moves === "object") {
    for (const k of ["attack", "guard", "flee", "emote", "befriend"]) {
      const n = (b.moves as Record<string, unknown>)[k];
      if (typeof n === "number" && Number.isFinite(n)) moves[k] = Math.max(0, Math.min(MAX_MOVES, Math.round(n)));
    }
  }
  return { npc: b.npc as RivalOwner, memo: { summary: "", rules: memo.rules.map((r) => ({ ...r, why: "" })) }, moves };
}

// The valid rules among the first few, none about the enemy's archetype or size (they mean nothing from the rival's
// side); a bad rule is dropped, not the plan. Null when none is left.
export function validatePlan(input: unknown): GhostMemo | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const o = input as Record<string, unknown>;
  const rules = (Array.isArray(o.rules) ? o.rules : [])
    .slice(0, RIVAL_MAX_RULES + 2)
    .map((r) => parseGhostMemo({ summary: "", rules: [r] })?.rules[0])
    .filter((r): r is GhostRule => !!r && !r.if.some((c) => c.k === "enemy" || c.k === "size"))
    .slice(0, RIVAL_MAX_RULES);
  return rules.length ? { summary: parseGhostMemo({ summary: o.summary, rules: [] })?.summary ?? "", rules } : null;
}

const ruleText = (r: GhostRule): string => `${r.if.map((c) => ("is" in c ? `${c.k}=${c.is}` : `${c.k}${c.op}${c.n}`)).join(" & ")} -> ${r.do}`;

// FNV-1a over the rules, for the cache key.
export function memoHash(m: GhostMemo): string {
  let h = 0x811c9dc5;
  for (const ch of JSON.stringify(m.rules.map((r) => [r.if, r.do]))) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

export const RIVAL_SYSTEM =
  "You coach a villager's pet for a friendly duel in a cozy pet-battle game. Reply with JSON only, no prose. " +
  "Think briefly, in a few short steps: a simulator tests your rules and keeps them only if they work, so a quick, plausible plan is best.";

export function rivalPrompt(a: RivalAsk): string {
  return [
    `You train ${STYLE[a.npc]}.`,
    "The player's pet follows these rules (condition -> move), first match wins, else it attacks (and flees below 25% HP):",
    a.memo.rules.length ? a.memo.rules.map(ruleText).join("\n") : "(no rules: it just attacks)",
    `In its last fights it used: ${JSON.stringify(a.moves)}`,
    "",
    `Write 1..${RIVAL_MAX_RULES} counter-rules for your pet that beat this player's pet but keep your pet's style.`,
    'Reply {"summary": "<= 12 words, what your pet will do, said to the player", "rules": [...]}.',
    'A rule: {"if": [1..2 conditions], "do": action, "why": "<= 8 words"}.',
    "Actions: attack, guard, flee, emote, befriend. Attack right after your own guard is a telegraphed HEAVY hit;",
    "a hit into a guard is blocked, and the blocker's next attack is a x1.5 counter.",
    'Conditions: {"k":"intent","is":"idle|guarding|calm|scared"} = what the player pet just did (idle = it attacked,',
    "calm = it emoted or befriended, scared = it is hurt or ran);",
    '{"k":"last","is":action} = your pet\'s own last move; {"k":"myHp"|"enemyHp"|"turn","op":"<"|">=","n":number} (hp in %).',
    "Never use enemy or size conditions.",
    'Example: {"summary":"Ripple will block your attacks and strike back","rules":[{"if":[{"k":"intent","is":"idle"}],"do":"guard","why":"let it swing"}]}',
  ].join("\n");
}

const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10);

export interface RivalPlan {
  rules: GhostRule[];
  summary: string;
  source: "model" | "cache" | "none";
  why?: string;
  costUsd?: number;
}

export async function rivalPlan(a: RivalAsk, deps: Deps, clientKey: string): Promise<RivalPlan> {
  const none = (why: string, costUsd = 0): RivalPlan => ({ rules: [], summary: "", source: "none", why, ...(costUsd ? { costUsd } : {}) });
  const cacheKey = `${CACHE_PREFIX}${a.npc}:${memoHash(a.memo)}`;
  const cached = validatePlan(JSON.parse((await deps.ghosts.get(cacheKey)) ?? "null"));
  if (cached) return { rules: cached.rules, summary: cached.summary, source: "cache" };

  const { cfg } = deps;
  const provider = cfg.defaultProvider;
  const configured = !!cfg.providers[provider].apiKey && (provider !== "modal" && provider !== "glimmer" || !!cfg.providers[provider].baseUrl);
  if (!cfg.mock && !configured) return none("unconfigured");
  const prompt = rivalPrompt(a);
  const worst = cfg.mock ? 0 : worstCaseCostUsd(provider, estimateInputTokens(RIVAL_SYSTEM + prompt), RIVAL_MAX_TOKENS);
  const spendKey = SPEND_PREFIX + dayOf(deps.now());
  const spent = Number((await deps.ghosts.get(spendKey)) ?? "0") || 0;
  if (spent + worst > RIVAL_DAILY_USD) return none("job_cap");
  const id = deps.newId();
  const reserved = await deps.spend.reserve({ id, provider, worstCaseUsd: worst, clientKey, quota: RIVAL_QUOTA });
  if (!reserved.ok) return none(reserved.reason);
  // Book the worst case before the call so a crash mid-call cannot overspend the job cap.
  await deps.ghosts.put(spendKey, String(spent + worst), { expirationTtl: 3 * 86400 });

  let completion: Completion;
  try {
    completion = cfg.mock
      ? { text: JSON.stringify(MOCK_PLAN[a.npc]), truncated: false, model: "mock", usage: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 } }
      : await complete(provider, cfg.providers, { system: RIVAL_SYSTEM, prompt, maxTokens: RIVAL_MAX_TOKENS, effort: "low" }, deps.fetch);
  } catch (e) {
    if (e instanceof UpstreamError) {
      await deps.spend.release(id);
      await deps.ghosts.put(spendKey, String(spent), { expirationTtl: 3 * 86400 });
    } else await deps.spend.settle(id, worst); // may have been billed: keep the worst case booked
    return none("upstream");
  }
  const costUsd = cfg.mock ? 0 : actualCostUsd(provider, completion.usage);
  await deps.spend.settle(id, costUsd);
  await deps.ghosts.put(spendKey, String(spent + costUsd), { expirationTtl: 3 * 86400 });
  if (completion.truncated) return none("truncated", costUsd);
  const plan = validatePlan(extractObject(completion.text));
  if (!plan) return none("invalid", costUsd);
  await deps.ghosts.put(cacheKey, JSON.stringify(plan), { expirationTtl: CACHE_TTL_S });
  return { rules: plan.rules, summary: plan.summary, source: "model", costUsd };
}

// Mock mode (tests, local dev without keys): one plausible plan per villager.
const MOCK_PLAN: Record<RivalOwner, GhostMemo> = {
  elder: { summary: "Sage will wait out your guard", rules: [{ if: [{ k: "intent", is: "guarding" }], do: "emote", why: "patience" }] },
  mo: { summary: "Ripple will block your attacks and strike back", rules: [{ if: [{ k: "intent", is: "idle" }], do: "guard", why: "let it swing" }] },
  ama: { summary: "Honey will be kind if you are", rules: [{ if: [{ k: "intent", is: "calm" }], do: "emote", why: "kindness back" }] },
  pip: { summary: "Zip will hit even harder", rules: [{ if: [{ k: "turn", op: ">=", n: 0 }], do: "attack", why: "go go go" }] },
};
