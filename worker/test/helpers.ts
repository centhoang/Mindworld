import { handleRequest, type AppConfig, type Deps } from "../src/app";
import type { GhostStore } from "../src/ghosts";
import { SpendLedger, type LedgerLimits, type LedgerStorage } from "../src/ledger";

export function memoryStorage(delayMs = 0): LedgerStorage & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  const wait = () => (delayMs ? new Promise((r) => setTimeout(r, delayMs)) : Promise.resolve());
  return {
    data,
    async get<T>(key: string) {
      await wait();
      return data.get(key) === undefined ? undefined : (structuredClone(data.get(key)) as T);
    },
    async put<T>(key: string, value: T) {
      await wait();
      data.set(key, structuredClone(value));
    },
  };
}

export const LIMITS: LedgerLimits = {
  dailyUsd: 1,
  totalUsd: { baseten: 10, meta: 10 },
  clientDailyUsd: 1,
  clientPerMinute: 100,
  reservationTtlMs: 60_000,
};

export function memoryGhosts(): GhostStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: async (k) => data.get(k) ?? null,
    put: async (k, v) => void data.set(k, v),
    list: async ({ prefix, limit }) => ({
      keys: [...data.keys()].filter((k) => k.startsWith(prefix)).slice(0, limit).map((name) => ({ name })),
    }),
  };
}

export const CFG: AppConfig = {
  mock: false,
  defaultProvider: "baseten",
  maxOutputTokens: 2000,
  providers: {
    baseten: { apiKey: "test-baseten-key", baseUrl: "https://baseten.test/v1", model: "meta-models/muse-spark-open-1026" },
    meta: { apiKey: "test-meta-key", model: "muse-spark-1.3" },
  },
};

export interface Harness {
  deps: Deps;
  ledger: SpendLedger;
  ghosts: ReturnType<typeof memoryGhosts>;
  upstream: { calls: { url: string; init: RequestInit }[]; respond: (url: string, init: RequestInit) => Promise<Response> };
  call: (path: string, init?: RequestInit & { country?: string; ip?: string }) => Promise<Response>;
}

export function harness(over: { cfg?: Partial<AppConfig>; limits?: Partial<LedgerLimits>; now?: () => number } = {}): Harness {
  const now = over.now ?? (() => 1_700_000_000_000);
  const ledger = new SpendLedger(memoryStorage(), { ...LIMITS, ...over.limits }, now);
  const ghosts = memoryGhosts();
  let n = 0;
  const upstream: Harness["upstream"] = {
    calls: [],
    respond: async () => new Response("no upstream scripted", { status: 500 }),
  };
  const deps: Deps = {
    cfg: { ...CFG, ...over.cfg },
    spend: ledger,
    ghosts,
    assets: { fetch: async () => new Response("<html>asset</html>", { headers: { "content-type": "text/html" } }) },
    fetch: async (url, init) => {
      upstream.calls.push({ url, init });
      return upstream.respond(url, init);
    },
    newId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
    random: () => 0,
    now,
    hashClient: async (raw) => `h:${raw}`,
  };
  return {
    deps,
    ledger,
    ghosts,
    upstream,
    call: (path, init = {}) => {
      const { country, ip, ...rest } = init;
      const headers = new Headers(rest.headers);
      if (country) headers.set("CF-IPCountry", country);
      if (ip) headers.set("cf-connecting-ip", ip);
      return handleRequest(new Request(`https://pets.test${path}`, { ...rest, headers }), deps);
    },
  };
}

export const postJson = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const basetenReply = (text: string, inTok = 100, outTok = 50) =>
  new Response(
    JSON.stringify({
      model: "meta-models/muse-spark-open-1026",
      choices: [{ message: { role: "assistant", content: text }, finish_reason: "stop" }],
      usage: { prompt_tokens: inTok, completion_tokens: outTok, prompt_tokens_details: { cached_tokens: 0 } },
    }),
    { status: 200 },
  );

export const metaReply = (text: string, inTok = 100, outTok = 50) =>
  new Response(
    JSON.stringify({
      model: "muse-spark-1.3",
      status: "completed",
      output: [
        { type: "reasoning", summary: [] },
        { type: "message", content: [{ type: "output_text", text }] },
      ],
      usage: { input_tokens: inTok, input_tokens_details: { cached_tokens: 0 }, output_tokens: outTok },
    }),
    { status: 200 },
  );
