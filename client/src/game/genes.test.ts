import { describe, expect, it } from "vitest";
import { ghostPayload, ghostPet, parseGhostRecord } from "../sim/ghost";
import { DEFAULT_PET } from "../sim/types";
import { EMPTY_MEMO } from "../sim/memo";
import { EARS, GENE_KEYS, HORNS, parseGenes, PATTERNS, petLook, randomGenes, TAILS } from "./genes";

describe("pet genes", () => {
  it("is deterministic per seed and differs between seeds", () => {
    expect(randomGenes(42)).toEqual(randomGenes(42));
    expect(randomGenes(42)).not.toEqual(randomGenes(43));
  });

  it("keeps every gene in 0..1 and build fixed, so looks never change stats", () => {
    for (let s = 0; s < 200; s++) {
      const g = randomGenes(s * 7919);
      expect(Object.keys(g).sort()).toEqual([...GENE_KEYS].sort());
      for (const v of Object.values(g)) expect(v >= 0 && v <= 1).toBe(true);
      expect(ghostPet(g, DEFAULT_PET.name)).toEqual(DEFAULT_PET);
    }
  });

  it("covers every part over many hatches", () => {
    const seen = { ears: new Set<string>(), tail: new Set<string>(), horns: new Set<string>(), pattern: new Set<string>() };
    for (let s = 1; s < 400; s++) {
      const l = petLook(randomGenes(s));
      seen.ears.add(l.ears);
      seen.tail.add(l.tail);
      seen.horns.add(l.horns);
      seen.pattern.add(l.pattern);
      expect(l.size).toBeGreaterThanOrEqual(0.88);
      expect(l.size).toBeLessThanOrEqual(1.12);
      expect(Math.abs(l.accentHue - l.hue)).toBeGreaterThan(0.2);
    }
    expect(seen.ears.size).toBe(EARS.length);
    expect(seen.tail.size).toBe(TAILS.length);
    expect(seen.horns.size).toBe(new Set(HORNS).size);
    expect(seen.pattern.size).toBe(PATTERNS.length);
  });

  it("round-trips through JSON and the ghost payload/record", () => {
    const g = randomGenes(7);
    expect(parseGenes(JSON.parse(JSON.stringify(g)))).toEqual(g);
    const wire = JSON.parse(JSON.stringify(ghostPayload("Mochi", g, EMPTY_MEMO)));
    expect(parseGhostRecord({ ...wire, id: "a" })!.genes).toEqual(g);
  });

  it("tolerates old saves and old ghosts", () => {
    expect(parseGenes(undefined)).toBeNull();
    expect(parseGenes({ build: 0.5 })).toBeNull(); // no hue: re-roll
    expect(parseGenes({ hue: 2, junk: 1, ears: "x" })).toEqual({ hue: 1 });
    const old = petLook({ hue: 0.55, build: 0.4, ears: 0.7, tail: 0.3 });
    expect(old).toMatchObject({ ears: "bunny", tail: "nub", horns: "none", pattern: "plain" });
    expect(petLook({})).toMatchObject({ hue: 0.07, ears: "pointy", tail: "none" });
  });
});
