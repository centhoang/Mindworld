import { describe, expect, it } from "vitest";
import { BattleView } from "./battle";

const side = (name: string) => ({ name, sprite: {} as HTMLCanvasElement, maxHp: 30 });

async function runUntil(v: BattleView, p: Promise<void>, maxSeconds: number): Promise<number> {
  let done = false;
  void p.then(() => (done = true));
  let t = 0;
  while (!done && t < maxSeconds) {
    v.update(0.05);
    t += 0.05;
    await Promise.resolve();
  }
  return done ? t : Infinity;
}

describe("battle view script", () => {
  it("open, a turn and the end each finish in a few seconds", async () => {
    const v = new BattleView();
    expect(await runUntil(v, v.open(side("Foe"), side("Mochi")), 10)).toBeLessThan(4);
    expect(await runUntil(v, v.playTurn("attack", "Hi!", "memo #1", "strike", 7, 5, 25, 23), 20)).toBeLessThan(10);
    expect(await runUntil(v, v.end("win", "ko"), 10)).toBeLessThan(5);
    expect(v.busy).toBe(false);
  });

  it("skip shortens a line", async () => {
    const v = new BattleView();
    const p = v.say("A fairly long line of battle text that would take a while to read.");
    v.update(0.05);
    v.skip();
    v.update(0.05);
    v.skip();
    expect(await runUntil(v, p, 1)).toBeLessThan(0.5);
  });
});
