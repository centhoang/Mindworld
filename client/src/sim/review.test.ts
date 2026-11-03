import { describe, expect, it } from "vitest";
import { Battle } from "./battle";
import { ScriptedCortex } from "./cortex";
import { ENEMIES } from "./enemies";
import type { Memo } from "./memo";
import { memoPolicy } from "./policy";
import { prove } from "./proof";
import { coachReview, LESSONS, withLesson, type LessonId } from "./review";
import { rehearse, rivalDef, rivalOf } from "./rivals";
import { DEFAULT_PET, type Replay, type TurnRecord } from "./types";

const M = (rules: Memo["rules"]): Memo => ({ summary: "", rules });
const EMPTY = M([]);
const brute = () => ENEMIES.brute;

function fight(memo: Memo, seed: number, def = brute): Replay {
  const d = def();
  const b = new Battle({ enemy: d.id, seed, enemyDef: d });
  const policy = memoPolicy(memo);
  while (!b.done) b.step(policy(b.observe()));
  return b.replay();
}

const turn = (t: Partial<TurnRecord> & Pick<TurnRecord, "action">): TurnRecord => ({
  obs: { turn: 1, myHpPct: 100, enemyHpPct: 100, enemy: "brute", size: "similar", intent: "idle", last: "none", ...t.obs },
  enemyAct: "strike", dealt: 0, taken: 0, myHp: 30, enemyHp: 48, ...t,
});

describe("coach review", () => {
  it("every lesson's words become its rule with the free scripted coach, so Teach it works offline", async () => {
    for (const id of Object.keys(LESSONS) as LessonId[]) {
      const { memo } = await new ScriptedCortex().teach(EMPTY, LESSONS[id].words);
      expect(memo.rules.map((r) => [r.if, r.do])).toEqual([[LESSONS[id].rule.if, LESSONS[id].rule.do]]);
    }
  });

  it("after a loss to the brute it proposes a lesson that wins more practice fights and raises Prove", () => {
    const rp = [1, 2, 3, 4, 5, 6].map((s) => fight(EMPTY, s * 31)).find((r) => r.outcome !== "win")!;
    const r = coachReview(rp, EMPTY, { pet: "Mochi", foe: "Brute", def: brute })!;
    expect(r).not.toBeNull();
    expect(r.after - r.before).toBeGreaterThanOrEqual(2 / 32);
    expect(prove(null, withLesson(EMPTY, r.id)).heldout.winRateDelta).toBeGreaterThan(0);
  });

  it("names what it saw: heavy hits taken without guarding", () => {
    const rp: Replay = { enemy: "brute", seed: 1, outcome: "win", how: "ko", myHpEnd: 10, enemyHpEnd: 0, turns: [
      turn({ action: "attack", obs: { intent: "heavy" } as TurnRecord["obs"], enemyAct: "heavy", taken: 9 }),
      turn({ action: "attack", obs: { intent: "heavy" } as TurnRecord["obs"], enemyAct: "heavy", taken: 11 }),
    ] };
    const r = coachReview(rp, EMPTY, { pet: "Mochi", foe: "Brute", def: brute });
    expect(r?.id).toBe("heavy");
    expect(r?.seen).toBe("Mochi took 2 heavy hits without guarding (-20 HP).");
  });

  it("a shouted move is the trainer's call, not a lesson", () => {
    const rp: Replay = { enemy: "brute", seed: 1, outcome: "win", how: "ko", myHpEnd: 10, enemyHpEnd: 0, turns: [
      turn({ action: "attack", obs: { intent: "heavy" } as TurnRecord["obs"], enemyAct: "heavy", taken: 9, shout: true }),
    ] };
    expect(coachReview(rp, EMPTY, { pet: "Mochi", foe: "Brute", def: brute })).toBeNull();
  });

  it("never proposes a lesson the memo already has", () => {
    const memo = M([LESSONS.heavy.rule, LESSONS.friends.rule]);
    for (let s = 1; s <= 8; s++) {
      const r = coachReview(fight(memo, s * 17), memo, { pet: "Mochi", foe: "Brute", def: brute });
      expect(r?.id ?? "none").not.toMatch(/^(heavy|friends)$/);
    }
  });

  it("against a rival, a lesson is rehearsed against the rival as it fought, and never makes the pet worse in general", () => {
    const start = M([LESSONS.heavy.rule]);
    for (const owner of ["mo", "ama", "elder"] as const) {
      const rv = { ...rivalOf(owner), memo: rehearse(rivalOf(owner), start).memo };
      const def = () => rivalDef(rv, DEFAULT_PET, []);
      for (let s = 1; s <= 4; s++) {
        const r = coachReview(fight(start, s * 31, def), start, { pet: "Mochi", foe: rv.name, def });
        if (r) expect(prove(start, withLesson(start, r.id)).heldout.winRateDelta).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
