import { describe, expect, it } from "vitest";
import { GAZETTE_DAILY_USD, GAZETTE_MAX_TOKENS, gameDayAt, gazettePrompt, parseGazetteAsk, validateHeadlines } from "../src/gazette";
import { basetenReply, harness, metaReply, postJson } from "./helpers";

const NOW = 1_700_000_000_000;
const DAY = gameDayAt(NOW);
const ASK = {
  room: "main",
  day: DAY,
  events: ["Mo: my Ripple beat Kai's pet in a duel", "Ama: Kai's birthday party: I went and Kai came", "Pip: <b>saved</b> up and bought a ball http://x.y"],
  prices: ["fish 4c", "wheat 2c"],
};
const PAPER = { headlines: ["Ripple Wins the Duel of the Day", "Kai's Birthday Party: Everyone Came", "Pip Buys a Shiny New Ball"] };
const utcDay = new Date(NOW).toISOString().slice(0, 10);

describe("/api/gazette", () => {
  it("matches the client's game clock: a day is 12 real minutes from Oct 27 UTC", () => {
    const epoch = Date.UTC(2026, 9, 27);
    expect(gameDayAt(epoch)).toBe(0);
    expect(gameDayAt(epoch + 719_999)).toBe(0);
    expect(gameDayAt(epoch + 720_000)).toBe(1);
  });

  it("parses the ask: a room name, today's game day (give or take one), cleaned notes", () => {
    const a = parseGazetteAsk(ASK, NOW)!;
    expect(a.events[2]).toBe("Pip: b saved b up and bought a ball");
    expect(a.prices).toEqual(["fish 4c", "wheat 2c"]);
    expect(parseGazetteAsk({ ...ASK, day: DAY + 1 }, NOW)).not.toBeNull();
    expect(parseGazetteAsk({ ...ASK, day: DAY + 5 }, NOW)).toBeNull();
    expect(parseGazetteAsk({ ...ASK, room: "Main Room!" }, NOW)).toBeNull();
    expect(parseGazetteAsk({ ...ASK, events: Array.from({ length: 40 }, (_, i) => `Mo: note ${i}`) }, NOW)!.events).toHaveLength(12);
  });

  it("keeps two or three short headlines, cleaned; null otherwise", () => {
    expect(validateHeadlines(PAPER)).toEqual(PAPER.headlines);
    expect(validateHeadlines({ headlines: ["**Big** news at the pond", "ok", "x".repeat(200)] })).toBeNull();
    expect(validateHeadlines({ headlines: ["**Big** news at the pond", "Ama's party was a hit"] })).toEqual(["Big news at the pond", "Ama's party was a hit"]);
    expect(validateHeadlines({ nope: 1 })).toBeNull();
  });

  it("the prompt holds the notes and says never to invent", () => {
    const p = gazettePrompt(parseGazetteAsk(ASK, NOW)!);
    expect(p).toContain(`day ${DAY - 1}`);
    expect(p).toContain("- Mo: my Ripple beat Kai's pet in a duel");
    expect(p).toContain("fish 4c, wheat 2c");
  });

  it("asks Muse Spark on the Meta Model API once per (room, day), then serves the cache; books spend", async () => {
    const h = harness({ now: () => NOW });
    h.upstream.respond = async () => metaReply("thinking... " + JSON.stringify(PAPER), 400, 300);
    const r = (await (await h.call("/api/gazette", postJson(ASK))).json()) as { source: string; headlines: string[]; model: string };
    expect(r).toMatchObject({ source: "model", headlines: PAPER.headlines, model: "muse-spark-1.3" });
    expect(h.upstream.calls[0]!.url).toBe("https://api.meta.ai/v1/responses");
    const body = JSON.parse(String(h.upstream.calls[0]!.init.body)) as { max_output_tokens: number; input: string };
    expect(body.max_output_tokens).toBeLessThanOrEqual(GAZETTE_MAX_TOKENS);
    expect(body.input).toContain("Ripple beat Kai's pet");
    // Another player in the room, with nothing to tell: same paper, no new call.
    const reader = (await (await h.call("/api/gazette", postJson({ ...ASK, events: [] }))).json()) as { source: string; headlines: string[] };
    expect(reader).toMatchObject({ source: "cache", headlines: PAPER.headlines });
    expect(h.upstream.calls).toHaveLength(1);
    expect((await h.ledger.snapshot()).totalSpentUsd.meta).toBeGreaterThan(0);
    // Another room has its own paper.
    expect(await (await h.call("/api/gazette", postJson({ ...ASK, room: "main-2", events: [] }))).json()).toMatchObject({ source: "none", why: "empty" });
  });

  it("answers no headlines (never an error) on a bad reply, an upstream error, a writer at work, or over the cap", async () => {
    const h = harness({ now: () => NOW });
    h.upstream.respond = async () => metaReply("no json");
    expect(await (await h.call("/api/gazette", postJson(ASK))).json()).toMatchObject({ source: "none", why: "invalid", headlines: [] });
    // That writer still holds the day for a minute: nobody calls again meanwhile.
    expect(await (await h.call("/api/gazette", postJson(ASK))).json()).toMatchObject({ source: "none", why: "busy" });
    h.upstream.respond = async () => new Response("down", { status: 500 });
    expect(await (await h.call("/api/gazette", postJson({ ...ASK, room: "main-3" }))).json()).toMatchObject({ source: "none", why: "upstream" });
    const capped = harness({ now: () => NOW });
    await capped.ghosts.put(`gazette:spend:${utcDay}`, String(GAZETTE_DAILY_USD));
    expect(await (await capped.call("/api/gazette", postJson(ASK))).json()).toMatchObject({ source: "none", why: "job_cap" });
    expect(capped.upstream.calls).toHaveLength(0);
    expect((await h.call("/api/gazette", postJson({ room: "main" }))).status).toBe(400);
  });

  it("falls back to the default provider when the Meta key is missing", async () => {
    const base = harness({ now: () => NOW });
    const h = harness({ now: () => NOW, cfg: { providers: { ...base.deps.cfg.providers, meta: { model: "muse-spark-1.3" } } } });
    h.upstream.respond = async () => basetenReply(JSON.stringify(PAPER));
    expect(await (await h.call("/api/gazette", postJson(ASK))).json()).toMatchObject({ source: "model" });
    expect(h.upstream.calls[0]!.url).not.toContain("meta.ai");
  });
});
