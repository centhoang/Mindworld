import { describe, expect, it } from "vitest";
import { AWAY, buildTileMap, T } from "../pixel/tiles";
import { CELL, generateWorld, platformAt, rollBetween, SLOT_COUNT, SLOTS, walkable } from "./layout";
import { followStep, FOLLOW_GAP, keyDir, slide, stepToward } from "./movement";

describe("world layout", () => {
  const w = generateWorld({ me: { seed: 11, slot: 0 }, others: [{ id: "g1", name: "Pip", seed: 22, slot: 1 }], roomSeed: 5, day: 3 });
  const reachable = (m: ReturnType<typeof generateWorld>) => {
    const seen = new Set(["plaza"]);
    for (let grow = true; grow; ) {
      grow = false;
      for (const b of m.bridges)
        if (seen.has(b.a) !== seen.has(b.b)) {
          seen.add(b.a);
          seen.add(b.b);
          grow = true;
        }
    }
    return seen;
  };

  it("puts the square in the middle, every shared place around it, and your ground on your slot", () => {
    expect(platformAt(w, 0.5, 0.5)?.kind).toBe("plaza");
    for (const k of ["wild", "boss", "npc", "event"]) expect(w.platforms.some((p) => p.kind === k)).toBe(true);
    const home = w.platforms.find((p) => p.kind === "home")!;
    expect(home.cell).toEqual(SLOTS[0]);
    expect(platformAt(w, home.x + 0.5, home.z + 0.5)?.id).toBe("home");
    expect(w.platforms.find((p) => p.kind === "ground")).toMatchObject({ owner: "g1", label: "Pip's ground" });
  });

  it("starts small: a lone player gets the square and a few shared places, and more fill in between as players arrive", () => {
    const count = (n: number) => generateWorld({ me: { seed: 1, slot: 0 }, others: Array.from({ length: n - 1 }, (_, k) => ({ id: `p${k}`, name: "P", seed: k + 2, slot: k + 1 })), roomSeed: 3, day: 0 }).platforms.filter((p) => !p.ground).length;
    expect(count(1)).toBe(4);
    expect(count(3)).toBeGreaterThan(count(1));
    expect(count(6)).toBeGreaterThan(count(3));
  });

  it("has 24 slots on a checkerboard: never two grounds side by side", () => {
    expect(new Set(SLOTS.map((c) => c.join())).size).toBe(SLOT_COUNT);
    for (const [i, j] of SLOTS) {
      expect(Math.max(Math.abs(i), Math.abs(j))).toBeGreaterThanOrEqual(1);
      for (const [a, b] of SLOTS) expect(Math.abs(i - a) + Math.abs(j - b)).not.toBe(1);
    }
  });

  it("connects every ground to the square, even far slots with nobody in between", () => {
    for (const slot of [0, 7, 8, 15, 19, 20, 23]) {
      const m = generateWorld({ me: { seed: 3, slot }, roomSeed: 9, day: 1 });
      expect(reachable(m).size).toBe(m.platforms.length);
      // Walk every bridge end to end in small steps: never off the map.
      for (const b of m.bridges)
        for (let t = 0; t <= 1; t += 0.05) expect(walkable(m, b.ax + (b.bx - b.ax) * t, b.az + (b.bz - b.az) * t)).toBe(true);
    }
    const full = generateWorld({ me: { seed: 1, slot: 0 }, others: SLOTS.slice(1).map((_, n) => ({ id: `p${n}`, name: "P", seed: n, slot: n + 1 })), roomSeed: 2, day: 0 });
    expect(full.platforms.filter((p) => p.ground).length).toBe(SLOT_COUNT);
    expect(reachable(full).size).toBe(full.platforms.length);
  });

  it("rolls in-between grounds the same way on every client, and differently by day", () => {
    const input = { me: { seed: 1, slot: 0 }, others: [{ id: "a", name: "A", seed: 2, slot: 1 }, { id: "b", name: "B", seed: 3, slot: 2 }], roomSeed: 77 };
    const kinds = (day: number) => generateWorld({ ...input, day }).platforms.filter((p) => p.spots).map((p) => `${p.cell}:${p.kind}`).join(" ");
    expect(kinds(4)).toBe(kinds(4));
    const seen = new Set<string>();
    for (let d = 0; d < 60; d++) for (let i = 0; i < 4; i++) seen.add(String(rollBetween(77, i, 2, d)));
    expect(seen).toEqual(new Set(["playground", "picnic", "pond", "null"]));
    for (let d = 0; d < 60; d++) expect(rollBetween(77, 2, 2, d, true)).not.toBeNull();
  });

  it("marks a ghost ground as away", () => {
    const m = generateWorld({ others: [{ id: "x", name: "Mo", seed: 5, slot: 3, away: true }] });
    expect(m.platforms.find((p) => p.owner === "x")).toMatchObject({ away: true, label: "Mo's ground (away)" });
  });

  it("is not walkable over the gap between platforms", () => {
    expect(walkable(w, CELL / 2, CELL / 2)).toBe(false);
    expect(walkable(w, CELL / 2, -2)).toBe(false); // beside the bridge
  });

  it("rasterises so that every place is reachable on foot over tiles", () => {
    const m = generateWorld({ me: { seed: 8, slot: 13 }, others: [{ id: "a", name: "A", seed: 9, slot: 0 }, { id: "b", name: "B", seed: 10, slot: 22, away: true }], roomSeed: 4, day: 2 });
    const t = buildTileMap(m);
    const seen = new Uint8Array(t.w * t.h);
    const stack = [[-t.ox, -t.oz]];
    while (stack.length) {
      const [i, j] = stack.pop()!;
      if (i! < 0 || j! < 0 || i! >= t.w || j! >= t.h || seen[j! * t.w + i!] || t.kind[j! * t.w + i!] === T.water) continue;
      seen[j! * t.w + i!] = 1;
      stack.push([i! + 1, j!], [i! - 1, j!], [i!, j! + 1], [i!, j! - 1]);
    }
    for (const p of m.platforms) {
      const c = p.kind === "pond" ? { x: p.spots!.dock!.x, z: p.spots!.dock!.z + 2 } : { x: p.x, z: p.z };
      expect(seen[(Math.floor(c.z) - t.oz) * t.w + Math.floor(c.x) - t.ox], p.id).toBe(1);
    }
    expect(t.look.some((v) => v & AWAY)).toBe(true);
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
