import { describe, expect, it } from "vitest";
import { duelCoins, duelView, parseFighter, runDuel, type Fighter } from "./duel";
import { EMPTY_MEMO, type Memo } from "./memo";

const guardHeavy: Memo = { summary: "", rules: [{ if: [{ k: "intent", is: "heavy" }], do: "guard", why: "" }] };
const a: Fighter = { id: "a", name: "Ann", genes: { hue: 0.1, build: 0.5 }, memo: guardHeavy };
const b: Fighter = { id: "b", name: "Bo", genes: { hue: 0.9, build: 0.5 }, memo: EMPTY_MEMO };

describe("duel sim", () => {
  it("is deterministic: same seed, same fight on both clients", () => {
    for (const seed of [1, 42, 999_999]) {
      expect(runDuel(a, b, seed)).toEqual(runDuel(structuredClone(a), structuredClone(b), seed));
      expect(JSON.parse(JSON.stringify(runDuel(a, b, seed)))).toEqual(runDuel(a, b, seed));
    }
  });

  it("gives the two players mirror-image views with opposite results", () => {
    let seen = new Set<string>();
    for (let seed = 1; seed < 60; seed++) {
      const va = duelView(a, b, seed, "a");
      const vb = duelView(a, b, seed, "b");
      seen.add(va.result);
      expect(vb.turns).toHaveLength(va.turns.length);
      va.turns.forEach((t, i) => {
        const u = vb.turns[i]!;
        expect([u.dealt, u.taken, u.myHp, u.theirHp]).toEqual([t.taken, t.dealt, t.theirHp, t.myHp]);
        expect(u.theirs).toBe(t.mine);
        expect(u.mine).toBe(t.theirs);
      });
      const pair = `${va.result}/${vb.result}`;
      expect(["win/loss", "loss/win", "draw/draw", "friends/friends"]).toContain(pair);
      expect(va.myMaxHp).toBe(vb.theirMaxHp);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("parses fighters from the room defensively", () => {
    expect(parseFighter({ id: "a", name: "Ann<b>", genes: { hue: 3, x: "y" }, memo: { rules: [{ if: [{ k: "intent", is: "heavy" }], do: "guard" }] } })).toMatchObject({
      name: "Annb",
      genes: { hue: 1 },
      memo: { rules: [{ do: "guard" }] },
    });
    expect(parseFighter({ id: "a", name: "x" })).toBeNull();
    expect(parseFighter(null)).toBeNull();
  });

  it("pays coins to the winner, both on friends", () => {
    expect([duelCoins("win"), duelCoins("friends"), duelCoins("loss"), duelCoins("draw")]).toEqual([3, 2, 0, 0]);
  });
});
