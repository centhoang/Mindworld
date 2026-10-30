import { describe, expect, it } from "vitest";
import { replyPrompt } from "./brain";
import { emptyMemory } from "./memory";
import { VILLAGERS } from "./persona";
import { cleanScene, petScene, SCENE_MAX, sharedScene, type Seen } from "./scene";

const things: Seen[] = [
  { name: "Mo", kind: "person", x: 4, z: 0, doing: "fishes" },
  { name: "the fishing pond", kind: "thing", x: 5, z: 1 },
  { name: "a tree", kind: "thing", x: -2, z: 0 },
  { name: "a tree", kind: "thing", x: -3, z: 1 },
  { name: "the food bowl", kind: "thing", x: 1, z: 0, petCares: true },
  { name: "Sprig", kind: "pet", x: 0, z: 2, doing: "naps" },
  { name: "a far rock", kind: "thing", x: 30, z: 0 },
];

describe("sharedScene", () => {
  it("lists what both can see, with directions, and counts plain things", () => {
    const s = sharedScene({ x: 0, z: 0 }, { x: 1, z: 0 }, things, "Picnic Hill", "evening");
    expect(s).toMatch(/^At Picnic Hill, evening\. In view: /);
    expect(s).toContain("Mo fishes, east");
    expect(s).toContain("Sprig (a pet) naps, south");
    expect(s).toContain("2 trees, west");
    expect(s).not.toContain("far rock");
  });

  it("leaves out what only one of the two can see", () => {
    const s = sharedScene({ x: 0, z: 0 }, { x: -6, z: 0 }, things, "", "noon");
    expect(s).toContain("tree");
    expect(s).not.toContain("Mo"); // 10 tiles from the player
    expect(s.startsWith("Outside, noon.")).toBe(true);
  });

  it("stays under the cap", () => {
    const many: Seen[] = Array.from({ length: 40 }, (_, i) => ({ name: `Villager${i} with a long name`, kind: "person", x: i % 3, z: 0, doing: "dances a long dance" }));
    expect(sharedScene({ x: 0, z: 0 }, { x: 0, z: 0 }, many, "the square", "morning").length).toBeLessThanOrEqual(SCENE_MAX);
  });
});

describe("petScene", () => {
  it("only sees close, pet-relevant things", () => {
    const s = petScene({ x: 0, z: 0 }, things, "home", "night");
    expect(s).toContain("the food bowl");
    expect(s).toContain("Sprig");
    expect(s).not.toContain("tree"); // a pet doesn't care about trees
    expect(s).not.toContain("Mo"); // 4 tiles away: out of a pet's small view
  });
});

describe("cleanScene", () => {
  it("drops links and control characters and caps the length", () => {
    expect(cleanScene("see www.example.com")).toBe("");
    expect(cleanScene("a <b>\nbench")).toBe("a b bench");
    expect(cleanScene("x".repeat(500)).length).toBe(SCENE_MAX);
    expect(cleanScene(42)).toBe("");
  });
});

describe("replyPrompt with a scene", () => {
  const p = VILLAGERS[0]!;
  it("is unchanged without a scene and grounded with one", () => {
    const plain = replyPrompt(p, emptyMemory(), "Kai", "what's that?");
    expect(plain.user).not.toContain("Around you");
    const grounded = replyPrompt(p, emptyMemory(), "Kai", "what's that?", "At the pond, noon. In view: a bench, east.");
    expect(grounded.user).toContain("Around you: At the pond, noon. In view: a bench, east.");
    expect(grounded.user).toContain("answer only from what is listed");
  });
});
