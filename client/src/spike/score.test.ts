import { describe, expect, it } from "vitest";
import { SCENARIOS } from "./scenarios";
import { parseAction, percentile, summarize, type Sample } from "./score";

describe("parseAction", () => {
  it("accepts a bare action, ignoring case, quotes and a trailing period", () => {
    expect(parseAction("Attack").strict).toBe("attack");
    expect(parseAction(' "guard". ').strict).toBe("guard");
    expect(parseAction("**flee**").strict).toBe("flee");
  });

  it("is strict about extra words but lenient finds the first action", () => {
    const p = parseAction("I would befriend it, not attack");
    expect(p.strict).toBeNull();
    expect(p.lenient).toBe("befriend");
  });

  it("does not match action words inside other words", () => {
    expect(parseAction("counterattack").lenient).toBeNull();
    expect(parseAction("").lenient).toBeNull();
  });
});

describe("summarize", () => {
  const s = (kind: Sample["kind"], text: string, ok: Sample["ok"], ms = 100): Sample => ({ kind, text, ok, ms });

  it("computes validity, sanity, memo compliance and latency percentiles", () => {
    const sum = summarize([
      s("plain", "attack", ["attack"], 100),
      s("plain", "I think guard.", ["attack"], 200),
      s("memo", "guard", ["guard"], 300),
      s("memo", "???", ["flee"], 400),
    ]);
    expect(sum.n).toBe(4);
    expect(sum.strictValidPct).toBe(50);
    expect(sum.lenientValidPct).toBe(75);
    expect(sum.sensiblePlainPct).toBe(50);
    expect(sum.memoCompliancePct).toBe(50);
    expect(sum.latencyMs).toMatchObject({ p50: 200, p95: 400, min: 100, max: 400, mean: 250 });
    expect(sum.invalidSamples).toEqual(["I think guard.", "???"]);
  });

  it("percentile handles tiny and empty inputs", () => {
    expect(percentile([], 95)).toBe(0);
    expect(percentile([7], 50)).toBe(7);
  });
});

describe("scenarios", () => {
  it("has a fixed 20 plain + 12 memo set with unique ids and non-empty sanity sets", () => {
    expect(SCENARIOS.filter((x) => x.kind === "plain")).toHaveLength(20);
    expect(SCENARIOS.filter((x) => x.kind === "memo")).toHaveLength(12);
    expect(new Set(SCENARIOS.map((x) => x.id)).size).toBe(SCENARIOS.length);
    expect(SCENARIOS.every((x) => x.ok.length > 0)).toBe(true);
  });
});
