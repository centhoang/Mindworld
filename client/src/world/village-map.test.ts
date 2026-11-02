import { describe, expect, it } from "vitest";
import { buildTileMap, T, tileAt, tileWalkable } from "./tilemap";
import { platformAt } from "./layout";
import { GUEST_SLOT, PLOT_AT, PLOT_COUNT, VILLAGE_ROWS, villageThings, villageWorld } from "./village-map";

describe("the village", () => {
  const others = Array.from({ length: PLOT_COUNT - 1 }, (_, n) => ({ id: `p${n}`, name: "Pip", seed: n + 2, slot: n + 1 }));
  const full = villageWorld({ me: { seed: 1, slot: 0 }, others });
  const m = buildTileMap(full);

  it("is a rectangle of known tiles", () => {
    for (const row of VILLAGE_ROWS) expect(row).toHaveLength(VILLAGE_ROWS[0].length);
    expect(/^[~."*=o#Tbr]+$/.test(VILLAGE_ROWS.join(""))).toBe(true);
  });

  it("gives the same map to every client, whatever order players came in", () => {
    const flip = villageWorld({ me: { seed: 1, slot: 0 }, others: [...others].reverse() });
    expect(flip.platforms.map((p) => p.id).sort()).toEqual(full.platforms.map((p) => p.id).sort());
    expect(flip.things).toEqual(full.things);
  });

  it("has every place from the plan and twelve plots", () => {
    for (const k of ["plaza", "npc", "wild", "pond", "picnic", "playground"]) expect(full.platforms.some((p) => p.kind === k)).toBe(true);
    expect(full.platforms.filter((p) => p.ground)).toHaveLength(PLOT_COUNT);
    expect(platformAt(full, 0.5, 0.5)?.kind).toBe("plaza");
  });

  it("does not let two plots overlap, or a plot sit on a road or the sea", () => {
    const seen = new Set<string>();
    for (const [x, z] of PLOT_AT.slice(0, PLOT_COUNT)) for (let j = 0; j < 7; j++) for (let i = 0; i < 10; i++) {
      const k = `${x + i},${z + j}`;
      expect(seen.has(k), k).toBe(false);
      seen.add(k);
      expect([T.grass, T.flowers, T.tall], k).toContain(tileAt(m, x + i + 0.5, z + j + 0.5));
    }
  });

  it("makes a late player a guest, who still has a yard", () => {
    const home = villageWorld({ me: { seed: 1, slot: 15 } }).platforms.find((p) => p.kind === "home")!;
    expect(home.label).toBe("Guest yard");
    expect([home.rect![0], home.rect![1]]).toEqual(PLOT_AT[GUEST_SLOT]);
  });

  it("reaches every place, door and spawn on foot", () => {
    const blocked = new Set(villageThings().map((t) => `${Math.floor(t.x)},${Math.floor(t.z)}`));
    const seen = new Set<string>();
    const stack: [number, number][] = [[0, 0]];
    while (stack.length) {
      const [x, z] = stack.pop()!;
      const k = `${x},${z}`;
      if (seen.has(k) || blocked.has(k) || !tileWalkable(m, x + 0.5, z + 0.5)) continue;
      seen.add(k);
      stack.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
    }
    for (const p of full.platforms) {
      if (p.kind === "pond") expect(seen.has(`${Math.floor(p.spots!.dock!.x)},${Math.floor(p.spots!.dock!.z)}`), p.id).toBe(true);
      else expect(seen.has(`${p.x},${p.z}`), p.id).toBe(true);
      if (p.ground) expect(seen.has(`${p.x},${Math.floor(p.z - 1.6)}`), `${p.id} door`).toBe(true);
    }
  });
});
