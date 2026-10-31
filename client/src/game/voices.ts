import { completeTiered, isGrammarError, type GrammarTier } from "./grammar";
import type { LmRequest } from "../mind/brain";
import { splitReply, type VoiceBackend, type VoicePrompt, type VoiceReply } from "./instinct";

// The Instinct backends. WebLlmVoice is the one local model: our tuned Llama 3.2 1B in this tab via WebGPU, no
// install; it picks among the allowed moves and voices them.

export class CloudVoice implements VoiceBackend {
  readonly timeoutMs = 3000; // runs during the previous turn's animation; only when no memo rule fires
  readonly label: string;
  private readonly baseUrl: string;
  private readonly provider: "modal" | "glimmer";
  private readonly fetchFn: typeof fetch;
  private readonly now: () => number;
  private ok = false;
  private failures = 0;
  private openUntil = 0;

  constructor({ baseUrl = "", provider = "modal", label = "Muse Spark Open (cloud)", fetchFn = (...a) => fetch(...a), now = Date.now }: {
    baseUrl?: string;
    provider?: "modal" | "glimmer";
    label?: string;
    fetchFn?: typeof fetch;
    now?: () => number;
  } = {}) {
    this.baseUrl = baseUrl;
    this.provider = provider;
    this.label = label;
    this.fetchFn = fetchFn;
    this.now = now;
  }

