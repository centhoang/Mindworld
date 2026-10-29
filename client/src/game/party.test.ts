import { describe, expect, it } from "vitest";
import { randomGenes } from "./genes";
import { addToParty, MAX_PARTY, parseActive, parseParty } from "./party";

describe("party", () => {
  it("adds befriended pets with a short name and caps the size", () => {
    let p = addToParty([], "pal", randomGenes(1));
    expect(p[0]!.name.length).toBeGreaterThan(0);
    expect(p[0]!.name).not.toContain(" ");
    for (let i = 0; i < 10; i++) p = addToParty(p, "brute", randomGenes(10 + i));
    expect(p).toHaveLength(MAX_PARTY);
  });

  it("parses saves defensively", () => {
    const good = addToParty([], "turtle", randomGenes(3));
    expect(parseParty(JSON.parse(JSON.stringify(good)))).toEqual(good);
    expect(parseParty([{ arch: "dragon", genes: randomGenes(1) }, null, 5, { arch: "pal" }])).toEqual([]);
    expect(parseParty("nope")).toEqual([]);
  });

  it("active index falls back to the hatched pet", () => {
    expect(parseActive(2, 3)).toBe(2);
    expect(parseActive(4, 3)).toBe(0);
    expect(parseActive(-1, 3)).toBe(0);
    expect(parseActive("1", 3)).toBe(0);
  });
});
