import type { Deps } from "./app";
import { actualCostUsd, estimateInputTokens, worstCaseCostUsd } from "./pricing";
import { complete, UpstreamError, type Completion } from "./providers";
import { extractObject } from "./wild-memos";

// Villagers talking to each other, from the cloud with their memories (P5d). One call writes a whole short talk
// between two villagers, or an evening campfire story (one villager tells the others, and the players sitting with
// them, about something that really happened, from its notes). The client asks only while a player is close enough
// to hear; it sends each villager's notes (memories, feelings), the place and the time, and which villagers its own
// machine may speak for. Muse Spark Open (the default provider, Baseten), capped per UTC day (KV) and by the global
// ledger. Any failure answers 200 with no lines: the client's local model or scripted lines play instead.

export const BANTER_NPCS = ["elder", "mo", "ama", "pip"] as const;
export type BanterNpc = (typeof BANTER_NPCS)[number];
export type BanterKind = "chat" | "story";
const SPEND_PREFIX = "banter:spend:";
export const BANTER_DAILY_USD = 1; // hard cap for this feature, per UTC day
export const BANTER_MAX_TOKENS = 1100; // it reasons first, briefly
export const BANTER_QUOTA = { pool: "banter", perClient: 150, total: 3000 };
export const BANTER_MAX_LINES = 5;
export const BANTER_LINE_MAX = 80; // the room's SAY_MAX
const NOTE_MAX = 600;
const SAID_MAX = 6;

// Who each villager is, in a few words (the client only names them).
export const CARD: Record<BanterNpc, { name: string; card: string }> = {
  elder: { name: "Elder", card: "the oldest villager, an herb gardener: gentle, wise, a little slow, full of practical tips about pets" },
  mo: { name: "Mo", card: "the fisher: calm, curious and patient; fishes at dawn, whittles, says few words" },
  ama: { name: "Ama", card: "the cook at the market: tidy, generous and chatty; feeds everyone and loves a party" },
  pip: { name: "Pip", card: "the village kid and wood-cutter: playful, loud and curious; loves soccer and dancing" },
};

export interface BanterAsk {
  kind: BanterKind;
  who: BanterNpc[]; // the villagers in the talk; the first one opens it (a chat) or tells the story
  speak: BanterNpc[]; // the ones this machine speaks for; only they get lines
  notes: Partial<Record<BanterNpc, string>>;
  listeners: string[]; // players sitting with them (a story) or standing close
  place: string;
  time: string; // "19:40, evening"
  said: string[]; // the talk so far, "Mo: ..."
  lines: number;
}

