// Free-talk benchmark: the open-ended talks from docs/testing/checks/npc.md go to a llama-server with the game's own
// reply prompt and memory, so two models can be read side by side. Free: it only talks to a local llama-server.
// Usage: npx tsx src/finetune/chat-bench.ts <llama-server url> [--label x] [--out file.txt] [--seeds 2]
import { writeFileSync } from "node:fs";
import { parseLine, replyPrompt } from "../mind/brain";
import { emptyMemory, remember } from "../mind/memory";
import { VILLAGERS } from "../mind/persona";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const url = args[0] ?? "http://127.0.0.1:8080";
const label = opt("--label") ?? url;
const seeds = Number(opt("--seeds") ?? 2);

const TALKS: [string, ...string[]][] = [
  ["Mo", "I caught a big fish today", "what do you think of it?", "should I cook it or sell it?", "would you eat it raw?", "ok what is your favourite fish?"],
  ["Pip", "do you like Mo?", "what is he like at work?", "do you ever fight?", "who else do you like here?", "and the Elder?"],
  ["Elder", "tell me a story", "what happened next?", "how did it end?", "is that true?", "tell me another one"],
  ["Ama", "business has been slow for me", "any advice?", "what sells best at your stall?", "do you ever get tired of it?", "what would you do instead?"],
  ["Pip", "I feel a bit lonely today", "thanks", "do you ever feel that way?", "what helps you?", "ok, what are you up to tomorrow?"],
  ["Mo", "you are stupid"],
  ["Elder", "are you an AI?"],
  ["Pip", "asdf"],
];

async function ask(system: string, user: string, seed: number): Promise<{ text: string; ms: number }> {
  const t0 = Date.now();
  const r = await fetch(`${url}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature: 0.8, max_tokens: 40, seed }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = (await r.json()) as { choices: { message: { content: string } }[] };
  return { text: j.choices[0]?.message.content ?? "", ms: Date.now() - t0 };
}

async function main() {
  const out: string[] = [`# ${label}`];
  const ms: number[] = [];
  for (let seed = 1; seed <= seeds; seed++) {
    for (const [name, ...lines] of TALKS) {
      const p = VILLAGERS.find((v) => v.name === name)!;
      const m = emptyMemory();
      out.push(`\n## ${name}, seed ${seed}`);
      for (const line of lines) {
        const req = replyPrompt(p, m, "Kai", line);
        const { text, ms: t } = await ask(req.system, req.user, seed);
        const say = parseLine(text, p.name) ?? "(nothing)";
        remember(m, 1, "morning", `Kai asked "${line.slice(0, 40)}", I said "${say.slice(0, 40)}"`);
        out.push(`> ${line}`, `  ${say}`);
        ms.push(t);
      }
    }
  }
  ms.sort((a, b) => a - b);
  out.push(`\np50 ${ms[ms.length >> 1]} ms, ${ms.length} replies`);
  const file = opt("--out");
  if (file) writeFileSync(file, out.join("\n"));
  console.log(out.at(-1));
}

void main();
