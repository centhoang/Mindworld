// Spike B: can a small model running in the player's browser (WebGPU, via WebLLM) be the pet's Instinct?
// Measures cold/warm load time, per-decision latency, validity of the reply, sanity of the choice, and
// whether the model follows a memo. Results land in the page and in window.__spike (read by tooling).
import * as webllm from "@mlc-ai/web-llm";
import { GRAMMAR, SCENARIOS, SYSTEM_PROMPT } from "./scenarios";
import { summarize, type Sample, type Summary } from "./score";

type Mode = "free" | "grammar";

interface ModelSpec {
  key: string;
  label: string;
  f16Id: string | null; // needs the WebGPU shader-f16 feature
  f32Id: string | null;
}

// Meta models only: organizers ruled (2026-10-28) that every model the project calls at runtime must be a
// Meta model. The Gemma results from the spike stay in docs/SPIKES.md as research.
const MODELS: ModelSpec[] = [
  { key: "llama1b", label: "Llama 3.2 1B Instruct (Meta)", f16Id: "Llama-3.2-1B-Instruct-q4f16_1-MLC", f32Id: "Llama-3.2-1B-Instruct-q4f32_1-MLC" },
  { key: "llama3b", label: "Llama 3.2 3B Instruct (Meta)", f16Id: "Llama-3.2-3B-Instruct-q4f16_1-MLC", f32Id: "Llama-3.2-3B-Instruct-q4f32_1-MLC" },
];

interface ModelResult {
  key: string;
  label: string;
  modelId: string | null;
  vramRequiredMB: number | null;
  wasCached: boolean | null;
  coldLoadMs: number | null; // first load; includes the download when wasCached is false
  warmLoadMs: number | null; // second load, weights already in the browser cache
  firstDecisionMs: number | null;
  modes: Partial<Record<Mode, Summary>>;
  runtimeStats: string | null;
  error?: string;
}

