import { describe, expect, it } from "vitest";
import { hints, parseOnboard, pixelGoals } from "./onboard";

describe("pixel goals card", () => {
  it("ticks each goal from its own progress flag", () => {
    const none = pixelGoals({ taught: false, party: 0, shipped: false });
    expect(none.map((g) => g.done)).toEqual([false, false, false]);
    const some = pixelGoals({ taught: true, party: 2, shipped: false });
    expect(some.filter((g) => g.done).map((g) => g.id)).toEqual(["teach", "befriend"]);
  });
});

describe("first-run onboarding", () => {
  it("has three hints, with touch wording on phones", () => {
    expect(hints(false)).toHaveLength(3);
    expect(hints(true)[0]!.body).toMatch(/Tap/);
    expect(hints(false)[1]!.body).toMatch(/press E/);
  });
  it("parses the save field and tolerates junk", () => {
    expect(parseOnboard(undefined)).toBeUndefined();
    expect(parseOnboard("x")).toBeUndefined();
    expect(parseOnboard({ seen: true, goalsHidden: "yes" })).toEqual({ seen: true });
    expect(parseOnboard({})).toEqual({});
  });
});
