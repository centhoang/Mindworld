import { describe, expect, it } from "vitest";
import { stickKeys } from "./touch";

describe("the touch stick", () => {
  it("holds nothing near the middle, one arrow straight out, two on a slant", () => {
    expect(stickKeys(5, -4, 60)).toEqual([]);
    expect(stickKeys(0, -40, 60)).toEqual(["ArrowUp"]);
    expect(stickKeys(-40, 2, 60)).toEqual(["ArrowLeft"]);
    expect(stickKeys(30, 30, 60)).toEqual(["ArrowRight", "ArrowDown"]);
  });

  it("runs when pushed to the rim", () => {
    expect(stickKeys(0, 58, 60)).toEqual(["ArrowDown", "Shift"]);
  });
});
