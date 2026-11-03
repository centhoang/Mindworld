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
    for (const [x, y] of [[8, 44], [26, 24], [40, 25], [72, 30], [72, 46], [56, 40]]) expect(near(x!, y!)).toBe(true);
  });

  it("walls, furniture and the outside block; the door leads out", () => {
    expect(onFloor(12, 23)).toBe(false); // the bed
    expect(onFloor(64, 24)).toBe(false); // the table
    expect(onFloor(10, 52)).toBe(false); // the front wall
    expect(onFloor(2, 30)).toBe(false); // the west wall
    expect(onFloor(40, HOUSE_EXIT_Y + 1)).toBe(true);
  });
});
