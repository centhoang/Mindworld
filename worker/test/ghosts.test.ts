import { describe, expect, it } from "vitest";
import { cleanName, GHOST_POSTS_PER_HOUR, GHOST_PREFIX, GHOST_TTL_SECONDS, parseGhost, SEED_GHOST } from "../src/ghosts";
import { cleanText, MAX_CONDS, MAX_RULES, parseGhostMemo } from "../src/memo-dsl";
import { harness, postJson } from "./helpers";

const rule = { if: [{ k: "intent", is: "heavy" }], do: "guard", why: "blunt it" };
const ghost = { name: "Mochi", genes: { ears: 0.4, tail: 0.9 }, memo: { summary: "careful", rules: [rule] } };

describe("ghost API", () => {
  it("stores a ghost with a TTL, then reads it back by id and at random", async () => {
    const h = harness();
    let ttl: number | undefined;
    const put = h.ghosts.put;
    h.ghosts.put = async (k, v, o) => {
      if (k.startsWith(GHOST_PREFIX)) ttl = o?.expirationTtl;
      return put(k, v, o);
    };
    const created = await h.call("/api/ghosts", postJson(ghost));
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };
    expect(id).toMatch(/^[a-f0-9]{20}$/);
    expect(ttl).toBe(GHOST_TTL_SECONDS);
    expect(await (await h.call(`/api/ghosts/${id}`)).json()).toMatchObject({ id, name: "Mochi", genes: ghost.genes, memo: ghost.memo });
    expect(await (await h.call("/api/ghosts/random")).json()).toMatchObject({ id, name: "Mochi" });
  });

  it("serves the built-in seed ghost when the store is empty, 404/400 for unknown or malformed ids", async () => {
    const h = harness();
    const seed = (await (await h.call("/api/ghosts/random")).json()) as typeof SEED_GHOST;
    expect(seed).toMatchObject({ seed: true, name: SEED_GHOST.name });
    expect(parseGhost(seed)).not.toBeNull(); // the seed itself passes validation
    expect((await h.call("/api/ghosts/aaaaaaaaaaaaaaaaaaaa")).status).toBe(404);
    expect((await h.call("/api/ghosts/../secrets")).status).not.toBe(200);
    expect((await h.call("/api/ghosts/NOT-AN-ID")).status).toBe(400);
  });

  it("never serves a stored record that fails validation", async () => {
    const h = harness();
    h.ghosts.data.set(GHOST_PREFIX + "a".repeat(20), JSON.stringify({ id: "a".repeat(20), createdAt: 1, name: "<b>x</b>", genes: {}, memo: "nope" }));
    expect(await (await h.call("/api/ghosts/random")).json()).toMatchObject({ seed: true });
    expect((await h.call(`/api/ghosts/${"a".repeat(20)}`)).status).toBe(404);
  });

  it("rejects bodies over 4 KB with 413", async () => {
    const h = harness();
    const big = { ...ghost, memo: { summary: "x".repeat(5000), rules: [] } };
    expect((await h.call("/api/ghosts", postJson(big))).status).toBe(413);
    expect(h.ghosts.data.size).toBe(0);
  });

  it.each([
    ["empty name", { ...ghost, name: "" }],
    ["name with only symbols", { ...ghost, name: "<>/.@" }],
    ["string gene", { ...ghost, genes: { ears: "big" } }],
    ["gene out of 0..1", { ...ghost, genes: { ears: 7 } }],
    ["too many genes", { ...ghost, genes: Object.fromEntries([...Array(13)].map((_, i) => [`g${i}`, 0.5])) }],
    ["no memo", { name: "a", genes: {} }],
    ["memo without rules", { ...ghost, memo: { summary: "x" } }],
    ["too many rules", { ...ghost, memo: { summary: "", rules: Array(MAX_RULES + 1).fill(rule) } }],
    ["too many conds", { ...ghost, memo: { summary: "", rules: [{ ...rule, if: Array(MAX_CONDS + 1).fill(rule.if[0]) }] } }],
    ["unknown action", { ...ghost, memo: { summary: "", rules: [{ ...rule, do: "nuke" }] } }],
    ["unknown cond", { ...ghost, memo: { summary: "", rules: [{ ...rule, if: [{ k: "mood", is: "x" }] }] } }],
    ["array body", [ghost]],
  ])("rejects an invalid ghost: %s", async (_n, body) => {
    const h = harness();
    expect((await h.call("/api/ghosts", postJson(body))).status).toBe(400);
    expect([...h.ghosts.data.keys()].filter((k) => k.startsWith(GHOST_PREFIX))).toHaveLength(0);
  });

  it("rejects malformed JSON", async () => {
    const h = harness();
    expect((await h.call("/api/ghosts", { method: "POST", body: "{nope" })).status).toBe(400);
  });

  it("rate-limits uploads per client per hour", async () => {
    const h = harness();
    for (let i = 0; i < GHOST_POSTS_PER_HOUR; i++) {
      expect((await h.call("/api/ghosts", { ...postJson(ghost), ip: "1.1.1.1" })).status).toBe(201);
    }
    expect((await h.call("/api/ghosts", { ...postJson(ghost), ip: "1.1.1.1" })).status).toBe(429);
    expect((await h.call("/api/ghosts", { ...postJson(ghost), ip: "2.2.2.2" })).status).toBe(201);
  });
});

describe("ghost sanitizing", () => {
  it("keeps names short and free of links and markup", () => {
    expect(cleanName("  Mochi  the   Brave ")).toBe("Mochi the Brave");
    expect(cleanName("x".repeat(40))).toHaveLength(16);
    expect(cleanName("<script>evil.com</script>")).toBe("scriptevilcomscr");
    expect(cleanName("visit http://a.io")).not.toMatch(/[:/.]/);
    expect(cleanName("Mötley_Pip-2")).toBe("Mötley_Pip-2");
    expect(cleanName(42)).toBeNull();
  });

  it("strips URLs, e-mails and HTML from memo text and drops unknown fields", () => {
    expect(cleanText("see https://x.io/a and www.y.com now", 120)).toBe("see and now");
    expect(cleanText("mail me a@b.co or evil.com/x", 120)).toBe("mail me or");
    expect(cleanText("<img src=x onerror=1>", 120)).not.toMatch(/[<>]/);
    const m = parseGhostMemo({ summary: "hi\nthere", rules: [{ ...rule, extra: 1, if: [{ k: "myHp", op: "<", n: 30, x: 2 }] }], owner: "me" });
    expect(m).toEqual({ summary: "hi there", rules: [{ if: [{ k: "myHp", op: "<", n: 30 }], do: "guard", why: "blunt it" }] });
  });

  it("only stores name, genes and memo", () => {
    const g = parseGhost({ ...ghost, email: "a@b.co", stats: { atk: 999 } });
    expect(Object.keys(g!).sort()).toEqual(["genes", "memo", "name"]);
  });
});
