import { describe, expect, it } from "vitest";
import { humanize, typingMs } from "./human";
import { VILLAGERS } from "./persona";

const [elder, mo, , pip] = VILLAGERS;

describe("how villagers type", () => {
  it("longer lines take longer, up to a limit", () => {
    expect(typingMs("hi")).toBeLessThan(typingMs("a much longer line than that one"));
    expect(typingMs("x".repeat(500))).toBe(3500);
  });

  it("each keeps its own habit, stable for the same line", () => {
    expect(humanize("Nice day for it.", pip!)).toBe(humanize("Nice day for it.", pip!));
    expect(humanize("Nice day for it.", pip!)).toMatch(/^n.*t$/);
    expect(humanize("Nice day for it.", elder!)).toMatch(/^Nice day for it\.+$/);
  });

  it("a slip swaps two letters and never touches short words or the length", () => {
    const lines = Array.from({ length: 60 }, (_, i) => `I caught something wonderful number${"abcdefgh"[i % 8]} ${i}.`);
    const slipped = lines.filter((l) => humanize(l, mo!) !== l);
    expect(slipped.length).toBeGreaterThan(0);
    for (const l of slipped) expect(humanize(l, mo!).length).toBe(l.length);
    expect(humanize("Hi there.", mo!)).toBe("Hi there.");
  });
});
