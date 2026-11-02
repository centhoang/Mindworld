// The pet checks (docs/testing/checks/pet.md) on the real Teach and Prove code, with the scripted coach standing in for a model.
import { describe, expect, it } from "vitest";
import { describeCond, EMPTY_MEMO, type Memo } from "../sim/memo";
import { prove } from "../sim/proof";
import { ScriptedCortex } from "../sim/cortex";
import { randomGenes } from "./genes";

const coach = new ScriptedCortex();

describe("pet checks", () => {
  it("turns a lesson in plain words into rules you can read", async () => {
    const r = await coach.teach(EMPTY_MEMO, "guard when it winds up a heavy hit");
    expect(r.memo.rules.length).toBeGreaterThan(0);
    const said = r.memo.rules.map((x) => `${x.do}: ${x.if.map(describeCond).join(" and ")}`);
    console.info("[pet proof] rules:", said.join(" | "));
    expect(said.join()).toMatch(/guard/);
  });

  it("shows a real change in Prove, for or against", async () => {
    const r = await coach.teach(EMPTY_MEMO, "guard when it winds up a heavy hit");
    const p = prove(null, r.memo as Memo);
    console.info("[pet proof] heldout:", JSON.stringify(p.heldout));
    expect(p.heldout.n).toBeGreaterThan(0);
    expect(p.heldout.after.winRate).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(p.heldout.winRateDelta)).toBe(true);
  });

  it("makes each pet differ", () => {
    const pets = Array.from({ length: 12 }, (_, i) => JSON.stringify(randomGenes(i * 37 + 5)));
    expect(new Set(pets).size).toBe(12);
  });
});
