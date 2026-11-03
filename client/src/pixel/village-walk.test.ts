import { describe, expect, it, vi } from "vitest";
import { randomGenes } from "../game/genes";
import { Overworld } from "./overworld";
import { T } from "../world/tilemap";

// Sprites draw to canvases nobody looks at here.
const pen: unknown = new Proxy(() => pen, { get: () => pen, set: () => true, apply: () => pen });
vi.stubGlobal("document", { createElement: () => ({ getContext: () => pen }) });

describe("walking the village", () => {
  const w = new Overworld(randomGenes(1), 1);
  const m = w.map;
  const kindAt = (x: number, z: number) => m.kind[Math.floor(z - m.oz) * m.w + Math.floor(x - m.ox)];

  it("keeps everyone off the pond and the sea: only the pier and land are ground", () => {
    expect([m.w, m.h]).toEqual([66, 47]); // the village, not a set-aside layout
    let pier = 0;
    for (let z = m.oz; z < m.oz + m.h; z += 0.25) for (let x = m.ox; x < m.ox + m.w; x += 0.25) {
      const k = kindAt(x, z);
      if (k === T.pool || k === T.water) expect(w.canWalk(x, z), `water at ${x},${z}`).toBe(false);
      if (k === T.bridge && w.canWalk(x, z)) pier++;
    }
    expect(pier).toBeGreaterThan(0);
  });

  it("lets you reach every bed: stand somewhere free, face it, and it is the bed in front of you", () => {
    const dirs = [[0, 0.7], [-0.7, 0], [0.7, 0], [0, -0.7]];
    w.beds.forEach((b, i) => {
      let ok = false;
      for (let z = b.z - 1.5; z <= b.z + 2.5 && !ok; z += 0.05) for (let x = b.x - 1.5; x <= b.x + 2.5 && !ok; x += 0.05) {
        if (!w.canWalk(x, z)) continue;
        for (let d = 0; d < 4 && !ok; d++) {
          w.player = { x, z };
          w.playerMotion.dir = d as never;
          ok = w.bedNear() === i && dirs[d] !== undefined;
        }
      }
      expect(ok, `bed ${i} at ${b.x},${b.z}`).toBe(true);
    });
  });

  it("puts you on open ground when you leave the house, free to walk away (bug 47)", () => {
    w.exitHouse();
    const p = { ...w.player };
    expect(w.canWalk(p.x, p.z)).toBe(true);
    expect(w.canWalk(w.pet.x, w.pet.z)).toBe(true);
    for (let i = 0; i < 10; i++) w.update(0.05, new Set(["arrowdown"]));
    expect(w.player.z).toBeGreaterThan(p.z + 0.3);
  });
});
