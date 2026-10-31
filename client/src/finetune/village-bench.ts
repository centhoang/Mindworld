// Village-mind benchmark (docs/FINETUNE.md stage 5): the held-out village scenarios (seed 2, never trained on) go to a
// llama-server exactly as the game builds them, without grammar, and each answer is scored by the game's own check
// (gen-village `validate`). Free: it only talks to a local llama-server.
// Usage: npx tsx src/finetune/village-bench.ts <llama-server url> [--n 200] [--label x] [--out file.json]
import { writeFileSync } from "node:fs";
import { TASKS, validate, villageItem, type Task } from "./gen-village";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const url = args[0] ?? "http://127.0.0.1:8080";
const n = Number(opt("--n") ?? 200);
const label = opt("--label") ?? url;

async function ask(system: string, user: string): Promise<{ text: string; ms: number }> {
  const t0 = Date.now();
  const r = await fetch(`${url}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature: 0, max_tokens: 48 }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = (await r.json()) as { choices: { message: { content: string } }[] };
  return { text: j.choices[0]?.message.content ?? "", ms: Date.now() - t0 };
}

async function main() {
  const per = Object.fromEntries(TASKS.map((t) => [t, { ok: 0, n: 0 }])) as Record<Task, { ok: number; n: number }>;
  const rows: { id: string; task: Task; ok: boolean; text: string }[] = [];
  const ms: number[] = [];
  for (let i = 0; i < n; i++) {
    const it = villageItem(Number(opt("--seed") ?? 2), i);
    const { text, ms: t } = await ask(it.req.system, it.req.user);
    const ok = validate(it, text) !== null;
    per[it.task].n++;
    if (ok) per[it.task].ok++;
    rows.push({ id: it.id, task: it.task, ok, text: text.slice(0, 160) });
    ms.push(t);
  }
  const ok = rows.filter((r) => r.ok).length;
  ms.sort((a, b) => a - b);
  const summary = { label, n, valid: +(ok / n).toFixed(3), p50Ms: ms[Math.floor(ms.length / 2)], per: Object.fromEntries(TASKS.map((t) => [t, `${per[t].ok}/${per[t].n}`])) };
  console.log(JSON.stringify(summary));
  const out = opt("--out");
  if (out) writeFileSync(out, JSON.stringify({ summary, rows }, null, 1));
}

void main();
