import { describe, expect, it } from "vitest";
import { complete } from "../src/providers";
import { actualCostUsd } from "../src/pricing";
import { basetenReply, CFG, harness, LLM_SYSTEMS, postJson } from "./helpers";

const request = { kind: "move", system: LLM_SYSTEMS.move, prompt: "choose the move", maxTokens: 400 };

describe("Modal providers", () => {
  it.each(["https://modal.test", "https://modal.test/v1", "https://modal.test/v1/"])(
    "sends Modal effort and Bearer authentication with base URL %s", async (baseUrl) => {
      const h = harness({ cfg: { providers: { ...CFG.providers, modal: { ...CFG.providers.modal, baseUrl } } } });
      h.upstream.respond = async () => basetenReply("hello");
      const res = await h.call("/api/llm", postJson({ ...request, provider: "modal", effort: "low" }));
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ provider: "modal", text: "hello" });
      const call = h.upstream.calls[0]!;
      expect(call.url).toBe("https://modal.test/v1/chat/completions");
      expect(new Headers(call.init.headers).get("authorization")).toBe("Bearer wk-test.ws-test");
      expect(JSON.parse(call.init.body as string)).toEqual({
        model: "meta-models/Muse-Spark-Open", max_tokens: 400, reasoning_effort: "low",
        messages: [{ role: "system", content: LLM_SYSTEMS.move }, { role: "user", content: request.prompt }],
      });
      expect((await h.ledger.snapshot()).totalSpentUsd.modal).toBeGreaterThan(0);
    },
  );

  it.each([undefined, "", "be brief"])("prepends Glimmer reasoning to the system message (%s)", async (system) => {
    const h = harness();
    h.upstream.respond = async () => basetenReply("hello");
    // Glimmer is no longer selectable through /api/llm; keep testing its adapter directly.
    const res = await complete("glimmer", h.deps.cfg.providers, { system, prompt: request.prompt, maxTokens: 400, effort: "low" }, h.deps.fetch);
    expect(res).toMatchObject({ text: "hello" });
    const call = h.upstream.calls[0]!;
    expect(call.url).toBe("https://glimmer.test/v1/chat/completions");
    expect(new Headers(call.init.headers).get("authorization")).toBe("Bearer wk-test.ws-test");
    const sent = JSON.parse(call.init.body as string);
    expect(sent).not.toHaveProperty("reasoning_effort");
    expect(sent.messages).toEqual([
      { role: "system", content: `Reasoning strength: low${system ? `\n${system}` : ""}` },
      { role: "user", content: request.prompt },
    ]);
    expect(sent.model).toBe("glimmer");
    expect(actualCostUsd("glimmer", res.usage)).toBe(0.00023);
  });

  it.each(["baseten", "modal", "glimmer"] as const)("omits reasoning effort when unset for %s", async (provider) => {
    const h = harness();
    h.upstream.respond = async () => basetenReply("hello");
    await complete(provider, h.deps.cfg.providers, { prompt: request.prompt, maxTokens: 400 }, h.deps.fetch);
    const sent = JSON.parse(h.upstream.calls[0]!.init.body as string);
    expect(sent).not.toHaveProperty("reasoning_effort");
    expect(sent.messages).toEqual([{ role: "user", content: request.prompt }]);
  });

  it("preserves Baseten reasoning_effort", async () => {
    const h = harness();
    h.upstream.respond = async () => basetenReply("hello");
    await complete("baseten", h.deps.cfg.providers, { prompt: request.prompt, maxTokens: 400, effort: "high" }, h.deps.fetch);
    expect(JSON.parse(h.upstream.calls[0]!.init.body as string).reasoning_effort).toBe("high");
  });

  it.each(["modal", "glimmer"] as const)("requires both a key and URL for %s, including health", async (provider) => {
    for (const missing of [{ apiKey: undefined }, { apiKey: "" }, { baseUrl: "" }]) {
      const h = harness({ cfg: { providers: { ...CFG.providers, [provider]: { ...CFG.providers[provider], ...missing } } } });
      // Only Modal has an /api/llm kind; Glimmer configuration is still reported by health.
      if (provider === "modal") {
        const res = await h.call("/api/llm", postJson({ ...request, provider }));
        expect(res.status).toBe(503);
        expect(await res.json()).toEqual({ error: "provider_unconfigured", fallback: "reflex" });
      }
      expect(h.upstream.calls).toHaveLength(0);
      expect((await h.ledger.snapshot()).inflight).toBe(0);
      expect(await (await h.call("/api/health")).json()).toMatchObject({ providers: { [provider]: false } });
    }
  });

  it("reports all four configured providers as booleans", async () => {
    const h = harness();
    expect(await (await h.call("/api/health")).json()).toEqual({
      ok: true, mock: false, providers: { baseten: true, meta: true, modal: true, glimmer: true },
    });
  });
});