interface Env {
  userAgent: string;
  gpu: Record<string, unknown> | null;
  shaderF16: boolean;
  hardwareConcurrency: number;
  deviceMemoryGB: number | null;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const logEl = $("log");
const log = (msg: string) => {
  logEl.textContent += `${new Date().toISOString().slice(11, 19)} ${msg}\n`;
  logEl.scrollTop = logEl.scrollHeight;
};

const spike = ((window as unknown as { __spike: Record<string, unknown> }).__spike = {
  done: false,
  env: null as Env | null,
  results: [] as ModelResult[],
  raw: {} as Record<string, Sample[]>,
});

async function detectEnv(): Promise<Env> {
  const base: Env = {
    userAgent: navigator.userAgent,
    gpu: null,
    shaderF16: false,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemoryGB: (navigator as { deviceMemory?: number }).deviceMemory ?? null,
  };
  if (!navigator.gpu) return base;
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
  if (!adapter) return base;
  const info = adapter.info;
  return {
    ...base,
    shaderF16: adapter.features.has("shader-f16"),
    gpu: {
      vendor: info.vendor,
      architecture: info.architecture,
      device: info.device,
      description: info.description,
      maxBufferSizeMB: Math.round(adapter.limits.maxBufferSize / 1048576),
      maxStorageBufferBindingSizeMB: Math.round(adapter.limits.maxStorageBufferBindingSize / 1048576),
    },
  };
}

function resolveId(spec: ModelSpec, f16: boolean): string | null {
  return f16 ? (spec.f16Id ?? spec.f32Id) : spec.f32Id;
}

async function decide(engine: webllm.MLCEngineInterface, mode: Mode, prompt: string) {
  const t0 = performance.now();
  const reply = await engine.chat.completions.create({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    temperature: 0,
    max_tokens: 8,
    ...(mode === "grammar" ? { response_format: { type: "grammar" as const, grammar: GRAMMAR } } : {}),
  });
  const ms = performance.now() - t0;
  const extra = (reply.usage as { extra?: { prefill_tokens_per_s?: number; decode_tokens_per_s?: number } } | undefined)?.extra;
  return {
    text: reply.choices[0]?.message?.content ?? "",
    ms,
    prefillTps: extra?.prefill_tokens_per_s,
    decodeTps: extra?.decode_tokens_per_s,
  };
}

async function loadEngine(modelId: string, label: string): Promise<webllm.MLCEngineInterface> {
  let lastPct = -1;
  return webllm.CreateMLCEngine(modelId, {
    initProgressCallback: (p) => {
      const pct = Math.floor(p.progress * 20) * 5;
      if (pct !== lastPct) {
        lastPct = pct;
        $("progress").textContent = `${label}: ${pct}% ${p.text.slice(0, 90)}`;
      }
    },
  });
}

async function runModel(spec: ModelSpec, modes: Mode[], f16: boolean): Promise<ModelResult> {
  const modelId = resolveId(spec, f16);
  const result: ModelResult = {
    key: spec.key, label: spec.label, modelId, vramRequiredMB: null, wasCached: null,
    coldLoadMs: null, warmLoadMs: null, firstDecisionMs: null, modes: {}, runtimeStats: null,
  };
  if (!modelId) {
    result.error = "no variant for this GPU (needs shader-f16)";
    return result;
  }
  result.vramRequiredMB = webllm.prebuiltAppConfig.model_list.find((m) => m.model_id === modelId)?.vram_required_MB ?? null;

  try {
    result.wasCached = await webllm.hasModelInCache(modelId);
    log(`${spec.label}: loading ${modelId} (cached=${result.wasCached})`);
    const t0 = performance.now();
    let engine = await loadEngine(modelId, spec.label);
    result.coldLoadMs = Math.round(performance.now() - t0);
    log(`${spec.label}: ready in ${(result.coldLoadMs / 1000).toFixed(1)} s`);

    log(`${spec.label}: first decision...`);
    const first = await decide(engine, "free", SCENARIOS[0]!.prompt);
    result.firstDecisionMs = Math.round(first.ms);
    log(`${spec.label}: first decision ${result.firstDecisionMs} ms -> ${JSON.stringify(first.text)}`);

    for (const mode of modes) {
      const samples: Sample[] = [];
      for (const [i, sc] of SCENARIOS.entries()) {
        $("progress").textContent = `${spec.label} [${mode}] decision ${i + 1}/${SCENARIOS.length}`;
        const d = await decide(engine, mode, sc.prompt);
        samples.push({ kind: sc.kind, ok: sc.ok, text: d.text, ms: d.ms, prefillTps: d.prefillTps, decodeTps: d.decodeTps });
      }
      (spike.raw as Record<string, Sample[]>)[`${spec.key}:${mode}`] = samples;
      result.modes[mode] = summarize(samples);
      const s = result.modes[mode]!;
      log(`${spec.label} [${mode}]: strict ${s.strictValidPct}%  sane ${s.sensiblePlainPct}%  memo ${s.memoCompliancePct}%  p50 ${s.latencyMs.p50} ms  p95 ${s.latencyMs.p95} ms`);
    }
    result.runtimeStats = await engine.runtimeStatsText();

    // Warm start: unload, then load again with the weights already cached by the browser.
    await engine.unload();
    const t1 = performance.now();
    engine = await loadEngine(modelId, `${spec.label} (warm)`);
    result.warmLoadMs = Math.round(performance.now() - t1);
    log(`${spec.label}: warm load ${(result.warmLoadMs / 1000).toFixed(1)} s`);
    await engine.unload();
  } catch (e) {
    result.error = String((e as Error)?.message ?? e).slice(0, 300);
    log(`${spec.label}: FAILED ${result.error}`);
  }
  return result;
}

function renderTable(results: ModelResult[]) {
  const rows: string[] = [];
  for (const r of results) {
    const ms = (v: number | null) => (v === null ? "-" : (v / 1000).toFixed(1) + " s");
    if (r.error && Object.keys(r.modes).length === 0) {
      rows.push(`<tr><td>${r.label}</td><td colspan="9">${r.error}</td></tr>`);
      continue;
    }
    for (const [mode, s] of Object.entries(r.modes) as [Mode, Summary][]) {
      rows.push(
        `<tr><td>${r.label}</td><td>${mode}</td><td>${r.vramRequiredMB ? Math.round(r.vramRequiredMB) : "-"}</td>` +
          `<td>${ms(r.coldLoadMs)}${r.wasCached ? "" : " (+dl)"}</td><td>${ms(r.warmLoadMs)}</td>` +
          `<td>${s.latencyMs.p50} / ${s.latencyMs.p95}</td><td>${s.strictValidPct}%</td>` +
          `<td>${s.sensiblePlainPct}%</td><td>${s.memoCompliancePct}%</td><td>${s.decodeTps ?? "-"}</td></tr>`,
      );
    }
  }
  $("table-body").innerHTML = rows.join("");
  $("results").textContent = JSON.stringify({ env: spike.env, results }, null, 1);
}

async function runAll(keys: string[], modes: Mode[]) {
  ($("run") as HTMLButtonElement).disabled = true;
  spike.done = false;
  const env = await detectEnv();
  spike.env = env;
  log(`GPU: ${JSON.stringify(env.gpu)}  shader-f16=${env.shaderF16}`);
  if (!env.gpu) {
    log("WebGPU is not available in this browser; nothing to measure.");
    spike.done = true;
    return;
  }
  const results: ModelResult[] = [];
  spike.results = results;
  for (const spec of MODELS.filter((m) => keys.includes(m.key))) {
    results.push(await runModel(spec, modes, env.shaderF16));
    renderTable(results);
  }
  $("progress").textContent = "done";
  spike.done = true;
  ($("run") as HTMLButtonElement).disabled = false;
}

function init() {
  const params = new URLSearchParams(location.search);
  const picked = (params.get("models") ?? "llama1b").split(",");
  $("models").innerHTML = MODELS.map(
    (m) => `<label><input type="checkbox" value="${m.key}" ${picked.includes(m.key) ? "checked" : ""}/> ${m.label}</label>`,
  ).join("");
  const selected = () => [...document.querySelectorAll<HTMLInputElement>("#models input:checked")].map((i) => i.value);
  const modes = (): Mode[] => ($("grammar") as HTMLInputElement).checked ? ["free", "grammar"] : ["free"];
  ($("grammar") as HTMLInputElement).checked = (params.get("modes") ?? "free,grammar").includes("grammar");
  $("run").addEventListener("click", () => void runAll(selected(), modes()));
  if (params.get("auto") === "1") void runAll(selected(), modes());
}

init();
