import { describe, expect, it } from "vitest";
import { afterLine, brainMayShow, type Line } from "./hatch-line";

const egg: Line = { text: "egg", t: 4, keep: true };
const hatched: Line = { text: "hatched", t: 6, keep: true };
const hint: Line = { text: "hint", t: 6 };
const brain: Line = { text: "Loading", who: "Brain", t: 30 };

describe("hatch line", () => {
  it("keeps the story lines over a Brain line", () => {
    expect(brainMayShow(egg)).toBe(false);
    expect(brainMayShow(hatched)).toBe(false);
    expect(brainMayShow(hint)).toBe(true);
    expect(brainMayShow(null)).toBe(true);
  });

  it("shows the waiting Brain line only after the story, before the hints", () => {
    const queue = [hatched, hint];
    const first = afterLine(queue, brain);
    expect(first).toEqual({ next: hatched, held: brain });
    const second = afterLine(queue, first.held);
    expect(second).toEqual({ next: brain, held: null });
    expect(afterLine(queue, second.held)).toEqual({ next: hint, held: null });
    expect(afterLine(queue, null)).toEqual({ next: null, held: null });
  });
});
