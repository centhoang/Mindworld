import type { Deps } from "./app";
import { PERSONA } from "./chat";
import { actualCostUsd, estimateInputTokens, worstCaseCostUsd } from "./pricing";
import { complete, UpstreamError, type Completion } from "./providers";
import { extractObject } from "./wild-memos";

// A villager watching a fight calls out once when it ends. The client asks at the start (the line must be ready the
// moment the fight ends, and the ending is not known yet), so one call writes the villager's line for each ending.
// Muse Spark Open (the default provider, Baseten), capped per UTC day (KV) and by the global ledger. Any failure
// answers 200 with no lines: the client's own lines play.

export const CHEER_NPCS = ["elder", "mo", "ama", "pip"] as const;
export type CheerNpc = (typeof CHEER_NPCS)[number];
export const CHEER_ENDS = ["win", "loss", "friends"] as const;
export type CheerEnd = (typeof CHEER_ENDS)[number];
const SPEND_PREFIX = "cheer:spend:";
export const CHEER_DAILY_USD = 1; // hard cap for this feature, per UTC day
export const CHEER_MAX_TOKENS = 900; // it reasons first, briefly
export const CHEER_QUOTA = { pool: "cheer", perClient: 80, total: 2000 };
const MAX_LINE = 90;

export interface CheerAsk {
  npc: CheerNpc;
  player: string;
  pet: string;
  foe: string; // "a wild Brute", "Mo's Ripple", "Zed's pet Bolt"
  duel: boolean;
  feel: string; // how the villager feels about the player, from its own memory ("" = no feeling yet)
}

const name = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/[^\p{L}\p{N} '-]+/gu, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";

export function parseCheerAsk(body: unknown): CheerAsk | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.npc !== "string" || !(CHEER_NPCS as readonly string[]).includes(b.npc)) return null;
  const ask = { npc: b.npc as CheerNpc, player: name(b.player, 16), pet: name(b.pet, 16), foe: name(b.foe, 32), duel: b.duel === true, feel: name(b.feel, 40) };
  return ask.player && ask.pet && ask.foe ? ask : null;
}

// A line for each ending, cleaned; win and loss are needed, friends falls back to win.
export function validateCheer(input: unknown): Record<CheerEnd, string> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const o = input as Record<string, unknown>;
  const line = (v: unknown) => (typeof v === "string" ? v.replace(/https?:\/\/\S+/g, "").replace(/[^\p{L}\p{N} ,.!?'-]+/gu, "").replace(/\s+/g, " ").trim() : "");
  const ok = (s: string) => s.length >= 3 && s.length <= MAX_LINE;
  const win = line(o.win), loss = line(o.loss), friends = line(o.friends);
  if (!ok(win) || !ok(loss)) return null;
  return { win, loss, friends: ok(friends) ? friends : win };
}

export const CHEER_SYSTEM =
  "You play a villager in a cozy pixel-art village game, watching a friendly pet fight. Reply with JSON only, no prose. " +
  "Think briefly. Lines are spoken aloud: plain text, no emoji, no quotes, no stage directions.";

export function cheerPrompt(a: CheerAsk): string {
  return [
    PERSONA[a.npc],
    `You are standing nearby, watching ${a.player}'s pet ${a.pet} fight ${a.foe}${a.duel ? " in a friendly duel" : " in the meadow"}.`,
    a.feel ? `How you feel about ${a.player}: ${a.feel}.` : "",
    `Write what you call out to ${a.player} the moment the fight ends, one line for each ending, each under 14 words, in your own voice.`,
    `"win" = ${a.pet} won, "loss" = ${a.pet} lost, "friends" = the two pets made friends instead of fighting on. Never use your own name.`,
    'Reply {"win": "...", "loss": "...", "friends": "..."}.',
  ].filter(Boolean).join("\n");
}

const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10);

export interface CheerReply {
  lines: Partial<Record<CheerEnd, string>>;
  source: "model" | "none";
  model?: string;
  why?: string;
  costUsd?: number;
}

export async function cheerLines(a: CheerAsk, deps: Deps, clientKey: string): Promise<CheerReply> {
  const none = (why: string, costUsd = 0): CheerReply => ({ lines: {}, source: "none", why, ...(costUsd ? { costUsd } : {}) });
  const { cfg } = deps;
  const provider = cfg.defaultProvider;
  const configured = !!cfg.providers[provider].apiKey && (provider !== "modal" && provider !== "glimmer" || !!cfg.providers[provider].baseUrl);
  if (!cfg.mock && !configured) return none("unconfigured");
  const prompt = cheerPrompt(a);
  const worst = cfg.mock ? 0 : worstCaseCostUsd(provider, estimateInputTokens(CHEER_SYSTEM + prompt), CHEER_MAX_TOKENS);
  const spendKey = SPEND_PREFIX + dayOf(deps.now());
  const spent = Number((await deps.ghosts.get(spendKey)) ?? "0") || 0;
  if (spent + worst > CHEER_DAILY_USD) return none("job_cap");
  const id = deps.newId();
  const reserved = await deps.spend.reserve({ id, provider, worstCaseUsd: worst, clientKey, quota: CHEER_QUOTA });
  if (!reserved.ok) return none(reserved.reason);
  await deps.ghosts.put(spendKey, String(spent + worst), { expirationTtl: 3 * 86400 });

  let completion: Completion;
  try {
    completion = cfg.mock
      ? { text: JSON.stringify({ win: `Well done, ${a.pet}!`, loss: `Chin up, ${a.player}.`, friends: "New friends!" }), truncated: false, model: "mock", usage: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 } }
      : await complete(provider, cfg.providers, { system: CHEER_SYSTEM, prompt, maxTokens: CHEER_MAX_TOKENS, effort: "low" }, deps.fetch);
  } catch (e) {
    if (e instanceof UpstreamError) {
      await deps.spend.release(id);
      await deps.ghosts.put(spendKey, String(spent), { expirationTtl: 3 * 86400 });
    } else await deps.spend.settle(id, worst);
    return none("upstream");
  }
  const costUsd = cfg.mock ? 0 : actualCostUsd(provider, completion.usage);
  await deps.spend.settle(id, costUsd);
  await deps.ghosts.put(spendKey, String(spent + costUsd), { expirationTtl: 3 * 86400 });
  if (completion.truncated) return none("truncated", costUsd);
  const lines = validateCheer(extractObject(completion.text));
  if (!lines) return none("invalid", costUsd);
  return { lines, source: "model", model: completion.model, costUsd };
}
