import { describe, expect, it, vi } from "vitest";
import { handleMlc, type MlcCache, type MlcDeps } from "../src/mlc";

const PATH = "/mlc/q4f32_1/resolve/main/params_shard_0.bin";
const NEW_PATH = "/mlc/n4/q4f32_1/resolve/main/params_shard_0.bin";
const ok = (body = "weights") => new Response(body, { headers: { "content-length": String(body.length) } });
const deps = (over: Partial<MlcDeps> = {}) => ({ token: "secret", fetch: vi.fn<MlcDeps["fetch"]>(async () => ok()), ...over });

function memoryCache() {
  const store = new Map<string, Response>();
  const cache: MlcCache = {
    match: async (k) => store.get(k)?.clone(),
    put: async (k, r) => void store.set(k, new Response(await r.arrayBuffer(), { headers: r.headers })),
  };
  return { cache, store };
}

describe("/mlc proxy", () => {
  it("fetches a whitelisted file from the private repo with the token and streams it", async () => {
    const f = vi.fn<MlcDeps["fetch"]>(async () => ok());
    const res = await handleMlc(PATH, "GET", deps({ fetch: f }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("weights");
    const [url, init] = f.mock.calls[0]!;
    expect(url).toContain("huggingface.co/kysupo/Llama-3.2-1B-Mindworld-q4f32_1-MLC/resolve/");
    expect(url).toContain("/params_shard_0.bin");
    expect(init.headers).toEqual({ authorization: "Bearer secret" });
    expect(res.headers.get("content-length")).toBe("7");
  });

  it.each([
    "/mlc/q4f8/resolve/main/params_shard_0.bin",
    "/mlc/constructor/resolve/main/tokenizer.json",
    "/mlc/q4f32_1/resolve/main/README.md",
    "/mlc/q4f32_1/resolve/main/..%2f..%2fsecret",
    "/mlc/q4f32_1/params_shard_0.bin",
    "/mlc/q4f32_1/resolve/dev/tokenizer.json",
  ])("refuses %s without calling Hugging Face", async (path) => {
    const d = deps();
    expect((await handleMlc(path, "GET", d)).status).toBe(404);
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it("is read-only", async () => {
    expect((await handleMlc(PATH, "POST", deps())).status).toBe(405);
  });

  it("answers 503 without a token", async () => {
    const d = deps({ token: undefined });
    expect((await handleMlc(PATH, "GET", d)).status).toBe(503);
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it("does not pass upstream errors or the token through", async () => {
    const res = await handleMlc(PATH, "GET", deps({ fetch: vi.fn(async () => new Response("Bearer secret denied", { status: 401 })) }));
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("secret");
  });

  it("follows the CDN redirect without sending the token off Hugging Face", async () => {
    const f = vi.fn<MlcDeps["fetch"]>(async (url) => url.includes("cdn") ? ok() : new Response(null, { status: 302, headers: { location: "https://cdn-lfs.hf.co/x?sig=1" } }));
    const res = await handleMlc(PATH, "GET", deps({ fetch: f }));
    expect(res.status).toBe(200);
    expect(f.mock.calls[1]![1].headers).toBeUndefined();
  });

  it("keeps the token on a relative redirect within Hugging Face", async () => {
    let calls = 0;
    const f = vi.fn<MlcDeps["fetch"]>(async (_url, init) => ++calls === 1 ? new Response(null, { status: 307, headers: { location: "/other/repo" } }) : init.headers ? ok() : new Response(null, { status: 401 }));
    expect((await handleMlc(PATH, "GET", deps({ fetch: f }))).status).toBe(200);
    expect(f.mock.calls[1]![0]).toBe("https://huggingface.co/other/repo");
  });

  it("serves the second request from the cache", async () => {
    const { cache, store } = memoryCache();
    const d = deps({ cache });
    expect(await (await handleMlc(PATH, "GET", d)).text()).toBe("weights");
    expect(store.size).toBe(1);
    expect(await (await handleMlc(PATH, "GET", d)).text()).toBe("weights");
    expect(d.fetch).toHaveBeenCalledTimes(1);
  });

  it("does not store a failed response", async () => {
    const { cache, store } = memoryCache();
    await handleMlc(PATH, "GET", deps({ cache, fetch: vi.fn(async () => new Response("no", { status: 500 })) }));
    expect(store.size).toBe(0);
  });
});
