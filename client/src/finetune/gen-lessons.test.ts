import { describe, expect, it } from "vitest";
import { buildSplit, normalize, templateLessons } from "./gen-lessons";
import { HELDOUT_LESSONS } from "./lessons";

describe("training lessons", () => {
  it("templates are deterministic, unique and short", () => {
    const a = templateLessons(500, 3);
    expect(templateLessons(500, 3)).toEqual(a);
    expect(a).toHaveLength(500);
    expect(new Set(a.map((x) => normalize(x.text))).size).toBe(500);
    expect(a.every((x) => x.text.length > 0 && x.text.length <= 300)).toBe(true);
  });

  it("never lets a held-out lesson into train or val", () => {
    const leaked = HELDOUT_LESSONS.slice(0, 5).map((text) => ({ text: text.toUpperCase() + "!", kind: "muse0" }));
    const { train, val, droppedHeldout } = buildSplit(templateLessons(400, 1), leaked, 50, 1);
    expect(droppedHeldout).toBe(5);
    const banned = new Set(HELDOUT_LESSONS.map(normalize));
    expect([...train, ...val].some((l) => banned.has(normalize(l.text)))).toBe(false);
    expect(val).toHaveLength(50);
    expect(new Set([...train, ...val].map((l) => l.id)).size).toBe(train.length + val.length);
  });
});
