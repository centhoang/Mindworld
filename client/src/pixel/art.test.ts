import { describe, expect, it } from "vitest";
import { seasonName } from "./art";

describe("season art names", () => {
  it("puts the theme before a frame number, or at the end", () => {
    expect(seasonName("tile-grass-1", 1)).toBe("tile-grass-autumn-1");
    expect(seasonName("prop-tree", 2)).toBe("prop-tree-snow");
    expect(seasonName("prop-tree", 2 | 4)).toBe("prop-tree-snow"); // the AWAY look bit is ignored
  });
});
