import { describe, expect, it } from "vitest";
import { cycle, fromHome, isSlotId, itemAt, MAX_PLACED, ownedItems, parseDecor, parsePorch, place, plotSlot, plotSlots, porchSlot, porchSlots, remove, STARTER_SET } from "./decor";
import { HOME_SLOTS } from "./home";

describe("corner decor", () => {
  it("places, replaces and removes items by slot", () => {
    let d = place([], "pot", porchSlot(0));
    d = place(d, "tree", plotSlot(3));
    expect(itemAt(d, porchSlot(0))).toBe("pot");
    d = place(d, "rug", porchSlot(0));
    expect(d.filter((p) => p.slot === "porch-0")).toEqual([{ item: "rug", slot: "porch-0" }]);
    d = remove(d, porchSlot(0));
    expect(itemAt(d, porchSlot(0))).toBeNull();
    expect(itemAt(d, plotSlot(3))).toBe("tree");
  });

  it("ignores bad slots, unknown items and items not owned", () => {
    expect(place([], "pot", "porch-9" as never)).toEqual([]);
    expect(place([], "plot-8" as never, plotSlot(0))).toEqual([]);
    expect(place([], "castle" as never, plotSlot(0))).toEqual([]);
    expect(place([], "rug", plotSlot(0), ["tree"])).toEqual([]);
    expect(isSlotId("plot-7")).toBe(true);
    expect(isSlotId("plot-8")).toBe(false);
    expect(isSlotId("porch-3")).toBe(true);
    expect(isSlotId("porch-4")).toBe(false);
  });

  it("caps the number of placed items and never duplicates a slot", () => {
    let d: ReturnType<typeof place> = [];
    for (let i = 0; i < HOME_SLOTS; i++) d = place(d, "flower", plotSlot(i));
    for (let i = 0; i < 4; i++) d = place(d, "lamp", porchSlot(i));
    expect(d).toHaveLength(MAX_PLACED);
    const raw = [...d, ...d, { item: "tree", slot: "plot-0" }];
    expect(parseDecor(raw)).toHaveLength(MAX_PLACED);
  });

  it("cycles a slot through owned items and back to empty", () => {
    const owned = ["tree", "pot"] as const;
    let d = cycle([], porchSlot(1), [...owned]);
    expect(itemAt(d, porchSlot(1))).toBe("tree");
    d = cycle(d, porchSlot(1), [...owned]);
    expect(itemAt(d, porchSlot(1))).toBe("pot");
    d = cycle(d, porchSlot(1), [...owned]);
    expect(d).toEqual([]);
  });

  it("round-trips through JSON and tolerates junk", () => {
    const d = place(place([], "mushroom", plotSlot(1)), "rug", porchSlot(2));
    expect(parseDecor(JSON.parse(JSON.stringify(d)))).toEqual(d);
    for (const junk of [null, undefined, 3, "x", {}, [null, 1, { item: "tree" }, { slot: "plot-1" }]]) expect(parseDecor(junk)).toEqual([]);
  });

  it("migrates old 8-slot saves and splits back into plot and porch arrays", () => {
    const d = fromHome(["tree", null, "lamp", null, null, null, null, "bogus"], ["pot"]);
    expect(plotSlots(d)).toEqual(["tree", null, "lamp", null, null, null, null, null]);
    expect(porchSlots(d)).toEqual(["pot", null, null, null]);
  });

  it("is ghost-safe: missing or malformed porch data becomes empty", () => {
    expect(parsePorch(undefined)).toEqual([null, null, null, null]);
    expect(parsePorch(["rug", 5, "nope", "lamp", "tree"])).toEqual(["rug", null, null, "lamp"]);
  });

  it("starts with every item free and leaves a hook for bought items", () => {
    expect(ownedItems()).toEqual([...STARTER_SET]);
    expect(ownedItems(["tree"])).toEqual([...STARTER_SET]);
  });
});
