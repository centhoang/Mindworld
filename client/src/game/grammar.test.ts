import { describe, expect, it } from "vitest";
import { clipReply, completeTiered, grammarFor, isGrammarError, nextTier } from "./grammar";
import { thinkingLabel } from "./thinking";

const moves = ["attack", "guard"] as const;

describe("grammar tiers", () => {
  it("strict uses the bounded repetition, simple uses +, none has no grammar", () => {
    expect(grammarFor("strict", [...moves])).toContain(`line ::= [a-zA-Z ,.!?']{1,60}`);
    expect(grammarFor("simple", [...moves])).toContain(`line ::= [a-zA-Z ,.!?']+`);
    expect(grammarFor("simple", [...moves])).toContain(`move ::= "attack" | "guard"`);
    expect(grammarFor("none", [...moves])).toBeNull();
    expect([nextTier("strict"), nextTier("simple"), nextTier("none")]).toEqual(["simple", "none", null]);
  });

  it("recognises grammar errors but not aborts", () => {
    expect(isGrammarError(new Error("xgrammar: failed to parse EBNF at repetition"))).toBe(true);
    expect(isGrammarError(new Error("aborted"))).toBe(false);
  });

  it("steps down on grammar errors and remembers the working tier", async () => {
    const seen: (string | null)[] = [];
    const out = await completeTiered("strict", [...moves], async (g) => {
      seen.push(g);
      if (g?.includes("{1,60}")) throw new Error("Invalid grammar: repetition range unsupported");
      return "guard: Shields up!";
    });
    expect(out.tier).toBe("simple");
    expect(out.reply).toEqual({ action: "guard", line: " Shields up!" });
    expect(seen).toHaveLength(2);
  });

  it("falls back to no grammar and clips the raw text", async () => {
    const out = await completeTiered("strict", [...moves], async (g) => {
      if (g) throw new Error("grammar compile failed");
      return "Sure! I'll ATTACK - Take that, you big lug!!! 🦖 and more text that goes on far too long for a bubble";
    });
    expect(out.tier).toBe("none");
    expect(out.reply.action).toBe("attack");
    expect(out.reply.line.length).toBeLessThanOrEqual(60);
    expect(out.reply.line).toMatch(/^Take that, you big lug!!!/);
    expect(out.reply.line).toMatch(/^[a-zA-Z ,.!?']*$/);
  });

  it("rethrows non-grammar errors without stepping down", async () => {
    let calls = 0;
    await expect(
      completeTiered("strict", [...moves], async () => {
        calls++;
        throw new Error("aborted");
      }),
    ).rejects.toThrow("aborted");
    expect(calls).toBe(1);
  });

  it("clipReply rejects text without an allowed move", () => {
    expect(clipReply("flee: bye", [...moves]).action).toBe("");
    expect(clipReply("guard\nsecond line", [...moves])).toEqual({ action: "guard", line: "" });
  });
});

describe("thinkingLabel", () => {
  it("cycles dots and counts seconds", () => {
    expect(thinkingLabel(0)).toBe("thinking. 0s");
    expect(thinkingLabel(450)).toBe("thinking.. 0s");
    expect(thinkingLabel(19_300)).toMatch(/^thinking\.{1,3} 19s$/);
  });
});
