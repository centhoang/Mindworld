import { describe, expect, it } from "vitest";
import { basetenReply, CFG, harness, postJson } from "./helpers";

const request = { kind: "memo", prompt: "summarize the fight", maxTokens: 400 };

describe("Modal providers", () => {
  it.each(["https://modal.test", "https://modal.test/v1", "https://modal.test/v1/"])(
    "sends Modal effort and Bearer authentication with base URL %s", async (baseUrl) => {
      const h = harness({ cfg: { providers: { ...CFG.providers, modal: { ...CFG.providers.modal, baseUrl } } } });
      h.upstream.respond = async () => basetenReply("hello");
      const res = await h.call("/api/llm", postJson({ ...request, provider: "modal", system: "be brief", effort: "low" }));
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ provider: "modal", text: "hello" });
      const call = h.upstream.calls[0]!;
      expect(call.url).toBe("https://modal.test/v1/chat/completions");
      expect(new Headers(call.init.headers).get("authorization")).toBe("Bearer wk-test.ws-test");
      expect(JSON.parse(call.init.body as string)).toEqual({
        model: "meta-models/Muse-Spark-Open", max_tokens: 400, reasoning_effort: "low",
        messages: [{ role: "system", content: "be brief" }, { role: "user", content: request.prompt }],
      });
      expect((await h.ledger.snapshot()).totalSpentUsd.modal).toBeGreaterThan(0);
    },
  );

  it.each([undefined, "", "be brief"])("prepends Glimmer reasoning to the system message (%s)", async (system) => {
    const h = harness();
    h.upstream.respond = async () => basetenReply("hello");
    const res = await h.call("/api/llm", postJson({ ...request, provider: "glimmer", system, effort: "low" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ provider: "glimmer", text: "hello", costUsd: 0.00023 });
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
    expect((await h.ledger.snapshot()).totalSpentUsd.glimmer).toBe(0.00023);
  });

  it.each(["baseten", "modal", "glimmer"] as const)("omits reasoning effort when unset for %s", async (provider) => {
    const h = harness();
    h.upstream.respond = async () => basetenReply("hello");
    expect((await h.call("/api/llm", postJson({ ...request, provider }))).status).toBe(200);
    const sent = JSON.parse(h.upstream.calls[0]!.init.body as string);
    expect(sent).not.toHaveProperty("reasoning_effort");
    expect(sent.messages).toEqual([{ role: "user", content: request.prompt }]);
  });

  it("preserves Baseten reasoning_effort", async () => {
    const h = harness();
    h.upstream.respond = async () => basetenReply("hello");
    await h.call("/api/llm", postJson({ ...request, effort: "high" }));
    expect(JSON.parse(h.upstream.calls[0]!.init.body as string).reasoning_effort).toBe("high");
  });

  it.each(["modal", "glimmer"] as const)("requires both a key and URL for %s, including health", async (provider) => {
    for (const missing of [{ apiKey: undefined }, { apiKey: "" }, { baseUrl: "" }]) {
      const h = harness({ cfg: { providers: { ...CFG.providers, [provider]: { ...CFG.providers[provider], ...missing } } } });
      const res = await h.call("/api/llm", postJson({ ...request, provider }));
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: "provider_unconfigured", fallback: "reflex" });
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
