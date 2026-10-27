import { describe, expect, it } from "vitest";
import { fetchRandomGhost, shareGhost } from "../game/ghost-api";
import { Battle, runBattle } from "./battle";
import {
  GHOST_ARCHETYPE,
  ghostEnemyDef,
  ghostObservation,
  ghostPayload,
  ghostPet,
  LOCAL_SEED_GHOSTS,
  parseGhostRecord,
  PET_GENES,
  toEnemyAct,
  type Ghost,
} from "./ghost";
import { MAX_RULES } from "./memo";
import { baselinePolicy } from "./policy";
import { DEFAULT_PET } from "./types";

const guardHeavy: Ghost = {
  id: "g",
  name: "Tester",
  seed: false,
  genes: { build: 0.5 },
  decor: [],
  memo: {
    summary: "",
    rules: [
      { if: [{ k: "last", is: "guard" }], do: "attack", why: "" },
      { if: [{ k: "intent", is: "idle" }], do: "guard", why: "" },
    ],
  },
};

describe("ghost -> opponent mapping", () => {
  it("our genes map exactly onto the default pet, and every build has the same budget", () => {
    expect(ghostPet(PET_GENES, DEFAULT_PET.name)).toEqual(DEFAULT_PET);
    for (const b of [0, 0.25, 1, -5, 9]) {
      const p = ghostPet({ build: b });
      expect(p.maxHp).toBeGreaterThanOrEqual(26);
      expect(p.maxHp).toBeLessThanOrEqual(34);
      expect(p.atk).toBe(DEFAULT_PET.atk);
      expect(p.maxHp + 2 * p.spd).toBe(DEFAULT_PET.maxHp + 2 * DEFAULT_PET.spd); // trade-off, no free power
    }
  });

  it("maps memo actions to enemy acts; attacking after a guard is a telegraphed heavy hit", () => {
    expect(toEnemyAct("attack", "none")).toBe("strike");
    expect(toEnemyAct("attack", "guard")).toBe("heavy");
    expect(toEnemyAct("guard", "attack")).toBe("guard");
    expect(toEnemyAct("flee", "none")).toBe("flee");
    expect(toEnemyAct("emote", "none")).toBe("idle");
    expect(toEnemyAct("befriend", "none")).toBe("idle");
  });

  it("the ghost sees the fight from its own side", () => {
    const ctx = { seed: 1, turn: 4, enemyHpPct: 62.4, myHpPct: 30, petLast: "guard" as const, calm: 0 };
    expect(ghostObservation(ctx, "attack", "bigger")).toEqual({
      turn: 4, myHpPct: 62, enemyHpPct: 30, enemy: GHOST_ARCHETYPE, size: "bigger", intent: "guarding", last: "attack",
    });
    expect(ghostObservation({ ...ctx, petLast: "attack" }, "none", "similar").intent).toBe("scared"); // player below 40%
    expect(ghostObservation({ ...ctx, petLast: "emote", myHpPct: 90 }, "none", "similar").intent).toBe("calm");
  });

  it("the ghost plays its memo: guard on turn 1, then the heavy hit it saved up", () => {
    const b = new Battle({ enemy: GHOST_ARCHETYPE, seed: 7, enemyDef: ghostEnemyDef(guardHeavy) });
    expect(b.observe().intent).toBe("guarding"); // rule: intent idle -> guard
    b.step("attack");
    expect(b.observe().intent).toBe("heavy"); // rule: last guard -> attack, charged up
    const empty = new Battle({ enemy: GHOST_ARCHETYPE, seed: 7, enemyDef: ghostEnemyDef({ ...guardHeavy, memo: { summary: "", rules: [] } }) });
    expect(empty.observe().intent).toBe("idle"); // no memo: baseline attack, a plain strike
  });

  it("full fights against every seed ghost finish and are deterministic per seed", () => {
    for (const g of LOCAL_SEED_GHOSTS) {
      const a = runBattle({ enemy: GHOST_ARCHETYPE, seed: 3, enemyDef: ghostEnemyDef(g) }, baselinePolicy);
      const b = runBattle({ enemy: GHOST_ARCHETYPE, seed: 3, enemyDef: ghostEnemyDef(g) }, baselinePolicy);
      expect(a.turns.length).toBeGreaterThan(0);
      expect(b).toEqual(a);
    }
  });
});

describe("ghost validation", () => {
  it("parses a server record and drops invalid memo rules", () => {
    const g = parseGhostRecord({
      id: "abc",
      name: "<b>Pip</b> http://x.io",
      genes: { hue: 2, build: 0.3, bad: "x" },
      memo: { summary: "s", rules: [...Array(MAX_RULES + 2)].map(() => ({ if: [{ k: "turn", op: "<", n: 3 }], do: "guard" })).concat([{ if: [], do: "nuke" }] as never[]) },
      seed: true,
    });
    expect(g).not.toBeNull();
    expect(g!.name).not.toMatch(/[<>:/.]/);
    expect(g!.genes).toEqual({ hue: 1, build: 0.3 });
    expect(g!.memo.rules).toHaveLength(1); // duplicates and the invalid rule are dropped
    expect(g!.seed).toBe(true);
  });

  it.each([null, "x", [], { name: "" }, { name: "Pip" }, { name: "<>", memo: {} }])("rejects %j", (raw) => {
    expect(parseGhostRecord(raw)).toBeNull();
  });

  it("uploads rules only: no summary or free-text notes leave the device", () => {
    const p = ghostPayload("Mochi", PET_GENES, { summary: "my name is Alex", rules: [{ if: [{ k: "intent", is: "heavy" }], do: "guard", why: "Alex said so" }] });
    expect(JSON.stringify(p)).not.toContain("Alex");
    expect(p.memo.rules[0]).toEqual({ if: [{ k: "intent", is: "heavy" }], do: "guard", why: "" });
  });
});

describe("ghost API client", () => {
  const ok = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status });

  it("returns the server ghost when online", async () => {
    const r = await fetchRandomGhost("", ok({ id: "a", name: "Remote", genes: {}, memo: { summary: "", rules: [] } }));
    expect(r).toMatchObject({ online: true, ghost: { name: "Remote" } });
  });

  it.each([
    ["network error", async () => { throw new TypeError("offline"); }],
    ["server error", ok({ error: "x" }, 500)],
    ["garbage body", async () => new Response("<html>")],
    ["invalid ghost", ok({ name: "" })],
  ])("falls back to a local seed ghost on %s, never throws", async (_n, f) => {
    const r = await fetchRandomGhost("", f as never, () => 0);
    expect(r.online).toBe(false);
    expect(r.ghost).toBe(LOCAL_SEED_GHOSTS[0]);
  });

  it("reports share outcomes", async () => {
    const memo = guardHeavy.memo;
    expect(await shareGhost("Mochi", PET_GENES, memo, [], "", ok({ id: "x" }, 201))).toEqual({ ok: true, id: "x" });
    expect(await shareGhost("Mochi", PET_GENES, memo, [], "", ok({}, 429))).toEqual({ ok: false, reason: "rate_limited" });
    expect(await shareGhost("Mochi", PET_GENES, memo, [], "", ok({}, 400))).toEqual({ ok: false, reason: "rejected" });
    expect(await shareGhost("Mochi", PET_GENES, memo, [], "", async () => { throw new Error("x"); })).toEqual({ ok: false, reason: "offline" });
  });
});
