import { describe, expect, it, vi } from "vitest";
import type { VoicePrompt } from "./instinct";
import { CloudMind, CloudVoice, limitPrefill, PREFILL_CHUNK, stockId, tunedRecord } from "./voices";

const prompt: VoicePrompt = { system: "Choose a move", user: "Allowed: attack, guard", grammar: "do not send", moves: ["attack", "guard"] };
const signal = () => new AbortController().signal;
const reply = (text = "attack: Hyaa!", truncated = false) => Response.json({ text, truncated });

describe("CloudVoice", () => {
  it("takes the first move line after reasoning noise and sends the capped chooser request", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(reply("Thinking about the enemy...\n  GUARD : Bracing!\nattack: Hyaa!"));
    const cloud = new CloudVoice({ baseUrl: "https://worker.test", provider: "glimmer", label: "Glimmer", fetchFn });
    const abort = signal();
    expect(await cloud.pick(prompt, abort)).toEqual({ action: "guard", line: "Bracing!" });
    expect(cloud.label).toBe("Glimmer");
    expect(cloud.timeoutMs).toBe(3000);
    expect(fetchFn).toHaveBeenCalledWith("https://worker.test/api/llm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: abort,
      body: JSON.stringify({ kind: "move", provider: "glimmer", system: prompt.system, prompt: prompt.user, maxTokens: 600, effort: "low" }),
    });
  });

  it.each([
    ["non-2xx", () => new Response("unavailable", { status: 503 }), "cloud HTTP 503"],
    ["truncated", () => reply("attack: Hyaa!", true), "truncated cloud reply"],
    ["empty", () => reply(" \n "), "empty cloud reply"],
    ["no move", () => reply("I would attack now."), "invalid cloud reply"],
  ])("rejects a %s response", async (_name, response, message) => {
    const cloud = new CloudVoice({ fetchFn: vi.fn<typeof fetch>().mockResolvedValue(response()) });
    await expect(cloud.pick(prompt, signal())).rejects.toThrow(message);
  });

  it("opens after two failures and permits retry after 60 seconds", async () => {
    let time = 1000;
    const fetchFn = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ providers: { modal: true } }))
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(reply("attack: Hyaa!", true))
      .mockResolvedValueOnce(reply());
    const cloud = new CloudVoice({ fetchFn, now: () => time });
    expect(await cloud.probe()).toBe(true);
    await expect(cloud.pick(prompt, signal())).rejects.toThrow("network down");
    expect(cloud.ready()).toBe(true);
    await expect(cloud.pick(prompt, signal())).rejects.toThrow("truncated");
    expect(cloud.ready()).toBe(false);
    time += 59_999;
    expect(cloud.ready()).toBe(false);
    time += 1;
    expect(cloud.ready()).toBe(true);
    expect(await cloud.pick(prompt, signal())).toEqual({ action: "attack", line: "Hyaa!" });
  });

  it("resets consecutive failures on success and counts aborts as failures", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(async (url) =>
      url === "/api/health" ? Response.json({ providers: { modal: true } }) : reply(),
    );
    const cloud = new CloudVoice({ fetchFn, now: () => 1000 });
    await cloud.probe();
    const aborted = AbortSignal.abort();
    await expect(cloud.pick(prompt, aborted)).rejects.toThrow();
    expect(cloud.ready()).toBe(true);
    await cloud.pick(prompt, signal());
    await expect(cloud.pick(prompt, aborted)).rejects.toThrow();
    expect(cloud.ready()).toBe(true);
    await expect(cloud.pick(prompt, aborted)).rejects.toThrow();
    expect(cloud.ready()).toBe(false);
  });

  it("probes the selected provider and clears readiness after an unsuccessful probe", async () => {
    const fetchFn = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ providers: { modal: false, glimmer: true } }))
      .mockResolvedValueOnce(Response.json({ providers: { modal: true, glimmer: false } }));
    const cloud = new CloudVoice({ baseUrl: "https://worker.test", provider: "glimmer", fetchFn });
    expect(cloud.ready()).toBe(false);
    expect(await cloud.probe()).toBe(true);
    expect(cloud.ready()).toBe(true);
    expect(fetchFn).toHaveBeenCalledWith("https://worker.test/api/health", { signal: expect.any(AbortSignal) });
    expect(await cloud.probe()).toBe(false);
    expect(cloud.ready()).toBe(false);
  });

  it.each([
    ["provider missing", () => Response.json({ providers: {} })],
    ["truthy non-boolean", () => Response.json({ providers: { modal: "true" } })],
    ["non-2xx", () => Response.json({ providers: { modal: true } }, { status: 503 })],
    ["invalid JSON", () => new Response("not JSON")],
  ])("rejects a health response with %s", async (_name, response) => {
    const cloud = new CloudVoice({ fetchFn: vi.fn<typeof fetch>().mockResolvedValue(response()) });
    expect(await cloud.probe()).toBe(false);
    expect(cloud.ready()).toBe(false);
  });

  // A bare `fetch` stored on an object and called as a method throws "Illegal invocation" in browsers.
  it("calls the global fetch without the voice as its `this`", async () => {
    const seen: unknown[] = [];
    vi.stubGlobal("fetch", function (this: unknown) {
      seen.push(this);
      return Promise.resolve(Response.json({ providers: { modal: true } }));
    });
    try {
      const cloud = new CloudVoice();
      expect(await cloud.probe()).toBe(true);
      expect(seen).toHaveLength(1);
      expect(seen[0]).not.toBe(cloud);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("aborts a stalled health probe after 2500 ms", async () => {
    vi.useFakeTimers();
    try {
      const fetchFn = vi.fn<typeof fetch>().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
        init!.signal!.addEventListener("abort", () => reject(new Error("aborted")));
      }));
      const cloud = new CloudVoice({ fetchFn });
      const pending = cloud.probe();
      await vi.advanceTimersByTimeAsync(2500);
      expect(await pending).toBe(false);
      expect(cloud.ready()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("limitPrefill", () => {
  it("caps the chunk on every loaded pipeline", () => {
    const pipe = { prefillChunkSize: 1024 };
    limitPrefill({ loadedModelIdToPipeline: new Map([["m", pipe]]) });
    expect(pipe.prefillChunkSize).toBe(PREFILL_CHUNK);
  });

  it("does nothing if a WebLLM update renames the field", () => {
    expect(() => limitPrefill({})).not.toThrow();
  });
});

describe("tunedRecord", () => {
  const list = [32, 16].map((b) => ({ model: "https://huggingface.co/mlc-ai/x", model_id: stockId(b === 16), model_lib: `lib${b}.wasm` }));
  it("borrows the stock library of the GPU's format for our weights, and is off until a repo is set", () => {
    expect(tunedRecord(list, "", true)).toBeNull();
    expect(tunedRecord(list, "me/Llama-3.2-1B-Mindworld", true)).toEqual({ model: "https://huggingface.co/me/Llama-3.2-1B-Mindworld-q4f16_1-MLC", model_id: "Llama-3.2-1B-Mindworld-q4f16_1-MLC", model_lib: "lib16.wasm" });
    expect(tunedRecord(list, "http://localhost/_mlc/{q}/", false)).toMatchObject({ model: "http://localhost/_mlc/q4f32_1/", model_lib: "lib32.wasm" });
    expect(tunedRecord([], "me/x", false)).toBeNull();
  });
});

describe("CloudMind", () => {
  const req = { system: "s", user: "u", temperature: 0.7, maxTokens: 40 };
  const health = () => new Response(JSON.stringify({ providers: { meta: true } }));
  const sig = new AbortController().signal;

  it("answers through the Worker, spaced out so it stays a stand-in", async () => {
    let t = 0;
    const f = vi.fn<typeof fetch>(async (u) => (String(u).includes("health") ? health() : new Response(JSON.stringify({ text: "hi" }))));
    const m = new CloudMind(6000, f, () => t);
    await m.probe();
    expect(m.ready()).toBe(true);
    expect(await m.complete(req, sig)).toBe("hi");
    expect(m.ready()).toBe(false);
    expect(m.available()).toBe(true);
    t = 6000;
    expect(m.ready()).toBe(true);
  });

  it("backs off after two refusals (over budget), and is off when no provider is configured", async () => {
    let t = 0;
    const f = vi.fn<typeof fetch>(async (u) => (String(u).includes("health") ? health() : new Response("{}", { status: 429 })));
    const m = new CloudMind(0, f, () => t);
    await m.probe();
    await expect(m.complete(req, sig)).rejects.toThrow();
    await expect(m.complete(req, sig)).rejects.toThrow();
    expect(m.available()).toBe(false);
    t = 301_000;
    expect(m.available()).toBe(true);
    const off = new CloudMind(0, vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ providers: { meta: false } }))));
    await off.probe();
    expect(off.available()).toBe(false);
  });
});
