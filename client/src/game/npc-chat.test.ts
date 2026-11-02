import { describe, expect, it } from "vitest";
import { LINES } from "./chatter";
import { askNpc, chatWhoFor, cloudLine } from "./npc-chat";

const reply = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status });

describe("NPC chat client", () => {
  it("maps world entities to who can talk", () => {
    expect(chatWhoFor("npc")).toBe("elder");
    expect(chatWhoFor("wild", "pal")).toBe("pal");
    expect(chatWhoFor("wild")).toBeNull();
    expect(chatWhoFor("market")).toBeNull();
    expect(chatWhoFor("tamed", "pal")).toBeNull();
  });

  it("returns the server's line and source, and sends only who + a capped line", async () => {
    let sent = "";
    const r = await askNpc("elder", "x".repeat(300), "", async (_u, init) => {
      sent = String(init?.body);
      return new Response(JSON.stringify({ text: " Guard the big ones. ", source: "model" }));
    });
    expect(r).toEqual({ text: "Guard the big ones.", source: "model" });
    expect(JSON.parse(sent)).toEqual({ who: "elder", line: "x".repeat(140) });
    expect(await askNpc("pal", "hi", "", reply({ text: "Hi!", source: "cache" }))).toEqual({ text: "Hi!", source: "cache" });
    expect((await askNpc("pal", "hi", "", reply({ text: "Hi!", source: "weird" }))).source).toBe("scripted");
  });

  it("falls back to a canned line when offline or the reply is bad", async () => {
    const offline = await askNpc("skitter", "hi", "", async () => { throw new Error("offline"); });
    expect(offline.source).toBe("offline");
    expect(LINES.skitter).toContain(offline.text);
    expect((await askNpc("turtle", "hi", "", reply({ error: "x" }, 500))).source).toBe("offline");
    expect((await askNpc("turtle", "hi", "", reply({ text: "" }))).source).toBe("offline");
  });
});

describe("cloudLine", () => {
  const reply = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status });
  it("takes only a real model line, so a cap or an outage drops to the local tier", async () => {
    expect(await cloudLine("mo", "hi", "", "", reply({ text: "Quiet day.", source: "model" }))).toEqual({ text: "Quiet day.", source: "model" });
    expect(await cloudLine("mo", "hi", "", "", reply({ text: "Canned.", source: "scripted", why: "daily_cap" }))).toBeNull();
    expect(await cloudLine("mo", "hi", "", "", async () => { throw new Error("offline"); })).toBeNull();
  });

  it("sends the mind with the line", async () => {
    let sent = "";
    await cloudLine("mo", "hi", "", "Mo remembers soup", async (_u, init) => {
      sent = String(init?.body);
      return new Response(JSON.stringify({ text: "Hm.", source: "model" }));
    });
    expect(JSON.parse(sent).mind).toBe("Mo remembers soup");
  });
});
