import { describe, expect, it } from "vitest";
import { askPets, traitOf } from "./pet-chat";

describe("pet-to-pet chat", () => {
  it("derives the trait from the most-taught move", () => {
    expect(traitOf(null)).toBe("curious");
    const r = (d: string) => ({ if: [{ k: "turn" as const, op: ">=" as const, n: 1 }], do: d as "guard", why: "" });
    expect(traitOf({ summary: "", rules: [r("guard"), r("guard"), r("attack")] })).toBe("careful");
  });
  it("uses the server's lines, else a canned pair", async () => {
    const a = { name: "Mochi", trait: "bold" as const };
    const ok = await askPets(a, a, "", (async () => new Response(JSON.stringify({ lines: ["Hi", "Yo"], source: "model" }))) as typeof fetch);
    expect(ok).toEqual({ lines: ["Hi", "Yo"], source: "model" });
    const off = await askPets(a, a, "", (async () => { throw new Error("x"); }) as typeof fetch);
    expect(off.source).toBe("offline");
    expect(off.lines).toHaveLength(2);
  });
});