const clean = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/https?:\/\/\S+/g, "").replace(/[^\p{L}\p{N} ,.:;!?'"()-]+/gu, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
const name = (v: unknown): string => (typeof v === "string" ? v.replace(/[^\p{L}\p{N} '-]+/gu, " ").replace(/\s+/g, " ").trim().slice(0, 16) : "");
const isNpc = (v: unknown): v is BanterNpc => typeof v === "string" && (BANTER_NPCS as readonly string[]).includes(v);

export function parseBanterAsk(body: unknown): BanterAsk | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (b.kind !== "chat" && b.kind !== "story") return null;
  const who = Array.isArray(b.who) ? [...new Set(b.who.filter(isNpc))].slice(0, 4) : [];
  const speak = Array.isArray(b.speak) ? [...new Set(b.speak.filter(isNpc))].filter((n) => who.includes(n)) : [];
  const listeners = Array.isArray(b.listeners) ? [...new Set(b.listeners.map(name).filter(Boolean))].slice(0, 4) : [];
  if (!speak.length || (b.kind === "chat" && who.length < 2) || (b.kind === "story" && who.length + listeners.length < 2)) return null;
  const rawNotes = b.notes && typeof b.notes === "object" && !Array.isArray(b.notes) ? (b.notes as Record<string, unknown>) : {};
  const notes: BanterAsk["notes"] = {};
  for (const n of who) {
    const t = clean(rawNotes[n], NOTE_MAX);
    if (t) notes[n] = t;
  }
  const said = Array.isArray(b.said) ? b.said.map((s) => clean(s, 120)).filter(Boolean).slice(-SAID_MAX) : [];
  const lines = Math.max(1, Math.min(BANTER_MAX_LINES, Math.round(Number(b.lines) || 1)));
  return { kind: b.kind, who, speak, notes, listeners, place: clean(b.place, 40) || "the village", time: clean(b.time, 40), said, lines };
}

// The talk's lines, cleaned: only villagers this machine speaks for, a leading "Name:" dropped, room-sized.
export function validateBanter(input: unknown, a: BanterAsk): { who: BanterNpc; text: string }[] | null {
  const raw = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>).lines : null;
  if (!Array.isArray(raw)) return null;
  const byName = new Map(a.who.flatMap((n) => [[n, n], [CARD[n].name.toLowerCase(), n]] as [string, BanterNpc][]));
  const out: { who: BanterNpc; text: string }[] = [];
  for (const l of raw) {
    if (!l || typeof l !== "object") continue;
    const r = l as Record<string, unknown>;
    const who = typeof r.who === "string" ? byName.get(r.who.trim().toLowerCase()) : undefined;
    if (!who || !a.speak.includes(who)) continue;
    let text = typeof r.text === "string" ? r.text : "";
    text = text.replace(/https?:\/\/\S+/g, "").replace(new RegExp(`^\\s*${CARD[who].name}\\s*:\\s*`, "i"), "");
    text = text.replace(/[^\p{L}\p{N} ,.!?'-]+/gu, "").replace(/\s+/g, " ").trim();
    if (text.length < 3) continue;
    if (text.length > BANTER_LINE_MAX) text = `${text.slice(0, BANTER_LINE_MAX - 3).replace(/\s+\S*$/, "")}...`;
    out.push({ who, text });
    if (out.length === a.lines) break;
  }
  return out.length ? out : null;
}

export const BANTER_SYSTEM =
  "You write what villagers say to each other in a cozy pixel-art village game. Reply with JSON only, no prose. " +
  "Think briefly. Lines are spoken aloud: plain text, no emoji, no quotes, no stage directions, each under 14 words.";

export function banterPrompt(a: BanterAsk): string {
  const names = (ns: readonly BanterNpc[]) => ns.map((n) => CARD[n].name).join(", ");
  const opener = CARD[a.who[0]!].name;
  const people = a.who.map((n) => `- ${CARD[n].name}, ${CARD[n].card}.${a.notes[n] ? ` ${CARD[n].name}'s notes: ${a.notes[n]}` : ""}`);
  const task =
    a.kind === "story"
      ? [
          `It is evening and they sit around the campfire. ${opener} tells a short campfire story about something that really happened, taken from ${opener}'s notes: name who was there and what they did, and tell it warmly, like a tale.`,
          `Write ${a.lines} line${a.lines > 1 ? "s" : ""}: ${opener} tells the story${a.speak.length > 1 ? `, then ${names(a.speak.slice(1))} react in their own voice, one line each` : ""}.`,
        ]
      : [
          `${opener} and ${names(a.who.slice(1))} meet and chat.`,
          a.said.length ? `Their talk so far:\n${a.said.join("\n")}` : "",
          `Write the next ${a.lines} line${a.lines > 1 ? "s" : ""} of their talk, taking turns${a.speak.length < a.who.length ? `; only ${names(a.speak)} speak${a.speak.length > 1 ? "" : "s"} now` : ""}.`,
          "Talk about something from their notes (a thing that happened today, a plan, how they feel about someone), not the weather. Each line answers the one before it.",
        ];
  return [
    "The villagers:",
    ...people,
    `Place: ${a.place}.${a.time ? ` Time: ${a.time}.` : ""}`,
    a.listeners.length ? `Players ${a.kind === "story" ? "sitting with them" : "standing close"}: ${a.listeners.join(", ")}. They may be named, never spoken for.` : "",
    ...task,
    "Never invent people: the only names are the villagers above and the players named. Never say a name as a greeting to yourself.",
    'Reply {"lines": [{"who": "<name>", "text": "..."}]}.',
  ].filter(Boolean).join("\n");
}

const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10);

export interface BanterReply {
  lines: { who: BanterNpc; text: string }[];
  source: "model" | "none";
  model?: string;
  why?: string;
  costUsd?: number;
}

function mockLines(a: BanterAsk): string {
  const lines = Array.from({ length: a.lines }, (_, i) => {
    const who = a.speak[i % a.speak.length]!;
    return { who: CARD[who].name, text: a.kind === "story" && i === 0 ? "Let me tell you what happened today." : `Line ${i + 1} from ${CARD[who].name}.` };
  });
  return JSON.stringify({ lines });
}

export async function banterLines(a: BanterAsk, deps: Deps, clientKey: string): Promise<BanterReply> {
  const none = (why: string, costUsd = 0): BanterReply => ({ lines: [], source: "none", why, ...(costUsd ? { costUsd } : {}) });
  const { cfg } = deps;
  const provider = cfg.defaultProvider;
  const configured = !!cfg.providers[provider].apiKey && (provider !== "modal" && provider !== "glimmer" || !!cfg.providers[provider].baseUrl);
  if (!cfg.mock && !configured) return none("unconfigured");
  const prompt = banterPrompt(a);
  const worst = cfg.mock ? 0 : worstCaseCostUsd(provider, estimateInputTokens(BANTER_SYSTEM + prompt), BANTER_MAX_TOKENS);
  const spendKey = SPEND_PREFIX + dayOf(deps.now());
  const spent = Number((await deps.ghosts.get(spendKey)) ?? "0") || 0;
  if (spent + worst > BANTER_DAILY_USD) return none("job_cap");
  const id = deps.newId();
  const reserved = await deps.spend.reserve({ id, provider, worstCaseUsd: worst, clientKey, quota: BANTER_QUOTA });
  if (!reserved.ok) return none(reserved.reason);
  await deps.ghosts.put(spendKey, String(spent + worst), { expirationTtl: 3 * 86400 });

  let completion: Completion;
  try {
    completion = cfg.mock
      ? { text: mockLines(a), truncated: false, model: "mock", usage: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 } }
      : await complete(provider, cfg.providers, { system: BANTER_SYSTEM, prompt, maxTokens: BANTER_MAX_TOKENS, effort: "low" }, deps.fetch);
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
  const lines = validateBanter(extractObject(completion.text), a);
  if (!lines) return none("invalid", costUsd);
  return { lines, source: "model", model: completion.model, costUsd };
}
