import { describe, expect, it } from "vitest";
import { LlmCortex, LocalCortex, MEMO_JSON_SCHEMA, ScriptedCortex, type JsonCompletion } from "../sim/cortex";
import { EMPTY_MEMO } from "../sim/memo";
import { coachChain } from "./teach";

describe("coachChain", () => {
  it("asks Muse Spark, then the scripted coach, with no model in the tab", () => {
    const chain = coachChain();
    expect(chain.map((c) => c.constructor)).toEqual([LlmCortex, ScriptedCortex]);
  });

  it("puts the tuned 1B in this tab between Muse Spark and the scripted coach", () => {
    const complete = async () => ({ text: "", truncated: false });
    expect(coachChain(complete).map((c) => c.constructor)).toEqual([LlmCortex, LocalCortex, ScriptedCortex]);
  });

  it("the in-tab coach parses the memo its model writes", async () => {
    let schema: object | undefined;
    const complete: JsonCompletion = async (req) => {
      schema = req.schema;
      return { text: JSON.stringify({ summary: "guard", rules: [{ if: [{ k: "intent", is: "heavy" }], do: "guard", why: "block it" }] }), truncated: false };
    };
    const res = await coachChain(complete)[1]!.teach(EMPTY_MEMO, "guard heavy hits");
    expect(res.source).toBe("local-llama");
    expect(res.memo.rules).toHaveLength(1);
    expect(schema).toBe(MEMO_JSON_SCHEMA);
  });

  it("reports a cut-off in-tab reply so the chain moves on", async () => {
    const complete: JsonCompletion = async () => ({ text: "{\"summary\":", truncated: true });
    await expect(coachChain(complete)[1]!.teach(EMPTY_MEMO, "x")).rejects.toThrow("cut off");
  });
});
