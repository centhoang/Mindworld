// The tuned 1B's MLC weights for WebLLM. The Hugging Face repos stay private until submission day, so the Worker fetches
// them with its own token. Only the whitelisted files of one pinned commit per format are served, and the route sits
// behind the same Access gate as the game.

const REPO = (q: string) => `kysupo/Llama-3.2-1B-Mindworld-${q}-MLC`;
export const MLC_REVISIONS: Record<string, string> = {
  q4f32_1: "cdaa34b96006e69aa5e77541fc1b4a23979a9a24",
  q4f16_1: "4538e9ad9198a93aba009250d0777cddf45dd867",
};
const FILE = /^(params_shard_\d{1,3}\.bin|tensor-cache\.json|ndarray-cache\.json|mlc-chat-config\.json|tokenizer\.json|tokenizer_config\.json)$/;
const MAX_REDIRECTS = 3;

export interface MlcCache {
  match(key: string): Promise<Response | undefined>;
  put(key: string, res: Response): Promise<void>;
}

export interface MlcDeps {
  token?: string;
  cache?: MlcCache;
  fetch(input: string, init: RequestInit): Promise<Response>;
  waitUntil?(p: Promise<unknown>): void;
}

const status = (code: number, error: string) =>
  new Response(JSON.stringify({ error }), { status: code, headers: { "content-type": "application/json", "cache-control": "no-store" } });

// Hugging Face answers large files with a redirect to a signed CDN URL, which must not receive the token.
async function fetchHf(url: string, token: string, get: MlcDeps["fetch"]): Promise<Response> {
  let res = await get(url, { headers: { authorization: `Bearer ${token}` }, redirect: "manual" });
  for (let i = 0; i < MAX_REDIRECTS && res.status >= 300 && res.status < 400; i++) {
    const next = res.headers.get("location");
    if (!next) break;
    const target = new URL(next, url);
    res = await get(target.href, target.host === "huggingface.co" ? { headers: { authorization: `Bearer ${token}` }, redirect: "manual" } : { redirect: "manual" });
  }
  return res;
}

export async function handleMlc(path: string, method: string, deps: MlcDeps): Promise<Response> {
  if (method !== "GET") return status(405, "method_not_allowed");
  const m = /^\/mlc\/(?:n4\/)?([^/]+)\/resolve\/main\/([^/]+)$/.exec(path);
  const rev = m && Object.hasOwn(MLC_REVISIONS, m[1]!) ? MLC_REVISIONS[m[1]!] : undefined;
  if (!m || !rev || !FILE.test(m[2]!)) return status(404, "not_found");
  if (!deps.token) return status(503, "no_token");
  const url = `https://huggingface.co/${REPO(m[1]!)}/resolve/${rev}/${m[2]}`;

  const hit = await deps.cache?.match(url);
  if (hit) return hit;

  const res = await fetchHf(url, deps.token, deps.fetch);
  if (!res.ok || !res.body) return status(502, "upstream_error");
  const headers = new Headers({
    "content-type": m[2]!.endsWith(".json") ? "application/json" : "application/octet-stream",
    "cache-control": "public, max-age=2592000",
  });
  const length = res.headers.get("content-length");
  if (length) headers.set("content-length", length);
  if (!deps.cache) return new Response(res.body, { headers });
  const [toClient, toCache] = res.body.tee();
  const put = deps.cache.put(url, new Response(toCache, { headers }));
  if (deps.waitUntil) deps.waitUntil(put);
  else await put;
  return new Response(toClient, { headers });
}
