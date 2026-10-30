import { describe, expect, it } from "vitest";
import { LlmCortex, LocalCortex, ScriptedCortex } from "../sim/cortex";
import { coachChain } from "./teach";

describe("coachChain", () => {
  it("asks Muse Spark, then the scripted coach, without power mode", () => {
    const chain = coachChain(false);
    expect(chain.map((c) => c.constructor)).toEqual([LlmCortex, ScriptedCortex]);
  });

  it("puts the tuned local coach between Muse Spark and the scripted coach in power mode", () => {
    const chain = coachChain(true);
    expect(chain.map((c) => c.constructor)).toEqual([LlmCortex, LocalCortex, ScriptedCortex]);
  });
});
