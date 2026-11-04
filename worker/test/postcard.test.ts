import { describe, expect, it } from "vitest";
import { colourName, parsePostcardAsk, petText, POSTCARD_DAILY_USD, POSTCARD_MODEL, POSTCARD_TEXT_URL, POSTCARD_URL, POSTCARD_USD, postcardPrompt } from "../src/postcard";
import { harness, postJson } from "./helpers";

const PET = { name: "Bolt<b>", hue: 0.3, accent: 0.62, ears: "bunny", tail: "curl", horns: "nubs", pattern: "stripes" };
const WIN = { scene: "win", player: "Kai", pet: PET, foe: { arch: "brute" }, with: ["ama", "rival", "ama"] };
const day = new Date(1_700_000_000_000).toISOString().slice(0, 10);
const json = (v: unknown) => new Response(JSON.stringify(v), { status: 200, headers: { "content-type": "application/json" } });
const imageReply = (b64 = "UklGRiQAAABXRUJQVlA4") => json({ output: [{ type: "reasoning" }, { type: "image_generation_call", result: b64 }], usage: {} });
const textReply = (b64 = "iVBORw0KGgo") => json({ data: [{ b64_json: b64 }], usage: {} });

describe("/api/postcard", () => {
  it("takes only the game's own values: a scene, gene words, villagers; names cleaned", () => {
    const a = parsePostcardAsk(WIN)!;
    expect(a).toMatchObject({ scene: "win", player: "Kai", pet: { name: "Bolt b", ears: "bunny", horns: "nubs" }, foe: { arch: "brute" }, with: ["ama"] });
    expect(parsePostcardAsk({ ...WIN, pet: { ...PET, ears: "laser" } })).toBeNull();
    expect(parsePostcardAsk({ ...WIN, foe: {} })).toBeNull(); // a win names who was beaten
    expect(parsePostcardAsk({ ...WIN, scene: "friends" })).toBeNull(); // a new friend needs its looks
    expect(parsePostcardAsk({ ...WIN, scene: "campfire", with: [] })).toBeNull(); // somebody tells the story
    expect(parsePostcardAsk({ ...WIN, scene: "selfie" })).toBeNull();
    expect(parsePostcardAsk({ ...WIN, prompt: "anything" })).not.toHaveProperty("prompt");
  });

  it("the genes become words, and the prompt is the worker's own with no text in the picture", () => {
    expect(colourName(0.3)).toBe("green");
    expect(colourName(0.98)).toBe("red");
    expect(petText(parsePostcardAsk(WIN)!.pet)).toBe("Bolt b, a small, round green pet creature with long bunny ears, blue stripes, two little horn nubs, a curly tail");
    const p = postcardPrompt(parsePostcardAsk(WIN)!);
    expect(p).toContain("won a friendly pet match against a big, sturdy wild brute");
    expect(p).toContain("Ama, a cheerful cook cheers");
    expect(p).toContain("No text");
    const fire = postcardPrompt(parsePostcardAsk({ ...WIN, scene: "campfire", with: ["elder", "mo"] })!);
    expect(fire).toContain("the Elder, a kind old villager tells a story");
    expect(fire).toContain("beside Mo, a calm young fisher");
  });

  it("paints one image from the game's own frames on the Meta Model API, books it, and answers with a data URL", async () => {
    const h = harness();
    h.upstream.respond = async () => imageReply();
    const r = (await (await h.call("/api/postcard", postJson(WIN))).json()) as { source: string; image: string; model: string; costUsd: number };
    expect(r).toMatchObject({ source: "model", model: POSTCARD_MODEL, costUsd: POSTCARD_USD });
    expect(r.image.startsWith("data:image/webp;base64,UklGR")).toBe(true);
    expect(h.upstream.calls).toHaveLength(1);
    const call = h.upstream.calls[0]!;
    expect(call.url).toBe(POSTCARD_URL);
    const body = JSON.parse(String(call.init.body)) as { model: string; input: { role: string; content: { type: string; text?: string; image_url?: string }[] }[] };
    expect(body.model).toBe("muse-image-1.0");
    const parts = body.input[0]!.content;
    expect(parts[0]).toMatchObject({ type: "input_text" });
    expect(parts[0]!.text).toContain("frames from this game");
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.slice(1).every((p) => p.type === "input_image" && p.image_url!.startsWith("data:image/png;base64,iVBOR"))).toBe(true);
    expect((await h.ledger.snapshot()).dailySpentUsd).toBeCloseTo(POSTCARD_USD);
  });

  it("if the reference call is refused, the text-only card is painted instead", async () => {
    const h = harness();
    h.upstream.respond = async (url: unknown) => (String(url) === POSTCARD_URL ? new Response("bad request", { status: 400 }) : textReply());
    const r = (await (await h.call("/api/postcard", postJson({ ...WIN, scene: "campfire", with: ["elder"] }))).json()) as { source: string; image: string };
    expect(r).toMatchObject({ source: "model" });
    expect(r.image.startsWith("data:image/png;base64,iVBOR")).toBe(true);
    expect(h.upstream.calls.map((c) => c.url)).toEqual([POSTCARD_URL, POSTCARD_TEXT_URL]);
    expect(JSON.parse(String(h.upstream.calls[1]!.init.body))).toMatchObject({ model: "muse-image-1.0", n: 1, size: "1536x1024" });
  });

  it("an upstream error costs nothing; over the day's cap no call; a bad ask is a 400", async () => {
    const h = harness();
    h.upstream.respond = async () => new Response("busy", { status: 503 });
    expect(await (await h.call("/api/postcard", postJson(WIN))).json()).toMatchObject({ source: "none", why: "upstream" });
    expect((await h.ledger.snapshot()).dailySpentUsd).toBe(0);
    h.upstream.respond = async () => new Response(JSON.stringify({ data: [] }), { status: 200 });
    expect(await (await h.call("/api/postcard", postJson(WIN))).json()).toMatchObject({ source: "none", why: "invalid" });
    const capped = harness();
    await capped.ghosts.put(`postcard:spend:${day}`, String(POSTCARD_DAILY_USD));
    expect(await (await capped.call("/api/postcard", postJson(WIN))).json()).toMatchObject({ source: "none", why: "job_cap" });
    expect(capped.upstream.calls).toHaveLength(0);
    expect((await h.call("/api/postcard", postJson({ scene: "win" }))).status).toBe(400);
  });

  it("mock mode answers a tiny image without a call", async () => {
    const h = harness({ cfg: { mock: true } });
    const r = (await (await h.call("/api/postcard", postJson(WIN))).json()) as { image: string };
    expect(r.image.startsWith("data:image/png;base64,")).toBe(true);
    expect(h.upstream.calls).toHaveLength(0);
  });
});
