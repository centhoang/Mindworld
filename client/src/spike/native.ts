// Spike B, native variant: same 32 scenarios, scored the same way, against a llama.cpp `llama-server`
// (OpenAI-compatible endpoint). Usage: npx tsx src/spike/native.ts http://127.0.0.1:8080 [label]
import { GRAMMAR, SCENARIOS, SYSTEM_PROMPT } from "./scenarios";
import { summarize, type Sample } from "./score";

type Mode = "free" | "grammar";

interface LlamaTimings {
  prompt_per_second?: number;
  predicted_per_second?: number;
}

async function decide(base: string, prompt: string, mode: Mode): Promise<Omit<Sample, "kind" | "ok">> {
  const t0 = performance.now();
  const res = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      max_tokens: 8,
      cache_prompt: false, // fair vs the browser run: every decision pays full prefill
      ...(mode === "grammar" ? { grammar: GRAMMAR } : {}),
    }),
  });
  if (!res.ok) throw new Error(`llama-server ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { choices: { message: { content: string } }[]; timings?: LlamaTimings };
  return {
    text: body.choices[0]?.message.content ?? "",
    ms: performance.now() - t0,
    prefillTps: body.timings?.prompt_per_second,
    decodeTps: body.timings?.predicted_per_second,
  };
}

async function main() {
  const base = process.argv[2] ?? "http://127.0.0.1:8080";
  const label = process.argv[3] ?? "native";
  await decide(base, SCENARIOS[0]!.prompt, "free"); // warm-up (CUDA graph / kernel load)
  const out: Record<string, unknown> = { label };
  for (const mode of ["free", "grammar"] as Mode[]) {
    const samples: Sample[] = [];
    for (const s of SCENARIOS) samples.push({ kind: s.kind, ok: s.ok, ...(await decide(base, s.prompt, mode)) });
    out[mode] = summarize(samples);
  }
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
