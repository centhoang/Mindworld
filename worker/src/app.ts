import { CHAT_MAX_TOKENS, CHAT_QUOTA, MIND_MAX_TOKENS, chatPrompt, cleanLine, cleanMind, cleanScene, isChatWho, isOpener, OpenerCache, parsePetSide, petsPrompt, scriptedLine, scriptedPair, tidyPair, tidyReply } from "./chat";
import { geoOf, isRestricted } from "./geo";
import {
  allowGhostPost,
  GHOST_MAX_BYTES,
  isGhostId,
  loadGhost,
  parseGhost,
  randomGhost,
  saveGhost,
  type GhostStore,
} from "./ghosts";
import type { ReserveRequest, ReserveResult, SpendSnapshot, RejectReason } from "./ledger";
import { LLM_KINDS, mockCompletion, type LlmKind } from "./mock";
import { actualCostUsd, estimateInputTokens, PROVIDERS, worstCaseCostUsd, type Provider } from "./pricing";
import { complete, UnreadableResponse, UpstreamError, type Completion, type ProviderConfig } from "./providers";
import { loadWildMemos } from "./wild-memos";
import { roomName } from "./room";
import { parseRivalAsk, rivalPlan } from "./rival";
import { gazettePaper, parseGazetteAsk } from "./gazette";
import { cheerLines, parseCheerAsk } from "./cheer";
import { handleMlc, type MlcDeps } from "./mlc";
import { MAX_CLIP_MS, MAX_WAV_BYTES, parseWav, transcribeCostUsd, transcribeMeta } from "./transcribe";

export interface SpendClient {
  reserve(req: ReserveRequest): Promise<ReserveResult>;
  settle(id: string, actualUsd: number): Promise<boolean>;
  release(id: string): Promise<boolean>;
  snapshot(): Promise<SpendSnapshot>;
}

export interface AppConfig {
  mock: boolean;
  defaultProvider: Provider;
  providers: ProviderConfig;
  maxOutputTokens: number;
}

export interface Deps {
  cfg: AppConfig;
  spend: SpendClient;
  ghosts: GhostStore;
  assets?: { fetch(request: Request): Promise<Response> };
  fetch(input: string, init: RequestInit): Promise<Response>;
  newId(): string;
  random(): number;
  now(): number;
  hashClient(raw: string): Promise<string>;
  room?: (name: string) => { fetch(request: Request): Promise<Response> }; // a live world room (Durable Object) by name
  chatCache?: OpenerCache; // tests pass their own; the Worker shares one per isolate
  mlc?: Omit<MlcDeps, "fetch">; // the tuned 1B weights (private repos until submission day)
}

const sharedChatCache = new OpenerCache();

const MAX_SYSTEM_CHARS = 4000;
const MAX_PROMPT_CHARS = 8000;
const MAX_BODY_CHARS = 20_000;
const MIN_OUTPUT_TOKENS = 64;
const DEFAULT_OUTPUT_TOKENS = 800;

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const fail = (status: number, error: string, extra: Record<string, unknown> = {}): Response =>
  json({ error, ...extra }, status);

function providerConfigured(providers: ProviderConfig, provider: Provider): boolean {
  return !!providers[provider].apiKey &&
    (provider !== "modal" && provider !== "glimmer" || !!providers[provider].baseUrl);
}

