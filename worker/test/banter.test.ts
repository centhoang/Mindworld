import { describe, expect, it } from "vitest";
import { BANTER_DAILY_USD, BANTER_LINE_MAX, BANTER_MAX_TOKENS, banterPrompt, parseBanterAsk, validateBanter } from "../src/banter";
import { basetenReply, harness, postJson } from "./helpers";

const CHAT = {
  kind: "chat",
  who: ["mo", "ama", "brute"],
  speak: ["mo", "ama"],
  notes: { mo: "08:10 caught three fish at the pond; Kai's picnic: I went and Kai came", ama: "fond of Kai <b>" },
  listeners: ["Kai<script>"],
  place: "the market square",
  time: "11:20, morning",
  said: [],
  lines: 3,
};
const STORY = { ...CHAT, kind: "story", who: ["elder", "pip"], speak: ["elder"], notes: { elder: "Kai's pet Bolt beat my Sage in a duel" }, listeners: ["Kai"], place: "the campfire", lines: 9 };
const REPLY = { lines: [{ who: "Mo", text: "Mo: Caught three fish at dawn today." }, { who: "ama", text: "Oh lovely, I'll make soup with them!" }, { who: "Mo", text: "Kai came to the picnic, you know." }] };
const day = new Date(1_700_000_000_000).toISOString().slice(0, 10);

describe("/api/banter", () => {
  it("parses the ask: villagers only, speakers among them, cleaned notes and names, a line count in range", () => {
    const a = parseBanterAsk(CHAT)!;
    expect(a).toMatchObject({ kind: "chat", who: ["mo", "ama"], speak: ["mo", "ama"], listeners: ["Kai script"], place: "the market square", lines: 3 });
    expect(a.notes.ama).toBe("fond of Kai b");
    expect(parseBanterAsk(STORY)!.lines).toBe(5);
    expect(parseBanterAsk({ ...CHAT, who: ["mo"] })).toBeNull(); // a chat needs two villagers
    expect(parseBanterAsk({ ...STORY, who: ["elder"], listeners: [] })).toBeNull(); // a story needs someone to listen
    expect(parseBanterAsk({ ...STORY, who: ["elder"], listeners: ["Kai"] })).not.toBeNull();
    expect(parseBanterAsk({ ...CHAT, speak: ["pip"] })).toBeNull(); // speakers come from the talk
    expect(parseBanterAsk({ ...CHAT, kind: "rap" })).toBeNull();
  });

  it("keeps only lines for the machine's own villagers, drops a name prefix, fits the room's line size", () => {
    const a = parseBanterAsk(CHAT)!;
    expect(validateBanter(REPLY, a)).toEqual([
      { who: "mo", text: "Caught three fish at dawn today." },
      { who: "ama", text: "Oh lovely, I'll make soup with them!" },
      { who: "mo", text: "Kai came to the picnic, you know." },
    ]);
    const one = parseBanterAsk({ ...CHAT, speak: ["mo"], lines: 1 })!;
    expect(validateBanter(REPLY, one)).toEqual([{ who: "mo", text: "Caught three fish at dawn today." }]);
    const long = validateBanter({ lines: [{ who: "Mo", text: "word ".repeat(40) }] }, a)!;
    expect(long[0]!.text.length).toBeLessThanOrEqual(BANTER_LINE_MAX);
    expect(validateBanter({ lines: [{ who: "Pip", text: "Hi there!" }] }, a)).toBeNull();
    expect(validateBanter({ text: "no lines" }, a)).toBeNull();
  });

  it("the prompt names the villagers, their notes, the place, and what to write", () => {
    const chat = banterPrompt(parseBanterAsk(CHAT)!);
    expect(chat).toContain("- Mo, the fisher");
    expect(chat).toContain("Mo's notes: 08:10 caught three fish");
    expect(chat).toContain("Place: the market square. Time: 11:20, morning.");
    expect(chat).toContain("Write the next 3 lines of their talk");
    const story = banterPrompt(parseBanterAsk(STORY)!);
    expect(story).toContain("Elder tells a short campfire story");
    expect(story).toContain("Players sitting with them: Kai");
    expect(story).not.toContain("react in their own voice"); // Pip is on another machine: only the Elder speaks here
  });

  it("asks Muse Spark Open once and books spend; never an error on a bad reply or over the cap", async () => {
    const h = harness();
    h.upstream.respond = async () => basetenReply("ok " + JSON.stringify(REPLY), 400, 250);
    const r = (await (await h.call("/api/banter", postJson(CHAT))).json()) as { source: string; lines: unknown[]; model: string };
    expect(r).toMatchObject({ source: "model", model: "meta-models/muse-spark-open-1026" });
    expect(r.lines).toHaveLength(3);
    expect((JSON.parse(String(h.upstream.calls[0]!.init.body)) as { max_tokens: number }).max_tokens).toBeLessThanOrEqual(BANTER_MAX_TOKENS);
    expect((await h.ledger.snapshot()).dailySpentUsd).toBeGreaterThan(0);
    h.upstream.respond = async () => basetenReply("no json");
    expect(await (await h.call("/api/banter", postJson(CHAT))).json()).toMatchObject({ source: "none", why: "invalid", lines: [] });
    const capped = harness();
    await capped.ghosts.put(`banter:spend:${day}`, String(BANTER_DAILY_USD));
    expect(await (await capped.call("/api/banter", postJson(CHAT))).json()).toMatchObject({ source: "none", why: "job_cap" });
    expect(capped.upstream.calls).toHaveLength(0);
    expect((await h.call("/api/banter", postJson({ kind: "chat", who: ["mo"] }))).status).toBe(400);
  });

  it("mock mode writes placeholder lines without an upstream call", async () => {
    const h = harness({ cfg: { mock: true } });
    const r = (await (await h.call("/api/banter", postJson(STORY))).json()) as { source: string; lines: { who: string; text: string }[] };
    expect(r.source).toBe("model");
    expect(r.lines[0]).toEqual({ who: "elder", text: "Let me tell you what happened today." });
    expect(h.upstream.calls).toHaveLength(0);
  });
});
