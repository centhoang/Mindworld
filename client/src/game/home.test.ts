import { describe, expect, it } from "vitest";
import { ghostPayload, LOCAL_SEED_GHOSTS, parseGhostRecord, PET_GENES } from "../sim/ghost";
import { EMPTY_MEMO } from "../sim/memo";
import { cycleSlot, DECOR, decorCount, decorSummary, emptyHome, HOME_SLOTS, homeToWire, parseHome, slotPosition } from "./home";

describe("home plot", () => {
  it("cycles a slot through every decor kind and back to empty", () => {
    let h = emptyHome();
    const seen: unknown[] = [];
    for (let i = 0; i <= DECOR.length; i++) {
      h = cycleSlot(h, 2);
      seen.push(h[2]);
    }
    expect(seen).toEqual([...DECOR, null]);
    expect(decorCount(h)).toBe(0);
  });

  it("ignores out-of-range slots and never mutates its input", () => {
    const h = emptyHome();
    expect(cycleSlot(h, -1)).toEqual(h);
    expect(cycleSlot(h, HOME_SLOTS)).toEqual(h);
    cycleSlot(h, 0);
    expect(h[0]).toBeNull();
  });

  it.each([null, "tree", {}, 42])("parses junk save data %j into an empty plot", (raw) => {
    expect(parseHome(raw)).toEqual(emptyHome());
  });

  it("keeps known decor, blanks unknown entries and trims to the slot count", () => {
    const h = parseHome(["tree", "castle", "", "lamp", ...Array(10).fill("rock")]);
    expect(h).toHaveLength(HOME_SLOTS);
    expect(h.slice(0, 4)).toEqual(["tree", null, null, "lamp"]);
    expect(homeToWire(h).slice(0, 4)).toEqual(["tree", "", "", "lamp"]);
    expect(parseHome(homeToWire(h))).toEqual(h); // wire format round-trips
  });

  it("puts every slot on the plot, mostly behind the fighters", () => {
    for (let i = 0; i < HOME_SLOTS; i++) {
      const p = slotPosition(i);
      expect(Math.hypot(p.x, p.z)).toBeCloseTo(3.0);
      expect(p.z).toBeLessThan(1.1); // never in front of the camera's view of the pets
    }
  });

  it("summarizes decor for the ghost card", () => {
    expect(decorSummary(emptyHome())).toBe("a bare plot");
    expect(decorSummary(parseHome(["tree", "tree", "lamp"]))).toBe("🌳×2 🏮");
  });

  it("ghosts carry decor both ways; seed ghosts have decorated plots", () => {
    const p = ghostPayload("Mochi", PET_GENES, EMPTY_MEMO, parseHome(["flower"]));
    expect(p.decor).toEqual(["flower", "", "", "", "", "", "", ""]);
    expect(parseGhostRecord({ ...p, id: "x" })!.decor[0]).toBe("flower");
    expect(parseGhostRecord({ ...p, decor: "junk" })!.decor).toEqual(emptyHome());
    for (const g of LOCAL_SEED_GHOSTS) expect(decorCount(g.decor)).toBeGreaterThan(0);
  });
});
