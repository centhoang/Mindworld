import { describe, expect, it } from "vitest";
import { saveGhost, SEED_GHOST } from "../src/ghosts";
import { runWildMemos, validateMemos, WILD_DAILY_USD, WILD_MAX_TOKENS, WILD_MEMOS_KEY } from "../src/wild-memos";
import { basetenReply, harness } from "./helpers";

const GOOD = {
  brute: { summary: "Punishes guards", rules: [{ if: [{ k: "intent", is: "guarding" }], do: "guard", why: "wait it out" }] },
  pal: { summary: "Kind back", rules: [{ if: [{ k: "intent", is: "calm" }], do: "emote", why: "friends" }] },
  skitter: { summary: "bad", rules: [{ if: [{ k: "enemy", is: "brute" }], do: "flee", why: "x" }] }, // enemy cond: rejected
  turtle: { summary: "bad", rules: [{ if: [{ k: "intent", is: "calm" }], do: "dance", why: "x" }] }, // unknown action: rejected
};

async function withGhost(h: ReturnType<typeof harness>) {
  const { id: _id, createdAt: _c, seed: _s, ...g } = SEED_GHOST;
  await saveGhost(h.ghosts, "a".repeat(20), g, 1);
}

describe("wild-pet memo cron", () => {
  it("validates per key: drops enemy/size conditions, bad actions, too many rules and unknown keys", () => {
    const tooMany = { summary: "x", rules: Array.from({ length: 4 }, () => GOOD.brute.rules[0]) };
    expect(Object.keys(validateMemos({ ...GOOD, bully: tooMany, admin: GOOD.brute })).sort()).toEqual(["brute", "pal"]);
    expect(validateMemos("nope")).toEqual({});
  });

  it("asks Muse once with the shared ghosts' rules, stores only valid memos, books spend", async () => {
    const h = harness();
    await withGhost(h);
    h.upstream.respond = async () => basetenReply("thinking... " + JSON.stringify(GOOD), 900, 1200);
    const r = await runWildMemos(h.deps);
    expect(r).toMatchObject({ source: "model" });
    expect(r.keys.sort()).toEqual(["brute", "pal"]);
    expect(h.upstream.calls).toHaveLength(1);
    const sent = JSON.parse(String(h.upstream.calls[0]!.init.body)) as Record<string, unknown>;
    expect(JSON.stringify(sent)).toContain("intent=heavy -> guard"); // the seed ghost's rule reached the prompt
    expect((sent.max_tokens ?? sent.max_completion_tokens) as number).toBe(WILD_MAX_TOKENS);
    const res = await h.call("/api/wild-memos");
    const body = (await res.json()) as { source: string; memos: Record<string, unknown>; version: number };
    expect(body).toMatchObject({ source: "model", version: 1 });
    expect(Object.keys(body.memos).sort()).toEqual(["brute", "pal"]);
    expect((await h.ledger.snapshot()).dailySpentUsd).toBeGreaterThan(0);
  });

  it("serves an empty default before any run", async () => {
    const h = harness();
    expect(await (await h.call("/api/wild-memos")).json()).toMatchObject({ source: "default", memos: {} });
  });

  it("keeps the previous memos when the reply is invalid, and goes scripted when there are none", async () => {
    const h = harness();
    h.upstream.respond = async () => basetenReply("no json here");
    const first = await runWildMemos(h.deps);
    expect(first.source).toBe("scripted");
    expect(first.keys.length).toBeGreaterThan(0);
    const again = await runWildMemos(h.deps);
    expect(again).toMatchObject({ source: "kept", why: "invalid" });
  });

  it("stops at the job's daily cap and never calls upstream over it", async () => {
    const h = harness();
    await h.ghosts.put(`wild:spend:${new Date(1_700_000_000_000).toISOString().slice(0, 10)}`, String(WILD_DAILY_USD));
    const r = await runWildMemos(h.deps);
    expect(r).toMatchObject({ source: "scripted", why: "job_cap" });
    expect(h.upstream.calls).toHaveLength(0);
  });

  it("allows only 4 model calls per day (one per 6 h run)", async () => {
    const h = harness();
    h.upstream.respond = async () => basetenReply(JSON.stringify(GOOD), 100, 100);
    for (let i = 0; i < 4; i++) expect((await runWildMemos(h.deps)).source).toBe("model");
    expect((await runWildMemos(h.deps)).source).toBe("kept");
    expect(h.upstream.calls).toHaveLength(4);
  });

  it("falls back without a provider key and un-books spend on an upstream error", async () => {
    const h = harness();
    h.upstream.respond = async () => new Response("down", { status: 500 });
    expect((await runWildMemos(h.deps)).why).toBe("upstream");
    const day = new Date(1_700_000_000_000).toISOString().slice(0, 10);
    expect(Number(await h.ghosts.get(`wild:spend:${day}`))).toBe(0);
    const bare = harness({ cfg: { providers: { ...h.deps.cfg.providers, baseten: { ...h.deps.cfg.providers.baseten, apiKey: undefined } } } });
    expect((await runWildMemos(bare.deps)).why).toBe("unconfigured");
    expect(bare.ghosts.data.has(WILD_MEMOS_KEY)).toBe(true);
  });
});
