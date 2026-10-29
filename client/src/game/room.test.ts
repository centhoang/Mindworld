import { describe, expect, it } from "vitest";
import { blocked, canPlace, COLS, CRATE, defaultRoom, DOOR, parseRoom, pieceAt, place, removeAt, ROWS } from "./room";

describe("room", () => {
  it("default room is valid and keeps door and crate clear", () => {
    const r = defaultRoom();
    expect(parseRoom(r)).toEqual(r);
    expect(blocked(r, DOOR.x + 0.5, DOOR.y + 0.5)).toBe(false);
    expect(blocked(r, CRATE.x + 0.5, CRATE.y + 0.5)).toBe(true); // the crate itself
  });

  it("keeps pieces inside the floor and off the door", () => {
    expect(canPlace([], { kind: "bed", x: COLS - 1, y: 0 })).toBe(false);
    expect(canPlace([], { kind: "chair", x: 0, y: ROWS })).toBe(false);
    expect(canPlace([], { kind: "chair", x: DOOR.x, y: DOOR.y })).toBe(false);
    expect(canPlace([], { kind: "rug", x: DOOR.x, y: DOOR.y - 1 })).toBe(true); // rugs may cover the door mat
  });

  it("stacks furniture on rugs but not on furniture", () => {
    let r = place([], { kind: "rug", x: 0, y: 0 });
    r = place(r, { kind: "table", x: 1, y: 0 });
    expect(r).toHaveLength(2);
    expect(canPlace(r, { kind: "chair", x: 2, y: 0 })).toBe(false);
    expect(canPlace(r, { kind: "rug", x: 1, y: 1 })).toBe(false);
    expect(blocked(r, 0.5, 1.5)).toBe(false); // rug only
    expect(blocked(r, 1.5, 0.5)).toBe(true);
  });

  it("removes the top piece first", () => {
    let r = place(place([], { kind: "rug", x: 0, y: 0 }), { kind: "lamp", x: 1, y: 1 });
    expect(r[pieceAt(r, 1, 1)]!.kind).toBe("lamp");
    r = removeAt(r, 1, 1);
    expect(r.map((p) => p.kind)).toEqual(["rug"]);
    r = removeAt(r, 1, 1);
    expect(r).toEqual([]);
  });

  it("parses saves defensively", () => {
    expect(parseRoom("x")).toEqual(defaultRoom());
    expect(parseRoom([{ kind: "bed", x: 0, y: 0 }, { kind: "bed", x: 1, y: 1 }, { kind: "sofa", x: 5, y: 2 }, null])).toEqual([{ kind: "bed", x: 0, y: 0 }]);
  });
});
