import { describe, expect, it } from "vitest";
import { memoHash, parseRivalAsk, RIVAL_DAILY_USD, RIVAL_MAX_TOKENS, validatePlan } from "../src/rival";
import { basetenReply, harness, postJson } from "./helpers";

const ASK = { npc: "mo", rules: [{ if: [{ k: "intent", is: "heavy" }], do: "guard", why: "my secret note" }], moves: { attack: 9, guard: 4, hack: 3 } };
const PLAN = { summary: "Ripple waits, then strikes", rules: [{ if: [{ k: "intent", is: "guarding" }], do: "emote", why: "wait" }, { if: [{ k: "last", is: "emote" }], do: "attack", why: "strike" }] };
const day = new Date(1_700_000_000_000).toISOString().slice(0, 10);

describe("/api/rival", () => {
  it("parses the ask: known villager, valid rules, only move counts; the player's notes are dropped", () => {
    const a = parseRivalAsk(ASK)!;
    expect(a.npc).toBe("mo");
    expect(a.memo.rules[0]!.why).toBe("");
    expect(a.moves).toEqual({ attack: 9, guard: 4 });
    expect(parseRivalAsk({ ...ASK, npc: "kai" })).toBeNull();
    expect(parseRivalAsk({ ...ASK, rules: [{ if: [], do: "guard" }] })).toBeNull();
  });

  it("keeps up to 3 valid rules with no enemy or size conditions, dropping bad ones", () => {
    expect(validatePlan(PLAN)!.rules).toHaveLength(2);
    expect(validatePlan({ summary: "", rules: [] })).toBeNull();
    expect(validatePlan({ summary: "", rules: Array.from({ length: 4 }, () => PLAN.rules[0]) })!.rules).toHaveLength(3);
    expect(validatePlan({ summary: "", rules: [{ if: [{ k: "size", is: "bigger" }], do: "flee", why: "" }] })).toBeNull();
    const mixed = validatePlan({ summary: "Go <b>now</b>", rules: [{ if: [{ k: "enemy", is: "brute" }], do: "flee" }, { if: [{ k: "intent", is: "calm" }], do: "dance" }, PLAN.rules[1]] })!;
    expect(mixed.rules).toEqual([PLAN.rules[1]]);
    expect(mixed.summary).not.toMatch(/[<>]/);
  });

  it("asks Muse once per (villager, memo), then serves the cache; books spend", async () => {
    const h = harness();
    h.upstream.respond = async () => basetenReply("let me think... " + JSON.stringify(PLAN), 600, 400);
    const r = (await (await h.call("/api/rival", postJson(ASK))).json()) as { source: string; rules: unknown[]; summary: string };
    expect(r).toMatchObject({ source: "model", summary: "Ripple waits, then strikes" });
    expect(r.rules).toHaveLength(2);
    const sent = JSON.stringify(JSON.parse(String(h.upstream.calls[0]!.init.body)));
    expect(sent).toContain("intent=heavy -> guard");
    expect(sent).not.toContain("my secret note");
    expect((JSON.parse(String(h.upstream.calls[0]!.init.body)) as Record<string, number>).max_tokens ?? 0).toBeLessThanOrEqual(RIVAL_MAX_TOKENS);
    const again = (await (await h.call("/api/rival", postJson(ASK))).json()) as { source: string };
    expect(again.source).toBe("cache");
    expect(h.upstream.calls).toHaveLength(1);
    expect((await h.ledger.snapshot()).dailySpentUsd).toBeGreaterThan(0);
  });

  it("answers no rules (never an error) on a bad reply, an upstream error, or over the daily cap", async () => {
    const h = harness();
    h.upstream.respond = async () => basetenReply("no json");
    expect(await (await h.call("/api/rival", postJson(ASK))).json()).toMatchObject({ source: "none", why: "invalid", rules: [] });
    h.upstream.respond = async () => new Response("down", { status: 500 });
    expect(await (await h.call("/api/rival", postJson({ ...ASK, npc: "ama" }))).json()).toMatchObject({ source: "none", why: "upstream" });
    const capped = harness();
    await capped.ghosts.put(`rival:spend:${day}`, String(RIVAL_DAILY_USD));
    expect(await (await capped.call("/api/rival", postJson(ASK))).json()).toMatchObject({ source: "none", why: "job_cap" });
    expect(capped.upstream.calls).toHaveLength(0);
    expect((await h.call("/api/rival", postJson({ npc: "mo" }))).status).toBe(400);
  });

  it("hashes memos by rules, not notes", () => {
    const a = parseRivalAsk(ASK)!.memo;
    expect(memoHash(a)).toBe(memoHash({ ...a, rules: a.rules.map((r) => ({ ...r, why: "other" })) }));
    expect(memoHash(a)).not.toBe(memoHash({ summary: "", rules: [] }));
  });
});
