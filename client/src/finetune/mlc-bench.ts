// Dev-only page (client/mlc-bench.html): runs the held-out village prompts through WebLLM on this GPU, with the same
// settings as village-bench.ts, so the browser build can be compared reply by reply with llama-server.
// Usage: /mlc-bench.html?base=<url serving prompts.json, <q>/ model folders, POST /result/<label>>&q=q4f32_1|q4f16_1[&stock=1][&n=200]
// &bridge=1 instead serves queued OpenAI-style requests from that url (see .scratch/mlc/serve.mjs), so teach-bench and
// voice-bench run on WebLLM unchanged. &power=low picks the integrated GPU, &chunk=N sets the prefill chunk.
import { CreateMLCEngine, prebuiltAppConfig } from "@mlc-ai/web-llm";

const params = new URLSearchParams(location.search);
const base = params.get("base") ?? "http://127.0.0.1:8099";
const q = params.get("q") ?? "q4f32_1";
const stockRun = params.has("stock");
const n = Number(params.get("n") ?? 200);
const label = `${stockRun ? "stock" : "tuned"}-${q}`;
const logEl = document.getElementById("log")!;
const log = (s: string) => { logEl.textContent = s; (window as unknown as { __bench: string }).__bench = s; };

async function main() {
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: params.get("power") === "low" ? "low-power" : "high-performance" });
  if (!adapter) throw new Error("no WebGPU adapter");
  const gpu = `${adapter.info.vendor} ${adapter.info.architecture} ${adapter.info.description} f16=${adapter.features.has("shader-f16")}`;
  const id = `Llama-3.2-1B-Instruct-${q}-MLC`;
  const stock = prebuiltAppConfig.model_list.find((m) => m.model_id === id)!;
  const record = stockRun ? stock : { ...stock, model: `${base}/${q}/resolve/main/`, model_id: `Llama-3.2-1B-Mindworld-${q}-MLC` };
  const engine = await CreateMLCEngine(record.model_id, {
    appConfig: { ...prebuiltAppConfig, model_list: [record] },
    initProgressCallback: (r) => log(`load ${gpu}: ${r.text}`),
  });
  // WebLLM takes the chunk from the wasm metadata and ignores overrides, so it is set on the loaded pipeline.
  const chunk = params.get("chunk");
  if (chunk) (engine as unknown as { loadedModelIdToPipeline: Map<string, { prefillChunkSize: number }> }).loadedModelIdToPipeline.forEach((p) => (p.prefillChunkSize = Number(chunk)));
  if (params.has("bridge")) {
    log(`bridge ready ${gpu}`);
    let served = 0;
    for (;;) {
      const job = (await (await fetch(`${base}/next`)).json()) as { id: number; body: { messages: never; temperature: number; max_tokens: number; grammar?: string; json_schema?: unknown } };
      const { messages, temperature, max_tokens, grammar, json_schema } = job.body;
      const format = grammar ? { response_format: { type: "grammar" as const, grammar } } : json_schema ? { response_format: { type: "json_object" as const, schema: JSON.stringify(json_schema) } } : {};
      const reply = await engine.chat.completions.create({ messages, temperature, max_tokens, ...format }).then((r) => ({ choices: [{ message: { content: r.choices[0]?.message.content ?? "" } }] }), (e) => ({ error: String(e) }));
      await fetch(`${base}/done/${job.id}`, { method: "POST", body: JSON.stringify(reply) });
      log(`bridge served ${++served}`);
    }
  }
  const prompts = (await (await fetch(`${base}/prompts.json`)).json()) as { id: string; task: string; system: string; user: string }[];
  const rows: { id: string; task: string; text: string; ms: number }[] = [];
  for (const p of prompts.slice(0, n)) {
    const t0 = performance.now();
    const r = await engine.chat.completions.create({
      messages: [{ role: "system", content: p.system }, { role: "user", content: p.user }],
      temperature: 0,
      max_tokens: 48,
    });
    rows.push({ id: p.id, task: p.task, text: r.choices[0]?.message.content ?? "", ms: Math.round(performance.now() - t0) });
    log(`${label} ${rows.length}/${n}`);
    if (rows.length % 20 === 0) await post(rows, gpu);
  }
  await post(rows, gpu);
  log(`done ${label} ${rows.length}`);
}

const post = (rows: unknown[], gpu: string) => fetch(`${base}/result/${label}`, { method: "POST", body: JSON.stringify({ gpu, rows }) });

main().catch((e) => log(`error: ${String(e)}`));
