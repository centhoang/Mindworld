import { describe, expect, it } from "vitest";
import { followStep, FOLLOW_GAP, keyDir, slide, stepToward } from "./movement";

describe("movement", () => {
  const ok = (x: number, z: number) => Math.abs(x) <= 2 && Math.abs(z) <= 2;

  it("slides along an edge instead of stopping", () => {
    expect(slide({ x: 2, z: 0 }, 0.5, 0.5, ok)).toEqual({ x: 2, z: 0.5 });
    expect(slide({ x: 2, z: 2 }, 0.5, 0.5, ok)).toEqual({ x: 2, z: 2 });
  });

  it("never overshoots a click target", () => {
    expect(stepToward({ x: 0, z: 0 }, { x: 1, z: 0 }, 5)).toEqual({ dx: 1, dz: 0, arrived: true });
    const s = stepToward({ x: 0, z: 0 }, { x: 3, z: 4 }, 1);
    expect(s.arrived).toBe(false);
    expect(Math.hypot(s.dx, s.dz)).toBeCloseTo(1);
  });

  it("maps keys to a unit direction", () => {
    expect(keyDir(new Set(["w"]))).toEqual({ x: 0, z: -1 });
    const d = keyDir(new Set(["w", "d"]));
    expect(Math.hypot(d.x, d.z)).toBeCloseTo(1);
    expect(keyDir(new Set(["w", "s"]))).toEqual({ x: 0, z: 0 });
  });

  it("the pet follows but keeps a gap", () => {
    let pet = { x: -1.9, z: 0 };
    for (let i = 0; i < 200; i++) pet = followStep(pet, { x: 1.9, z: 0 }, 0.05, ok);
    const gap = Math.hypot(1.9 - pet.x, -pet.z);
    expect(gap).toBeGreaterThanOrEqual(FOLLOW_GAP - 1e-9);
    expect(gap).toBeLessThan(FOLLOW_GAP + 0.05);
  });
});
