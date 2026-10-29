import { describe, expect, it } from "vitest";
import { syllables } from "./babble";

describe("babble syllables", () => {
  it("makes one blip per vowel group with pauses at word and sentence ends", () => {
    const s = syllables("Hello there. Snack?");
    expect(s.map((x) => x.vowel)).toEqual(["e", "o", "e", "e", "a"]);
    expect(s[1]!.pause).toBe(35);
    expect(s[3]!.pause).toBe(140);
  });

  it("stresses shouts and caps long lines", () => {
    expect(syllables("GRR smash!")[0]!.stress).toBeGreaterThan(syllables("grr smash")[0]!.stress);
    expect(syllables("banana ".repeat(40)).length).toBe(28);
    expect(syllables("... 123")).toEqual([]);
  });
});
