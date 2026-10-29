import { describe, expect, it } from "vitest";
import { mulberry32 } from "../sim/rng";
import { ACTIVITIES } from "./activities";
import { clockLabel, DAY_SECONDS, gameTime, HOUR_SECONDS } from "./clock";
import { applyEffects, decay, fullNeeds, mostUrgent } from "./needs";
import { friends, pairKey } from "./relations";
import { addAgent, cleanMess, newVillage, stepVillage, validChoices, type Env, type LifeEvent, type Village } from "./village";

const SPOTS = { home: [{ x: 0, z: 0 }], bowl: [{ x: 3, z: 0 }], bed: [{ x: -3, z: 0 }], lawn: [{ x: 0, z: 3 }] };
const env = (seed = 1, chooser?: Env["chooser"]): Env => ({ spots: SPOTS, canWalk: () => true, rng: mulberry32(seed), chooser });
const run = (v: Village, e: Env, seconds: number, dt = 0.25): LifeEvent[] => {
  const out: LifeEvent[] = [];
  for (let s = 0; s < seconds; s += dt) out.push(...stepVillage(v, dt, e));
  return out;
};

describe("clock", () => {
  it("starts at 08:00 and a day is 12 real minutes", () => {
    expect(gameTime(0)).toMatchObject({ day: 0, hour: 8, phase: "morning" });
    expect(gameTime(DAY_SECONDS).day).toBe(1);
    expect(gameTime(15 * HOUR_SECONDS).phase).toBe("night"); // 23:00
    expect(clockLabel(8.5)).toBe("08:30");
  });
});

describe("needs", () => {
  it("decay over game hours and refill from activity effects, clamped", () => {
    const n = decay(fullNeeds(), "pet", 10);
    expect(n.hunger).toBe(20);
    expect(applyEffects(n, { hunger: 200 }).hunger).toBe(100);
    expect(applyEffects(n, { hunger: 50 }, 0.5).hunger).toBe(45);
  });
  it("humans never need the lawn", () => {
    expect(decay(fullNeeds(), "human", 10).bladder).toBe(90);
    expect(mostUrgent(fullNeeds(), "human")).not.toContain("bladder");
  });
});

