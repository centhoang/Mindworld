import { describe, expect, it } from "vitest";
import { HOUSE_DOOR, HOUSE_EXIT_Y, onFloor } from "./house";

const STEP = 3;

function reach(): Set<string> {
  const seen = new Set<string>();
  const todo = [[HOUSE_DOOR.x, HOUSE_DOOR.y]];
  while (todo.length) {
    const [x, y] = todo.pop()!;
    const k = `${x},${y}`;
    if (seen.has(k) || !onFloor(x!, y!)) continue;
    seen.add(k);
    todo.push([x! + STEP, y!], [x! - STEP, y!], [x!, y! + STEP], [x!, y! - STEP]);
  }
  return seen;
}

describe("house plan", () => {
  it("every room can be walked to from the door", () => {
    const seen = [...reach()].map((k) => k.split(",").map(Number) as [number, number]);
    const near = (x: number, y: number) => seen.some(([a, b]) => Math.hypot(a - x, b - y) < 6);
    for (const [x, y] of [[80, 60], [105, 70], [150, 55], [170, 45], [150, 85], [230, 45], [240, 85]]) expect(near(x!, y!)).toBe(true);
  });

  it("walls, furniture and the outside block; the door leads out", () => {
    expect(onFloor(55, 50)).toBe(false); // the bed
    expect(onFloor(120, 70)).toBe(false); // outside, by the wall
    expect(onFloor(10, 10)).toBe(false);
    expect(onFloor(217, HOUSE_EXIT_Y + 1)).toBe(true);
  });
});
