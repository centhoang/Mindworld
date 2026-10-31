import { afterEach, describe, expect, it, vi } from "vitest";
import { GeneratedSprites } from "./generated-sprites";

afterEach(() => vi.unstubAllGlobals());

describe("generated sprite loading", () => {
  it("draws the fallback while pending and after failure, requesting each PNG once", () => {
    const images: { src: string; onload: () => void; onerror: () => void }[] = [];
    vi.stubGlobal("Image", class {
      src = "";
      onload = () => {};
      onerror = () => {};
      constructor() { images.push(this); }
    });
    const sprites = new GeneratedSprites();
    const fallback = vi.fn();
    const g = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D;
    sprites.draw(g, "market-stall", 10, 20, fallback);
    sprites.draw(g, "market-stall", 10, 20, fallback);
    expect(images).toHaveLength(1);
    expect(images[0]!.src).toBe("/art/gen/market-stall.png");
    images[0]!.onerror();
    sprites.draw(g, "market-stall", 10, 20, fallback);
    expect(images).toHaveLength(1);
    expect(fallback).toHaveBeenCalledTimes(3);
    expect(g.drawImage).not.toHaveBeenCalled();
  });

  it("uses the support root, native pixels and integer positions once loaded", () => {
    let loaded!: () => void;
    vi.stubGlobal("Image", class {
      src = "";
      set onload(fn: () => void) { loaded = fn; }
    });
    const sprites = new GeneratedSprites();
    const fallback = vi.fn();
    const g = { save: vi.fn(), restore: vi.fn(), drawImage: vi.fn(), imageSmoothingEnabled: true };
    sprites.draw(g as unknown as CanvasRenderingContext2D, "market-stall", 50.2, 60.8, fallback);
    loaded();
    sprites.draw(g as unknown as CanvasRenderingContext2D, "market-stall", 50.2, 60.8, fallback);
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(g.imageSmoothingEnabled).toBe(false);
    expect(g.drawImage).toHaveBeenCalledWith(expect.anything(), 26, 17);
    expect(g.restore).toHaveBeenCalledOnce();
  });
});
