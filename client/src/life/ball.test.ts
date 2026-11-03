import { describe, expect, it } from "vitest";
import { aim, Ball, cleanKick, KICK_MAX, PITCH_R, type Kick, type Pitch } from "./ball";

const PITCH: Pitch = { spot: { x: 0, z: 5 }, goal: { x: 0, z: -4 } };
const open = () => true;
const walled = (x: number, z: number) => x < 6 && x > -6 && z > -10 && z < 10; // a box
const kick = (k: Partial<Kick>): Kick => ({ x: 0, z: 5, vx: 0, vz: 0, by: "a", ...k });

describe("ball", () => {
  it("waits on its spot until kicked", () => {
    const b = new Ball(PITCH, open);
    expect(b.now(100)).toMatchObject({ x: 0, z: 5, moving: false, goal: false });
  });

  it("rolls along the kick and slows to a stop", () => {
    const b = new Ball(PITCH, open);
    b.apply(kick({ vx: 4 }), 10);
    const a = b.now(10.5);
    expect(a.moving).toBe(true);
    expect(a.x).toBeGreaterThan(1);
    const end = b.now(40);
    expect(end.moving).toBe(false);
    expect(end.x).toBeGreaterThan(a.x);
    expect(end.x).toBeLessThan(6);
    expect(end.z).toBe(5);
  });

  it("two machines fed the same kicks agree, however often they look", () => {
    const kicks: [Kick, number][] = [[kick({ vx: 5, vz: -1 }), 0], [kick({ x: 3, z: 4, vx: -2, vz: 3 }), 1.2], [kick({ x: -1, z: 6, vx: 7, vz: 0.5 }), 2]];
    const a = new Ball(PITCH, walled), b = new Ball(PITCH, walled);
    kicks.forEach(([k, t], i) => {
      a.apply(k, t, i + 1);
      for (let s = t; s < t + 1; s += 0.016) a.now(s); // one looks every frame
      b.apply(k, t, i + 1); // the other only now and then
    });
    for (const t of [3.2, 3.7, 9]) expect(b.now(t)).toEqual(a.now(t));
  });

  it("bounces off walls instead of passing them", () => {
    const b = new Ball(PITCH, walled);
    b.apply(kick({ vx: 9 }), 0);
    let maxX = 0;
    for (let t = 0; t < 6; t += 0.05) maxX = Math.max(maxX, b.now(t).x);
    expect(maxX).toBeLessThan(6);
    expect(b.now(10).x).toBeLessThan(maxX);
  });

  it("scores when it rolls into the goal, then goes back to its spot", () => {
    const b = new Ball(PITCH, open);
    b.apply(kick({ vz: -8 }), 0);
    let scored = false;
    for (let t = 0; t < 3; t += 0.05) scored ||= b.now(t).goal;
    expect(scored).toBe(true);
    expect(b.now(20)).toMatchObject({ x: 0, z: 5, goal: false, moving: false });
  });

  it("a lost ball comes back to its spot after a while", () => {
    const b = new Ball(PITCH, open);
    b.apply(kick({ z: 5 + PITCH_R + 2, vx: 0.5 }), 0);
    expect(b.now(5).z).toBeGreaterThan(5 + PITCH_R);
    expect(b.now(100)).toMatchObject({ x: 0, z: 5 });
  });

  it("keeps the room's order: an older kick is ignored, my own echo does not jump the ball", () => {
    const b = new Ball(PITCH, open);
    b.apply(kick({ vx: 3, by: "me" }), 0); // mine, shown at once
    const before = b.now(0.3);
    expect(b.apply(kick({ vx: 3, by: "me" }), 0.1, 7)).toBe(false); // its echo
    expect(b.now(0.3)).toEqual(before);
    expect(b.apply(kick({ vx: -3 }), 0.4, 6)).toBe(false); // older than 7
    expect(b.apply(kick({ vx: -3 }), 0.4, 8)).toBe(true);
    expect(b.now(1).x).toBeLessThan(before.x);
  });

  it("caps a kick's speed and rounds like the room", () => {
    const k = cleanKick(kick({ vx: 30, vz: 0.123456 }));
    expect(Math.hypot(k.vx, k.vz)).toBeLessThanOrEqual(KICK_MAX + 0.01);
    expect(k.vz).toBe(Math.round(k.vz * 100) / 100);
  });

  it("aims at a target, turned by a miss", () => {
    const v = aim({ x: 0, z: 0 }, { x: 0, z: -10 }, 5);
    expect(v.vx).toBeCloseTo(0);
    expect(v.vz).toBeCloseTo(-5);
    expect(aim({ x: 0, z: 0 }, { x: 0, z: -10 }, 5, 0.3).vx).not.toBeCloseTo(0);
  });
});
