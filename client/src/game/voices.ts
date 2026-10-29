import { completeTiered, type GrammarTier } from "./grammar";
import { splitReply, type VoiceBackend, type VoicePrompt, type VoiceReply } from "./instinct";

// Two Instinct backends, both Meta Llama 3.2 on the player's own machine:
// - NativeVoice ("power mode"): a llama.cpp `llama-server` on localhost running Llama 3.2 3B (spike B-native:
//   ~0.5 s per decision on a GTX 1050, follows the memo). Needs a one-time local install.
// - WebLlmVoice: Llama 3.2 1B in this tab via WebGPU. No install, but slower and weaker, so it only picks among
//   the allowed moves and voices them.

export const NATIVE_URL = "http://127.0.0.1:8080";

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

export class NativeVoice implements VoiceBackend {
  readonly label = "Llama 3.2 3B (native, power mode)";
  private ok = false;

  constructor(private readonly base = NATIVE_URL) {}

  ready(): boolean {
    return this.ok;
  }

  // True if a llama-server answers on this machine. From an https page Chrome holds the request until
  // the player answers its local-network prompt, so a probe the player started waits much longer.
  async probe(timeoutMs = 800): Promise<boolean> {
    try {
      const res = await fetch(`${this.base}/health`, { signal: AbortSignal.timeout(timeoutMs) });
      this.ok = res.ok;
    } catch {
      this.ok = false;
    }
    return this.ok;
  }

  async pick(p: VoicePrompt, signal: AbortSignal): Promise<VoiceReply> {
    const res = await fetch(`${this.base}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal,
      body: JSON.stringify({
        messages: [
          { role: "system", content: p.system },
          { role: "user", content: p.user },
        ],
        temperature: 0.7,
        max_tokens: 24,
        grammar: p.grammar,
      }),
    });
    if (!res.ok) throw new Error(`llama-server HTTP ${res.status}`);
    const body = (await res.json()) as { choices: { message: { content: string } }[] };
    return splitReply(body.choices[0]?.message.content ?? "");
  }
}

// Chrome's Local Network Access: an https page must ask the player before it may reach 127.0.0.1.
// "prompt" means a request would pop that question, so the game never probes silently in that state.
export type LocalAccess = "granted" | "prompt" | "denied";
export async function localAccessState(
  protocol = location.protocol,
  query = (name: string) => navigator.permissions.query({ name: name as PermissionName }),
): Promise<LocalAccess> {
  if (protocol !== "https:") return "granted"; // dev on http://localhost: same address space, no prompt
  for (const name of ["loopback-network", "local-network-access"]) {
    try {
      return (await query(name)).state;
    } catch {
      // older or newer Chrome names the permission differently; try the next one
    }
  }
  return "granted"; // no such permission in this browser: requests are not gated
}

type Engine = import("@mlc-ai/web-llm").MLCEngineInterface;

export class WebLlmVoice implements VoiceBackend {
  readonly label = "Llama 3.2 1B (in browser, WebGPU)";
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
      const id = adapter.features.has("shader-f16") ? "Llama-3.2-1B-Instruct-q4f16_1-MLC" : "Llama-3.2-1B-Instruct-q4f32_1-MLC";
      this.engine = await webllm.CreateMLCEngine(id, { initProgressCallback: (r) => onProgress(r.text, r.progress) });
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
    } finally {
      signal.removeEventListener("abort", onAbort);
      this.busy = false;
    }
  }
}
