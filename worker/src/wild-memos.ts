import type { Deps } from "./app";
import { GHOST_PREFIX, loadGhost, type GhostRecord } from "./ghosts";
import { ARCHETYPES, parseGhostMemo, type GhostMemo } from "./memo-dsl";
import { actualCostUsd, estimateInputTokens, worstCaseCostUsd } from "./pricing";
import { complete, UpstreamError, type Completion } from "./providers";

// Wild-pet tactics, re-taught by Muse Spark on a schedule: the cron reads what players' shared ghosts have
// learned and asks the model for counter-tactics in the same rule DSL, written from the wild pet's side.
// Every reply is validated like a ghost memo; invalid memos are dropped and the previous ones kept.
// The client falls back to the bundled behaviour (no tactics) when nothing is stored.

export const WILD_KEYS = [...ARCHETYPES, "boss"] as const;
export type WildKey = (typeof WILD_KEYS)[number];
export const WILD_MEMOS_KEY = "wild:memos";
const SPEND_PREFIX = "wild:spend:";
export const WILD_DAILY_USD = 0.3; // hard cap for this job, per UTC day
export const WILD_MAX_TOKENS = 2000; // the model reasons first; memo JSON needs >= 1500
export const WILD_MAX_RULES = 3; // a wild pet keeps its readable pattern; tactics only add a few moves
const MAX_GHOSTS = 20;
export const WILD_QUOTA = { pool: "wild-memo", perClient: 4, total: 4 }; // one call per 6 h run

export interface WildMemos {
  version: number;
  updatedAt: number;
  source: "model" | "scripted";
  model?: string;
  memos: Partial<Record<WildKey, GhostMemo>>;
}

export async function loadWildMemos(deps: Pick<Deps, "ghosts">): Promise<WildMemos | null> {
  try {
    const raw = JSON.parse((await deps.ghosts.get(WILD_MEMOS_KEY)) ?? "null") as WildMemos | null;
    if (!raw || typeof raw !== "object" || typeof raw.memos !== "object") return null;
    return { ...raw, memos: validateMemos(raw.memos) };
  } catch {
    return null;
  }
}

// Keeps only known keys whose memo passes the DSL validator and the wild-pet limits.
export function validateMemos(input: unknown): Partial<Record<WildKey, GhostMemo>> {
  const out: Partial<Record<WildKey, GhostMemo>> = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  for (const key of WILD_KEYS) {
    const m = parseGhostMemo((input as Record<string, unknown>)[key]);
    // "enemy" and "size" describe the player's pet from the pet's side; they mean nothing to a wild pet.
    if (!m || m.rules.length === 0 || m.rules.length > WILD_MAX_RULES) continue;
    if (m.rules.some((r) => r.if.some((c) => c.k === "enemy" || c.k === "size"))) continue;
    out[key] = m;
  }
  return out;
}

export function extractObject(text: string): unknown {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try {
    return JSON.parse(text.slice(a, b + 1));
  } catch {
    return null;
  }
}

async function recentGhosts(deps: Pick<Deps, "ghosts">): Promise<GhostRecord[]> {
  const { keys } = await deps.ghosts.list({ prefix: GHOST_PREFIX, limit: MAX_GHOSTS });
  const recs = await Promise.all(keys.map((k) => loadGhost(deps.ghosts, k.name.slice(GHOST_PREFIX.length))));
  return recs.filter((r): r is GhostRecord => !!r).sort((x, y) => y.createdAt - x.createdAt);
}

// How often the players' pets use each move, and their rules in short text (for the prompt).
export function digest(ghosts: readonly GhostRecord[]): { counts: Record<string, number>; lines: string[] } {
  const counts: Record<string, number> = {};
  const lines: string[] = [];
  for (const g of ghosts) {
    for (const r of g.memo.rules) {
      counts[r.do] = (counts[r.do] ?? 0) + 1;
      const conds = r.if.map((c) => ("is" in c ? `${c.k}=${c.is}` : `${c.k}${c.op}${c.n}`)).join(" & ");
      if (lines.length < 40) lines.push(`${conds} -> ${r.do}`);
    }
  }
  return { counts, lines };
}

export const WILD_SYSTEM =
  "You design tactics for wild creatures in a cozy pet-battle game. Reply with JSON only, no prose.";

export function wildPrompt(d: ReturnType<typeof digest>): string {
  return [
    "Players' pets learned these rules (condition -> move):",
    d.lines.length ? d.lines.join("\n") : "(no shared pets yet: assume pets attack, and guard against heavy hits)",
    `Move counts: ${JSON.stringify(d.counts)}`,
    "",
    "Write counter-tactics for each wild creature, from the creature's own side, so fights stay fresh but fair.",
    `Keys: ${WILD_KEYS.join(", ")}. Each value: {"summary": "<= 12 words", "rules": [1..${WILD_MAX_RULES} rules]}.`,
    'A rule: {"if": [1..2 conditions], "do": action, "why": "<= 8 words"}.',
    "Actions: attack, guard, flee, emote, befriend. (attack right after guard = a telegraphed heavy hit.)",
    'Conditions: {"k":"intent","is":"idle|guarding|calm|scared"} = what the player pet just did;',
    '{"k":"last","is":action} = the creature\'s own last move; {"k":"myHp"|"enemyHp"|"turn","op":"<"|">=","n":number} (hp in %).',
    "Never use enemy or size conditions. Keep each creature's character: brute heavy hitter, skitter timid and fast,",
    "turtle defensive, pal friendly (emotes back when calmed), bully aggressive, boss cunning.",
    'Example: {"brute":{"summary":"Punishes turtling pets","rules":[{"if":[{"k":"intent","is":"guarding"}],"do":"guard","why":"wait out the shell"}]}}',
  ].join("\n");
}

