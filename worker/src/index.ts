import { handleRequest, type AppConfig, type Deps } from "./app";
import type { Env } from "./env";
import { WorldRoom } from "./room-do";
import { SpendCounter } from "./spend-do";
import { runWildMemos } from "./wild-memos";

export { SpendCounter, WorldRoom };

const flag = (v: string | undefined) => v === "1" || v === "true";

async function hashClient(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return [...new Uint8Array(digest).slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function buildDeps(env: Env, ctx?: ExecutionContext): Deps {
  const cfg: AppConfig = {
    mock: flag(env.LLM_MOCK),
    defaultProvider: "baseten",
    maxOutputTokens: 4000, // reasoning models spend most of this thinking; 2000 cut memo replies off
    providers: {
      baseten: {
        apiKey: env.BASETEN_API_KEY,
        baseUrl: env.BASETEN_BASE_URL ?? "https://inference.baseten.co/v1",
        model: env.BASETEN_MODEL ?? "meta-models/muse-spark-open-1026",
      },
      meta: { apiKey: env.META_API_KEY, model: env.META_MODEL ?? "muse-spark-1.3" },
      modal: {
        apiKey: env.MODAL_PROXY_TOKEN,
        baseUrl: env.MODAL_BASE_URL ?? "",
        model: env.MODAL_MODEL ?? "meta-models/Muse-Spark-Open-816B-A42B",
      },
      glimmer: {
        apiKey: env.MODAL_PROXY_TOKEN,
        baseUrl: env.MODAL_GLIMMER_URL ?? "",
        model: env.MODAL_GLIMMER_MODEL ?? "glimmer",
      },
    },
  };
  return {
    cfg,
    spend: env.SPEND.get(env.SPEND.idFromName("global")),
    ghosts: env.GHOSTS,
    room: env.ROOM.get(env.ROOM.idFromName("main")),
    assets: env.ASSETS,
    fetch: (input, init) => fetch(input, init),
    mlc: {
      token: env.HF_TOKEN,
      cache: {
        match: (key) => caches.default.match(new Request(key)),
        put: (key, res) => caches.default.put(new Request(key), res),
      },
      waitUntil: ctx ? (p) => ctx.waitUntil(p) : undefined,
    },
    newId: () => crypto.randomUUID(),
    random: Math.random,
    now: Date.now,
    hashClient,
  };
}

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => handleRequest(request, buildDeps(env, ctx)),
  // Every 6 h: Muse Spark re-teaches the wild pets from what shared ghosts learned (capped, see wild-memos.ts).
  scheduled: async (_controller: ScheduledController, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(runWildMemos(buildDeps(env)).then((r) => console.log("wild-memos", JSON.stringify(r))));
  },
} satisfies ExportedHandler<Env>;