describe("village sim", () => {
  it("every activity id is unique and has a positive duration", () => {
    expect(new Set(ACTIVITIES.map((a) => a.id)).size).toBe(ACTIVITIES.length);
    for (const a of ACTIVITIES) expect(a.minutes).toBeGreaterThan(0);
  });

  it("a hungry pet walks to the bowl and eats until fed", () => {
    const v = newVillage();
    const a = addAgent(v, "p1", "Mallow", "pet", { x: 0, z: 0 }, { ...fullNeeds(), hunger: 10 });
    expect(validChoices(a, v, env())[0]!.act).toBe("eat");
    const ev = run(v, env(), 60);
    expect(ev).toContainEqual({ kind: "start", who: "p1", act: "eat", with: [] });
    expect(ev.some((e) => e.kind === "done" && e.act === "eat")).toBe(true);
    expect(a.needs.hunger).toBeGreaterThan(50);
  });

  it("only offers activities that fit kind, time of day and existing spots", () => {
    const v = newVillage();
    const a = addAgent(v, "p1", "Mallow", "pet", { x: 0, z: 0 });
    const acts = validChoices(a, v, env()).map((c) => c.act);
    expect(acts).not.toContain("sleep"); // morning
    expect(acts).not.toContain("fish"); // human + no pond
    expect(acts).not.toContain("ball"); // nobody to play with
    expect(acts).toContain("wander");
  });

  it("a full bladder ends in a poop the player can clean", () => {
    const v = newVillage();
    addAgent(v, "p1", "Mallow", "pet", { x: 0, z: 0 }, { ...fullNeeds(), bladder: 5 });
    const ev = run(v, env(), 40);
    const mess = ev.find((e) => e.kind === "mess");
    expect(mess).toBeTruthy();
    expect(v.messes).toHaveLength(1);
    expect(cleanMess(v, v.messes[0]!.id)).toBe(true);
    expect(v.messes).toHaveLength(0);
  });

  it("a villager walks over and cleans a mess", () => {
    const v = newVillage();
    v.messes.push({ id: 99, pos: { x: 2, z: 2 }, by: "p1" });
    addAgent(v, "h1", "Mo", "human", { x: 0, z: 0 }, { ...fullNeeds(), hunger: 100, fun: 100, social: 100, energy: 100, hygiene: 100 });
    const ev = run(v, env(), 40);
    expect(ev).toContainEqual({ kind: "cleaned", who: "h1", id: 99 });
    expect(v.messes).toHaveLength(0);
  });

  it("group play gathers two pets, then both gain fun and like each other more", () => {
    const v = newVillage();
    const bored = { ...fullNeeds(), fun: 5, social: 10 };
    const a = addAgent(v, "p1", "Mallow", "pet", { x: 0, z: 0 }, { ...bored });
    const b = addAgent(v, "p2", "Sprig", "pet", { x: 1, z: 0 }, { ...bored });
    const pickBall: Env["chooser"] = (_, cs) => (cs.some((c) => c.act === "ball") ? "ball" : null);
    const ev = run(v, env(2, pickBall), 120);
    const starts = ev.filter((e) => e.kind === "start" && e.act === "ball");
    expect(starts.slice(0, 2).map((e) => e.who).sort()).toEqual(["p1", "p2"]);
    expect(a.needs.fun).toBeGreaterThan(30);
    expect(b.needs.social).toBeGreaterThan(30);
    expect(friends(v.rel, "p1", 1)[0]?.id).toBe("p2");
    expect(v.rel.get(pairKey("p1", "p2"))).toBeGreaterThan(0);
  });

  it("a pet arriving late joins the running game instead of starting its own", () => {
    const v = newVillage();
    const bored = { ...fullNeeds(), fun: 5, social: 10 };
    addAgent(v, "p1", "A", "pet", { x: 0, z: 3 }, { ...bored });
    addAgent(v, "p2", "B", "pet", { x: 0, z: 3 }, { ...bored });
    const c = addAgent(v, "p3", "C", "pet", { x: 9, z: 9 }, { ...bored });
    c.idle = 8; // decides after the others started
    const ev = run(v, env(5, (_, cs) => (cs.some((x) => x.act === "ball") ? "ball" : null)), 20);
    const late = ev.find((e) => e.kind === "start" && e.who === "p3");
    expect(late).toMatchObject({ act: "ball" });
    expect(late && "with" in late ? late.with.length : 0).toBeGreaterThan(0);
  });

  it("a gathering nobody joins is cancelled and the starter moves on", () => {
    const v = newVillage();
    addAgent(v, "p1", "Mallow", "pet", { x: 0, z: 0 }, { ...fullNeeds(), fun: 5, social: 5 });
    addAgent(v, "p2", "Sprig", "pet", { x: 1, z: 0 }, { ...fullNeeds(), energy: 0 });
    const onlyP1Ball: Env["chooser"] = (a, cs) => (a.id === "p1" && cs.some((c) => c.act === "ball" && c.join === undefined) ? "ball" : a.id === "p2" ? "nap" : null);
    const ev = run(v, env(3, onlyP1Ball), 40);
    expect(ev).toContainEqual({ kind: "cancel", who: "p1", act: "ball" });
  });

  it("the chooser can never pick an invalid activity", () => {
    const v = newVillage();
    const a = addAgent(v, "p1", "Mallow", "pet", { x: 0, z: 0 });
    run(v, env(4, () => "fish"), 5);
    expect(a.act).not.toBe("fish");
  });

  it("is deterministic for a seed", () => {
    const make = () => {
      const v = newVillage();
      addAgent(v, "p1", "A", "pet", { x: 0, z: 0 });
      addAgent(v, "p2", "B", "pet", { x: 1, z: 1 });
      return run(v, env(7), 300);
    };
    expect(make()).toEqual(make());
  });
});
