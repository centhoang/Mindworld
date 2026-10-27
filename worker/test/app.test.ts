import { describe, expect, it, vi } from "vitest";
import { geoOf, isRestricted } from "../src/geo";
import { actualCostUsd, estimateInputTokens, worstCaseCostUsd } from "../src/pricing";
import { basetenReply, harness, metaReply, postJson } from "./helpers";

const llmBody = { kind: "memo", system: "be brief", prompt: "summarize the fight", maxTokens: 400 };

describe("geo-block", () => {
  it.each(["CN", "RU", "IR", "PK", "KP", "VE", "HK", "MM"])("returns 451 for %s on every route", async (country) => {
    const h = harness();
    for (const path of ["/", "/api/health", "/api/spend"]) {
      const res = await h.call(path, { country });
      expect(res.status).toBe(451);
      expect((await res.json()) as { error: string }).toMatchObject({ error: "region_restricted" });
    }
    expect(h.upstream.calls).toHaveLength(0);
  });

  it("allows other countries, and a request with no location at all (local dev)", async () => {
    const h = harness();
    expect((await h.call("/api/health", { country: "US" })).status).toBe(200);
    expect((await h.call("/api/health", { country: "VN" })).status).toBe(200);
    expect((await h.call("/api/health")).status).toBe(200);
  });

  it("fails closed when Cloudflare cannot place the user (XX) or sees Tor (T1)", () => {
    expect(isRestricted({ country: "XX", regionCode: null })).toBe(true);
    expect(isRestricted({ country: "T1", regionCode: null })).toBe(true);
  });

  it("blocks Crimea/Donetsk/Luhansk by region code, and Ukraine when the region is unknown", () => {
    expect(isRestricted({ country: "UA", regionCode: "43" })).toBe(true);
    expect(isRestricted({ country: "UA", regionCode: "14" })).toBe(true);
    expect(isRestricted({ country: "UA", regionCode: "09" })).toBe(true);
    expect(isRestricted({ country: "UA", regionCode: "30" })).toBe(false);
    expect(isRestricted({ country: "UA", regionCode: null })).toBe(true);
  });

  it("reads the country from the cf object first", () => {
    const req = Object.assign(new Request("https://x.test"), { cf: { country: "ru" } });
    expect(geoOf(req).country).toBe("RU");
  });
});

describe("pricing", () => {
  it("worst case is never below the real cost for any usage within the limits", () => {
    const input = estimateInputTokens("x".repeat(2000));
    const worst = worstCaseCostUsd("baseten", input, 500);
    const real = actualCostUsd("baseten", { inputTokens: input, cachedInputTokens: 0, outputTokens: 500 });
    expect(worst).toBeGreaterThanOrEqual(real);
  });

  it("input estimate bounds the token count for dense Unicode (never below one token per UTF-8 byte)", () => {
    expect(estimateInputTokens("中".repeat(1000))).toBeGreaterThanOrEqual(3000);
    expect(estimateInputTokens("😀".repeat(500))).toBeGreaterThanOrEqual(2000);
    expect(estimateInputTokens("")).toBeGreaterThan(0);
  });

  it("charges cached input at the cheaper rate", () => {
    const full = actualCostUsd("meta", { inputTokens: 1000, cachedInputTokens: 0, outputTokens: 0 });
    const cached = actualCostUsd("meta", { inputTokens: 1000, cachedInputTokens: 1000, outputTokens: 0 });
    expect(cached).toBeLessThan(full);
  });
});

