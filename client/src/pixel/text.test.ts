import { describe, expect, it, vi } from "vitest";
import { drawDialogue, drawToast } from "./text";

vi.mock("./art", () => ({
  PAL: { panel: "cream", ink: "ink", wood: "wood" },
  img: () => ({ width: 96, height: 32 }),
}));

function canvas() {
  const g = { fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: "" };
  vi.stubGlobal("document", { createElement: () => ({
    getContext: () => ({ drawImage: vi.fn(), fillRect: vi.fn(), fillStyle: "", globalCompositeOperation: "" }), width: 0, height: 0,
  }) });
  return g as unknown as CanvasRenderingContext2D;
}

describe("toast panels", () => {
  it("centres a short toast in a 12px bottom strip using the dialogue panel", () => {
    const g = canvas();
    drawToast(g, 384, 216, "Hi");
    // The nine-slice centre is inset 4px; the full frame is x=182,y=196,w=20,h=12.
    expect(g.fillRect).toHaveBeenCalledWith(186, 200, 12, 4);
    expect(g.fillStyle).toBe("cream");
    const glyphs = vi.mocked(g.drawImage).mock.calls.filter((c) => c[3] === 6 && c[4] === 8);
    expect(glyphs.map((c) => c[6])).toEqual([198, 198]);
  });

  it("wraps long and unbroken messages to at most two lines inside the strip", () => {
    const g = canvas();
    drawToast(g, 180, 216, "A".repeat(200));
    const glyphs = vi.mocked(g.drawImage).mock.calls.filter((c) => c[3] === 6 && c[4] === 8);
    expect([...new Set(glyphs.map((c) => c[6]))]).toEqual([188, 198]);
    expect(glyphs.length).toBe(52); // 26 glyphs per row, no third row or overflow
    for (const c of glyphs) expect((c[5] as number) + 6).toBeLessThanOrEqual(170);
  });

  it("preserves named dialogue and portrait dialogue exactly", () => {
    const toast = canvas();
    drawToast(toast, 384, 216, "Hello there", "Pip");
    const dialogue = canvas();
    drawDialogue(dialogue, 384, 216, "Hello there", "Pip");
    expect(toast.fillRect).toHaveBeenCalledWith(12, 164, 360, 40);
    expect(vi.mocked(toast.drawImage).mock.calls).toEqual(vi.mocked(dialogue.drawImage).mock.calls);
    const portrait = {} as CanvasImageSource;
    drawDialogue(dialogue, 384, 216, "Battle line", undefined, portrait, 200);
    expect(dialogue.drawImage).toHaveBeenCalledWith(portrait, 16, 168, 32, 32);
  });
});
