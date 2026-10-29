import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runVillage, TASKS, validate, villageItem, type VillageItem } from "./gen-village";
import { BudgetExceeded, ModalClient } from "./modal-client";

const items = Array.from({ length: 300 }, (_, i) => villageItem(1, i));
const of = (task: string) => items.find((x) => x.task === task)!;

// A fake teacher: answers each task correctly (from the prompt's own option list) and counts its calls.
function fakeTeacher(answer?: (it: VillageItem) => string, costUsd = 0.002) {
  const byUser = new Map(items.map((it) => [it.req.user, it]));
  let spent = 0;
  const calls: string[] = [];
  return {
    calls,
    get spentUsd() {
      return spent;
    },
    async complete(req: { prompt: string; system: string }) {
      const it = byUser.get(req.prompt)!;
      calls.push(it.id);
      spent += costUsd;
      const text = answer ? answer(it) : it.options ? (it.task === "plan" ? it.options.slice(0, 3).join(",") : it.options[0]!) : "What a lovely quiet morning.";
      return { text, truncated: false, model: "fake", provider: "modal", costUsd, latencyMs: 1 };
    },
  };
}

describe("village teacher data", () => {
  it("scenarios are deterministic, cover every task and use the game's prompt builders", () => {
    expect(villageItem(1, 5)).toEqual(villageItem(1, 5));
    expect(villageItem(2, 5)).not.toEqual(villageItem(1, 5));
    for (const t of TASKS) expect(items.some((x) => x.task === t), t).toBe(true);
    expect(of("choose").req.user).toContain("Answer with one option.");
    expect(of("plan").req.grammar).toMatch(/^root ::= act "," act "," act/);
    expect(of("emote").options).toContain("none");
  });

  it("keeps only answers the game would accept", () => {
    const plan = of("plan");
    const [a, b, c] = plan.options!;
    expect(validate(plan, `${a},${b},${c}`)).toBe(`${a},${b},${c}`);
    expect(validate(plan, `morning: ${a}, noon: ${b}, evening: ${c}`)).toBeNull();
    expect(validate(plan, "dig,fly,swim")).toBeNull();
    const choose = of("choose");
    expect(validate(choose, `${choose.options![1]}.`)).toBe(choose.options![1]);
    expect(validate(choose, `I think ${choose.options![0]}`)).toBeNull();
    expect(validate(of("emote"), "Heart")).toBe("heart");
    expect(validate(of("emote"), "hug")).toBeNull();
    const line = of("line");
    expect(validate(line, `${line.who}: Want to go fishing later?`)).toBe("Want to go fishing later?");
    expect(validate(line, "I love this 🌸🌸🌸 day 🌸🌸")).toBeNull(); // needed heavy cleaning
    expect(validate(line, "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen")).toBeNull();
    expect(validate(of("reflect"), "")).toBeNull();
  });

  it("writes rows with the game's exact prompt, and resumes without asking again", async () => {
    const out = join(mkdtempSync(join(tmpdir(), "village-")), "v.jsonl");
    const llm = fakeTeacher();
    const res = await runVillage({ limit: 20, seed: 1, out, llm, concurrency: 3 });
    expect(res.finished).toBe(true);
    expect(res.rows).toHaveLength(20);
    expect(res.rows.every((r) => r.ok)).toBe(true);
    const row = res.rows[0]!;
    expect(row.user).toBe(villageItem(1, 0).req.user);
    expect(row.system).toBe(villageItem(1, 0).req.system); // the teacher's extra note is not in the training text
    expect(readFileSync(out, "utf8").trim().split("\n")).toHaveLength(20);
    await runVillage({ limit: 25, seed: 1, out, llm, concurrency: 3 });
    expect(llm.calls).toHaveLength(25); // only the 5 new ids
  });

  it("logs invalid answers as failed rows with the raw text", async () => {
    const out = join(mkdtempSync(join(tmpdir(), "village-")), "v.jsonl");
    const res = await runVillage({ limit: 10, seed: 1, out, llm: fakeTeacher(() => "```json {}```"), concurrency: 2 });
    expect(res.rows.every((r) => !r.ok && r.error === "invalid" && r.raw)).toBe(true);
  });

  it("stops at the USD cap: the capped client refuses calls before they are sent", async () => {
    const dir = mkdtempSync(join(tmpdir(), "village-"));
    let sent = 0;
    const fetchFn = (async () => {
      sent++;
      return new Response(JSON.stringify({ choices: [{ message: { content: "wave" }, finish_reason: "stop" }], usage: { prompt_tokens: 400, completion_tokens: 600 } }), { status: 200 });
    }) as typeof fetch;
    const env = { MODAL_BASE_URL: "https://fake.example", MODAL_PROXY_TOKEN: "x", MODAL_MODEL: "m" };
    const llm = new ModalClient({ kind: "village", capUsd: 0.02, maxCalls: 100, ledgerPath: join(dir, "ledger.jsonl"), fetchFn, env });
    const res = await runVillage({ limit: 40, seed: 1, out: join(dir, "v.jsonl"), llm, concurrency: 1 });
    expect(res.finished).toBe(false);
    expect(sent).toBeLessThan(10);
    expect(llm.spentUsd).toBeLessThanOrEqual(0.02);
    const ledger = readFileSync(join(dir, "ledger.jsonl"), "utf8").trim().split("\n");
    expect(ledger).toHaveLength(sent);
    await expect(llm.complete({ kind: "teach", system: "s", prompt: "p", maxTokens: 1500 })).rejects.toBeInstanceOf(BudgetExceeded);
  });
});

describe("village rows in the SFT mix", () => {
  it("only valid rows become chat examples with the game's prompt", async () => {
    const { villageExamples } = await import("./build-sft");
    const base = { task: "choose" as const, who: "Mo", system: "S", user: "U", costUsd: 0, latencyMs: 0 };
    const ex = villageExamples([{ ...base, id: "a", ok: true, target: "fish" }, { ...base, id: "b", ok: false, error: "invalid" }]);
    expect(ex).toEqual([{ task: "village", messages: [{ role: "system", content: "S" }, { role: "user", content: "U" }, { role: "assistant", content: "fish" }] }]);
  });
});
