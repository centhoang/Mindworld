import type { Deps } from "./app";
import { actualCostUsd, estimateInputTokens, worstCaseCostUsd, type Provider } from "./pricing";
import { complete, UpstreamError, type Completion } from "./providers";
import { extractObject } from "./wild-memos";

// The Village Gazette: once per game day, the client that hosts the villagers sends yesterday's real events (what the
// villagers noted: promises kept or broken, duels, gifts, deals, things bought) and this morning's prices; Muse Spark
// 1.3 on the Meta Model API writes three headlines. Cached per (room, game day) in KV, so every player in the room
// reads the same paper and the model is asked once. Capped per UTC day (KV) and by the global ledger. Any failure
// answers 200 with no headlines: the client writes them by rules from the same events.

const PAPER_PREFIX = "gazette:paper:";
const BUSY_PREFIX = "gazette:busy:";
const SPEND_PREFIX = "gazette:spend:";
const PAPER_TTL_S = 2 * 86400;
const BUSY_TTL_S = 60; // KV's shortest expiry; a writer that crashed frees the day after this
export const GAZETTE_DAILY_USD = 1; // hard cap for this feature, per UTC day (~$0.006 a paper on live)
export const GAZETTE_MAX_TOKENS = 1500; // it reasons first, briefly
export const GAZETTE_QUOTA = { pool: "gazette", perClient: 12, total: 300 };
export const GAZETTE_MAX_EVENTS = 12;
const MAX_EVENT_CHARS = 120;
const MAX_HEADLINE_CHARS = 70;

// The game's shared clock (client/src/life/clock.ts gameTime(worldSeconds())): a game day is 12 real minutes from
// Oct 27 UTC; the 08:00 start and the 8-hour offset cancel out.
const DAY_MS = 720_000;
const EPOCH_MS = Date.UTC(2026, 9, 27);
export const gameDayAt = (nowMs: number): number => Math.floor((nowMs - EPOCH_MS) / DAY_MS);

export interface GazetteAsk {
  room: string;
  day: number; // today's game day; the paper tells of the day before
  events: string[]; // "Mo: my Ripple beat Kai's pet in a duel"; empty = only read a paper that exists
  prices: string[]; // "fish 4c"
}

const clean = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/https?:\/\/\S+|www\.\S+/gi, "").replace(/[^\p{L}\p{N} ,.:;!?'()%+-]+/gu, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";

export function parseGazetteAsk(body: unknown, nowMs: number): GazetteAsk | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.room !== "string" || !/^[a-z0-9-]{1,20}$/.test(b.room)) return null;
  if (typeof b.day !== "number" || !Number.isInteger(b.day) || Math.abs(b.day - gameDayAt(nowMs)) > 1) return null;
  const list = (v: unknown, n: number, max: number) => (Array.isArray(v) ? v.slice(0, n).map((x) => clean(x, max)).filter((x) => x.length >= 3) : []);
  return { room: b.room, day: b.day, events: list(b.events, GAZETTE_MAX_EVENTS, MAX_EVENT_CHARS), prices: list(b.prices, 8, 24) };
}

// Two or three short headlines, or null. Quotes, markdown and links are stripped; a headline must say something.
export function validateHeadlines(input: unknown): string[] | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = (input as Record<string, unknown>).headlines;
  if (!Array.isArray(raw)) return null;
  const out = raw.slice(0, 3).map((h) => clean(h, MAX_HEADLINE_CHARS + 20)).filter((h) => h.length >= 8 && h.length <= MAX_HEADLINE_CHARS);
  return out.length >= 2 ? out : null;
}

export const GAZETTE_SYSTEM =
  "You write the Village Gazette, the front page of a cozy pixel-art village game. Reply with JSON only, no prose. " +
  "Think briefly. Every headline must come from the notes you are given: never invent a person, pet, place or event.";

export function gazettePrompt(a: GazetteAsk): string {
  return [
    `Yesterday (day ${a.day - 1}) in the village, from the villagers' own notes. Each line is "Villager: what they noted",`,
    'in their own words, so "I" and "my" mean that villager:',
    ...a.events.map((e) => `- ${e}`),
    a.prices.length ? `Market prices this morning: ${a.prices.join(", ")}.` : "",
    "",
    "Write exactly 3 front-page headlines about the most interesting of these real events, the biggest story first.",
    `Each one at most ${MAX_HEADLINE_CHARS - 10} characters, warm and a little playful, in the third person, with the names from the notes.`,
    "A broken promise or a lost duel is news too: tell it kindly. Use the prices only if the notes are thin.",
    'Reply {"headlines": ["...", "...", "..."]}.',
  ].filter((l, i, all) => l !== "" || all[i - 1] !== "").join("\n");
}

