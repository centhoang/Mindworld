import { describe, expect, it } from "vitest";
import { CHAT_QUOTA, OpenerCache, parsePetSide, tidyPair } from "../src/chat";
import { basetenReply, harness, postJson } from "./helpers";

type Res = { lines: [string, string]; source: string; why?: string };
const A = { name: "Mochi", trait: "bold" };
const B = { name: "Pip", trait: "friendly" };
function h0(limits = {}) {
  const h = harness({ limits });
  h.deps.chatCache = new OpenerCache();
  return h;
}
const pet = (h: ReturnType<typeof h0>, body: unknown, ip = "1.1.1.1") =>
  h.call("/api/petchat", { ...postJson(body), ip }).then(async (r) => ({ status: r.status, body: (await r.json()) as Res }));

describe("pet-to-pet chat", () => {
  it("validates sides: clean name + known trait only", () => {
    expect(parsePetSide({ name: "<b>Mo</b>chi.com", trait: "bold" })).toEqual({ name: "bMobchicom", trait: "bold" });
    expect(parsePetSide({ name: "Mochi", trait: "evil" })).toBeNull();
    expect(parsePetSide({ name: "<<>>", trait: "bold" })).toBeNull();
  });

  it("parses two lines and rejects one-sided replies", () => {
    expect(tidyPair("<think>x</think>A: Race you!\nB: You're on, friend!")).toEqual(["Race you!", "You're on, friend!"]);
    expect(tidyPair("A: only me")).toBeNull();
  });

  it("asks Muse once, never sends names, then serves the trait pair from cache", async () => {
    const h = h0();
    let n = 0;
    h.upstream.respond = async () => basetenReply(`A: Hi number ${++n}!\nB: Hello back!`);
    const r = await pet(h, { a: A, b: B });
    expect(r.body).toMatchObject({ source: "model", lines: ["Hi number 1!", "Hello back!"] });
    expect(String(h.upstream.calls[0]!.init.body)).not.toContain("Mochi");
    for (let i = 0; i < 2; i++) await pet(h, { a: A, b: B });
    expect((await pet(h, { a: A, b: B })).body.source).toBe("cache");
    expect(h.upstream.calls).toHaveLength(3);
  });

  it("falls back to scripted lines on bad input, quota or upstream errors", async () => {
    const h = h0({ clientPerMinute: 1000 });
    expect((await pet(h, { a: A })).status).toBe(400);
    h.upstream.respond = async () => new Response("down", { status: 500 });
    expect((await pet(h, { a: A, b: B })).body).toMatchObject({ source: "scripted", why: "upstream" });
    h.upstream.respond = async () => basetenReply("A: hi\nB: yo");
    const T = ["bold", "careful", "cautious", "cheerful", "friendly", "curious"] as const;
    for (let i = 0; i < CHAT_QUOTA.perClient; i++) h.deps.chatCache = new OpenerCache(), await pet(h, { a: { ...A, trait: T[i % 6] }, b: { ...B, trait: T[Math.floor(i / 6) % 6] } }, "9.9.9.9");
    const over = await pet(h, { a: { name: "Z", trait: "curious" }, b: { name: "Y", trait: "curious" } }, "9.9.9.9");
    expect(over.body).toMatchObject({ source: "scripted", why: "client_cap" });
  });
});
