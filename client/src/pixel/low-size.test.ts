import { describe, expect, it } from "vitest";
import { lowSize } from "./low-size";

describe("low-res picture size", () => {
  it("keeps landscape screens as they were: the height picks the scale", () => {
    expect(lowSize(800, 600)).toEqual({ w: 400, h: 300, scale: 2 });
    expect(lowSize(1920, 1080)).toEqual({ w: 384, h: 216, scale: 5 });
  });

  it("gives a phone-size window enough columns for the Goals card and the bottom line", () => {
    expect(lowSize(375, 812)).toEqual({ w: 375, h: 812, scale: 1 }); // no zoom at 1x: the cards fit
    expect(lowSize(1125, 2436).w).toBeGreaterThanOrEqual(360); // a 3x phone
    expect(lowSize(1125, 2436).scale).toBe(3);
  });
});
