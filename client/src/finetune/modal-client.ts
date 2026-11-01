// Direct client for Muse Spark Open on Modal's shared endpoint, for offline data generation only (docs/archive/FINETUNE.md
// steps 1-2). It skips the Worker, so it keeps its own guards: every call is appended to a JSONL ledger, a call is
// refused before it is sent if the worst case would pass the cap for its kind, and a run has a hard call limit.
// It implements LlmClient, so the teacher goes through the exact LlmCortex code path the game uses.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CortexUnavailable, type LlmClient, type LlmReply } from "../sim/cortex";

// Same prices as the Worker's pricing table for provider "modal" (USD per million tokens).
const PRICE = { input: 1.25, cachedInput: 0.15, output: 4.25 };
const ROOT = new URL("../../../", import.meta.url);

export class BudgetExceeded extends Error {}

export interface ModalOptions {
  kind: string; // ledger tag; the cap applies to the sum of this kind
  capUsd: number;
  maxCalls: number; // per process run
  effort?: "low" | "medium" | "high";
  ledgerPath?: string;
  fetchFn?: typeof fetch;
  env?: Record<string, string | undefined>;
}

// Reads KEY=VALUE lines from the repo's .env (gitignored). Values never leave this process except as the auth header.
export function loadDotEnv(path = new URL(".env", ROOT)): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return out;
}

export const defaultLedger = (): string => fileURLToPath(new URL(".scratch/finetune/ledger.jsonl", ROOT));

export class ModalClient implements LlmClient {
  private readonly url: string;
  private readonly token: string;
  private readonly model: string;
  private readonly ledger: string;
  private spent: number; // settled cost of this kind, all runs
  private reserved = 0; // worst case of calls in flight
  private calls = 0;

  constructor(private readonly opts: ModalOptions) {
    const env = opts.env ?? { ...loadDotEnv(), ...process.env };
    const base = (env.MODAL_BASE_URL ?? "").replace(/\/+$/, "");
    if (!base || !env.MODAL_PROXY_TOKEN || !env.MODAL_MODEL) throw new Error("MODAL_BASE_URL, MODAL_PROXY_TOKEN and MODAL_MODEL must be set in .env");
    this.url = `${base.endsWith("/v1") ? base : `${base}/v1`}/chat/completions`;
    this.token = env.MODAL_PROXY_TOKEN;
    this.model = env.MODAL_MODEL;
    this.ledger = opts.ledgerPath ?? defaultLedger();
    mkdirSync(dirname(this.ledger), { recursive: true });
    this.spent = ledgerTotal(this.ledger, opts.kind);
  }

  get spentUsd(): number {
    return this.spent;
  }

  async complete(req: Parameters<LlmClient["complete"]>[0]): Promise<LlmReply> {
    // Rough input size (3 chars per token, on the high side) for the worst-case reservation.
    const worst = ((req.system.length + req.prompt.length) / 3 * PRICE.input + req.maxTokens * PRICE.output) / 1e6;
    if (this.calls >= this.opts.maxCalls) throw new BudgetExceeded(`call limit ${this.opts.maxCalls} reached`);
    if (this.spent + this.reserved + worst > this.opts.capUsd) throw new BudgetExceeded(`cap $${this.opts.capUsd} for ${this.opts.kind} reached (spent $${this.spent.toFixed(3)})`);
    this.calls++;
    this.reserved += worst;
    const t0 = Date.now();
    let cost = worst; // booked if the outcome is unknown (network error after sending)
    try {
      const res = await (this.opts.fetchFn ?? fetch)(this.url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.token}` },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: "system", content: req.system }, { role: "user", content: req.prompt }],
          max_tokens: req.maxTokens,
          ...(this.opts.effort ? { reasoning_effort: this.opts.effort } : {}),
        }),
        signal: AbortSignal.timeout(180_000),
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, any>;
      if (!res.ok) {
        cost = 0; // refused calls are not billed
        throw new CortexUnavailable(`modal HTTP ${res.status}: ${JSON.stringify(body).slice(0, 200)}`);
      }
      const u = body.usage ?? {};
      const inTok = Number(u.prompt_tokens) || 0;
      const outTok = Number(u.completion_tokens) || 0;
      const cached = Math.min(Number(u.prompt_tokens_details?.cached_tokens) || 0, inTok);
      cost = inTok && outTok ? ((inTok - cached) * PRICE.input + cached * PRICE.cachedInput + outTok * PRICE.output) / 1e6 : worst;
      const choice = body.choices?.[0] ?? {};
      return {
        text: typeof choice.message?.content === "string" ? choice.message.content : "",
        truncated: choice.finish_reason === "length",
        model: String(body.model ?? this.model),
        provider: "modal",
        costUsd: cost,
        latencyMs: Date.now() - t0,
      };
    } finally {
      this.reserved -= worst;
      this.spent += cost;
      if (cost > 0) appendFileSync(this.ledger, JSON.stringify({ t: new Date().toISOString(), kind: this.opts.kind, costUsd: cost, ms: Date.now() - t0 }) + "\n");
    }
  }
}

export function ledgerTotal(path: string, kind?: string): number {
  if (!existsSync(path)) return 0;
  let sum = 0;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const row = JSON.parse(line) as { kind: string; costUsd: number };
    if (!kind || row.kind === kind) sum += row.costUsd;
  }
  return sum;
}

// Runs fn over items with at most `n` in flight; stops handing out new items once fn throws BudgetExceeded.
export async function pool<T>(items: readonly T[], n: number, fn: (item: T, i: number) => Promise<void>): Promise<boolean> {
  let next = 0;
  let stopped = false;
  const worker = async () => {
    while (!stopped && next < items.length) {
      const i = next++;
      try {
        await fn(items[i]!, i);
      } catch (e) {
        if (!(e instanceof BudgetExceeded)) throw e;
        if (!stopped) console.error(`stopping: ${e.message}`);
        stopped = true;
      }
    }
  };
  await Promise.all(Array.from({ length: n }, worker));
  return !stopped;
}