export async function handleRequest(request: Request, deps: Deps): Promise<Response> {
  if (isRestricted(geoOf(request))) {
    return fail(451, "region_restricted", {
      message: "This game is not available in your region (Meta Geographic Use Policy).",
    });
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (path.startsWith("/api/")) {
    if (path === "/api/health" && method === "GET") {
      const { providers, mock } = deps.cfg;
      return json({
        ok: true, mock,
        providers: {
          baseten: providerConfigured(providers, "baseten"),
          meta: providerConfigured(providers, "meta"),
          modal: providerConfigured(providers, "modal"),
          glimmer: providerConfigured(providers, "glimmer"),
        },
      });
    }
    if (path === "/api/spend" && method === "GET") return json(await deps.spend.snapshot());
    if (path === "/api/llm" && method === "POST") return handleLlm(request, deps);
    if (path === "/api/chat" && method === "POST") return handleChat(request, deps);
    if (path === "/api/petchat" && method === "POST") return handlePetChat(request, deps);
    if (path === "/api/room" && method === "GET") {
      if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") return fail(426, "expected_websocket");
      const name = roomName(url.searchParams.get("room"));
      if (!name) return fail(400, "bad_room");
      return deps.room ? deps.room(name).fetch(request) : fail(503, "no_room");
    }
    if (path === "/api/wild-memos" && method === "GET") {
      const w = await loadWildMemos(deps);
      return json(w ?? { version: 0, updatedAt: 0, source: "default", memos: {} });
    }
    if (path === "/api/rival" && method === "POST") return handleRival(request, deps);
    if (path === "/api/gazette" && method === "POST") return handleGazette(request, deps);
    if (path === "/api/cheer" && method === "POST") return handleCheer(request, deps);
    if (path === "/api/chatlog" && method === "POST") return handleChatLog(request, deps);
    if (path === "/api/transcribe" && method === "POST") return handleTranscribe(request, deps);
    if (path === "/api/ghosts" && method === "POST") return handleGhostCreate(request, deps);
    if (path === "/api/ghosts/random" && method === "GET") return handleGhostGet(await randomGhost(deps.ghosts, deps.random));
    const ghostId = /^\/api\/ghosts\/([^/]+)$/.exec(path)?.[1];
    if (ghostId && method === "GET") {
      return isGhostId(ghostId) ? handleGhostGet(await loadGhost(deps.ghosts, ghostId)) : fail(400, "bad_id");
    }
    return fail(404, "not_found");
  }

  if (path.startsWith("/mlc/")) return handleMlc(path, method, { ...deps.mlc, fetch: deps.fetch });

  // The pixel build used to live at /pixel.html; it is the main page now.
  if (path === "/pixel.html" || path === "/pixel") return Response.redirect(new URL("/", request.url).toString(), 301);
  return deps.assets ? deps.assets.fetch(request) : fail(404, "not_found");
}

// ---------- chat log ----------

// What players and villagers said, so a play-test can be read afterwards. Write-only here: reading goes through
// `wrangler kv`, so the log stays private once Access is gone. Records expire.
const CHATLOG_PREFIX = "chat:";
const CHATLOG_TTL_SECONDS = 14 * 24 * 3600;
const CHATLOG_MAX_CHARS = 1000;

async function handleChatLog(request: Request, deps: Deps): Promise<Response> {
  const b = await readJson(request, CHATLOG_MAX_CHARS) as Record<string, unknown> | undefined;
  const text = (k: string, n: number) => (typeof b?.[k] === "string" ? (b[k] as string).slice(0, n) : "");
  if (!text("npc", 16) || !text("reply", 300)) return fail(400, "bad_request");
  const row = { t: deps.now(), npc: text("npc", 16), player: text("player", 24), line: text("line", 300), reply: text("reply", 300), source: text("source", 16) };
  await deps.ghosts.put(`${CHATLOG_PREFIX}${row.t}:${deps.newId().slice(0, 8)}`, JSON.stringify(row), { expirationTtl: CHATLOG_TTL_SECONDS });
  return json({ ok: true });
}

// ---------- LLM proxy ----------

const EFFORTS = ["low", "medium", "high"] as const;

interface LlmRequest {
  effort: (typeof EFFORTS)[number] | undefined;
  provider: Provider;
  kind: LlmKind;
  system: string | undefined;
  prompt: string;
  maxTokens: number;
}

function parseLlmRequest(body: unknown, cfg: AppConfig): LlmRequest | string {
  if (!body || typeof body !== "object") return "body must be a JSON object";
  const b = body as Record<string, unknown>;
  const provider = (b.provider ?? cfg.defaultProvider) as Provider;
  if (!PROVIDERS.includes(provider)) return "unknown provider";
  if (!LLM_KINDS.includes(b.kind as LlmKind)) return "unknown kind";
  if (typeof b.prompt !== "string" || b.prompt.length === 0 || b.prompt.length > MAX_PROMPT_CHARS) return "bad prompt";
  if (b.system !== undefined && (typeof b.system !== "string" || b.system.length > MAX_SYSTEM_CHARS)) return "bad system";
  let maxTokens = DEFAULT_OUTPUT_TOKENS;
  if (b.effort !== undefined && !EFFORTS.includes(b.effort as never)) return "bad effort";
  if (b.maxTokens !== undefined) {
    if (typeof b.maxTokens !== "number" || !Number.isInteger(b.maxTokens) || b.maxTokens < MIN_OUTPUT_TOKENS) {
      return "bad maxTokens";
    }
    maxTokens = b.maxTokens;
  }
  return {
    provider,
    kind: b.kind as LlmKind,
    system: b.system as string | undefined,
    prompt: b.prompt,
    maxTokens: Math.min(maxTokens, cfg.maxOutputTokens),
    effort: b.effort as LlmRequest["effort"],
  };
}

async function readJson(request: Request, maxChars: number): Promise<unknown | undefined> {
  const text = await request.text();
  if (text.length > maxChars) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const REJECT_STATUS: Record<RejectReason, number> = {
  rate_limit: 429,
  client_cap: 429,
  duplicate: 409,
  daily_cap: 503,
  total_cap: 503,
};

async function handleLlm(request: Request, deps: Deps): Promise<Response> {
  const body = await readJson(request, MAX_BODY_CHARS);
  if (body === undefined) return fail(400, "bad_json");
  const req = parseLlmRequest(body, deps.cfg);
  if (typeof req === "string") return fail(400, "bad_request", { message: req });
  // NPC chat has its own quota and token cap; it must not be reachable through the generic proxy.
  if (req.kind === "chat") return fail(400, "bad_request", { message: "use /api/chat" });

  const { cfg } = deps;
  if (!cfg.mock && !providerConfigured(cfg.providers, req.provider)) return fail(503, "provider_unconfigured", { fallback: "reflex" });

  const reasoningLine = req.provider === "glimmer" && req.effort ? `Reasoning strength: ${req.effort}\n` : "";
  const worst = worstCaseCostUsd(req.provider, estimateInputTokens(reasoningLine + (req.system ?? "") + req.prompt), req.maxTokens);
  const id = deps.newId();
  const clientKey = await deps.hashClient(request.headers.get("cf-connecting-ip") ?? "local");
  // Mock calls cost nothing but still pass through the ledger so rate limits behave the same.
  const reserved = await deps.spend.reserve({ id, provider: req.provider, worstCaseUsd: cfg.mock ? 0 : worst, clientKey });
  if (!reserved.ok) {
    return fail(REJECT_STATUS[reserved.reason], reserved.reason === "rate_limit" ? "rate_limited" : "budget_exhausted", {
      reason: reserved.reason,
      fallback: "reflex",
    });
  }

  const started = deps.now();
  let completion: Completion;
  try {
    completion = cfg.mock
      ? mockCompletion(req.kind, req.system, req.prompt)
      : await complete(req.provider, cfg.providers, { system: req.system, prompt: req.prompt, maxTokens: req.maxTokens, ...(req.effort ? { effort: req.effort } : {}) }, deps.fetch);
  } catch (e) {
    if (e instanceof UpstreamError) {
      await deps.spend.release(id); // nothing was generated
      return fail(502, "upstream_error", { upstreamStatus: e.status, fallback: "reflex" });
    }
    // Timeout or unreadable 2xx: it may have been billed, so book the worst case instead of releasing.
    await deps.spend.settle(id, worst);
    const message = e instanceof UnreadableResponse ? e.message : "unexpected error";
    return fail(502, "upstream_unreadable", { message, fallback: "reflex" });
  }

  const costUsd = cfg.mock ? 0 : actualCostUsd(req.provider, completion.usage);
  await deps.spend.settle(id, costUsd);
  return json({
    text: completion.text,
    truncated: completion.truncated,
    provider: req.provider,
    model: completion.model,
    mock: cfg.mock,
    usage: completion.usage,
    costUsd,
    latencyMs: deps.now() - started,
  });
}

// ---------- NPC chat ----------

// Always answers 200 with a line: `source` says whether it came from the model, the opener cache or the
// scripted fallback (over cap, provider down, unusable reply), so the NPC never goes silent.
async function handleChat(request: Request, deps: Deps): Promise<Response> {
  const body = await readJson(request, 2400);
  if (!body || typeof body !== "object") return fail(400, "bad_json");
  const b = body as Record<string, unknown>;
  if (!isChatWho(b.who)) return fail(400, "bad_request", { message: "unknown who" });
  const who = b.who;
  const line = cleanLine(b.line);
  const scene = cleanScene(b.scene);
  const mind = cleanMind(b.mind);
  const cache = deps.chatCache ?? sharedChatCache;
  const scripted = (why: string) => json({ text: scriptedLine(who, deps.random), source: "scripted", why });

  const opener = !mind && isOpener(line); // a villager with a mind answers this very talk, so nothing is cached
  if (opener && cache.full(who)) return json({ text: cache.pick(who, deps.random), source: "cache" });

  const { cfg } = deps;
  const provider = cfg.defaultProvider;
  if (!cfg.mock && !providerConfigured(cfg.providers, provider)) return scripted("unconfigured");
  const p = chatPrompt(who, line, scene, mind);
  const maxTokens = mind ? MIND_MAX_TOKENS : CHAT_MAX_TOKENS;
  const worst = worstCaseCostUsd(provider, estimateInputTokens(p.system + p.prompt), maxTokens);
  const id = deps.newId();
  const clientKey = await deps.hashClient(request.headers.get("cf-connecting-ip") ?? "local");
  const reserved = await deps.spend.reserve({ id, provider, worstCaseUsd: cfg.mock ? 0 : worst, clientKey, quota: CHAT_QUOTA });
  if (!reserved.ok) return scripted(reserved.reason);

  let completion: Completion;
  try {
    completion = cfg.mock
      ? mockCompletion("chat", p.system, p.prompt)
      : await complete(provider, cfg.providers, { ...p, maxTokens, effort: "low" }, deps.fetch);
  } catch (e) {
    if (e instanceof UpstreamError) await deps.spend.release(id);
    else await deps.spend.settle(id, worst); // may have been billed
    return scripted("upstream");
  }
  const costUsd = cfg.mock ? 0 : actualCostUsd(provider, completion.usage);
  await deps.spend.settle(id, costUsd);
  const text = completion.truncated ? "" : tidyReply(completion.text);
  if (!text) return scripted(completion.truncated ? "truncated" : "unusable");
  if (opener) cache.add(who, text);
  return json({ text, source: "model", model: completion.model, mock: cfg.mock, costUsd });
}

// Two pets meet: one model call writes a line for each (same quota and budget as NPC chat). Pairs of
// traits are cached, so after 3 model replies per pair the dialogue rotates for free.
async function handlePetChat(request: Request, deps: Deps): Promise<Response> {
  const body = await readJson(request, 500);
  if (!body || typeof body !== "object") return fail(400, "bad_json");
  const a = parsePetSide((body as Record<string, unknown>).a);
  const b = parsePetSide((body as Record<string, unknown>).b);
  if (!a || !b) return fail(400, "bad_request");
  const cache = deps.chatCache ?? sharedChatCache;
  const key = `pets:${a.trait}|${b.trait}`;
  const scripted = (why: string) => json({ lines: scriptedPair(a, b, deps.random), source: "scripted", why });
  if (cache.full(key)) return json({ lines: JSON.parse(cache.pick(key, deps.random)!), source: "cache" });

  const { cfg } = deps;
  const provider = cfg.defaultProvider;
  if (!cfg.mock && !providerConfigured(cfg.providers, provider)) return scripted("unconfigured");
  const p = petsPrompt(a, b);
  const worst = worstCaseCostUsd(provider, estimateInputTokens(p.system + p.prompt), CHAT_MAX_TOKENS);
  const id = deps.newId();
  const clientKey = await deps.hashClient(request.headers.get("cf-connecting-ip") ?? "local");
  const reserved = await deps.spend.reserve({ id, provider, worstCaseUsd: cfg.mock ? 0 : worst, clientKey, quota: CHAT_QUOTA });
  if (!reserved.ok) return scripted(reserved.reason);
  let completion: Completion;
  try {
    completion = cfg.mock
      ? { ...mockCompletion("chat", p.system, p.prompt), text: "A: Hi there!\nB: Hello, friend!" }
      : await complete(provider, cfg.providers, { ...p, maxTokens: CHAT_MAX_TOKENS, effort: "low" }, deps.fetch);
  } catch (e) {
    if (e instanceof UpstreamError) await deps.spend.release(id);
    else await deps.spend.settle(id, worst);
    return scripted("upstream");
  }
  const costUsd = cfg.mock ? 0 : actualCostUsd(provider, completion.usage);
  await deps.spend.settle(id, costUsd);
  const lines = completion.truncated ? null : tidyPair(completion.text);
  if (!lines) return scripted("unusable");
  cache.add(key, JSON.stringify(lines));
  return json({ lines, source: "model", costUsd });
}

// A villager's pet studies the player's memo before a duel (worker/src/rival.ts). Always 200 unless the ask is bad.
async function handleRival(request: Request, deps: Deps): Promise<Response> {
  const ask = parseRivalAsk(await readJson(request, 3000));
  if (!ask) return fail(400, "bad_request");
  const clientKey = await deps.hashClient(request.headers.get("cf-connecting-ip") ?? "local");
  return json(await rivalPlan(ask, deps, clientKey));
}

// The Village Gazette (worker/src/gazette.ts): one paper per room and game day. Always 200 unless the ask is bad.
async function handleGazette(request: Request, deps: Deps): Promise<Response> {
  const ask = parseGazetteAsk(await readJson(request, 4000), deps.now());
  if (!ask) return fail(400, "bad_request");
  const clientKey = await deps.hashClient(request.headers.get("cf-connecting-ip") ?? "local");
  return json(await gazettePaper(ask, deps, clientKey));
}

// A watching villager's line for each way a fight can end (worker/src/cheer.ts). Always 200 unless the ask is bad.
async function handleCheer(request: Request, deps: Deps): Promise<Response> {
  const ask = parseCheerAsk(await readJson(request, 1000));
  if (!ask) return fail(400, "bad_request");
  const clientKey = await deps.hashClient(request.headers.get("cf-connecting-ip") ?? "local");
  return json(await cheerLines(ask, deps, clientKey));
}

// ---------- voice teaching ----------

async function handleTranscribe(request: Request, deps: Deps): Promise<Response> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_WAV_BYTES) return fail(413, "too_large");
  const wav = await request.arrayBuffer().catch(() => null);
  if (!wav) return fail(400, "bad_body");
  if (wav.byteLength > MAX_WAV_BYTES) return fail(413, "too_large");
  const info = parseWav(wav);
  if (typeof info === "string") return fail(400, "bad_audio", { message: info });
  if (info.durationMs > MAX_CLIP_MS) return fail(400, "bad_audio", { message: `clip longer than ${MAX_CLIP_MS / 1000} s` });

  const { cfg } = deps;
  if (cfg.mock) return json({ transcript: "guard when it winds up a heavy hit", mock: true, costUsd: 0, audioDurationMs: info.durationMs });
  if (!providerConfigured(cfg.providers, "meta")) return fail(503, "provider_unconfigured");

  const worst = transcribeCostUsd(info.durationMs);
  const id = deps.newId();
  const clientKey = await deps.hashClient(request.headers.get("cf-connecting-ip") ?? "local");
  const reserved = await deps.spend.reserve({ id, provider: "meta", worstCaseUsd: worst, clientKey });
  if (!reserved.ok) return fail(REJECT_STATUS[reserved.reason], reserved.reason === "rate_limit" ? "rate_limited" : "budget_exhausted", { reason: reserved.reason });

  const started = deps.now();
  try {
    const r = await transcribeMeta(cfg.providers.meta, wav, deps.fetch);
    const costUsd = Number.isNaN(r.audioDurationMs) ? worst : Math.min(worst, transcribeCostUsd(r.audioDurationMs));
    await deps.spend.settle(id, costUsd);
    return json({ transcript: r.transcript.trim().slice(0, 300), audioDurationMs: r.audioDurationMs, costUsd, latencyMs: deps.now() - started });
  } catch (e) {
    if (e instanceof UpstreamError) {
      await deps.spend.release(id);
      return fail(502, "upstream_error", { upstreamStatus: e.status });
    }
    await deps.spend.settle(id, worst); // may have been billed
    return fail(502, "upstream_unreadable", { message: e instanceof UnreadableResponse ? e.message : "unexpected error" });
  }
}

// ---------- ghosts ----------

async function handleGhostCreate(request: Request, deps: Deps): Promise<Response> {
  if (Number(request.headers.get("content-length") ?? 0) > GHOST_MAX_BYTES) return fail(413, "too_large");
  const text = await request.text();
  if (new TextEncoder().encode(text).length > GHOST_MAX_BYTES) return fail(413, "too_large");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return fail(400, "bad_json");
  }
  const ghost = parseGhost(body);
  if (!ghost) return fail(400, "bad_ghost");
  const clientKey = await deps.hashClient(request.headers.get("cf-connecting-ip") ?? "local");
  if (!(await allowGhostPost(deps.ghosts, clientKey, deps.now()))) return fail(429, "rate_limited");
  const id = deps.newId().replaceAll("-", "").slice(0, 20);
  await saveGhost(deps.ghosts, id, ghost, deps.now());
  return json({ id }, 201);
}

function handleGhostGet(ghost: unknown | null): Response {
  return ghost ? json(ghost) : fail(404, "no_ghost");
}