const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10);

export interface GazettePaper {
  day: number;
  headlines: string[];
  source: "model" | "cache" | "none";
  model?: string; // who wrote it: "muse-spark-1.3" on the Meta Model API
  why?: string;
  costUsd?: number;
}

function pickProvider(deps: Deps): Provider | null {
  const { cfg } = deps;
  const ok = (p: Provider) => !!cfg.providers[p].apiKey && (p !== "modal" && p !== "glimmer" || !!cfg.providers[p].baseUrl);
  if (ok("meta")) return "meta"; // the Gazette is the Meta Model API's job
  return ok(cfg.defaultProvider) ? cfg.defaultProvider : null;
}

export async function gazettePaper(a: GazetteAsk, deps: Deps, clientKey: string): Promise<GazettePaper> {
  const none = (why: string, costUsd = 0): GazettePaper => ({ day: a.day, headlines: [], source: "none", why, ...(costUsd ? { costUsd } : {}) });
  const paperKey = `${PAPER_PREFIX}${a.room}:${a.day}`;
  const cached = JSON.parse((await deps.ghosts.get(paperKey)) ?? "null") as { headlines?: unknown; model?: unknown } | null;
  const kept = cached && validateHeadlines(cached);
  if (kept) return { day: a.day, headlines: kept, source: "cache", ...(typeof cached.model === "string" ? { model: cached.model } : {}) };
  if (!a.events.length) return none("empty"); // a reader with nothing to tell: the host's client writes the paper

  const { cfg } = deps;
  const provider = pickProvider(deps);
  if (!cfg.mock && !provider) return none("unconfigured");
  const busyKey = `${BUSY_PREFIX}${a.room}:${a.day}`;
  if (await deps.ghosts.get(busyKey)) return none("busy");
  const prompt = gazettePrompt(a);
  const worst = cfg.mock || !provider ? 0 : worstCaseCostUsd(provider, estimateInputTokens(GAZETTE_SYSTEM + prompt), GAZETTE_MAX_TOKENS);
  const spendKey = SPEND_PREFIX + dayOf(deps.now());
  const spent = Number((await deps.ghosts.get(spendKey)) ?? "0") || 0;
  if (spent + worst > GAZETTE_DAILY_USD) return none("job_cap");
  const id = deps.newId();
  const reserved = await deps.spend.reserve({ id, provider: provider ?? cfg.defaultProvider, worstCaseUsd: worst, clientKey, quota: GAZETTE_QUOTA });
  if (!reserved.ok) return none(reserved.reason);
  await deps.ghosts.put(busyKey, "1", { expirationTtl: BUSY_TTL_S });
  // Book the worst case before the call so a crash mid-call cannot overspend the job cap.
  await deps.ghosts.put(spendKey, String(spent + worst), { expirationTtl: 3 * 86400 });

  let completion: Completion;
  try {
    completion = cfg.mock || !provider
      ? { text: JSON.stringify({ headlines: mockHeadlines(a) }), truncated: false, model: "mock", usage: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 } }
      : await complete(provider, cfg.providers, { system: GAZETTE_SYSTEM, prompt, maxTokens: GAZETTE_MAX_TOKENS, effort: "low" }, deps.fetch);
  } catch (e) {
    if (e instanceof UpstreamError) {
      await deps.spend.release(id);
      await deps.ghosts.put(spendKey, String(spent), { expirationTtl: 3 * 86400 });
    } else await deps.spend.settle(id, worst); // may have been billed: keep the worst case booked
    return none("upstream");
  }
  const costUsd = cfg.mock || !provider ? 0 : actualCostUsd(provider, completion.usage);
  await deps.spend.settle(id, costUsd);
  await deps.ghosts.put(spendKey, String(spent + costUsd), { expirationTtl: 3 * 86400 });
  if (completion.truncated) return none("truncated", costUsd);
  const headlines = validateHeadlines(extractObject(completion.text));
  if (!headlines) return none("invalid", costUsd);
  await deps.ghosts.put(paperKey, JSON.stringify({ headlines, model: completion.model }), { expirationTtl: PAPER_TTL_S });
  return { day: a.day, headlines, source: "model", model: completion.model, costUsd };
}

// Mock mode (tests, local dev without keys): the notes themselves, trimmed.
function mockHeadlines(a: GazetteAsk): string[] {
  const out = a.events.slice(0, 3).map((e) => `Village notes: ${e}`.slice(0, MAX_HEADLINE_CHARS));
  while (out.length < 3) out.push(a.prices.length ? `Market today: ${a.prices.slice(0, 3).join(", ")}`.slice(0, MAX_HEADLINE_CHARS) : "A quiet day in the village");
  return out;
}
