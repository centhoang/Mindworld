import { describe, expect, it } from "vitest";
import { DAY_SECONDS, gameTime } from "../life/clock";
import { mulberry32 } from "../sim/rng";
import { feel } from "./bonds";
import { dealLimit, refuseLine, refusesDeal, shiftChoice } from "./jobs";
import { emptyMemory } from "./memory";
import { NpcVillage } from "./npcs";
import { VILLAGERS, type Persona } from "./persona";
import { MindScheduler } from "./scheduler";

const by = (id: string): Persona => VILLAGERS.find((p) => p.id === id)!;
const ama = by("ama"), mo = by("mo"), pip = by("pip");
const fine = { hunger: 80, energy: 80, fun: 80, social: 80, hygiene: 80, bladder: 80 };

describe("shifts", () => {
  it("works its hours and has its own life outside them", () => {
    expect(shiftChoice(ama, fine, "morning", 1, "")).toMatchObject({ work: true });
    expect(shiftChoice(ama, fine, "evening", 1, "")).toEqual({ work: false, why: "" });
    expect(shiftChoice(by("elder"), fine, "morning", 2, "").work).toBe(true);
  });
  it("can decide against a shift, for a reason", () => {
    expect(shiftChoice(ama, { ...fine, energy: 10 }, "noon", 1, "").why).toContain("too tired");
    expect(shiftChoice(ama, { ...fine, hunger: 5 }, "noon", 1, "").why).toContain("too hungry");
    expect(shiftChoice(mo, fine, "morning", 1, "Kai").why).toContain("promised Kai");
  });
  it("the playful skip some days, the patient never", () => {
    const days = Array.from({ length: 30 }, (_, d) => d);
    expect(days.filter((d) => !shiftChoice(pip, fine, "noon", d, "").work).length).toBeGreaterThan(5);
    expect(days.every((d) => shiftChoice(mo, fine, "morning", d, "").work)).toBe(true);
  });
});

describe("refusal", () => {
  it("depends on what happened and on who the keeper is", () => {
    const m = emptyMemory();
    expect(refusesDeal(ama, m.bonds.Kai)).toBe(false);
    feel(m, ama, "Kai", "rude", 0, "Kai was rude to me");
    expect(refusesDeal(ama, m.bonds.Kai)).toBe(false);
    feel(m, ama, "Kai", "rude", 0, "Kai was rude to me");
    expect(refusesDeal(ama, m.bonds.Kai)).toBe(true);
    expect(refuseLine(m.bonds.Kai, "Kai")).toBe("Not today, Kai. Last time, you were rude to me.");
    expect(dealLimit(mo)).toBeLessThan(dealLimit(pip));
  });
});

describe("the market keeper in the village", () => {
  const HOMES = { elder: { x: 0, z: 0 }, mo: { x: 20, z: 0 }, ama: { x: 0, z: 20 }, pip: { x: 20, z: 20 } }; // apart: a chat would hold them still
  const SPOTS = { home: [{ x: 0, z: 0 }], bed: [{ x: -3, z: 0 }], lawn: [{ x: 0, z: 3 }], stall: [{ x: 4, z: 4 }], woods: [{ x: -4, z: 4 }] };
  const make = () => {
    const bubbles: [string, string][] = [];
    const nv = new NpcVillage(new MindScheduler(() => null), () => false, { line: () => {}, say: (id, t) => bubbles.push([id, t]) }, HOMES, SPOTS, () => true, undefined, mulberry32(5));
    return { nv, bubbles, a: nv.v.agents.find((x) => x.id === "ama")! };
  };
  const at = (phase: string) => {
    let t = 2 * DAY_SECONDS;
    while (gameTime(t).phase !== phase) t += 10;
    return t;
  };
  const toWork = (nv: NpcVillage) => {
    nv.v.t = at("morning");
    const ama = nv.v.agents.find((x) => x.id === "ama")!;
    for (let i = 0; i < 400 && !(ama.act === "sell" && ama.state === "do"); i++) nv.step(0.25, nv.v.t + 0.25);
  };

  it("goes to work in the morning, and only Ama sells", () => {
    const { nv, a } = make();
    toWork(nv);
    expect(a.act).toBe("sell");
    expect(nv.v.agents.filter((x) => x.act === "sell")).toHaveLength(1);
  });

  it("is closed off hours, and says where the keeper is", () => {
    const { nv, a } = make();
    nv.v.t = at("evening");
    Object.assign(a, { act: "picnic", state: "do" });
    expect(nv.dealWith("Kai")).toMatchObject({ ok: false, refused: false });
    expect((nv.dealWith("Kai") as { text: string }).text).toContain("Ama has a picnic");
  });

  it("serves a stranger, refuses someone rude, and comes round after an apology", async () => {
    const { nv, bubbles, a } = make();
    toWork(nv);
    expect(nv.dealWith("Kai").ok).toBe(true);
    expect(nv.shipRefused("Kai")).toBeNull();
    await nv.reply("ama", "Kai", "shut up, you are annoying");
    await nv.reply("ama", "Kai", "you are useless, go away");
    Object.assign(a, { act: "sell", state: "do" });
    expect(nv.dealWith("Kai")).toMatchObject({ ok: false, refused: true, npc: "ama" });
    expect(bubbles.at(-1)![1]).toContain("you were rude to me");
    expect(nv.hub.minds.get("ama")!.mem.why).toContain("refused to deal");
    expect(nv.shipRefused("Kai")).toContain("Ama won't take your goods");
    await nv.reply("ama", "Kai", "I am sorry");
    expect(nv.dealWith("Kai").ok).toBe(true);
    expect(nv.shipRefused("Kai")).toBeNull();
  });

  it("remembers manners even when another machine hosts the keeper", async () => {
    const { nv, a } = make();
    toWork(nv);
    nv.me = "me";
    nv.setHost("ama", "other");
    await nv.reply("ama", "Kai", "shut up");
    await nv.reply("ama", "Kai", "stupid idiot");
    Object.assign(a, { act: "sell", state: "do" });
    expect(nv.dealWith("Kai")).toMatchObject({ refused: true });
  });
});
