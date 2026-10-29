import { describe, expect, it } from "vitest";
import { groundFromSeed, isLand, landCount, THEMES } from "./ground";

const connected = (g: ReturnType<typeof groundFromSeed>) => {
  const seen = new Set<number>();
  const start = g.land.indexOf(1);
  const stack = [start];
  while (stack.length) {
    const k = stack.pop()!;
    if (seen.has(k) || !g.land[k]) continue;
    seen.add(k);
    const i = k % g.w;
    const j = Math.floor(k / g.w);
    if (i > 0) stack.push(k - 1);
    if (i < g.w - 1) stack.push(k + 1);
    if (j > 0) stack.push(k - g.w);
    if (j < g.h - 1) stack.push(k + g.w);
  }
  return seen.size === landCount(g);
};

describe("ground from seed", () => {
  it("is the same for the same seed on every client", () => {
    const a = groundFromSeed(1234);
    const b = groundFromSeed(1234);
    expect([...a.land]).toEqual([...b.land]);
    expect(a.theme).toBe(b.theme);
    expect(a.gates).toEqual(b.gates);
  });

  it("gives every seed a unique shape, a sane size and all themes over many seeds", () => {
    const shapes = new Set<string>();
    const themes = new Set<string>();
    for (let s = 1; s <= 40; s++) {
      const g = groundFromSeed(s * 7919);
      shapes.add(g.land.join(""));
      themes.add(g.theme);
      const area = landCount(g) / (g.w * g.h);
      expect(area).toBeGreaterThan(0.3);
      expect(area).toBeLessThan(0.85);
    }
    expect(shapes.size).toBe(40);
    expect(themes.size).toBe(THEMES.length);
  });

  it("is one walkable piece with the centre on land", () => {
    for (let s = 1; s <= 30; s++) {
      const g = groundFromSeed(s * 104729);
      expect(isLand(g, Math.round((g.w - 1) / 2), Math.round((g.h - 1) / 2))).toBe(true);
      expect(connected(g)).toBe(true);
    }
  });

  it("puts each gate on the shore, facing open water", () => {
    const g = groundFromSeed(42);
    const out = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] } as const;
    for (const side of ["n", "s", "w", "e"] as const) {
      const { i, j } = g.gates[side];
      expect(isLand(g, i, j)).toBe(true);
      expect(isLand(g, i + out[side][0], j + out[side][1])).toBe(false);
    }
  });
});
