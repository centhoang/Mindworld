import { describe, expect, it } from "vitest";
import { goals, hints, parseOnboard, pixelGoals } from "./onboard";

describe("pixel goals card", () => {
  it("ticks each goal from its own progress flag", () => {
    const none = pixelGoals({ taught: false, party: 0, shipped: false, boss: false });
    expect(none.map((g) => g.done)).toEqual([false, false, false, false]);
    const some = pixelGoals({ taught: true, party: 2, shipped: false, boss: true });
    expect(some.filter((g) => g.done).map((g) => g.id)).toEqual(["teach", "befriend", "boss"]);
  });
});

describe("first-run onboarding", () => {
  it("has three hints, with touch wording on phones", () => {
    expect(hints(false)).toHaveLength(3);
    expect(hints(true)[0]!.body).toMatch(/Tap/);
    expect(hints(false)[1]!.body).toMatch(/press E/);
  });
  it("tracks the three goals from the save", () => {
    expect(goals({ tamed: 0, decor: 0, boss: false }).map((g) => g.done)).toEqual([false, false, false]);
    expect(goals({ tamed: 2, decor: 1, boss: true }).every((g) => g.done)).toBe(true);
    expect(goals({ tamed: 0, decor: 3, boss: false }).find((g) => g.id === "decorate")!.done).toBe(true);
  });
  it("parses the save field and tolerates junk", () => {
    expect(parseOnboard(undefined)).toBeUndefined();
    expect(parseOnboard("x")).toBeUndefined();
    expect(parseOnboard({ seen: true, goalsHidden: "yes" })).toEqual({ seen: true });
    expect(parseOnboard({})).toEqual({});
  });
});
