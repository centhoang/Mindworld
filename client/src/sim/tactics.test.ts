import { describe, expect, it } from "vitest";
import { ENEMIES } from "./enemies";
import { fetchWildMemos, parseWildMemos, withTactics } from "./tactics";

const brute = { summary: "Waits out guards", rules: [{ if: [{ k: "intent", is: "guarding" }], do: "guard", why: "save strength" }] };
const ctx = (turn: number, petLast: "attack" | "guard" | "none") => ({ seed: 1, turn, enemyHpPct: 100, myHpPct: 100, petLast, calm: 0 });

describe("wild-pet tactics", () => {
  it("keeps only valid memos for known keys (no enemy/size conditions, <= 3 rules)", () => {
    const bad = { summary: "x", rules: [{ if: [{ k: "size", is: "bigger" }], do: "flee", why: "" }] };
    const many = { summary: "x", rules: [1, 2, 3, 4].map((n) => ({ if: [{ k: "turn", op: ">=", n }], do: "attack", why: "" })) };
    const m = parseWildMemos({ memos: { brute, skitter: bad, turtle: many, pal: { rules: [{ do: "dance" }] }, admin: brute } });
    expect(Object.keys(m)).toEqual(["brute"]);
    expect(parseWildMemos(null)).toEqual({});
  });

  it("follows a matching tactic, otherwise the archetype's own pattern", () => {
    const def = withTactics(ENEMIES.brute, parseWildMemos({ memos: { brute } }).brute);
    expect(def.act(ctx(1, "attack"))).toBe("strike"); // no match: own pattern
    expect(def.act(ctx(3, "guard"))).toBe("guard"); // pet guarded: the tactic overrides the heavy
    expect(def.act(ctx(3, "attack"))).toBe("heavy"); // own pattern again
    expect(withTactics(ENEMIES.pal, undefined)).toBe(ENEMIES.pal);
  });

  it("falls back to no tactics when offline or on a bad reply", async () => {
    expect(await fetchWildMemos("", (async () => { throw new Error("offline"); }) as typeof fetch)).toEqual({});
    expect(await fetchWildMemos("", (async () => new Response("x", { status: 500 })) as typeof fetch)).toEqual({});
    const ok = await fetchWildMemos("", (async () => new Response(JSON.stringify({ memos: { brute } }))) as typeof fetch);
    expect(ok.brute?.rules).toHaveLength(1);
  });
});
