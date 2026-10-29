import { describe, expect, it } from "vitest";
import { mulberry32 } from "../sim/rng";
import type { MindLine } from "../world/live";
import { NpcVillage } from "./npcs";
import { MindScheduler } from "./scheduler";

const HOMES = { elder: { x: 0, z: 0 }, mo: { x: 2, z: 0 }, ama: { x: 0, z: 2 }, pip: { x: 2, z: 2 } };
const SPOTS = { home: [{ x: 0, z: 0 }], bed: [{ x: -3, z: 0 }], lawn: [{ x: 0, z: 3 }], picnic: [{ x: 3, z: 3 }] };

function make() {
  const lines: (MindLine & { mem?: string })[] = [];
  const bubbles: [string, string][] = [];
  const nv = new NpcVillage(new MindScheduler(() => null), () => false, { line: (l) => lines.push(l), say: (id, t) => bubbles.push([id, t]) }, HOMES, SPOTS, () => true, undefined, mulberry32(5));
  return { nv, lines, bubbles };
}
const run = (nv: NpcVillage, seconds: number) => {
  for (let s = 0; s < seconds; s += 0.25) nv.step(0.25, nv.v.t + 0.25);
};

describe("NpcVillage", () => {
  it("with no host known, the NPCs live on utility and send nothing", () => {
    const { nv, lines } = make();
    run(nv, 30);
    expect(nv.v.agents.some((a) => a.state !== "idle")).toBe(true);
    expect(lines).toEqual([]);
  });

  it("the host runs the mind and sends act lines for its NPC only", () => {
    const { nv, lines } = make();
    nv.me = "me";
    nv.setHost("mo", "me");
    nv.setHost("elder", "other");
    expect(nv.hub.minds.has("mo")).toBe(true);
    expect(nv.hub.minds.has("elder")).toBe(false);
    run(nv, 30);
    expect(lines.some((l) => l.who === "mo" && l.act)).toBe(true);
    expect(lines.some((l) => l.who === "elder")).toBe(false);
  });

  it("a replaying NPC waits for its host's act, then does it", () => {
    const { nv, bubbles } = make();
    nv.me = "me";
    nv.setHost("elder", "other");
    const elder = nv.v.agents.find((a) => a.id === "elder")!;
    run(nv, 5);
    expect(elder.state).toBe("idle"); // waiting for the host
    nv.hear({ who: "elder", act: "wander", say: "Good morning!" });
    run(nv, 1);
    expect(elder.act).toBe("wander");
    expect(bubbles).toContainEqual(["elder", "Good morning!"]);
  });

  it("decides itself when the host stays silent too long", () => {
    const { nv } = make();
    nv.me = "me";
    nv.setHost("pip", "other");
    run(nv, 25);
    expect(nv.v.agents.find((a) => a.id === "pip")!.state).not.toBe("idle");
  });

  it("handover: the memory from the room seeds the mind, new memories go back out", () => {
    const { nv, lines } = make();
    nv.me = "me";
    nv.setMemory("ama", ["08:10 cooked soup for Pip"]);
    nv.setHost("ama", "me");
    expect(nv.hub.minds.get("ama")!.mem.log[0]!.text).toBe("cooked soup for Pip");
    run(nv, 400);
    const mems = lines.filter((l) => l.who === "ama" && l.mem);
    expect(mems.length).toBeGreaterThan(0);
    expect(mems.every((l) => /^\d\d:\d\d /.test(l.mem!) && !l.mem!.includes("cooked soup"))).toBe(true);
    nv.setHost("ama", "other"); // moved away: the mind stops here
    expect(nv.hub.minds.has("ama")).toBe(false);
  });
});