describe("POST /api/llm", () => {
  it("proxies to Baseten with the server-side key and settles the real cost", async () => {
    const h = harness();
    h.upstream.respond = async () => basetenReply("hello", 200, 100);
    const res = await h.call("/api/llm", postJson(llmBody));
    expect(res.status).toBe(200);
    const out = (await res.json()) as Record<string, unknown>;
    expect(out).toMatchObject({ text: "hello", provider: "baseten", mock: false, truncated: false });
    expect(out.costUsd).toBeCloseTo(actualCostUsd("baseten", { inputTokens: 200, cachedInputTokens: 0, outputTokens: 100 }), 9);

    const call = h.upstream.calls[0]!;
    expect(call.url).toBe("https://baseten.test/v1/chat/completions");
    expect((call.init.headers as Record<string, string>).authorization).toBe("Bearer test-baseten-key");
    const sent = JSON.parse(call.init.body as string);
    expect(sent).toMatchObject({ model: "meta-models/muse-spark-open-1026", max_tokens: 400 });
    expect(sent.messages[0]).toEqual({ role: "system", content: "be brief" });

    expect(JSON.stringify(out)).not.toContain("test-baseten-key");
    const snap = await h.ledger.snapshot();
    expect(snap.inflight).toBe(0);
    expect(snap.dailySpentUsd).toBeGreaterThan(0);
  });

  it("proxies to the Meta Responses API and reads the nested output text", async () => {
    const h = harness();
    h.upstream.respond = async () => metaReply("ok from meta");
    const res = await h.call("/api/llm", postJson({ ...llmBody, provider: "meta" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ text: "ok from meta", provider: "meta", model: "muse-spark-1.3" });
    const call = h.upstream.calls[0]!;
    expect(call.url).toBe("https://api.meta.ai/v1/responses");
    expect(JSON.parse(call.init.body as string)).toMatchObject({
      model: "muse-spark-1.3",
      instructions: "be brief",
      input: "summarize the fight",
      max_output_tokens: 400,
    });
  });

  it("mock mode never calls upstream, costs nothing and needs no keys", async () => {
    const h = harness({ cfg: { mock: true, providers: { baseten: { baseUrl: "x", model: "m" }, meta: { model: "m" } } } });
    const res = await h.call("/api/llm", postJson(llmBody));
    expect(res.status).toBe(200);
    const out = (await res.json()) as { mock: boolean; costUsd: number; text: string };
    expect(out).toMatchObject({ mock: true, costUsd: 0 });
    expect(JSON.parse(out.text)).toHaveProperty("rules");
    expect(h.upstream.calls).toHaveLength(0);
    expect((await h.ledger.snapshot()).dailySpentUsd).toBe(0);
  });

  it("refuses with a reflex fallback once the daily cap would be exceeded, without calling upstream", async () => {
    const h = harness({ limits: { dailyUsd: 0.001 } });
    h.upstream.respond = async () => basetenReply("never");
    const res = await h.call("/api/llm", postJson(llmBody));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: "budget_exhausted", reason: "daily_cap", fallback: "reflex" });
    expect(h.upstream.calls).toHaveLength(0);
  });

  it("rate limits one client but not another", async () => {
    const h = harness({ cfg: { mock: true }, limits: { clientPerMinute: 2 } });
    const post = (ip: string) => h.call("/api/llm", { ...postJson(llmBody), ip });
    expect((await post("1.1.1.1")).status).toBe(200);
    expect((await post("1.1.1.1")).status).toBe(200);
    const limited = await post("1.1.1.1");
    expect(limited.status).toBe(429);
    expect(await limited.json()).toMatchObject({ error: "rate_limited" });
    expect((await post("2.2.2.2")).status).toBe(200);
  });

  it("releases the reservation when upstream returns an error status", async () => {
    const h = harness();
    h.upstream.respond = async () => new Response("nope", { status: 429 });
    const res = await h.call("/api/llm", postJson(llmBody));
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: "upstream_error", upstreamStatus: 429, fallback: "reflex" });
    const snap = await h.ledger.snapshot();
    expect(snap.inflight).toBe(0);
    expect(snap.dailySpentUsd).toBe(0);
  });

  it("books the worst case when the connection fails (it may have been billed before the reset)", async () => {
    const h = harness();
    h.upstream.respond = async () => {
      throw new TypeError("connection reset");
    };
    const res = await h.call("/api/llm", postJson(llmBody));
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: "upstream_unreadable" });
    const snap = await h.ledger.snapshot();
    expect(snap.inflight).toBe(0);
    expect(snap.dailySpentUsd).toBeGreaterThan(0);
  });

  it.each([
    ["usage missing", { choices: [{ message: { content: "x" } }] }],
    ["usage null", { choices: [{ message: { content: "x" } }], usage: null }],
    ["usage empty", { choices: [{ message: { content: "x" } }], usage: {} }],
    ["negative tokens", { choices: [{ message: { content: "x" } }], usage: { prompt_tokens: -5, completion_tokens: 3 } }],
  ])("books the worst case when a 2xx has no usable usage: %s", async (_n, payload) => {
    const h = harness();
    h.upstream.respond = async () => new Response(JSON.stringify(payload), { status: 200 });
    const res = await h.call("/api/llm", postJson(llmBody));
    expect(res.status).toBe(502);
    const snap = await h.ledger.snapshot();
    expect(snap.inflight).toBe(0);
    expect(snap.dailySpentUsd).toBeGreaterThan(0);
  });

  it("times out a stalled response body and books the worst case", async () => {
    vi.useFakeTimers();
    try {
      const h = harness();
      h.upstream.respond = (_url, init) =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => new Promise((_res, rej) => init.signal!.addEventListener("abort", () => rej(new Error("aborted")))),
        } as unknown as Response);
      const pending = h.call("/api/llm", postJson(llmBody));
      await vi.advanceTimersByTimeAsync(41_000);
      const res = await pending;
      expect(res.status).toBe(502);
      expect(await res.json()).toMatchObject({ error: "upstream_unreadable", message: "upstream timeout" });
      expect((await h.ledger.snapshot()).dailySpentUsd).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("books the worst case when a 2xx body cannot be read (it may have been billed)", async () => {
    const h = harness();
    h.upstream.respond = async () => new Response("<html>gateway</html>", { status: 200 });
    const res = await h.call("/api/llm", postJson(llmBody));
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: "upstream_unreadable" });
    const snap = await h.ledger.snapshot();
    expect(snap.inflight).toBe(0);
    expect(snap.dailySpentUsd).toBeGreaterThan(0);
  });

  it("flags truncated answers (reasoning ate the token budget)", async () => {
    const h = harness();
    h.upstream.respond = async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "" }, finish_reason: "length" }],
          usage: { prompt_tokens: 10, completion_tokens: 400 },
        }),
      );
    const out = (await (await h.call("/api/llm", postJson(llmBody))).json()) as { text: string; truncated: boolean };
    expect(out).toMatchObject({ text: "", truncated: true });
  });

  it("returns 503 when the chosen provider has no key", async () => {
    const h = harness({ cfg: { providers: { baseten: { baseUrl: "x", model: "m" }, meta: { model: "m" } } } });
    const res = await h.call("/api/llm", postJson(llmBody));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: "provider_unconfigured" });
  });

  it.each([
    ["unknown provider", { ...llmBody, provider: "openai" }],
    ["unknown kind", { ...llmBody, kind: "hack" }],
    ["empty prompt", { ...llmBody, prompt: "" }],
    ["huge prompt", { ...llmBody, prompt: "x".repeat(9000) }],
    ["tiny maxTokens", { ...llmBody, maxTokens: 3 }],
    ["fractional maxTokens", { ...llmBody, maxTokens: 100.5 }],
    ["non-object body", "just a string"],
  ])("rejects %s with 400 and no upstream call", async (_name, body) => {
    const h = harness();
    const res = await h.call("/api/llm", postJson(body));
    expect(res.status).toBe(400);
    expect(h.upstream.calls).toHaveLength(0);
  });

  it("clamps maxTokens to the server limit", async () => {
    const h = harness();
    h.upstream.respond = async () => basetenReply("x");
    await h.call("/api/llm", postJson({ ...llmBody, maxTokens: 50_000 }));
    expect(JSON.parse(h.upstream.calls[0]!.init.body as string).max_tokens).toBe(2000);
  });

  it("GET /api/spend exposes only aggregate numbers", async () => {
    const h = harness();
    const snap = (await (await h.call("/api/spend")).json()) as Record<string, unknown>;
    expect(Object.keys(snap).sort()).toEqual(
      ["dailyCapUsd", "dailyReservedUsd", "dailySpentUsd", "day", "inflight", "overrunUsd", "totalCapUsd", "totalSpentUsd"].sort(),
    );
  });
});

