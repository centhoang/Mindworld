import { describe, expect, it } from "vitest";
import { layoutBubbles, type BubbleBox } from "./bubbles";
import { tintAt } from "../pixel/life-draw";

const box = (cx: number, bottom: number): BubbleBox => ({ cx, bottom, w: 100, h: 28 });
const overlap = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) < 100 && Math.abs(a.y - b.y) < 28;

describe("layoutBubbles", () => {
  it("leaves a lone bubble above its speaker", () => {
    expect(layoutBubbles([box(160, 100)], 320, 240)).toEqual([{ x: 110, y: 72, moved: false }]);
  });

  it("separates speakers standing together, and says which bubbles moved", () => {
    const p = layoutBubbles([box(150, 120), box(160, 118), box(170, 116)], 320, 240);
    expect(overlap(p[0]!, p[1]!) || overlap(p[0]!, p[2]!) || overlap(p[1]!, p[2]!)).toBe(false);
    expect(p.filter((b) => b!.moved).length).toBe(2);
    for (const b of p) expect(Math.abs(b!.x + 50 - 160)).toBeLessThan(60); // never far from who speaks
  });

  it("keeps every bubble on screen", () => {
    for (const b of layoutBubbles([box(4, 30), box(6, 30), box(316, 30), box(318, 30)], 320, 240).filter((p) => p)) {
      expect(b!.x).toBeGreaterThanOrEqual(2);
      expect(b!.x + 100).toBeLessThanOrEqual(318);
      expect(b!.y).toBeGreaterThanOrEqual(2);
    }
  });

  it("never overlaps in a crowd: those without room wait, nearest the player shown first", () => {
    const wide = (cx: number, bottom: number): BubbleBox => ({ cx, bottom, w: 200, h: 60 });
    const crowd = [wide(160, 100), ...Array.from({ length: 11 }, (_, i) => wide(40 + i * 4, 60))];
    const p = layoutBubbles(crowd, 320, 200);
    const shown = p.flatMap((b) => (b ? [b] : []));
    expect(p[0]).not.toBeNull();
    expect(shown.length).toBeLessThan(crowd.length);
    for (const a of shown) for (const b of shown) if (a !== b) expect(Math.abs(a.x - b.x) < 200 && Math.abs(a.y - b.y) < 60).toBe(false);
  });
});

describe("layoutBubbles limits", () => {
  it("shows at most three, and whoever speaks to me comes first", () => {
    const crowd = Array.from({ length: 8 }, (_, i) => box(60 + i * 30, 150));
    crowd[7] = { ...crowd[7]!, first: true };
    const p = layoutBubbles(crowd, 320, 240);
    expect(p.filter((b) => b).length).toBeLessThanOrEqual(3);
    expect(p[7]).not.toBeNull();
  });
});

describe("tintAt", () => {
  it("is clear by day and dark at night", () => {
    expect(tintAt(12)[3]).toBe(0);
    expect(tintAt(1)[3]).toBe(0.55);
    expect(tintAt(23.9)[3]).toBe(0.55);
  });

  it("never jumps: one game minute changes the darkness only a little, all day", () => {
    for (let h = 0; h < 24; h += 1 / 60) expect(Math.abs(tintAt(h + 1 / 60)[3] - tintAt(h)[3])).toBeLessThan(0.01);
  });
});
