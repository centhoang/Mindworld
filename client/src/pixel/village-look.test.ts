import { describe, expect, it } from "vitest";
import { buildTerrain } from "./sunny-terrain";
import { bedsAt } from "./overworld";
import { T } from "../world/tilemap";
import { GUEST_SLOT, PLOT_COUNT, villageTiles, villageWorld } from "../world/village-map";

// Bugs 39-41 on the Sunnyside village: whole-map rules for paths, the pond and the farm field.
describe("the village look", () => {
  const m = villageTiles();
  const t = buildTerrain(m);
  const at = (i: number, j: number) => (i < 0 || j < 0 || i >= m.w || j >= m.h ? T.water : m.kind[j * m.w + i]!);
  const dry = (i: number, j: number) => ![T.water, T.pool, T.bridge].includes(at(i, j) as never);
  const road = (i: number, j: number) => i >= 0 && j >= 0 && i < m.w && j < m.h && t.road[j * m.w + i] !== 0;

  it("has no land a tile wide, so no cliff or edge piece floats on its own", () => {
    for (let j = 0; j < m.h; j++) for (let i = 0; i < m.w; i++) {
      if (!dry(i, j)) continue;
      expect((!dry(i, j - 1) && !dry(i, j + 1)) || (!dry(i - 1, j) && !dry(i + 1, j)), `land at ${i},${j}`).toBe(false);
    }
  });

  it("draws every road at least three tiles across, with no one-tile tip at a path's end", () => {
    for (let j = 0; j < m.h; j++) for (let i = 0; i < m.w; i++) {
      if (!road(i, j)) continue;
      const thinNS = !road(i, j - 1) && !road(i, j + 1);
      const thinEW = !road(i - 1, j) && !road(i + 1, j);
      expect(thinNS || thinEW, `road at ${i},${j}`).toBe(false);
    }
  });

  it("keeps road tiles off the coast's edge tiles (a pier foot counts as land)", () => {
    const firm = (i: number, j: number) => dry(i, j) || at(i, j) === T.bridge;
    for (let j = 0; j < m.h; j++) for (let i = 0; i < m.w; i++) {
      if (!road(i, j)) continue;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) expect(firm(i + di, j + dj), `road at ${i},${j}`).toBe(true);
    }
  });

  it("leads the pond lane's road up to the pier's whole foot", () => {
    for (let i = 0; i < m.w; i++) {
      for (let j = 1; j < m.h; j++) if (at(i, j - 1) === T.bridge && dry(i, j) && at(i, j - 2) === T.bridge) expect(road(i, j), `under pier ${i},${j}`).toBe(true);
    }
  });

  it("lays no loose fishing rod on the pier: a rod shows only in a fisher's hands", () => {
    const pond = villageWorld().platforms.find((p) => p.kind === "pond")!;
    expect(Object.keys(pond.spots ?? {})).not.toContain("rod");
  });

  it("keeps each plot's field and its edge inside the plot, clear of the road's edge tiles", () => {
    const others = Array.from({ length: PLOT_COUNT - 1 }, (_, n) => ({ id: `p${n}`, name: "Pip", seed: n + 2, slot: n + 1 }));
    const world = villageWorld({ me: { seed: 1, slot: 0 }, others });
    const path = (x: number, z: number) => at(x - m.ox, z - m.oz) === T.path;
    const guest = villageWorld({ me: { seed: 1, slot: GUEST_SLOT } });
    for (const p of [...world.platforms, ...guest.platforms].filter((q) => q.ground)) {
      const beds = bedsAt(p);
      const [x0, z0, x1, z1] = p.rect!;
      for (let z = beds[0]!.z - 1; z <= beds[5]!.z + 1; z++) for (let x = beds[0]!.x - 1; x <= beds[5]!.x + 1; x++) {
        expect(x >= x0 && x < x1 && z >= z0 && z < z1, `${p.id} field at ${x},${z}`).toBe(true);
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) expect(path(x + dx, z + dz), `${p.id} field by a path at ${x},${z}`).toBe(false);
      }
    }
  });
});
