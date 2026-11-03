import { describe, expect, it } from "vitest";
import { Battle } from "./battle";
import { GHOST_ARCHETYPE } from "./ghost";
import { validateMemo, type Memo } from "./memo";
import { memoPolicy } from "./policy";
import { duelAsked, duelEnd, duelRefusal, FAIR, habits, nextLesson, playerWinRate, rehearse, rivalDef, rivalOf, RIVAL_OWNERS, whyLost } from "./rivals";
import { DEFAULT_PET } from "./types";

const M = (rules: Memo["rules"]): Memo => ({ summary: "", rules });
const GOOD = M([
  { if: [{ k: "intent", is: "heavy" }], do: "guard", why: "" },
  { if: [{ k: "enemyHp", op: "<", n: 40 }], do: "befriend", why: "" },
  { if: [{ k: "intent", is: "guarding" }], do: "emote", why: "" },
]);

describe("rivals", () => {
  it("every villager's pet has a valid memo in the DSL", () => {
    for (const o of RIVAL_OWNERS) expect(validateMemo(rivalOf(o).memo).dropped).toEqual([]);
  });

  it("hears a duel ask, not talk about some fight", () => {
    for (const yes of ["Wanna duel?", "Let's battle!", "Can our pets fight?", "I challenge you", "duel?", "fight me!"]) expect(duelAsked(yes), yes).toBe(true);
    for (const no of ["Why did you fight?", "I fought a brute today.", "Don't duel me, please?", "The battle was long."]) expect(duelAsked(no), no).toBe(false);
  });

  it("refuses for a reason, in order", () => {
    const ok = { hasPet: true, night: false, working: false, grudge: false, today: 0 };
    expect(duelRefusal(ok)).toBeNull();
    expect(duelRefusal({ ...ok, hasPet: false, night: true })).toBe("no-pet");
    expect(duelRefusal({ ...ok, grudge: true, night: true })).toBe("grudge");
    expect(duelRefusal({ ...ok, working: true })).toBe("work");
    expect(duelRefusal({ ...ok, today: 3 })).toBe("tired");
  });

  it("an untaught pet loses to Mo, Ama and the Elder; a taught one beats them most of the time", () => {
    for (const o of ["mo", "ama", "elder"] as const) {
      expect(playerWinRate(rivalOf(o), M([]), 64), o).toBeLessThan(0.4);
      expect(playerWinRate(rivalOf(o), GOOD, 64), o).toBeGreaterThan(0.6);
    }
  });

  it("keeps its own style when the player would lose anyway, and adapts toward a fair fight otherwise", () => {
    expect(rehearse(rivalOf("mo"), M([])).from).toBe("own");
    const ama = rivalOf("ama");
    const own = playerWinRate(ama, GOOD);
    const study = rehearse(ama, GOOD);
    expect(study.from).toBe("bundled");
    expect(study.playerWins).toBeLessThan(own);
    expect(Math.abs(study.playerWins - FAIR)).toBeLessThan(Math.abs(own - FAIR));
  });

  it("weighs cloud rules in the same rehearsal", () => {
    const cloud = M([{ if: [{ k: "intent", is: "calm" }], do: "attack", why: "strike while it plays nice" }]).rules;
    const study = rehearse(rivalOf("ama"), GOOD, cloud);
    expect(["cloud", "bundled"]).toContain(study.from);
  });

  it("logs the rule behind each move and explains a loss in plain words", () => {
    const mo = rivalOf("mo");
    let lost = null;
    for (let seed = 1; seed < 40 && !lost; seed++) {
      const log: number[] = [];
      const b = new Battle({ enemy: GHOST_ARCHETYPE, seed, enemyDef: rivalDef(mo, DEFAULT_PET, log) });
      const policy = memoPolicy(M([]));
      while (!b.done) b.step(policy(b.observe()));
      const rp = b.replay();
      expect(log.length).toBeGreaterThanOrEqual(rp.turns.length);
      if (duelEnd(rp) === "loss") lost = whyLost(rp, log, mo, M([]));
    }
    expect(lost).not.toBeNull();
    expect(lost!.why).toMatch(/^Ripple /);
    expect(lost!.tip).toMatch(/^Teach your pet to guard when the foe winds up a heavy hit/);
  });

  it("teaches the lessons that beat every rival, one at a time, and those lessons win", () => {
    const steps: Memo["rules"] = [];
    const lessons = [
      { if: [{ k: "intent", is: "heavy" }], do: "guard", why: "" },
      { if: [{ k: "enemyHp", op: "<", n: 40 }], do: "befriend", why: "" },
      { if: [{ k: "intent", is: "guarding" }], do: "emote", why: "" },
    ] as Memo["rules"];
    for (const [i, want] of [/heavy hit/, /make friends/, /wait \(emote\)/, /shouts/].entries()) {
      expect(nextLesson(M([...steps]))).toMatch(want);
      if (lessons[i]) steps.push(lessons[i]!);
    }
    for (const o of RIVAL_OWNERS) {
      const rv = rivalOf(o);
      expect(playerWinRate({ ...rv, memo: rehearse(rv, M(steps)).memo }, M(steps), 64), o).toBeGreaterThan(0.5);
    }
  });

  it("counts what the player's pet does from its memo and last fights", () => {
    expect(habits(GOOD)).toMatchObject({ guard: 2, befriend: 2, emote: 2, attack: 0 });
  });
});
