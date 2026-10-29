import { describe, expect, it } from "vitest";
import { addAgent, newVillage, stepVillage, type Env } from "../life/village";
import { fullNeeds } from "../life/needs";
import { mulberry32 } from "../sim/rng";
import { findRoute, lineClear } from "./route";

// Two islands (x -10..-2 and 2..10, z -6..6) joined by a bridge at z 4..5: the straight line at z = -4 is water.
const walk = (x: number, z: number) => (Math.abs(x) >= 2 && Math.abs(x) <= 10 && Math.abs(z) <= 6) || (Math.abs(x) < 2.5 && z >= 4 && z <= 5);

describe("findRoute", () => {
  it("is empty when the straight line is clear", () => {
    expect(findRoute({ x: -8, z: 0 }, { x: -3, z: 2 }, walk)).toEqual([]);
  });

  it("goes over the bridge, every leg on land, ending at the target", () => {
    const to = { x: 6, z: -4 };
    const r = findRoute({ x: -6, z: -4 }, to, walk)!;
    expect(r.length).toBeGreaterThan(1);
    expect(r[r.length - 1]).toEqual(to);
    let at = { x: -6, z: -4 };
    for (const p of r) {
      expect(lineClear(at, p, walk)).toBe(true);
      at = p;
    }
    expect(r.some((p) => p.z >= 4 && p.z <= 5)).toBe(true);
  });

  it("is null when there is no way", () => {
    expect(findRoute({ x: -6, z: 0 }, { x: 6, z: 0 }, (x) => Math.abs(x) >= 2, 2000)).toBeNull();
  });
});

describe("village walking with routes", () => {
  it("a pet reaches a bowl on the next island over the bridge", () => {
    const v = newVillage();
    const a = addAgent(v, "p", "P", "pet", { x: -6, z: -4 }, { ...fullNeeds(), hunger: 5 });
    a.idle = 0;
    const env: Env = { spots: { bowl: [{ x: 6, z: -4 }] }, canWalk: walk, rng: mulberry32(3), chooser: () => "eat", route: (f, t) => findRoute(f, t, walk) };
    let started = false;
    for (let s = 0; s < 120 && !started; s += 0.25) started = stepVillage(v, 0.25, env).some((e) => e.kind === "start" && e.act === "eat");
    expect(started).toBe(true);
    expect(Math.hypot(a.pos.x - 6, a.pos.z + 4)).toBeLessThan(1);
  });
});
