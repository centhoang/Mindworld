import { describe, expect, it } from "vitest";
import { CortexUnavailable, ScriptedCortex, type Cortex, type CortexResult } from "../sim/cortex";
import { EMPTY_MEMO } from "../sim/memo";
import { runCoach } from "./coach";

const down: Cortex = {
  teach: () => Promise.reject(new CortexUnavailable("budget reached")),
  reflect: () => Promise.reject(new Error("net")),
};

describe("coach chain", () => {
  it("falls through to the scripted coach and says why", async () => {
    const names = new Map([[down, "live coach"]]);
    const out = await runCoach([down, new ScriptedCortex()], (c) => c.teach(EMPTY_MEMO, "guard when it winds up a heavy hit"), EMPTY_MEMO, { names });
    expect(out.memo?.rules.length).toBeGreaterThan(0);
    expect(out.note).toContain("live coach: budget reached");
    expect(out.note).toContain("offline coach");
  });

  it("reports failure when the last coach throws", async () => {
    const out = await runCoach([down], (c) => c.teach(EMPTY_MEMO, "x"), EMPTY_MEMO);
    expect(out.memo).toBeNull();
    expect(out.note).toMatch(/Memo unchanged/);
  });

  it("gated reviews keep the old memo when the new one is worse", async () => {
    const good = (await new ScriptedCortex().teach(EMPTY_MEMO, "guard when it winds up a heavy hit")).memo;
    const worse: Cortex = {
      teach: () => Promise.reject(new Error("unused")),
      reflect: async (): Promise<CortexResult> => ({ memo: { summary: "", rules: [{ if: [{ k: "turn", op: ">=", n: 1 }], do: "flee", why: "" }] }, dropped: [], source: "muse-spark", costUsd: 0, latencyMs: 1 }),
    };
    const out = await runCoach([worse], (c) => c.reflect(good, []), good, { gated: true });
    expect(out.memo).toBeNull();
    expect(out.note).toMatch(/keeps its current memo/);
  });
});