describe("ghost snapshots (KV stub)", () => {
  const ghost = { name: "Mochi", genes: { ears: 0.4, tail: 0.9 }, memo: { summary: "careful", rules: [] } };

  it("stores a ghost, then reads it back by id and at random", async () => {
    const h = harness();
    const created = await h.call("/api/ghosts", postJson(ghost));
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };
    expect(id).toMatch(/^[a-f0-9]{20}$/);
    expect(await (await h.call(`/api/ghosts/${id}`)).json()).toMatchObject({ id, name: "Mochi", genes: ghost.genes });
    expect(await (await h.call("/api/ghosts/random")).json()).toMatchObject({ id, name: "Mochi" });
  });

  it("returns 404 when there is no ghost and 400 for malformed ids", async () => {
    const h = harness();
    expect((await h.call("/api/ghosts/random")).status).toBe(404);
    expect((await h.call("/api/ghosts/aaaaaaaaaaaaaaaaaaaa")).status).toBe(404);
    expect((await h.call("/api/ghosts/../secrets")).status).not.toBe(200);
    expect((await h.call("/api/ghosts/NOT-AN-ID")).status).toBe(400);
  });

  it.each([
    ["missing name", { ...ghost, name: "" }],
    ["long name", { ...ghost, name: "x".repeat(25) }],
    ["string gene", { ...ghost, genes: { ears: "big" } }],
    ["no memo", { name: "a", genes: {} }],
    ["huge memo", { ...ghost, memo: { text: "x".repeat(4000) } }],
  ])("rejects an invalid ghost: %s", async (_n, body) => {
    const h = harness();
    expect((await h.call("/api/ghosts", postJson(body))).status).toBe(400);
    expect(h.ghosts.data.size).toBe(0);
  });
});

describe("static assets", () => {
  it("serves the client for non-API paths through the geo-blocking Worker", async () => {
    const h = harness();
    const res = await h.call("/spike-b.html");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("asset");
  });

  it("returns JSON 404 for unknown API routes", async () => {
    const h = harness();
    expect((await h.call("/api/nope")).status).toBe(404);
  });
});
