import { describe, expect, it } from "vitest";
import { followStep, FOLLOW_GAP, unstick } from "../world/movement";
import { petMood } from "./pet-mood";

describe("petMood", () => {
  it("trots along while you move, then settles by mood", () => {
    expect(petMood(1, false, 0)).toBeNull();
    expect(petMood(5, false, 0)).toBe("wiggle");
    expect(petMood(30, false, 0)).toBe("sit");
    expect(petMood(5, true, 0)).toBe("sleep");
  });

  it("cheers after a win, even at night", () => {
    expect(petMood(0, true, 2)).toBe("dance");
  });
});

describe("following around a wall", () => {
  const wall = (x: number, z: number) => !(x > 1 && x < 2 && z > -50 && z < 50);

  it("hops over after pushing against it for a moment", () => {
    const leader = { x: 6, z: 0 };
    let pet = { x: 0.9, z: 0 }, held = 0, secs = 0;
    while (pet.x < 2 && secs < 5) {
      const next = followStep(pet, leader, 0.05, wall);
      ({ pet, held } = unstick(pet, next, leader, held, 0.05, wall));
      secs += 0.05;
    }
    expect(pet.x).toBeGreaterThan(2);
    expect(secs).toBeLessThan(2);
  });

  it("does not hop when it is simply close to you", () => {
    const leader = { x: 0, z: FOLLOW_GAP };
    const pet = { x: 0, z: 0 };
    expect(unstick(pet, pet, leader, 9, 0.05, wall)).toEqual({ pet, held: 0 });
  });
});
