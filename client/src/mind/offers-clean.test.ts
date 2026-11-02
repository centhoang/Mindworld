import { describe, expect, it } from "vitest";
import { cleanReply } from "./offers";

describe("cleanReply", () => {
  it("cuts a memory off an invitation", () => {
    expect(cleanReply("Want to join me for a picnic but nobody showed?", true)).toBe("Want to join me for a picnic?");
  });
  it("leaves a plain invitation and plain talk alone", () => {
    expect(cleanReply("Want to join me for a picnic?", true)).toBe("Want to join me for a picnic?");
    expect(cleanReply("The picnic was sad, but nobody showed.", true)).toBe("The picnic was sad, but nobody showed.");
  });
  it("drops a second invitation", () => {
    expect(cleanReply("Nice day. Wanna dance?", false)).toBe("Nice day.");
  });
});
