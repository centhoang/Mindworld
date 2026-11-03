import { describe, expect, it } from "vitest";
import { fetchRivalPlan } from "./rival-api";

const moves = { attack: 3, guard: 1, flee: 0, emote: 0, befriend: 0 };
const memo = { summary: "", rules: [{ if: [{ k: "intent" as const, is: "heavy" as const }], do: "guard" as const, why: "my private note" }] };

describe("fetchRivalPlan", () => {
  it("sends rules without notes and keeps only valid rules and plain words", async () => {
    let sent = "";
    const fake = (async (_u: string, o: RequestInit) => {
      sent = String(o.body);
      return new Response(JSON.stringify({ source: "model", summary: "Ripple <script>waits</script>!", rules: [{ if: [{ k: "intent", is: "idle" }], do: "guard", why: "x" }, { if: [], do: "attack" }] }));
    }) as unknown as typeof fetch;
    const plan = await fetchRivalPlan("mo", memo, moves, fake);
    expect(sent).not.toContain("my private note");
    expect(plan.rules).toHaveLength(1);
    expect(plan.summary).not.toMatch(/[<>]/);
    expect(plan.source).toBe("model");
  });

  it("answers no rules when the Worker is down", async () => {
    const down = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    expect(await fetchRivalPlan("ama", memo, moves, down)).toMatchObject({ rules: [], source: "none" });
  });
});
