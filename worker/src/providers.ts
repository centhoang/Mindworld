import type { Provider, Usage } from "./pricing";

export interface ProviderConfig {
  baseten: { apiKey?: string; baseUrl: string; model: string };
  meta: { apiKey?: string; model: string };
  modal: { apiKey?: string; baseUrl: string; model: string };
  glimmer: { apiKey?: string; baseUrl: string; model: string };
}

export interface Completion {
  text: string;
  usage: Usage;
  truncated: boolean;
  model: string;
}

export interface CompletionRequest {
  system?: string;
  prompt: string;
  maxTokens: number;
  effort?: "low" | "medium" | "high"; // reasoning effort, sent only when set
}

// Upstream answered with an explicit error status, so nothing was generated and the caller may release the
// reservation. Anything else that goes wrong (network reset, timeout, unreadable or usage-less 2xx) may have
// been billed and is UnreadableResponse: the caller books the worst case instead.
export class UpstreamError extends Error {
  constructor(message: string, readonly status: number | null) {
    super(message);
  }
}

// A response that may have been billed but that we could not read: caller books the worst case.
export class UnreadableResponse extends Error {}

const META_URL = "https://api.meta.ai/v1/responses";
const TIMEOUT_MS = 40_000;

type FetchFn = (input: string, init: RequestInit) => Promise<Response>;

async function postJson(fetchFn: FetchFn, url: string, apiKey: string, body: unknown): Promise<unknown> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS); // covers headers AND body
  try {
    const res = await fetchFn(url, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    if (!res.ok) throw new UpstreamError(`upstream status ${res.status}`, res.status);
    return await res.json();
  } catch (e) {
    if (e instanceof UpstreamError) throw e;
    throw new UnreadableResponse(ctl.signal.aborted ? "upstream timeout" : `upstream failure: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

// Usage must carry real token counts; a missing or zeroed usage on a 2xx would otherwise free a billed call.
function readUsage(raw: unknown, inKey: string, outKey: string, detailsKey: string): Usage {
  const u = obj(raw);
  const count = (v: unknown): number => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw new UnreadableResponse("usage missing token counts");
    return Math.round(v);
  };
  return {
    inputTokens: count(u[inKey]),
    outputTokens: count(u[outKey]),
    cachedInputTokens: int(obj(u[detailsKey]).cached_tokens),
  };
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const int = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);

async function openAiChat(cfg: ProviderConfig["baseten"], url: string, req: CompletionRequest, fetchFn: FetchFn): Promise<Completion> {
  const messages = [
    ...(req.system ? [{ role: "system", content: req.system }] : []),
    { role: "user", content: req.prompt },
  ];
  const json = obj(
    await postJson(fetchFn, url, cfg.apiKey ?? "", {
      model: cfg.model,
      messages,
      max_tokens: req.maxTokens,
      ...(req.effort ? { reasoning_effort: req.effort } : {}),
    }),
  );
  const choice = obj((Array.isArray(json.choices) ? json.choices[0] : undefined));
  const message = obj(choice.message);
  return {
    text: typeof message.content === "string" ? message.content : "",
    truncated: choice.finish_reason === "length",
    model: typeof json.model === "string" ? json.model : cfg.model,
    usage: readUsage(json.usage, "prompt_tokens", "completion_tokens", "prompt_tokens_details"),
  };
}

export function completeBaseten(cfg: ProviderConfig["baseten"], req: CompletionRequest, fetchFn: FetchFn): Promise<Completion> {
  return openAiChat(cfg, `${cfg.baseUrl}/chat/completions`, req, fetchFn);
}

function modalChatUrl(baseUrl: string): string {
  const url = baseUrl.replace(/\/+$/, "");
  return `${url.endsWith("/v1") ? url : `${url}/v1`}/chat/completions`;
}

export function completeModal(cfg: ProviderConfig["modal"], req: CompletionRequest, fetchFn: FetchFn): Promise<Completion> {
  return openAiChat(cfg, modalChatUrl(cfg.baseUrl), req, fetchFn);
}

export function completeGlimmer(cfg: ProviderConfig["glimmer"], req: CompletionRequest, fetchFn: FetchFn): Promise<Completion> {
  const { effort, ...chatReq } = req;
  if (effort) chatReq.system = `Reasoning strength: ${effort}${req.system ? `\n${req.system}` : ""}`;
  return openAiChat(cfg, modalChatUrl(cfg.baseUrl), chatReq, fetchFn);
}

export async function completeMeta(cfg: ProviderConfig["meta"], req: CompletionRequest, fetchFn: FetchFn): Promise<Completion> {
  const json = obj(
    await postJson(fetchFn, META_URL, cfg.apiKey ?? "", {
      model: cfg.model,
      ...(req.system ? { instructions: req.system } : {}),
      input: req.prompt,
      max_output_tokens: req.maxTokens,
      ...(req.effort ? { reasoning: { effort: req.effort } } : {}),
    }),
  );
  return {
    text: metaText(json),
    truncated: json.status === "incomplete",
    model: typeof json.model === "string" ? json.model : cfg.model,
    usage: readUsage(json.usage, "input_tokens", "output_tokens", "input_tokens_details"),
  };
}

// The Responses API returns output: [{type:"reasoning"}, {type:"message", content:[{type:"output_text", text}]}].
function metaText(json: Record<string, unknown>): string {
  if (typeof json.output_text === "string") return json.output_text;
  const parts: string[] = [];
  for (const item of Array.isArray(json.output) ? json.output : []) {
    const it = obj(item);
    if (it.type !== "message" || !Array.isArray(it.content)) continue;
    for (const c of it.content) {
      const part = obj(c);
      if (part.type === "output_text" && typeof part.text === "string") parts.push(part.text);
    }
  }
  return parts.join("");
}

export function complete(
  provider: Provider,
  cfg: ProviderConfig,
  req: CompletionRequest,
  fetchFn: FetchFn,
): Promise<Completion> {
  switch (provider) {
    case "baseten": return completeBaseten(cfg.baseten, req, fetchFn);
    case "meta": return completeMeta(cfg.meta, req, fetchFn);
    case "modal": return completeModal(cfg.modal, req, fetchFn);
    case "glimmer": return completeGlimmer(cfg.glimmer, req, fetchFn);
  }
}
