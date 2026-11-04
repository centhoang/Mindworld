import { describe, expect, it } from "vitest";
import { gazetteNotes, noteHeadline, rulesHeadlines } from "./gazette";
import { outcomeMemory } from "./promises";
import { duelMemory, rivalOf } from "../sim/rivals";
import type { MemoryEntry } from "./memory";

const e = (day: number, text: string, imp?: number): MemoryEntry => ({ day, time: "10:00", text, ...(imp ? { imp } : {}) });

describe("Village Gazette notes", () => {
  it("takes yesterday's notes, the ones that mattered first, named by villager", () => {
    const notes = gazetteNotes([
      { name: "Mo", log: [e(4, "fished at the pond"), e(5, "fished at the pond"), e(5, "my Ripple beat Kai's pet in a duel", 6), e(5, "trade|Mo|fish|2|4", 5)] },
      { name: "Ama", log: [e(5, "Kai's birthday party: I went and Kai came", 8), e(5, "baked bread")] },
      { name: "Elder", log: [e(5, "refused to deal with Zed", 5)] },
    ], 5);
    expect(notes).toEqual(["Ama: Kai's birthday party: I went and Kai came", "Mo: my Ripple beat Kai's pet in a duel", "Elder: refused to deal with Zed"]);
  });

  it("fills a quiet day with everyday doings, and nothing from other days", () => {
    const notes = gazetteNotes([{ name: "Pip", log: [e(4, "saved up and bought a ball", 8), e(5, "planned: campfire, feed"), e(5, "played at the pitch"), e(5, "sat by the campfire")] }], 5);
    expect(notes).toEqual(["Pip: sat by the campfire", "Pip: played at the pitch"]);
    expect(gazetteNotes([], 5)).toEqual([]);
  });

  it("reads the sim's own note shapes as headlines", () => {
    const party = { id: "p1", from: "Kai", act: "campfire", occasion: "birthday party", day: 5, phase: "evening", state: "pending" } as unknown as Parameters<typeof outcomeMemory>[0];
    expect(noteHeadline(`Ama: ${outcomeMemory(party, "kept")}`)).toBe("Kai keeps a promise to Ama: the birthday party");
    expect(noteHeadline(`Ama: ${outcomeMemory(party, "broken")}`)).toBe("Ama waits in vain: Kai missed the birthday party");
    const rv = rivalOf("mo");
    expect(noteHeadline(`Mo: ${duelMemory("loss", rv, "Kai")}`)).toBe(`Mo's ${rv.name} wins a duel against Kai`);
    expect(noteHeadline(`Mo: ${duelMemory("win", rv, "Kai")}`)).toBe(`Kai's pet beats Mo's ${rv.name} in a duel!`);
    expect(noteHeadline(`Mo: ${duelMemory("friends", rv, "Kai")}`)).toContain("friendship");
    expect(noteHeadline("Pip: saved up and bought a ball")).toBe("Pip saves up and buys a ball at last");
    expect(noteHeadline("Mo: sold 3 fish at the market for 12c")).toBe("Mo sells 3 fish at the market for 12c");
    expect(noteHeadline("Mo: fished at the pond")).toBeNull();
  });

  it("always gives three headlines from real notes, then the market, then a quiet day", () => {
    expect(rulesHeadlines(["Pip: saved up and bought a ball", "Mo: fished at the pond"], ["fish 4c", "wheat 2c"])).toEqual([
      "Pip saves up and buys a ball at last",
      "From Mo's diary: fished at the pond",
      "Everyone is welcome at the campfire tonight",
    ]);
    expect(rulesHeadlines([], [])).toEqual(["A quiet day in the village", "Everyone is welcome at the campfire tonight"]);
    for (const h of rulesHeadlines([`Ama: ${"x".repeat(40)}'s ${"y".repeat(30)} was cancelled`], [])) expect(h.length).toBeLessThanOrEqual(70);
  });
});

describe("Village Gazette goals", () => {
  it("tells goals scored by a villager or a player", () => {
    expect(noteHeadline("Pip: scored a goal at the pitch")).toBe("Pip scores a goal at the pitch!");
    expect(noteHeadline("Mo: Kai scored a goal at the pitch")).toBe("Kai scores a goal as Mo cheers");
  });
});
