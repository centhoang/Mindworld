import { describe, expect, it } from "vitest";
import { BattleView, SHOUTS_PER_FIGHT, signatureName } from "./battle";

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
  it("a wild pet appears, but a friend's pet in a duel is not wild", () => {
    const wild = new BattleView();
    void wild.open(side("Foe"), side("Mochi"));
    const duel = new BattleView();
    void duel.open(side("Kai"), side("Mochi"), "Kai is ready to duel!");
    for (const v of [wild, duel]) for (let t = 0; t < 2; t += 0.05) v.update(0.05);
    const said = (v: BattleView) => (v as unknown as { text: string }).text;
    expect(said(wild)).toBe("A wild Foe appears!");
    expect(said(duel)).toBe("Kai is ready to duel!");
  });

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

describe("battle depth on screen", () => {
  it("the trainer gets a few shouts per fight; keys 1-5 call a move, and fights without shouts ignore them", () => {
    const v = new BattleView();
    void v.open(side("Foe"), side("Mochi"));
    expect(v.shoutKey("2")).toBe(false); // duels and the like: no shouts unless the fight allows them
    v.allowShouts();
    expect(v.shoutKey("9")).toBe(false);
    for (let i = 0; i < SHOUTS_PER_FIGHT; i++) {
      expect(v.shoutKey("2")).toBe(true);
      expect(v.takeShout()).toBe("guard");
    }
    expect(v.shouts).toBe(0);
    expect(v.shoutKey("1")).toBe(false);
    expect(v.takeShout()).toBeNull();
  });

  it("asks a question in the command box: keys move only over the answers, Esc picks the last, the commands keep their own cursor", async () => {
    const v = new BattleView();
    await runUntil(v, v.open(side("Foe"), side("Mochi")), 10);
    const picked = v.ask("Guard when the foe winds up a heavy hit.", ["Teach it", "Done"]);
    expect(v.scene().menu?.labels).toEqual(["Teach it", "Done"]);
    v.cmdKey("arrowdown"); // no answer below: stays on Teach it
    expect(v.scene().menu?.cursor).toBe(0);
    v.cmdKey("escape");
    v.cmdKey("enter");
    expect(await picked).toBe(1);
    const cmd = v.choose();
    expect(v.scene().menu?.labels).toEqual(["Fight", "Teach", "Swap", "Run"]);
    v.cmdKey("arrowright");
    v.cmdKey("enter");
    expect(await cmd).toBe("teach");
  });

  it("trainers: a shout swings, a hard hit makes its trainer flinch, then idle again; the winner's trainer jumps", async () => {
    const v = new BattleView();
    const look = { hair: "shorthair", tool: "hands" } as const;
    const pose = (s: "me" | "foe") => (v as unknown as { trainers: Record<string, { action: string }> }).trainers[s]!.action;
    await runUntil(v, v.open({ ...side("Foe"), trainer: look }, { ...side("Mochi"), trainer: look }), 10);
    let seen = new Set<string>();
    const p = v.playTurn("attack", "", "", "heavy", 7, 9, 21, 23, { shout: true });
    for (let t = 0; t < 20 && v.busy; t += 0.05) { v.update(0.05); seen.add(pose("me")); await Promise.resolve(); }
    await p;
    expect([...seen]).toEqual(expect.arrayContaining(["attack", "hurt"]));
    for (let t = 0; t < 2; t += 0.05) v.update(0.05);
    expect(pose("me")).toBe("idle");
    await runUntil(v, v.end("win", "ko"), 10);
    expect(pose("me")).toBe("jump");
    seen = new Set([pose("foe")]);
    expect(seen.has("jump")).toBe(false);
  });

  it("names a signature move the same way every time, from the pet's genes", () => {
    const a = signatureName({ name: "Mochi", genes: { hue: 0.4, ears: 0.7 } });
    expect(a).toBe(signatureName({ name: "Other", genes: { hue: 0.4, ears: 0.7 } }));
    expect(signatureName({ name: "Mochi" })).toBe(signatureName({ name: "Mochi" }));
  });

  it("plays a turn with a block, a counter, a signature and crits in a few seconds", async () => {
    const v = new BattleView();
    await runUntil(v, v.open(side("Foe"), side("Mochi")), 10);
    expect(await runUntil(v, v.playTurn("guard", "", "memo #1", "strike", 0, 2, 28, 30, { fx: ["block"], charge: 2 }), 20)).toBeLessThan(10);
    expect(await runUntil(v, v.playTurn("attack", "", "", "strike", 14, 9, 19, 16, { fx: ["signature", "crit", "foe-counter", "foe-crit"] }), 20)).toBeLessThan(12);
    expect(v.busy).toBe(false);
  });

  it("a foe that faints on my hit does not strike back on screen", async () => {
    const v = new BattleView();
    const lines: string[] = [];
    v.onLine = (t) => lines.push(t);
    await runUntil(v, v.open(side("Foe"), side("Mochi")), 10);
    await runUntil(v, v.playTurn("attack", "", "", "strike", 9, 0, 30, 0), 20);
    expect(lines.some((l) => l.includes("strikes"))).toBe(false);
  });
});
