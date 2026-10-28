import { describe, expect, it } from "vitest";
import { OpenerCache } from "../src/chat";
import { parseGhostMemo } from "../src/memo-dsl";
import { Room } from "../src/room";
import { harness, postJson } from "./helpers";

const memo = { summary: "", rules: [{ if: [{ k: "intent", is: "heavy" }], do: "guard", why: "" }] };
const send = (r: Room, id: string, m: unknown, now = 0) => r.message(id, JSON.stringify(m), now);

describe("night review fixes", () => {
  it("memo DSL rejects inherited keys like constructor instead of throwing", () => {
    expect(parseGhostMemo({ rules: [{ if: [{ k: "constructor", is: "x" }], do: "guard" }] })).toBeNull();
    expect(parseGhostMemo({ rules: [{ if: [{ k: "toString", is: "x" }], do: "guard" }] })).toBeNull();
  });

  it("the generic LLM proxy refuses kind chat (it has its own quota at /api/chat)", async () => {
    const h = harness();
    const r = await h.call("/api/llm", postJson({ kind: "chat", prompt: "hi" }));
    expect(r.status).toBe(400);
    expect(h.upstream.calls).toHaveLength(0);
  });

  it("accepting a duel withdraws the accepter's own open challenge", () => {
    let n = 0;
    const r = new Room(() => (++n % 10) / 10);
    for (const [id, name] of [["a", "Ann"], ["b", "Bo"], ["c", "Cy"]]) r.join(id!, { name }, 0);
    const bToC = send(r, "b", { t: "duel", to: "c", memo }, 10).out[0]!.msg as { duel: string };
    const aToB = send(r, "a", { t: "duel", to: "b", memo }, 20).out[0]!.msg as { duel: string };
    expect(send(r, "b", { t: "duelAccept", duel: aToB.duel, memo }, 30).out[0]!.msg).toMatchObject({ t: "duelStart" });
    expect(send(r, "c", { t: "duelAccept", duel: bToC.duel, memo }, 40).out[0]!.msg).toMatchObject({ t: "duelEnd", reason: "gone" });
  });

  it("opener cache fills even when the model repeats itself", () => {
    const c = new OpenerCache(3);
    for (let i = 0; i < 3; i++) c.add("pal", "Hi!");
    expect(c.full("pal")).toBe(true);
    expect(c.pick("pal", () => 0)).toBe("Hi!");
  });
});
