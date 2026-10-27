import { describe, expect, it } from "vitest";
import { Battle } from "../sim/battle";
import { ScriptedCortex } from "../sim/cortex";
import { EMPTY_MEMO } from "../sim/memo";
import { memoPolicy } from "../sim/policy";
import { ARCHETYPES, type Observation } from "../sim/types";
import { allowedMoves, buildVoicePrompt, Instinct, parseVoice, splitReply, type VoiceBackend } from "./instinct";

const obs: Observation = { turn: 2, myHpPct: 80, enemyHpPct: 90, enemy: "brute", size: "bigger", intent: "heavy", last: "attack" };

const fakeVoice = (impl: VoiceBackend["pick"]): VoiceBackend => ({ label: "fake", ready: () => true, pick: impl });

describe("allowedMoves", () => {
  it("puts memoPolicy's move first on every observation of real fights", async () => {
    const memo = (await new ScriptedCortex().teach(EMPTY_MEMO, "guard heavy hits and befriend hurt enemies")).memo;
    for (const m of [EMPTY_MEMO, memo]) {
      const policy = memoPolicy(m);
      for (const enemy of ARCHETYPES)
        for (let seed = 1; seed <= 20; seed++) {
          const b = new Battle({ enemy, seed });
          while (!b.done) {
            const o = b.observe();
            const a = allowedMoves(m, o);
            expect(a.moves[0]).toBe(policy(o));
            b.step(a.moves[0]!);
          }
        }
    }
  });

  it("binds a matching rule to a single move", async () => {
    const memo = (await new ScriptedCortex().teach(EMPTY_MEMO, "guard the heavy hits")).memo;
    expect(allowedMoves(memo, obs)).toEqual({ moves: ["guard"], rule: 0 });
    expect(allowedMoves(EMPTY_MEMO, obs).moves).toEqual(["attack", "guard"]);
  });
});

describe("voice parsing", () => {
  it("rejects moves outside the allowed set and splits replies", () => {
    expect(parseVoice(splitReply("guard: Not today!"), ["attack", "guard"])).toEqual({ action: "guard", line: "Not today!" });
    expect(parseVoice(splitReply("flee: bye"), ["attack", "guard"])).toBeNull();
    expect(parseVoice(splitReply("dance"), ["attack"])).toBeNull();
  });

  it("builds a grammar restricted to the allowed moves", () => {
    const p = buildVoicePrompt("Mochi", EMPTY_MEMO, obs, { moves: ["attack", "guard"], rule: null });
    expect(p.grammar).toContain(`move ::= "attack" | "guard"`);
    expect(p.grammar).not.toContain("flee");
  });
});

describe("Instinct", () => {
  it("uses the model's pick when valid", async () => {
    const c = await new Instinct(fakeVoice(async () => ({ action: "guard", line: "Bracing!" }))).decide("Mochi", EMPTY_MEMO, obs);
    expect(c).toMatchObject({ action: "guard", line: "Bracing!", source: "model" });
  });

  it("falls back to the rules on an invalid reply, a timeout, or no model", async () => {
    const bad = await new Instinct(fakeVoice(async () => ({ action: "flee", line: "" }))).decide("Mochi", EMPTY_MEMO, obs);
    expect(bad).toMatchObject({ action: "attack", source: "reflex", note: "invalid model reply" });
    const slow = fakeVoice((_, signal) => new Promise((_r, rej) => signal.addEventListener("abort", () => rej(new Error("aborted")))));
    expect(await new Instinct(slow, 20).decide("Mochi", EMPTY_MEMO, obs)).toMatchObject({ action: "attack", note: "model timeout" });
    expect(await new Instinct(null).decide("Mochi", EMPTY_MEMO, obs)).toMatchObject({ action: "attack", source: "reflex" });
  });
});
