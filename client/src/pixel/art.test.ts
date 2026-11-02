import { describe, expect, it, vi } from "vitest";
import { loadImage, seasonName } from "./art";

describe("season art names", () => {
  it("puts the theme before a frame number, or at the end", () => {
    expect(seasonName("tile-grass-1", 1)).toBe("tile-grass-autumn-1");
    expect(seasonName("prop-tree", 2)).toBe("prop-tree-snow");
    expect(seasonName("prop-tree", 2 | 4)).toBe("prop-tree-snow"); // the AWAY look bit is ignored
  });
});

describe("loadImage", () => {
  // An image that fails `fails` times, then loads.
  const flaky = (fails: number) => {
    let tried = 0;
    vi.stubGlobal("Image", class {
      onload = () => {};
      onerror = () => {};
      set src(_: string) {
        setTimeout(() => (++tried > fails ? this.onload() : this.onerror()));
      }
    });
    return () => tried;
  };

  it("gets past a failed try, as after a deploy", async () => {
    const tried = flaky(1);
    expect(await loadImage("/art/a.png")).not.toBeNull();
    expect(tried()).toBe(2);
  });

  it("gives up after its tries", async () => {
    const tried = flaky(9);
    expect(await loadImage("/art/a.png", 2)).toBeNull();
    expect(tried()).toBe(2);
  });
});