  async probe(): Promise<boolean> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 2500);
    try {
      const res = await this.fetchFn(`${this.baseUrl}/api/health`, { signal: ctl.signal });
      const body = await res.json() as { providers?: Record<string, unknown> } | null;
      this.ok = !ctl.signal.aborted && res.ok && body?.providers?.[this.provider] === true;
    } catch {
      this.ok = false;
    } finally {
      clearTimeout(timer);
    }
    return this.ok;
  }

  ready(): boolean {
    return this.ok && this.now() >= this.openUntil;
  }

  async pick(p: VoicePrompt, signal: AbortSignal): Promise<VoiceReply> {
    try {
      signal.throwIfAborted();
      const res = await this.fetchFn(`${this.baseUrl}/api/llm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal,
        body: JSON.stringify({ kind: "move", provider: this.provider, system: p.system, prompt: p.user, maxTokens: 600, effort: "low" }),
      });
      if (!res.ok) throw new Error(`cloud HTTP ${res.status}`);
      const body = await res.json() as { text?: string; truncated?: boolean };
      signal.throwIfAborted();
      if (body.truncated) throw new Error("truncated cloud reply");
      if (typeof body.text !== "string" || !body.text.trim()) throw new Error("empty cloud reply");
      const match = /^\s*(attack|guard|flee|emote|befriend)\s*:\s*(.*)$/im.exec(body.text);
      if (!match) throw new Error("invalid cloud reply");
      this.failures = 0;
      this.openUntil = 0;
      return { action: match[1]!.toLowerCase(), line: match[2]!.trim() };
    } catch (e) {
      if (++this.failures >= 2) this.openUntil = this.now() + 60_000;
      throw e;
    }
  }
}

// Minds without a local model: Muse Spark through the Worker. No spacing while we work up to judging (a gap comes back
// after the event, for real players); it still backs off when the Worker says no, and `parse` and the rules fallback
// handle anything else.
export class CloudMind {
  readonly label = "Muse Spark";
  private ok = false;
  private failures = 0;
  private openUntil = 0;
  private nextAt = 0;

  constructor(private readonly gapMs = 0, private readonly fetchFn: typeof fetch = (...a) => fetch(...a), private readonly now: () => number = Date.now) {}

  async probe(): Promise<void> {
    try {
      const res = await this.fetchFn("/api/health", { signal: AbortSignal.timeout(2500) });
      const body = (await res.json()) as { providers?: Record<string, unknown> } | null;
      this.ok = res.ok && Object.values(body?.providers ?? {}).some(Boolean);
    } catch {
      this.ok = false;
    }
  }

  available(): boolean {
    return this.ok && this.now() >= this.openUntil;
  }

  ready(): boolean {
    return this.available() && this.now() >= this.nextAt;
  }

  async complete(req: LmRequest, signal: AbortSignal): Promise<string> {
    this.nextAt = this.now() + this.gapMs;
    try {
      const res = await this.fetchFn("/api/llm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal,
        body: JSON.stringify({ kind: "dialogue", system: req.system, prompt: req.user, maxTokens: 400, effort: "low" }),
      });
      if (!res.ok) throw new Error(`cloud HTTP ${res.status}`);
      const body = (await res.json()) as { text?: string; truncated?: boolean };
      if (body.truncated || !body.text?.trim()) throw new Error("no cloud reply");
      this.failures = 0;
      return body.text;
    } catch (e) {
      if (++this.failures >= 2) this.openUntil = this.now() + 5 * 60_000;
      throw e;
    }
  }
}

type Engine = import("@mlc-ai/web-llm").MLCEngineInterface;

// Our fine-tuned 1B (coach + pet + village minds) as MLC weights on Hugging Face (modal/convert_mlc.py), in both of the
// stock 1B's formats: <repo>-q4f16_1-MLC for GPUs with shader-f16, <repo>-q4f32_1-MLC otherwise. Each runs on the
// prebuilt stock library of its format, so only the weights differ. The repos are private until submission day, so
// the Worker serves them on this site (worker/src/mlc.ts). Empty repo = stock 1B only.
export const TUNED_1B = { repo: "/mlc/n4/{q}/" }; // a new path per training run: browsers cache weights by URL
const quantOf = (f16: boolean) => (f16 ? "q4f16_1" : "q4f32_1");
export const stockId = (f16: boolean) => `Llama-3.2-1B-Instruct-${quantOf(f16)}-MLC`;

// The model list entry for the tuned weights, borrowing the stock entry's library and settings. A full URL (dev) may
// hold "{q}" for the format.
export function tunedRecord<T extends { model: string; model_id: string }>(list: readonly T[], repo: string, f16: boolean): T | null {
  const q = quantOf(f16);
  const stock = list.find((m) => m.model_id === stockId(f16));
  const model = repo.includes("://") ? repo.replace("{q}", q) : `https://huggingface.co/${repo}-${q}-MLC`;
  return repo && stock ? { ...stock, model, model_id: `Llama-3.2-1B-Mindworld-${q}-MLC` } : null;
}

// Dev only: ?tuned=<url> loads weights from anywhere (e.g. the local server) to test a conversion before publishing.
const tunedRepo = (): string => (import.meta.env.DEV && new URLSearchParams(location.search).get("tuned")) || (TUNED_1B.repo.startsWith("/") ? location.origin + TUNED_1B.repo : TUNED_1B.repo);

// One prefill dispatch of about 190+ tokens crashes the GPU process on a GTX 1050, with mlc-ai's stock weights too
// (docs/FINETUNE.md), and WebLLM ignores a prefill_chunk_size override. Long prompts survive when set on the pipeline.
export const PREFILL_CHUNK = 128;
const WARM_TOKENS = 300;
export function limitPrefill(engine: unknown): void {
  (engine as { loadedModelIdToPipeline?: Map<string, { prefillChunkSize: number }> }).loadedModelIdToPipeline?.forEach((p) => (p.prefillChunkSize = PREFILL_CHUNK));
}

export class WebLlmVoice implements VoiceBackend {
  label = "Llama 3.2 1B, tuned by us (in browser, WebGPU)";
  onLost: (() => void) | null = null; // the GPU dropped the model mid-game
  private engine: Engine | null = null;
  private busy = false;
  private loading: Promise<void> | null = null;
  tier: GrammarTier = "strict"; // drops to "simple"/"none" if xgrammar rejects the grammar

  ready(): boolean {
    return this.engine !== null && !this.busy;
  }

  static supported(): boolean {
    return typeof navigator !== "undefined" && "gpu" in navigator;
  }

  // Downloads (first time, ~0.9 GB, then cached by the browser) and compiles the model.
  load(onProgress: (text: string, frac: number) => void): Promise<void> {
    this.loading ??= (async () => {
      const webllm = await import("@mlc-ai/web-llm");
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
      if (!adapter) throw new Error("no WebGPU adapter");
      const initProgressCallback = (r: { text: string; progress: number }) => onProgress(r.text, r.progress);
      const f16 = adapter.features.has("shader-f16");
      // Warm-up: the first generation compiles the shaders (~30 s on a GTX 1050). Do it during the loading
      // toast, so fights and village minds don't spend their deadlines on it.
      // The long prompt also weeds out GPUs that cannot run this model: they fail here, not in the middle of play.
      const warm = async (e: Engine) => {
        limitPrefill(e);
        onProgress("Warming up the model (first run compiles shaders)...", 1);
        await e.chat.completions.create({ messages: [{ role: "user", content: "ok ".repeat(WARM_TOKENS) }], max_tokens: 4 });
        return e;
      };
      // f16 is only a capability flag, so a GPU that claims it and fails still gets a try with f32.
      let failure: unknown = new Error("no tuned model configured");
      for (const useF16 of f16 ? [true, false] : [false]) {
        const tuned = tunedRecord(webllm.prebuiltAppConfig.model_list, tunedRepo(), useF16);
        if (!tuned) continue;
        try {
          this.engine = await warm(await webllm.CreateMLCEngine(tuned.model_id, { appConfig: { ...webllm.prebuiltAppConfig, model_list: [tuned] }, initProgressCallback }));
          return;
        } catch (e) {
          failure = e;
          console.warn(`tuned 1B (${tuned.model_id}) failed`, e);
        }
      }
      throw failure;
    })();
    this.loading.catch(() => (this.loading = null));
    return this.loading;
  }

  async pick(p: VoicePrompt, signal: AbortSignal): Promise<VoiceReply> {
    const engine = this.engine;
    if (!engine) throw new Error("model not loaded");
    this.busy = true;
    const onAbort = () => engine.interruptGenerate();
    signal.addEventListener("abort", onAbort);
    try {
      const { reply, tier } = await completeTiered(this.tier, p.moves, async (grammar, tier) => {
        const r = await engine.chat.completions.create({
          messages: [
            { role: "system", content: p.system },
            { role: "user", content: p.user },
          ],
          temperature: 0.7,
          max_tokens: tier === "strict" ? 24 : 20,
          ...(grammar ? { response_format: { type: "grammar" as const, grammar } } : {}),
        });
        if (signal.aborted) throw new Error("aborted");
        return r.choices[0]?.message.content ?? "";
      });
      this.tier = tier;
      return reply;
    } catch (e) {
      this.checkLost(e);
      throw e;
    } finally {
      signal.removeEventListener("abort", onAbort);
      this.busy = false;
    }
  }

  // The coach: a JSON-schema constrained reply (Teach/Reflect memos). Only the tuned weights can do this job well.
  async completeJson(req: { system: string; user: string; maxTokens: number; schema: object }): Promise<{ text: string; truncated: boolean }> {
    const engine = this.engine;
    if (!engine) throw new Error("model not loaded");
    this.busy = true;
    try {
      const r = await engine.chat.completions.create({
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
        temperature: 0,
        max_tokens: req.maxTokens,
        response_format: { type: "json_object", schema: JSON.stringify(req.schema) },
      });
      return { text: r.choices[0]?.message.content ?? "", truncated: r.choices[0]?.finish_reason === "length" };
    } catch (e) {
      this.checkLost(e);
      throw e;
    } finally {
      this.busy = false;
    }
  }

  // WebGPU device loss surfaces as these errors, and the engine never recovers: let the game go on without it.
  private checkLost(e: unknown): void {
    if (!/disposed|not loaded|deleted object|device.*lost/i.test(String(e))) return;
    this.engine = null;
    this.loading = null;
    this.onLost?.();
  }

  private mindGrammar = true; // off for the session if xgrammar rejects a mind grammar

  // Any village-mind decision. Shares the engine with fights: WebLLM runs one request at a time.
  async complete(req: LmRequest, signal: AbortSignal): Promise<string> {
    const engine = this.engine;
    if (!engine) throw new Error("model not loaded");
    this.busy = true;
    const onAbort = () => engine.interruptGenerate();
    signal.addEventListener("abort", onAbort);
    const run = async (grammar: string | undefined) => {
      const r = await engine.chat.completions.create({
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
        temperature: req.temperature,
        max_tokens: req.maxTokens,
        ...(grammar ? { response_format: { type: "grammar" as const, grammar } } : {}),
      });
      if (signal.aborted) throw new Error("aborted");
      return r.choices[0]?.message.content ?? "";
    };
    try {
      if (req.grammar && this.mindGrammar) {
        try {
          return await run(req.grammar);
        } catch (e) {
          if (!isGrammarError(e)) throw e;
          this.mindGrammar = false;
        }
      }
      return await run(undefined);
    } catch (e) {
      this.checkLost(e);
      throw e;
    } finally {
      signal.removeEventListener("abort", onAbort);
      this.busy = false;
    }
  }
}
