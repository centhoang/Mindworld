import { describe, expect, it } from "vitest";
import { Battle, isWin, runBattle } from "./battle";
import { BOSS_FOCUS, BOSS_TURNS, makeBoss } from "./boss";
import type { Memo, Rule } from "./memo";
import { memoPolicy } from "./policy";

const rule = (r: Omit<Rule, "why">): Rule => ({ ...r, why: "" });
const guardHeavy: Memo = { summary: "", rules: [rule({ if: [{ k: "intent", is: "heavy" }], do: "guard" })] };
// Burns the boss's focus with a harmless rule, then befriends it while it is dazed.
const clever: Memo = {
  summary: "",
  rules: [rule({ if: [{ k: "intent", is: "calm" }], do: "befriend" }), rule({ if: [{ k: "intent", is: "idle" }], do: "guard" })],
};

const winRate = (memo: Memo, n = 300) => {
  let w = 0;
  for (let s = 0; s < n; s++) {
    const b = makeBoss(memo);
    if (isWin(runBattle({ enemy: "bully", seed: s, enemyDef: b.def, maxTurns: BOSS_TURNS }, memoPolicy(memo)))) w++;
  }
  return w / n;
};

describe("The Reader boss", () => {
  it("never reads an empty memo and just follows its pattern", () => {
    const b = makeBoss({ summary: "", rules: [] });
    const r = runBattle({ enemy: "bully", seed: 1, enemyDef: b.def, maxTurns: BOSS_TURNS }, memoPolicy({ summary: "", rules: [] }));
    expect(b.reads).toEqual([]);
    expect(b.dazedTurns).toEqual([]);
    r.turns.forEach((t) => expect(t.enemyAct).toBe(t.obs.turn % 3 === 0 ? "heavy" : "strike"));
  });

  it("feints: shows the tell the rule reacts to, then does the counter", () => {
    const b = makeBoss(guardHeavy);
    const battle = new Battle({ enemy: "bully", seed: 3, enemyDef: b.def, maxTurns: BOSS_TURNS });
    for (let i = 0; i < 2; i++) battle.step("attack");
    expect(battle.observe().intent).toBe("heavy"); // turn 3: looks like a heavy hit
    const rec = battle.step("guard");
    expect(rec.enemyAct).toBe("idle"); // but it pauses, so the guard is wasted
    expect(b.reads).toEqual([{ turn: 3, rule: 0, feint: "heavy", did: "idle" }]);
  });

  it(`is dazed (calm, cannot read) after ${BOSS_FOCUS} reads`, () => {
    const b = makeBoss(clever);
    const battle = new Battle({ enemy: "bully", seed: 5, enemyDef: b.def, maxTurns: BOSS_TURNS });
    battle.step("guard");
    battle.step("guard");
    expect(b.reads.length).toBe(BOSS_FOCUS);
    expect(b.dazedTurns).toEqual([3]);
    expect(battle.observe().intent).toBe("calm");
  });

  it("punishes the obvious memo and loses to one taught to use the daze", () => {
    expect(winRate({ summary: "", rules: [] })).toBeLessThan(0.05);
    expect(winRate(guardHeavy)).toBeLessThan(0.1);
    expect(winRate(clever)).toBeGreaterThan(0.85);
  });

  it("is a fresh mind each fight", () => {
    const a = makeBoss(clever);
    runBattle({ enemy: "bully", seed: 9, enemyDef: a.def, maxTurns: BOSS_TURNS }, memoPolicy(clever));
    expect(makeBoss(clever).reads).toEqual([]);
  });
});
