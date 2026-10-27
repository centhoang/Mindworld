import { splitReply, type VoiceBackend, type VoiceReply } from "./instinct";

// Two Instinct backends, both Meta Llama 3.2 on the player's own machine:
// - NativeVoice ("power mode"): a llama.cpp `llama-server` on localhost running Llama 3.2 3B (spike B-native:
//   ~0.5 s per decision on a GTX 1050, follows the memo). Needs a one-time local install.
// - WebLlmVoice: Llama 3.2 1B in this tab via WebGPU. No install, but slower and weaker, so it only picks among
//   the allowed moves and voices them.

export const NATIVE_URL = "http://127.0.0.1:8080";

export class NativeVoice implements VoiceBackend {
  readonly label = "Llama 3.2 3B (native, power mode)";
  private ok = false;

  constructor(private readonly base = NATIVE_URL) {}

  ready(): boolean {
    return this.ok;
  }

  // True if a llama-server answers on this machine.
  async probe(): Promise<boolean> {
    try {
      const res = await fetch(`${this.base}/health`, { signal: AbortSignal.timeout(800) });
      this.ok = res.ok;
    } catch {
      this.ok = false;
    }
    return this.ok;
  }

  async pick(p: { system: string; user: string; grammar: string }, signal: AbortSignal): Promise<VoiceReply> {
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

type Engine = import("@mlc-ai/web-llm").MLCEngineInterface;

export class WebLlmVoice implements VoiceBackend {
  readonly label = "Llama 3.2 1B (in browser, WebGPU)";
  private engine: Engine | null = null;
  private busy = false;
  private loading: Promise<void> | null = null;

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

  async pick(p: { system: string; user: string; grammar: string }, signal: AbortSignal): Promise<VoiceReply> {
    const engine = this.engine;
    if (!engine) throw new Error("model not loaded");
    this.busy = true;
    const onAbort = () => engine.interruptGenerate();
    signal.addEventListener("abort", onAbort);
    try {
      const reply = await engine.chat.completions.create({
        messages: [
          { role: "system", content: p.system },
          { role: "user", content: p.user },
        ],
        temperature: 0.7,
        max_tokens: 24,
        response_format: { type: "grammar", grammar: p.grammar },
      });
      if (signal.aborted) throw new Error("aborted");
      return splitReply(reply.choices[0]?.message.content ?? "");
    } finally {
      signal.removeEventListener("abort", onAbort);
      this.busy = false;
    }
  }
}
