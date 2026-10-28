import { describe, expect, it } from "vitest";
import { CELL, generateWorld, platformAt, walkable } from "./layout";
import { followStep, FOLLOW_GAP, keyDir, slide, stepToward } from "./movement";

describe("world layout", () => {
  const w = generateWorld([{ id: "g1", name: "Pip" }]);

  it("puts your corner in the middle and every shared place around it", () => {
    expect(platformAt(w, 0, 0)?.kind).toBe("home");
    for (const k of ["wild", "boss", "market", "npc", "event"]) expect(w.platforms.some((p) => p.kind === k)).toBe(true);
    expect(w.platforms.find((p) => p.kind === "corner")).toMatchObject({ owner: "g1", label: "Pip's corner" });
  });

  it("fills free corner cells with meadow", () => {
    const empty = generateWorld();
    expect(empty.platforms.filter((p) => p.kind === "corner")).toEqual([]);
    expect(empty.platforms.filter((p) => p.kind === "wild").length).toBe(4);
  });

  it("connects every platform to home by walkable bridges", () => {
    const seen = new Set(["home"]);
    for (let grow = true; grow; ) {
      grow = false;
      for (const b of w.bridges) {
        if (seen.has(b.a) !== seen.has(b.b)) {
          seen.add(b.a);
          seen.add(b.b);
          grow = true;
        }
      }
    }
    expect(seen.size).toBe(w.platforms.length);
    // Walk the bridge to the meadow (east) in small steps: never off the map.
    for (let x = 0; x <= CELL; x += 0.25) expect(walkable(w, x, 0)).toBe(true);
  });

  it("is not walkable over the gap between platforms", () => {
    expect(walkable(w, CELL / 2, CELL / 2)).toBe(false);
    expect(walkable(w, CELL / 2, 1.6)).toBe(false); // beside the bridge
  });
});

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
