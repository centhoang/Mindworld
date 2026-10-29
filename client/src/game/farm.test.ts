import { describe, expect, it } from "vitest";
import { buySeeds, CROPS, emptyFarm, harvest, needsWater, parseFarm, plant, PLOTS, RIPE, sellAll, tick, water, type Farm } from "./farm";

const ok = (r: { ok: boolean; farm?: Farm }): Farm => {
  expect(r.ok).toBe(true);
  return r.farm!;
};

describe("farm", () => {
  it("starts with empty beds and three turnip seeds", () => {
    const f = emptyFarm();
    expect(f.plots).toHaveLength(PLOTS);
    expect(f.plots.every((p) => p.crop === null)).toBe(true);
    expect(f.seeds.turnip).toBe(3);
  });

  it("grows one stage per watering and needs a watering for each stage", () => {
    let f = ok(plant(emptyFarm(), 0, "turnip"));
    expect(f.seeds.turnip).toBe(2);
    expect(needsWater(f.plots[0]!)).toBe(true);
    let now = 1000;
    for (let s = 1; s <= RIPE; s++) {
      f = ok(water(f, 0, now));
      expect(water(f, 0, now).ok).toBe(false); // already wet
      f = tick(f, now + CROPS.turnip.growMs - 1);
      expect(f.plots[0]!.stage).toBe(s - 1);
      now += CROPS.turnip.growMs;
      f = tick(f, now);
      expect(f.plots[0]!.stage).toBe(s);
    }
    expect(needsWater(f.plots[0]!)).toBe(false);
    expect(water(f, 0, now)).toEqual({ ok: false, reason: "ripe" });
  });

  it("never skips stages after a long absence", () => {
    let f = ok(water(ok(plant(emptyFarm(), 2, "turnip")), 2, 0));
    f = tick(f, 1e12);
    expect(f.plots[2]!.stage).toBe(1);
    expect(f.plots[2]!.wetUntil).toBe(0);
  });

  it("harvests only ripe beds, then sells the basket", () => {
    let f = ok(plant(emptyFarm(), 1, "turnip"));
    expect(harvest(f, 1)).toEqual({ ok: false, reason: "not-ripe" });
    f = { ...f, plots: f.plots.map((p, i) => (i === 1 ? { ...p, stage: RIPE } : p)) };
    f = ok(harvest(f, 1));
    expect(f.plots[1]!.crop).toBeNull();
    expect(f.basket.turnip).toBe(1);
    const s = sellAll(f, 10);
    expect(s.earned).toBe(CROPS.turnip.sell);
    expect(s.coins).toBe(10 + CROPS.turnip.sell);
    expect(s.farm.basket).toEqual({});
  });

  it("refuses bad plots, busy beds and missing seeds", () => {
    const f = ok(plant(emptyFarm(), 0, "turnip"));
    expect(plant(f, 0, "turnip")).toEqual({ ok: false, reason: "busy" });
    expect(plant(f, 9, "turnip")).toEqual({ ok: false, reason: "plot" });
    expect(plant(f, 1, "carrot")).toEqual({ ok: false, reason: "no-seed" });
    expect(water(f, 3, 0)).toEqual({ ok: false, reason: "empty" });
  });

  it("buys seeds with coins", () => {
    const r = buySeeds(emptyFarm(), 5, "carrot", 2);
    expect(r).toMatchObject({ ok: true, coins: 1 });
    if (r.ok) expect(r.farm.seeds.carrot).toBe(2);
    expect(buySeeds(emptyFarm(), 3, "berry")).toEqual({ ok: false, reason: "poor" });
  });

  it("parses saves defensively", () => {
    expect(parseFarm(null)).toEqual(emptyFarm());
    const f = parseFarm({ plots: [{ crop: "carrot", stage: 9, wetUntil: 5 }, { crop: "weed" }, "x"], seeds: { berry: 2.7, nope: 3 }, basket: { turnip: -1 } });
    expect(f.plots[0]).toEqual({ crop: "carrot", stage: RIPE, wetUntil: 0 });
    expect(f.plots[1]!.crop).toBeNull();
    expect(f.seeds).toEqual({ berry: 2 });
    expect(f.basket).toEqual({});
    expect(f.plots).toHaveLength(PLOTS);
  });
});