// Free fallback: a small bundled rotation of valid tactics, chosen by what pets do most.
export function scriptedMemos(counts: Record<string, number>): Partial<Record<WildKey, GhostMemo>> {
  const guards = (counts.guard ?? 0) >= (counts.attack ?? 0);
  return validateMemos({
    brute: guards
      ? { summary: "Waits out guarding pets", rules: [{ if: [{ k: "intent", is: "guarding" }], do: "guard", why: "save strength" }] }
      : { summary: "Hits hard when hurt", rules: [{ if: [{ k: "myHp", op: "<", n: 40 }], do: "attack", why: "last stand" }] },
    turtle: { summary: "Peeks out when calmed", rules: [{ if: [{ k: "intent", is: "calm" }], do: "emote", why: "curious" }] },
    pal: { summary: "Answers kindness with kindness", rules: [{ if: [{ k: "intent", is: "calm" }], do: "emote", why: "friends" }] },
    skitter: { summary: "Bolts when cornered", rules: [{ if: [{ k: "myHp", op: "<", n: 30 }], do: "flee", why: "too scary" }] },
  });
}

const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10);

export interface CronResult {
  source: "model" | "scripted" | "kept";
  why?: string;
  keys: string[];
  costUsd: number;
}

// One run: at most one model call, capped at WILD_DAILY_USD per UTC day (KV) and by the global ledger.
export async function runWildMemos(deps: Deps): Promise<CronResult> {
  const { cfg } = deps;
  const ghosts = await recentGhosts(deps);
  const d = digest(ghosts);
  const prev = await loadWildMemos(deps);
  const store = async (memos: Partial<Record<WildKey, GhostMemo>>, source: WildMemos["source"], model?: string) => {
    const merged = { ...(prev?.memos ?? {}), ...memos };
    const rec: WildMemos = { version: (prev?.version ?? 0) + 1, updatedAt: deps.now(), source, ...(model ? { model } : {}), memos: merged };
    await deps.ghosts.put(WILD_MEMOS_KEY, JSON.stringify(rec));
  };
  const fallback = async (why: string): Promise<CronResult> => {
    if (prev && Object.keys(prev.memos).length) return { source: "kept", why, keys: Object.keys(prev.memos), costUsd: 0 };
    const memos = scriptedMemos(d.counts);
    await store(memos, "scripted");
    return { source: "scripted", why, keys: Object.keys(memos), costUsd: 0 };
  };

  const provider = cfg.defaultProvider;
  const configured = !!cfg.providers[provider].apiKey && (provider !== "modal" && provider !== "glimmer" || !!cfg.providers[provider].baseUrl);
  if (!cfg.mock && !configured) return fallback("unconfigured");
  const prompt = wildPrompt(d);
  const worst = cfg.mock ? 0 : worstCaseCostUsd(provider, estimateInputTokens(WILD_SYSTEM + prompt), WILD_MAX_TOKENS);
  const spendKey = SPEND_PREFIX + dayOf(deps.now());
  const spent = Number((await deps.ghosts.get(spendKey)) ?? "0") || 0;
  if (spent + worst > WILD_DAILY_USD) return fallback("job_cap");
  const id = deps.newId();
  const reserved = await deps.spend.reserve({ id, provider, worstCaseUsd: worst, clientKey: "cron:wild-memo", quota: WILD_QUOTA });
  if (!reserved.ok) return fallback(reserved.reason);
  // Book the worst case before the call so a crash mid-call cannot overspend the job cap.
  await deps.ghosts.put(spendKey, String(spent + worst), { expirationTtl: 3 * 86400 });

  let completion: Completion;
  try {
    completion = cfg.mock
      ? { text: JSON.stringify(scriptedMemos(d.counts)), truncated: false, model: "mock", usage: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 } }
      : await complete(provider, cfg.providers, { system: WILD_SYSTEM, prompt, maxTokens: WILD_MAX_TOKENS, effort: "low" }, deps.fetch);
  } catch (e) {
    if (e instanceof UpstreamError) {
      await deps.spend.release(id);
      await deps.ghosts.put(spendKey, String(spent), { expirationTtl: 3 * 86400 });
    } else await deps.spend.settle(id, worst); // may have been billed: keep the worst case booked
    return fallback("upstream");
  }
  const costUsd = cfg.mock ? 0 : actualCostUsd(provider, completion.usage);
  await deps.spend.settle(id, costUsd);
  await deps.ghosts.put(spendKey, String(spent + costUsd), { expirationTtl: 3 * 86400 });
  const memos = completion.truncated ? {} : validateMemos(extractObject(completion.text));
  if (Object.keys(memos).length === 0) return { ...(await fallback("invalid")), costUsd };
  await store(memos, "model", completion.model);
  return { source: "model", keys: Object.keys(memos), costUsd };
}
